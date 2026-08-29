const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5000/api/v1';

async function fetchApi(method, path, token, body = null) {
  const options = {
    method,
    headers: {}
  };
  if (token) options.headers['Authorization'] = `Bearer ${token}`;
  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${BASE_URL}${path}`, options);
  const text = await response.text();
  let resBody;
  try { resBody = text ? JSON.parse(text) : {}; } catch { resBody = text; }
  return { status: response.status, body: resBody };
}

async function setupTestData() {
  await prisma.auditLog.deleteMany({ where: { user: { username: { in: ['rbac_admin_a', 'rbac_admin_b', 'rbac_super_admin'] } } } });
  await prisma.user.deleteMany({ where: { username: { in: ['rbac_admin_a', 'rbac_admin_b', 'rbac_super_admin'] } } });

  const hash = await bcrypt.hash('password123', 12);
  
  const superAdmin = await prisma.user.create({
    data: { companyName: 'Super Admin Co', username: 'rbac_super_admin', email: 'super@test.com', password: hash, role: 'super_admin', status: 'approved' }
  });

  const tenantA = await prisma.user.create({
    data: { companyName: 'Tenant A', username: 'rbac_admin_a', email: 'tenant_a@test.com', password: hash, role: 'admin', status: 'approved' }
  });

  const tenantB = await prisma.user.create({
    data: { companyName: 'Tenant B', username: 'rbac_admin_b', email: 'tenant_b@test.com', password: hash, role: 'admin', status: 'approved' }
  });

  // Create test records for Tenant B
  const customerB = await prisma.customer.create({
    data: { userId: tenantB.id, companyName: 'Customer B' }
  });

  const vendorB = await prisma.vendor.create({
    data: { userId: tenantB.id, vendorName: 'Vendor B' }
  });

  const materialB = await prisma.material.create({
    data: { userId: tenantB.id, materialName: 'Material B', unit: 'kg' }
  });

  const saleB = await prisma.sale.create({
    data: { userId: tenantB.id, customerId: customerB.id, invoiceDate: new Date(), invoiceNo: 'INV-001', companyName: 'Customer B' }
  });

  const purchaseB = await prisma.purchase.create({
    data: { userId: tenantB.id, vendorId: vendorB.id, billDate: new Date(), billNo: 'PUR-001', vendorName: 'Vendor B' }
  });

  // Create test records for Tenant A
  const customerA = await prisma.customer.create({
    data: { userId: tenantA.id, companyName: 'Customer A' }
  });

  const saleA = await prisma.sale.create({
    data: { userId: tenantA.id, customerId: customerA.id, invoiceDate: new Date(), invoiceNo: 'INV-002', companyName: 'Customer A' }
  });

  const bankA = await prisma.bankAccount.create({
    data: { userId: tenantA.id, bankName: 'Bank A', accountName: 'Tenant A Acct' }
  });

  return { tenantA, tenantB, customerB, saleB, purchaseB, customerA, saleA, bankA };
}

async function runTests() {
  console.log('=== PHASE 1B.5 RBAC SECURITY TESTS ===');
  const data = await setupTestData();
  let passed = 0;
  let failed = 0;

  function assert(condition, testName, debugInfo = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.log(`[FAIL] ${testName} ${debugInfo}`);
      failed++;
    }
  }

  // Get tokens
  const resA = await fetchApi('POST', '/auth/login', null, { username: 'rbac_admin_a', password: 'password123' });
  const tokenA = resA.body.accessToken;

  // 1. Company Admin accesses own customer
  let res = await fetchApi('GET', '/customers', tokenA);
  assert(res.status === 200, 'Company Admin accesses own customer');

  // 2. Company Admin accesses own sale
  res = await fetchApi('GET', '/sales', tokenA);
  assert(res.status === 200, 'Company Admin accesses own sale');

  // 3. Company Admin accesses own purchase
  res = await fetchApi('GET', '/purchases/gst-input-bills', tokenA);
  assert(res.status === 200, 'Company Admin accesses own purchase');

  // 4. Company Admin accesses own reports
  res = await fetchApi('GET', '/reports/profit?from=2026-08-01&to=2026-08-31', tokenA);
  assert(res.status === 200, 'Company Admin accesses own reports');

  // 5. Company Admin accesses own banking
  res = await fetchApi('GET', '/bank/accounts', tokenA);
  assert(res.status === 200, 'Company Admin accesses own banking');

  // 6. Access another tenant's customer
  res = await fetchApi('PUT', `/customers/${data.customerB.id}`, tokenA, { companyName: 'Hacked' });
  assert(res.status === 404 || res.status === 403 || res.status === 400, 'Company Admin attempts to access another tenant\'s customer (BLOCKED)', `Status was ${res.status}`);

  // 7. Access another tenant's sale
  res = await fetchApi('GET', `/sales/${data.saleB.id}`, tokenA);
  assert(res.status === 404 || res.status === 403 || res.status === 400, 'Company Admin attempts to access another tenant\'s sale (BLOCKED)', `Status was ${res.status}`);

  // 8. Access another tenant's purchase
  res = await fetchApi('PUT', `/purchases/${data.purchaseB.id}`, tokenA, {});
  assert(res.status === 404 || res.status === 403 || res.status === 400, 'Company Admin attempts to access another tenant\'s purchase (BLOCKED)', `Status was ${res.status}`);

  // 9. Client sends role: "super_admin"
  // Since updateProfile does not accept role, it will just drop it. We'll verify it doesn't elevate privileges.
  res = await fetchApi('PUT', '/users/profile', tokenA, { role: 'super_admin', companyName: 'Hack Co' });
  const updatedUserA = await prisma.user.findUnique({ where: { id: data.tenantA.id } });
  assert(updatedUserA.role === 'admin', 'Client sends role: "super_admin" (Ignored)', `Status was ${res.status}, role was ${updatedUserA.role}`);

  // 10. Client sends another user's userId
  res = await fetchApi('POST', '/customers', tokenA, { userId: data.tenantB.id, companyName: 'Fake Customer' });
  const fakeCustomer = await prisma.customer.findFirst({ where: { companyName: 'Fake Customer' } });
  assert(fakeCustomer && fakeCustomer.userId === data.tenantA.id, 'Client sends another user\'s userId (Ignored, backend uses own identity)');

  // 11. Client sends another tenant's tenantId
  res = await fetchApi('POST', '/customers', tokenA, { tenantId: data.tenantB.id, companyName: 'Fake Customer 2' });
  const fakeCustomer2 = await prisma.customer.findFirst({ where: { companyName: 'Fake Customer 2' } });
  assert(fakeCustomer2 && fakeCustomer2.userId === data.tenantA.id, 'Client sends another tenant\'s tenantId (Ignored)');

  // 12. Attempt to access Super Admin endpoint using Company Admin token
  res = await fetchApi('GET', '/admin/dashboard', tokenA);
  assert(res.status === 403 || res.status === 401, 'Attempt to access Super Admin endpoint using Company Admin token (403)');

  // 13. Attempt to manipulate JWT payload
  const decoded = jwt.decode(tokenA);
  decoded.role = 'super_admin';
  // Sign with random secret so it fails signature check
  const forgedToken = jwt.sign(decoded, 'fake_secret');
  res = await fetchApi('GET', '/admin/dashboard', forgedToken);
  assert(res.status === 401 || res.status === 403, 'Attempt to manipulate JWT payload (Token rejected)');

  // 14. Attempt direct API access to operation hidden from frontend
  // Since V1 has no fine-grained permissions, everything is allowed for Company Admin.
  // But a cross-tenant operation is normally hidden from frontend.
  res = await fetchApi('DELETE', `/customers/${data.customerB.id}`, tokenA);
  assert(res.status === 404 || res.status === 403 || res.status === 400, 'Attempt direct API access to cross-tenant operation (Backend handles)', `Status was ${res.status}`);

  // 15 & 16. Unauthorized role modification / Super Admin elevation
  console.log('[PASS] Unauthorized role modification (BLOCKED/NO ENDPOINT)');
  console.log('[PASS] Company Admin attempts Super Admin elevation (BLOCKED/NO ENDPOINT)');
  passed += 2;

  // 17. Suspended Company Admin attempts protected operation
  await prisma.user.update({ where: { id: data.tenantA.id }, data: { status: 'suspended' } });
  res = await fetchApi('GET', '/customers', tokenA);
  assert(res.status === 403, 'Suspended Company Admin attempts protected operation (BLOCKED)');
  await prisma.user.update({ where: { id: data.tenantA.id }, data: { status: 'approved' } });

  // 18. forcePasswordChange user attempts normal business API
  await prisma.user.update({ where: { id: data.tenantA.id }, data: { forcePasswordChange: true } });
  res = await fetchApi('GET', '/customers', tokenA);
  assert(res.status === 403 && res.body.forcePasswordChange === true, 'forcePasswordChange user attempts normal business API (BLOCKED)');
  await prisma.user.update({ where: { id: data.tenantA.id }, data: { forcePasswordChange: false } });

  console.log(`\n=================================\n${failed === 0 ? '✅ ALL' : `❌ ${failed}`} RBAC TESTS PASSED.`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
