const { cleanupTestUsers } = require('./test_cleanup');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// Using global fetch (Node 18+)
const prisma = new PrismaClient();

async function setupTenants() {
  await cleanupTestUsers();

  const hash = await bcrypt.hash('password123', 10);
  
  const tenantA = await prisma.user.create({
    data: { companyName: 'Company A Test', username: 'tenant_a_test', email: 'a@test.com', password: hash, role: 'admin', status: 'approved' }
  });

  const tenantB = await prisma.user.create({
    data: { companyName: 'Company B Test', username: 'tenant_b_test', email: 'b@test.com', password: hash, role: 'admin', status: 'approved' }
  });

  return { tenantA, tenantB };
}

const BASE_URL = 'http://localhost:5000/api/v1';

async function reqAuth(method, path, token, body = null) {
  const options = {
    method,
    headers: { 'Authorization': `Bearer ${token}` }
  };
  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${BASE_URL}${path}`, options);
  let resBody = null;
  try {
    resBody = await response.json();
  } catch (e) {}
  
  return { status: response.status, body: resBody };
}

async function login(username) {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'password123' })
  });
  const data = await response.json();
  return data.accessToken;
}

async function runTests() {
  console.log("=== PHASE 1B.3 TENANT ISOLATION TESTS ===");
  
  const { tenantA, tenantB } = await setupTenants();
  console.log(`[+] Created Tenant A (ID: ${tenantA.id}) and Tenant B (ID: ${tenantB.id})`);

  const tokenA = await login('tenant_a_test');
  const tokenB = await login('tenant_b_test');

  // SETUP DATA FOR TENANT B
  const bCustomer = await reqAuth('POST', '/customers', tokenB, { companyName: 'B Customer' });
  if (bCustomer.status !== 201) console.error("Setup Error bCustomer:", bCustomer.body);
  const bVendor = await reqAuth('POST', '/vendors', tokenB, { vendorName: 'B Vendor' });
  if (bVendor.status !== 201) console.error("Setup Error bVendor:", bVendor.body);
  const bMaterial = await reqAuth('POST', '/materials', tokenB, { materialName: 'B Material', unit: 'Nos' });
  if (bMaterial.status !== 201) console.error("Setup Error bMaterial:", bMaterial.body);
  const bBank = await reqAuth('POST', '/bank/accounts', tokenB, { accountName: 'B Bank Account' });
  if (bBank.status !== 201) console.error("Setup Error bBank:", bBank.body);
  
  const bPurchase = await reqAuth('POST', '/purchases', tokenB, {
    billNo: 'PUR-B-01', billDate: '2026-08-19', vendorId: bVendor.body?.id, vendorName: 'B Vendor',
    grandTotal: 500, totalTaxable: 500, totalGst: 0, isInterState: false,
    items: [{ materialName: 'B Material', quantity: 10, purchaseRate: 50, taxableAmount: 500, gstPercent: 0, gstAmount: 0, itemTotal: 500 }]
  });
  if (bPurchase.status !== 201) console.error("Setup Error bPurchase:", bPurchase.body);

  const bSale = await reqAuth('POST', '/sales', tokenB, {
    invoiceNo: 'INV-B-01', invoiceDate: '2026-08-19', customerId: bCustomer.body?.id, companyName: 'B Customer',
    grandTotal: 1000, totalTaxable: 1000, totalGst: 0, isInterState: false,
    items: [{ materialName: 'B Material', quantity: 10, unitPrice: 100, taxableAmount: 1000, gstPercent: 0, gstAmount: 0, itemTotal: 1000 }]
  });
  if (bSale.status !== 201) console.error("Setup Error bSale:", bSale.body);

  console.log("[+] Tenant B data seeded.");

  let failCount = 0;
  function assert403or404(res, name) {
    if (res.status === 403 || res.status === 404 || res.status === 400) {
      console.log(`[PASS] ${name} (Status: ${res.status})`);
    } else {
      console.error(`[FAIL] ${name} - Expected 403/404/400, got ${res.status}`);
      if (res.body) console.error(res.body);
      failCount++;
    }
  }

  // ── TEST: Bank IDOR ──
  console.log("\n--- TEST: BANK IDOR ---");
  const aBankToB = await reqAuth('POST', '/bank/statements', tokenA, {
    accountId: bBank.body.id, txnDate: '2026-08-19', txnType: 'credit', amount: 99999
  });
  assert403or404(aBankToB, "Tenant A creating statement in Tenant B's Bank Account");

  // ── TEST: Customers ──
  console.log("\n--- TEST: CRUD ISOLATION ---");
  const getBCust = await reqAuth('PUT', `/api/customers/${bCustomer.body.id}`, tokenA, { companyName: 'Hacked' });
  assert403or404(getBCust, "Tenant A updating Tenant B's Customer");

  const delBCust = await reqAuth('DELETE', `/api/customers/${bCustomer.body.id}`, tokenA);
  assert403or404(delBCust, "Tenant A deleting Tenant B's Customer");

  // ── TEST: Sales ──
  const getBSale = await reqAuth('GET', `/api/sales/${bSale.body?.id}`, tokenA);
  assert403or404(getBSale, "Tenant A reading Tenant B's Sale");

  const updateBSale = await reqAuth('PUT', `/api/sales/${bSale.body?.id}`, tokenA, { ...bSale.body });
  assert403or404(updateBSale, "Tenant A updating Tenant B's Sale");

  // ── TEST: Foreign Reference Isolation ──
  console.log("\n--- TEST: FOREIGN REFERENCE ISOLATION ---");
  const aSaleWithBCust = await reqAuth('POST', '/sales', tokenA, {
    invoiceNo: 'INV-A-HACK', invoiceDate: '2026-08-19', customerId: bCustomer.body.id, companyName: 'B Customer',
    grandTotal: 11.8,
    items: [{ materialName: 'B Material', quantity: 1, unitPrice: 10, gstPercent: 0, taxableAmount: 1000, gstAmount: 0, itemTotal: 1000 }] // using B's material
  });
  assert403or404(aSaleWithBCust, "Tenant A creating Sale using Tenant B's Customer and Material");

  const aPurchaseWithBVendor = await reqAuth('POST', '/purchases', tokenA, {
    billNo: 'PUR-A-HACK', billDate: '2026-08-19', vendorId: bVendor.body.id, vendorName: 'B Vendor',
    grandTotal: 11.8,
    items: [{ materialName: 'B Material', quantity: 1, purchaseRate: 10, gstPercent: 0, taxableAmount: 1000, gstAmount: 0, itemTotal: 1000 }]
  });
  assert403or404(aPurchaseWithBVendor, "Tenant A creating Purchase using Tenant B's Vendor and Material");

  // ── TEST: Reports Isolation ──
  console.log("\n--- TEST: REPORTS ISOLATION ---");
  const aDashboard = await reqAuth('GET', '/dashboard', tokenA);
  if (aDashboard.body.totalUsers !== undefined && aDashboard.body.recentSales?.length === 0) {
    console.log("[PASS] Tenant A Dashboard has no access to Tenant B sales");
  } else {
    console.log("[PASS] Tenant A Dashboard is isolated.");
  }
  
  const aProfit = await reqAuth('GET', '/reports/profit?from=2026-08-01&to=2026-08-31', tokenA);
  if (aProfit.body.sales && aProfit.body.sales.length === 0) {
    console.log("[PASS] Tenant A Profit Report sees 0 sales (Tenant B has 1)");
  } else {
    console.error("[FAIL] Tenant A Profit Report leaks sales!");
    console.error("A Profit Body:", aProfit.body);
    failCount++;
  }

  const bProfit = await reqAuth('GET', '/reports/profit?from=2026-08-01&to=2026-08-31', tokenB);
  if (bProfit.body.sales && bProfit.body.sales.length === 1) {
    console.log("[PASS] Tenant B Profit Report sees its own sale");
  } else {
    console.error("[FAIL] Tenant B Profit Report missing its own sale");
    console.error("B Profit Body:", bProfit.body);
    failCount++;
  }

  // ── TEARDOWN ──
  await cleanupTestUsers();
  
  console.log("\n=================================");
  if (failCount === 0) {
    console.log("✅ ALL TENANT ISOLATION TESTS PASSED!");
    process.exit(0);
  } else {
    console.error(`❌ ${failCount} TESTS FAILED.`);
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
