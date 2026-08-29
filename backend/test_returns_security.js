const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
const API = 'http://localhost:5000/api/v1';

async function req(method, path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`${API}${path}`, options);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        const error = new Error(`HTTP ${res.status}: ${JSON.stringify(data) || res.statusText}`);
        error.status = res.status; error.data = data; throw error;
    }
    return data;
}

let sub1Token = '';
let sub1Customer, sub1Vendor, sub1Material, sub1Purchase, sub1Sale;

async function setup() {
    console.log('--- SETUP RETURNS TEST ENVIRONMENT ---');
    const u = await prisma.user.findUnique({ where: { username: 'sub1_ret_admin' } });
    if (u) {
        await prisma.purchaseReturnItem.deleteMany({ where: { purchaseReturn: { purchase: { userId: u.id } } } });
        await prisma.purchaseReturn.deleteMany({ where: { purchase: { userId: u.id } } });
        await prisma.salesReturnItem.deleteMany({ where: { salesReturn: { sale: { userId: u.id } } } });
        await prisma.salesReturn.deleteMany({ where: { sale: { userId: u.id } } });
        await prisma.layerConsumption.deleteMany({ where: { userId: u.id } });
        await prisma.inventoryLayer.deleteMany({ where: { userId: u.id } });
        await prisma.inventoryLedger.deleteMany({ where: { userId: u.id } });
        await prisma.purchaseItem.deleteMany({ where: { purchase: { userId: u.id } } });
        await prisma.purchase.deleteMany({ where: { userId: u.id } });
        await prisma.salesReturnItem.deleteMany({ where: { salesReturn: { userId: u.id } } });
        await prisma.salesReturn.deleteMany({ where: { userId: u.id } });
        await prisma.purchaseReturnItem.deleteMany({ where: { purchaseReturn: { userId: u.id } } });
        await prisma.purchaseReturn.deleteMany({ where: { userId: u.id } });
        await prisma.saleItem.deleteMany({ where: { sale: { userId: u.id } } });
        await prisma.sale.deleteMany({ where: { userId: u.id } });
        await prisma.material.deleteMany({ where: { userId: u.id } });
        await prisma.customer.deleteMany({ where: { userId: u.id } });
        await prisma.vendor.deleteMany({ where: { userId: u.id } });
        await prisma.auditLog.deleteMany({ where: { userId: u.id } });
        await prisma.user.delete({ where: { id: u.id } });
    }
    const hash = await bcrypt.hash('Password123!', 12);
    const sub1 = await prisma.user.create({
        data: { companyName: 'Sub 1 Returns', username: 'sub1_ret_admin', email: 'sub1_ret@test.com', password: hash, role: 'admin', status: 'approved' }
    });
    
    const loginRes = await req('POST', '/auth/login', { username: 'sub1_ret_admin', password: 'Password123!' });
    sub1Token = loginRes.accessToken;

    sub1Customer = await req('POST', '/customers', { companyName: 'Sub1 Cust', email: 'c1@test.com', phone: '111', address: '111', isGstRegistered: false }, sub1Token);
    sub1Vendor = await req('POST', '/vendors', { vendorName: 'Sub1 Ven', email: 'v1@test.com', phone: '222', address: '222', isGstRegistered: false }, sub1Token);
    sub1Material = await req('POST', '/materials', { materialName: 'Return Item 1', category: 'Raw Material', unit: 'pcs', initialStock: 0, reorderLevel: 5, status: 'ACTIVE' }, sub1Token);
}

