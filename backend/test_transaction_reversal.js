const fetch = globalThis.fetch;

const API_BASE = 'http://localhost:5000/api/v1';

async function getStock(authHeaders, materialId) {
    const mats = await (await fetch(`${API_BASE}/materials`, { headers: authHeaders })).json();
    const mat = (mats.data || mats).find(m => m.id === materialId);
    return Number(mat.currentStock);
}

async function runTests() {
  console.log('--- RUNNING TRANSACTION REVERSAL TEST SUITE ---');

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('password123', 12);
  await prisma.user.create({
    data: { companyName: 'Rev Corp', username: 'reversalt', email: 'reversalt@test.com', password: hash, role: 'admin', status: 'approved' }
  });


  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'reversalt', password: 'password123' })
  });
  if (!loginRes.ok) throw new Error('Login failed');
  const token = (await loginRes.json()).accessToken;
  const authHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const matRes = await fetch(`${API_BASE}/materials`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ materialName: 'ReversalTestMat_' + Date.now(), hsnCode: '1234', unit: 'Nos', currentStock: 0 })
  });
  const material = await matRes.json();
  const materialId = material.id;
  console.log('Material created:', materialId);

  const purReq = {
    billNo: 'PUR-REV-01-' + Date.now(),
    billDate: new Date().toISOString().split('T')[0],
    vendorName: 'Rev Vendor',
    items: [ { materialId, materialName: material.materialName, quantity: 10, unitPrice: 100, gstPercent: 0, taxableAmount: 1000, gstAmount: 0, itemTotal: 1000 } ],
    otherExpense: 0, roundOff: 0, grandTotal: 1000, totalTaxable: 1000, totalGst: 0
  };
  const purRes = await fetch(`${API_BASE}/purchases`, { method: 'POST', headers: authHeaders, body: JSON.stringify(purReq) });
  if (!purRes.ok) throw new Error('Purchase failed: ' + await purRes.text());
  const purchase = await purRes.json();
  console.log('Purchase created:', purchase.id);

  let stock = await getStock(authHeaders, materialId);
  if (stock !== 10) throw new Error('Stock should be 10 after purchase, got: ' + stock);

  const saleReq = {
    invoiceDate: new Date().toISOString().split('T')[0],
    companyName: 'Rev Customer',
    isInterState: false,
    items: [ { materialId, materialName: material.materialName, quantity: 4, unitPrice: 200, gstPercent: 0, taxableAmount: 800, gstAmount: 0, itemTotal: 800 } ],
    otherExpense: 0, roundOff: 0, grandTotal: 800, totalTaxable: 800, totalGst: 0
  };
  const saleRes = await fetch(`${API_BASE}/sales`, { method: 'POST', headers: authHeaders, body: JSON.stringify(saleReq) });
  if (!saleRes.ok) throw new Error('Sale failed: ' + await saleRes.text());
  const sale = await saleRes.json();
  console.log('Sale created:', sale.id);

  stock = await getStock(authHeaders, materialId);
  if (stock !== 6) throw new Error('Stock should be 6 after sale, got: ' + stock);

  const cancelPurFailRes = await fetch(`${API_BASE}/purchases/${purchase.id}/cancel`, { method: 'POST', headers: authHeaders });
  if (cancelPurFailRes.status !== 400) throw new Error('Purchase cancellation blocked failed. Status: ' + cancelPurFailRes.status + ' Text: ' + await cancelPurFailRes.text());
  console.log('Purchase cancellation blocked (success)');

  const cancelSaleRes = await fetch(`${API_BASE}/sales/${sale.id}/cancel`, { method: 'POST', headers: authHeaders });
  if (!cancelSaleRes.ok) throw new Error('Sale cancellation failed: ' + await cancelSaleRes.text());
  console.log('Sale cancelled');

  const saleCheckRes = await fetch(`${API_BASE}/sales/${sale.id}`, { headers: authHeaders });
  const saleCheck = await saleCheckRes.json();
  if (saleCheck.status !== 'CANCELLED') throw new Error('Sale status not updated to CANCELLED');

  stock = await getStock(authHeaders, materialId);
  if (stock !== 10) throw new Error('Stock should be restored to 10 after sale cancellation, got: ' + stock);

  const doubleCancelRes = await fetch(`${API_BASE}/sales/${sale.id}/cancel`, { method: 'POST', headers: authHeaders });
  const msg = await doubleCancelRes.json();
  if (msg.message !== 'Sale is already cancelled.') throw new Error('Sale double cancellation not handled safely');
  console.log('Sale double-cancellation checked');

  const cancelPurRes = await fetch(`${API_BASE}/purchases/${purchase.id}/cancel`, { method: 'POST', headers: authHeaders });
  if (!cancelPurRes.ok) throw new Error('Purchase cancellation failed: ' + await cancelPurRes.text());
  console.log('Purchase cancelled');

  stock = await getStock(authHeaders, materialId);
  if (stock !== 0) throw new Error('Stock should be 0 after purchase cancellation, got: ' + stock);

  console.log('--- ALL REVERSAL TESTS PASSED ---');
}

runTests().catch(err => { console.error(err); process.exit(1); });
