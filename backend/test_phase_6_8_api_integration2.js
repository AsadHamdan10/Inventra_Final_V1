const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const API = 'http://localhost:5000/api/v1';

async function fetchJSON(url, options) {
    const res = await fetch(url, options);
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch(e) { throw new Error('Failed to parse JSON: ' + res.status + ' ' + text); }
    return { status: res.status, ok: res.ok, data: json };
}

async function run() {
    let t1;
    try {
        console.log('=== PHASE 6.8 API INTEGRATION E2E ===');
        const ts = Date.now();
        const p1 = await bcrypt.hash('Pass123', 10);
        t1 = await prisma.user.create({ data: { username: 't1_api_' + ts, companyName: 'T1 API', email: 't1api_' + ts + '@test.com', status: 'active', plan: 'PROFESSIONAL', role: 'admin', applicationRef: 'T1-' + ts, password: p1 }});
        
        const { initializeDefaultCOA } = require('./src/services/accounting/coaService');
        await initializeDefaultCOA(t1.id);
        
        const fy = await prisma.financialYear.create({
            data: { userId: t1.id, name: '2026-27', startDate: new Date('2026-04-01'), endDate: new Date('2027-03-31'), status: 'OPEN' }
        });
        await prisma.accountingPeriod.create({
            data: { userId: t1.id, financialYearId: fy.id, periodNumber: 1, name: 'Apr 2026', startDate: new Date('2026-04-01'), endDate: new Date('2027-03-31'), status: 'OPEN' }
        });

        const l1 = await fetchJSON(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 't1_api_' + ts, password: 'Pass123' }) });
        const tk1 = l1.data.accessToken;
        const h1 = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk1 };

        const wh1Req = await fetchJSON(API + '/inventory/warehouses', { method: 'POST', headers: h1, body: JSON.stringify({ code: 'T1-W1', name: 'T1 Warehouse', warehouseType: 'GENERAL' }) });
        const wh1 = wh1Req.data.data;
        
        const v1 = (await fetchJSON(API + '/vendors', { method: 'POST', headers: h1, body: JSON.stringify({ vendorName: 'T1 Vendor', email: 'v1@t1.com', status: 'ACTIVE' }) })).data.data || (await fetchJSON(API + '/vendors', { method: 'POST', headers: h1, body: JSON.stringify({ vendorName: 'T1 Vendor', email: 'v1@t1.com', status: 'ACTIVE' }) })).data;
        const c1 = (await fetchJSON(API + '/customers', { method: 'POST', headers: h1, body: JSON.stringify({ customerName: 'T1 Customer', companyName: 'T1 Customer', email: 'c1@t1.com', status: 'ACTIVE' }) })).data.data || (await fetchJSON(API + '/customers', { method: 'POST', headers: h1, body: JSON.stringify({ customerName: 'T1 Customer', companyName: 'T1 Customer', email: 'c1@t1.com', status: 'ACTIVE' }) })).data;
        const m1 = (await fetchJSON(API + '/materials', { method: 'POST', headers: h1, body: JSON.stringify({ itemType: 'FINISHED_GOOD', materialName: 'Laptop', hsnCode: '8471', unit: 'NOS', standardPrice: 50000, standardCost: 40000, inventoryTracked: true, purchaseEnabled: true, salesEnabled: true, gstRate: 18, taxability: 'TAXABLE' }) })).data;
        const mData = m1.data || m1;
        const vData = v1.data || v1;
        const cData = c1.data || c1;

        const grnReq = await fetchJSON(API + '/goods-receipts', { method: 'POST', headers: h1, body: JSON.stringify({
            vendorId: vData.id, warehouseId: wh1.id, grnDate: new Date().toISOString(), deliveryChallanNo: 'CH-1',
            items: [{ materialId: mData.id, receivedQty: 10, unitPrice: 40000 }]
        })});
        if (!grnReq.ok) throw new Error('GRN creation failed: ' + JSON.stringify(grnReq.data));
        console.log('GRN Minimal Payload Works');

        const grnPostReq = await fetchJSON(API + '/goods-receipts/' + grnReq.data.id + '/status', { method: 'PATCH', headers: h1, body: JSON.stringify({ status: 'POSTED' }) });
        if (!grnPostReq.ok) throw new Error('GRN POST failed: ' + JSON.stringify(grnPostReq.data));
        
        const saleReq = await fetchJSON(API + '/sales', { method: 'POST', headers: h1, body: JSON.stringify({
            customerId: cData.id, invoiceDate: new Date().toISOString(),
            items: [{ materialId: mData.id, warehouseId: wh1.id, quantity: 2, unitPrice: 50000, gstPercent: 18 }]
        })});
        if (!saleReq.ok) throw new Error('Sale creation failed: ' + JSON.stringify(saleReq.data));
        
        const sale = saleReq.data.data;
        console.log('Sales Payload Works, totals:', sale.totalTaxable, sale.totalGst, sale.grandTotal);
        
        if (Number(sale.totalTaxable) !== 100000) throw new Error('Taxable total wrong');
        if (Number(sale.grandTotal) !== 118000) throw new Error('Grand total wrong');

        console.log('ALL TESTS PASSED SUCCESSFULLY.');
    } catch(e) {
        console.error('Test failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}
run();