async function testPurchaseReturns() {
    console.log('\n--- TESTING PURCHASE RETURNS ---');
    sub1Purchase = await req('POST', '/purchases', { 
        vendorId: sub1Vendor.id, 
        vendorName: 'Sub1 Ven',
        billDate: new Date().toISOString().split('T')[0], 
        grandTotal: 1180,
        totalTaxable: 1000,
        totalGst: 180,
        items: [{ 
            materialName: 'Return Item 1', 
            quantity: 100, 
            purchaseRate: 10, 
            gstPercent: 18,
            taxableAmount: 1000,
            gstAmount: 180,
            itemTotal: 1180
        }] 
    }, sub1Token);
    const pi = sub1Purchase.items[0];
    const draftRes = await req('POST', '/purchase-returns', { purchaseId: sub1Purchase.id, returnDate: new Date().toISOString(), items: [{ purchaseItemId: pi.id, quantity: 20 }] }, sub1Token);
    let returnId = draftRes.id;
    if (draftRes.status !== 'DRAFT') throw new Error('Return should be DRAFT');
    console.log('Draft Purchase Return created successfully.');
    const finRes = await req('POST', `/purchase-returns/${returnId}/finalize`, {}, sub1Token);
    if (finRes.status !== 'POSTED') throw new Error('Return failed to POST');
    if (!finRes.debitNoteNo.startsWith('DBN-')) throw new Error('Invalid DBN number generated');
    console.log('Purchase Return Finalized. Generated DBN:', finRes.debitNoteNo);
    const m1 = await req('GET', '/materials', null, sub1Token);
    const stock = m1.find(m => m.id === sub1Material.id).currentStock;
    if (Number(stock) !== 80) throw new Error(`Stock mismatch after purchase return: ${stock} instead of 80`);
    console.log('Stock properly reduced to 80');
    try { await req('POST', '/purchase-returns', { purchaseId: sub1Purchase.id, returnDate: new Date().toISOString(), items: [{ purchaseItemId: pi.id, quantity: 90 }] }, sub1Token); throw new Error('Over return allowed!'); } catch (e) { if (e.status === 400) console.log('Over return successfully blocked.'); else throw e; }
    const cancelRes = await req('POST', `/purchase-returns/${returnId}/cancel`, {}, sub1Token);
    if (cancelRes.status !== 'CANCELLED') throw new Error('Cancellation failed');
    const m2 = await req('GET', '/materials', null, sub1Token);
    const stock2 = m2.find(m => m.id === sub1Material.id).currentStock;
    if (Number(stock2) !== 100) throw new Error(`Stock mismatch after purchase return cancellation: ${stock2} instead of 100`);
    console.log('Purchase Return successfully cancelled. Stock restored to 100.');
}

async function testSalesReturns() {
    console.log('\n--- TESTING SALES RETURNS ---');
    sub1Sale = await req('POST', '/sales', { 
        customerId: sub1Customer.id, 
        companyName: 'Sub1 Cust',
        invoiceDate: new Date().toISOString().split('T')[0], 
        grandTotal: 944,
        totalTaxable: 800,
        totalGst: 144,
        items: [{ 
            materialName: 'Return Item 1', 
            quantity: 40, 
            unitPrice: 20, 
            gstPercent: 18,
            taxableAmount: 800,
            gstAmount: 144,
            itemTotal: 944
        }] 
    }, sub1Token);
    const si = sub1Sale.items[0];
    const draftRes = await req('POST', '/sales-returns', { saleId: sub1Sale.id, returnDate: new Date().toISOString(), items: [{ saleItemId: si.id, quantity: 15 }] }, sub1Token);
    let returnId = draftRes.id;
    console.log('Draft Sales Return created successfully.');
    const finRes = await req('POST', `/sales-returns/${returnId}/finalize`, {}, sub1Token);
    if (finRes.status !== 'POSTED') throw new Error('Return failed to POST');
    if (!finRes.creditNoteNo.startsWith('CRN-')) throw new Error('Invalid CRN number generated');
    console.log('Sales Return Finalized. Generated CRN:', finRes.creditNoteNo);
    const m1 = await req('GET', '/materials', null, sub1Token);
    const stock = m1.find(m => m.id === sub1Material.id).currentStock;
    if (Number(stock) !== 75) throw new Error(`Stock mismatch after sales return: ${stock} instead of 75`);
    console.log('Stock properly increased to 75');
    try { await req('POST', '/sales-returns', { saleId: sub1Sale.id, returnDate: new Date().toISOString(), items: [{ saleItemId: si.id, quantity: 30 }] }, sub1Token); throw new Error('Over return allowed!'); } catch (e) { if (e.status === 400) console.log('Over return successfully blocked.'); else throw e; }
    const cancelRes = await req('POST', `/sales-returns/${returnId}/cancel`, {}, sub1Token);
    if (cancelRes.status !== 'CANCELLED') throw new Error('Cancellation failed');
    const m2 = await req('GET', '/materials', null, sub1Token);
    const stock2 = m2.find(m => m.id === sub1Material.id).currentStock;
    if (Number(stock2) !== 60) throw new Error(`Stock mismatch after sales return cancellation: ${stock2} instead of 60`);
    console.log('Sales Return successfully cancelled. Stock reversed to 60.');
}

async function runAll() {
    await setup();
    await testPurchaseReturns();
    await testSalesReturns();
    console.log('\n✅ ALL RETURN INTEGRITY TESTS PASSED!');
    process.exit(0);
}
runAll().catch(e => {
    console.error('\n❌ TEST FAILED:', e.data || e.message);
    process.exit(1);
});
