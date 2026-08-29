const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const API = 'http://localhost:5000/api/v1';
const bcrypt = require('bcryptjs');

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
let sub2Token = '';
let cust1Id, vend1Id, sale1Id, pur1Id;
let cust2Id, vend2Id, sale2Id, pur2Id;

async function setup() {
    const hash = await bcrypt.hash('Password123!', 10);
    
    // Clear specifically to avoid unique constraints
    // (This requires executing carefully so we don't break the database)
    const u1 = await prisma.user.findFirst({where:{email:'ledger1@t.com'}}) || await prisma.user.create({
        data: { username: 'ledger1', email: 'ledger1@t.com', companyName: 'L1', password: hash, status: 'approved', plan: 'YEARLY', role: 'admin' }
    });
    const u2 = await prisma.user.findFirst({where:{email:'ledger2@t.com'}}) || await prisma.user.create({
        data: { username: 'ledger2', email: 'ledger2@t.com', companyName: 'L2', password: hash, status: 'approved', plan: 'YEARLY', role: 'admin' }
    });

    await prisma.customerPaymentAllocation.deleteMany({});
    await prisma.vendorPaymentAllocation.deleteMany({});
    await prisma.customerPayment.deleteMany({});
    await prisma.vendorPayment.deleteMany({});
    await prisma.sale.updateMany({ data: { paymentReceived: 0 } });
    await prisma.purchase.updateMany({ data: { paymentPaid: 0 } });

    const r1 = await req('POST', '/auth/login', { username: 'ledger1', password: 'Password123!' });
    sub1Token = r1.accessToken;

    const r2 = await req('POST', '/auth/login', { username: 'ledger2', password: 'Password123!' });
    sub2Token = r2.accessToken;

    const c1 = await prisma.customer.findFirst({where:{userId:u1.id}}) || await prisma.customer.create({ data: { userId: u1.id, companyName: 'C1' } }); cust1Id = c1.id;
    const c2 = await prisma.customer.findFirst({where:{userId:u2.id}}) || await prisma.customer.create({ data: { userId: u2.id, companyName: 'C2' } }); cust2Id = c2.id;
    
    const v1 = await prisma.vendor.findFirst({where:{userId:u1.id}}) || await prisma.vendor.create({ data: { userId: u1.id, vendorName: 'V1' } }); vend1Id = v1.id;
    const v2 = await prisma.vendor.findFirst({where:{userId:u2.id}}) || await prisma.vendor.create({ data: { userId: u2.id, vendorName: 'V2' } }); vend2Id = v2.id;

    const s1 = await prisma.sale.findFirst({where:{userId:u1.id, status:'FINALIZED'}}) || await prisma.sale.create({ data: { userId: u1.id, customerId: c1.id, invoiceNo: 'S1', invoiceDate: new Date(), companyName: 'C1', grandTotal: 500, status: 'FINALIZED', totalTaxable: 500, totalGst: 0 } }); sale1Id = s1.id;
    const s2 = await prisma.sale.findFirst({where:{userId:u2.id, status:'FINALIZED'}}) || await prisma.sale.create({ data: { userId: u2.id, customerId: c2.id, invoiceNo: 'S2', invoiceDate: new Date(), companyName: 'C2', grandTotal: 500, status: 'FINALIZED', totalTaxable: 500, totalGst: 0 } }); sale2Id = s2.id;

    const p1 = await prisma.purchase.findFirst({where:{userId:u1.id, status:'FINALIZED'}}) || await prisma.purchase.create({ data: { userId: u1.id, vendorId: v1.id, billNo: 'P1', billDate: new Date(), vendorName: 'V1', grandTotal: 500, status: 'FINALIZED', totalTaxable: 500, totalGst: 0 } }); pur1Id = p1.id;
    const p2 = await prisma.purchase.findFirst({where:{userId:u2.id, status:'FINALIZED'}}) || await prisma.purchase.create({ data: { userId: u2.id, vendorId: v2.id, billNo: 'P2', billDate: new Date(), vendorName: 'V2', grandTotal: 500, status: 'FINALIZED', totalTaxable: 500, totalGst: 0 } }); pur2Id = p2.id;
}

