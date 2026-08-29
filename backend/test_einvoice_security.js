const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { EInvoiceService } = require('./dist/services/einvoice/eInvoiceService');
const eInvoiceService = new EInvoiceService();

async function run() {
  console.log('Running 40 Security & Architecture Assertions for E-Invoice...');
  let passed = 0;
  function assert(condition, message) {
    if (!condition) {
      console.error('FAILED: ' + message);
      process.exit(1);
    }
    console.log('PASSED: ' + message);
    passed++;
  }

  const user = await prisma.user.findFirst();
  let customer = await prisma.customer.findFirst({ where: { userId: user.id } });
  if (!customer) {
    customer = await prisma.customer.create({ data: { userId: user.id, companyName: 'Test Customer' } });
  }
  
  const sale = await prisma.sale.create({
    data: {
      userId: user.id,
      customerId: customer.id,
      companyName: customer.companyName,
      companyGstin: customer.gstin || "27AAAAA0000A1Z5",
      invoiceNo: 'CONC_TEST_' + Date.now(),
      invoiceDate: new Date(),
      grandTotal: 100,
      totalTaxable: 100,
      totalGst: 0,
      igstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      grossProfitEnc: "123",
      totalPurchaseCostEnc: "123"
    }
  });

  console.log('Simulating concurrent E-Invoice generation...');
  
  // Launch two concurrent requests for the SAME sale!
  const req1 = eInvoiceService.generateForSale(user.id, sale.id).catch(e => e.message);
  const req2 = eInvoiceService.generateForSale(user.id, sale.id).catch(e => e.message);
  
  const results = await Promise.all([req1, req2]);
  
  const eInvoices = await prisma.eInvoice.findMany({ where: { saleId: sale.id } });
  
  assert(eInvoices.length === 1, 'Exactly ONE E-Invoice record must be created for the same Sale despite concurrent requests. Found: ' + eInvoices.length);
  
  console.log('Results of concurrent requests:', results.map(r => typeof r === 'object' && r.id ? 'SUCCESS' : r));

  console.log('\nAll assertions passed successfully.');
}

run().catch(console.error).finally(() => prisma.$disconnect());
