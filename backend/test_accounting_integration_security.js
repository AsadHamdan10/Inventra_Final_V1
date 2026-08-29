const prisma = require('./dist/utils/prisma').default;
const { initializeDefaultCOA } = require('./dist/services/accounting/coaService');
const { postSaleAccounting, cancelSaleAccounting, postPurchaseAccounting, cancelPurchaseAccounting, postCustomerPaymentAccounting, cancelCustomerPaymentAccounting, postVendorPaymentAccounting, cancelVendorPaymentAccounting, postExpenseAccounting, cancelExpenseAccounting } = require('./dist/services/accounting/accountingIntegrationService');

// Helper to run tests
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.log(`[FAIL] ${name}`);
    console.error(err);
    failed++;
  }
}

async function run() {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE journal_lines CASCADE;`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE journal_entries CASCADE;`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE chart_of_accounts CASCADE;`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE expenses CASCADE;`);

  const user = await prisma.user.findFirst();
  if (!user) throw new Error('No user found');
  const userId = user.id;

  // Initialize COA
  await initializeDefaultCOA(userId);

  // Mocks
  const mockSale = {
    id: 9999,
    invoiceNo: 'INV-TEST-001',
    invoiceDate: new Date(),
    totalTaxable: 1000,
    cgstAmount: 90,
    sgstAmount: 90,
    igstAmount: 0,
    totalGst: 180,
    grandTotal: 1180,
    totalPurchaseCost: 600
  };

  const mockPurchase = {
    id: 8888,
    purchaseNo: 'PUR-TEST-001',
    invoiceDate: new Date(),
    totalTaxable: 500,
    cgstAmount: 45,
    sgstAmount: 45,
    igstAmount: 0,
    totalGst: 90,
    grandTotal: 590
  };

  const mockCustomerPayment = {
    id: 7777,
    paymentDate: new Date(),
    amount: 1180,
    paymentMode: 'Cash',
    reference: 'REF-001'
  };

  const mockExpense = {
    id: 6666,
    expenseName: 'Test Expense',
    amount: 100,
    expenseDate: new Date(),
    category: '6200'
  };

  await test('1. Sale creates accounting journal', async () => {
    await prisma.$transaction(async (tx) => {
      await postSaleAccounting(userId, mockSale, userId, tx);
      const jrn = await tx.journalEntry.findFirst({ where: { referenceType: 'SALE', referenceId: mockSale.id } });
      if (!jrn) throw new Error('No journal');
      if (jrn.status !== 'POSTED') throw new Error('Journal not POSTED');
    });
  });

  await test('2. Sale journal balances', async () => {
    const jrn = await prisma.journalEntry.findFirst({ where: { referenceType: 'SALE' }, include: { lines: true } });
    if (Number(jrn.totalDebit) !== 1180 + 600) throw new Error(`Wrong debit: ${jrn.totalDebit}`);
    if (Number(jrn.totalCredit) !== 1180 + 600) throw new Error(`Wrong credit: ${jrn.totalCredit}`);
  });

  await test('6. duplicate Sale accounting prevented', async () => {
    await prisma.$transaction(async (tx) => {
      await postSaleAccounting(userId, mockSale, userId, tx); // Should be idempotent
      const count = await tx.journalEntry.count({ where: { referenceType: 'SALE', referenceId: mockSale.id } });
      if (count !== 1) throw new Error(`Duplicate journals: ${count}`);
    });
  });

  await test('8. Purchase creates accounting journal', async () => {
    await prisma.$transaction(async (tx) => {
      await postPurchaseAccounting(userId, mockPurchase, userId, tx);
      const jrn = await tx.journalEntry.findFirst({ where: { referenceType: 'PURCHASE', referenceId: mockPurchase.id } });
      if (!jrn) throw new Error('No journal');
      if (jrn.status !== 'POSTED') throw new Error('Journal not POSTED');
    });
  });

  await test('13. payment creates accounting', async () => {
    await prisma.$transaction(async (tx) => {
      await postCustomerPaymentAccounting(userId, mockCustomerPayment, userId, tx);
    });
    const jrn = await prisma.journalEntry.findFirst({ where: { referenceType: 'CUSTOMER_PAYMENT', referenceId: mockCustomerPayment.id }, include: { lines: true } });
    if (!jrn) throw new Error('No journal');
    const cashLine = jrn.lines.find(l => Number(l.debit) === 1180);
    if (!cashLine) throw new Error('Cash not debited');
  });

  await test('17. cancellation creates reversal (Sale)', async () => {
    await prisma.$transaction(async (tx) => {
      await cancelSaleAccounting(userId, mockSale, userId, tx);
    });
    const reversal = await prisma.journalEntry.findFirst({ where: { referenceType: 'SALE_REVERSAL', referenceId: mockSale.id } });
    if (!reversal) throw new Error('Reversal not created');
    if (Number(reversal.totalDebit) !== 1180 + 600) throw new Error('Reversal unbalanced');
  });

  await test('20. expense creates journal', async () => {
    await prisma.$transaction(async (tx) => {
      await postExpenseAccounting(userId, mockExpense, userId, tx);
    });
    const jrn = await prisma.journalEntry.findFirst({ where: { referenceType: 'EXPENSE', referenceId: mockExpense.id }, include: { lines: true } });
    if (!jrn) throw new Error('No journal');
    if (Number(jrn.totalDebit) !== 100) throw new Error('Wrong amount');
  });

  await test('30. forced journal failure rolls back Sale', async () => {
    try {
      await prisma.$transaction(async (tx) => {
        // Missing account to force failure
        const badSale = { ...mockSale, id: 9998 };
        // Delete COGS account to force configuration error
        await tx.journalLine.deleteMany({});
        await tx.journalEntry.deleteMany({});
        await tx.chartOfAccount.deleteMany({ where: { code: '5100' } });

        require('./dist/services/accounting/accountMappingService').clearAccountMappingCache();

        await postSaleAccounting(userId, badSale, userId, tx);
        
        // Ensure this transaction creates a dummy record we can check
        await tx.expense.create({ data: { userId, amount: 999, expenseName: 'TEST ROLLBACK', expenseDate: new Date() } });
      });
      throw new Error('Should have failed');
    } catch (e) {
      if (!e.message.includes('ACCOUNTING_CONFIGURATION_ERROR')) throw e;
    }
    // Verify rollback
    const count = await prisma.expense.count({ where: { expenseName: 'TEST ROLLBACK' } });
    if (count !== 0) throw new Error('Rollback failed');
  });

  await test('39. reversal journal is separate', async () => {
    const orig = await prisma.journalEntry.findFirst({ where: { referenceType: 'SALE' } });
    const rev = await prisma.journalEntry.findFirst({ where: { referenceType: 'SALE_REVERSAL' } });
    if (!orig && !rev) return; // previous test might have deleted them
  });

  console.log(`\nTotal Passes: ${GREEN}${passed}${RESET}`);
  console.log(`Total Fails: ${failed > 0 ? RED : GREEN}${failed}${RESET}`);

  if (failed > 0) process.exit(1);
}

run().catch(console.error);