async function runTests() {
    console.log("--- RUNNING PHASE 3.3 LEDGER SECURITY TESTS ---");
    let passed = 0, failed = 0;

    async function assertThrows(promise, expectedStatus) {
        try { await promise; failed++; console.error(`❌ Expected error ${expectedStatus}, but succeeded.`); } 
        catch (e) {
            if (e.status === expectedStatus || (!expectedStatus && e.status)) { passed++; console.log(`✅ Passed expected error: ${e.message}`); }
            else { failed++; console.error(`❌ Expected error ${expectedStatus}, got ${e.status}: ${e.message}`); }
        }
    }

    async function assertSuccess(promise) {
        try { await promise; passed++; console.log(`✅ Passed success.`); } 
        catch (e) { failed++; console.error(`❌ Unexpected error: ${e.message}`); }
    }

    if (!sub1Token) await setup();

    console.log("1. Unauthenticated Payment Rejected");
    await assertThrows(req('POST', '/customer-payments', { customerId: cust1Id, amount: 100, paymentDate: '2026-01-01' }), 401);

    console.log("2. Unauthenticated Ledger Rejected");
    await assertThrows(req('GET', `/customer-payments/customer/${cust1Id}/ledger`), 401);

    console.log("3. Cross-Tenant Customer Payment Blocked");
    await assertThrows(req('POST', '/customer-payments', { customerId: cust1Id, amount: 100, paymentDate: '2026-01-01' }, sub2Token), 403);

    console.log("4. Cross-Tenant Vendor Payment Blocked");
    await assertThrows(req('POST', '/vendor-payments', { vendorId: vend1Id, amount: 100, paymentDate: '2026-01-01' }, sub2Token), 403);

    console.log("5. Cross-Tenant Invoice Allocation Blocked");
    await assertThrows(req('POST', '/customer-payments', { customerId: cust2Id, amount: 100, paymentDate: '2026-01-01', allocations: [{saleId: sale1Id, amount: 100}] }, sub2Token), 404);

    console.log("7. Customer Payment Creation (Advance)");
    await assertSuccess(req('POST', '/customer-payments', { customerId: cust1Id, amount: 500, paymentDate: '2026-01-01' }, sub1Token));

    console.log("8. Vendor Payment Creation (Advance)");
    await assertSuccess(req('POST', '/vendor-payments', { vendorId: vend1Id, amount: 500, paymentDate: '2026-01-01' }, sub1Token));

    console.log("9. Partial Payment with Invoice");
    await assertSuccess(req('POST', '/customer-payments', { customerId: cust1Id, amount: 500, paymentDate: '2026-02-02', allocations: [{saleId: sale1Id, amount: 500}] }, sub1Token));

    console.log("13. Over-allocation Rejected");
    await assertThrows(req('POST', '/customer-payments', { customerId: cust1Id, amount: 5000, paymentDate: '2026-02-02', allocations: [{saleId: sale1Id, amount: 5000}] }, sub1Token), 400);

    console.log("14. Negative amount rejected");
    await assertThrows(req('POST', '/customer-payments', { customerId: cust1Id, amount: -100, paymentDate: '2026-02-02' }, sub1Token), 400);

    console.log("27. Customer Opening Balance (Admin allowed)");
    await assertSuccess(req('POST', `/customer-payments/customer/${cust1Id}/opening-balance`, { amount: 1000 }, sub1Token)); 

    console.log(`TOTAL: ${passed + failed}, PASSED: ${passed}, FAILED: ${failed}`);
    if (failed > 0) process.exit(1);
}
runTests().then(() => console.log('Done.')).catch(console.error);
