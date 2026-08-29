const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { createSaleInternal } = require('./dist/controllers/saleController');
const { closeAccountingPeriod, reopenAccountingPeriod } = require('./dist/services/financialPeriodService');

async function run() {
    console.log('--- RUNNING test_backdated.js ---');
    const user = await prisma.user.findFirst();
    const userId = user.id;
    const customer = await prisma.customer.findFirst({ where: { userId } });
    const material = await prisma.material.findFirst({ where: { userId } });

    const april = await prisma.accountingPeriod.findFirst({ where: { userId, name: 'April 2026' } });
    const may = await prisma.accountingPeriod.findFirst({ where: { userId, name: 'May 2026' } });

    await reopenAccountingPeriod(userId, april.id);
    await reopenAccountingPeriod(userId, may.id);
    await closeAccountingPeriod(userId, april.id, userId); // April is Closed

    let passes = 0;

    // Sale in April (Closed)
    try {
        await createSaleInternal(userId, customer.id, '2026-04-30T10:00:00.000Z', undefined, undefined, undefined, undefined, [{ materialId: material.id, quantity: 1, unitPrice: 10, gstPercent: 0 }], prisma);
        console.error('[FAIL] Sale in April allowed!');
    } catch(e) {
        if (e.code === 'FINANCIAL_PERIOD_CLOSED') {
            passes++;
            console.log('[PASS] Sale in April correctly rejected.');
        } else {
            console.error(e);
        }
    }

    // Sale in May (Open)
    try {
        await createSaleInternal(userId, customer.id, '2026-05-01T10:00:00.000Z', undefined, undefined, undefined, undefined, [{ materialId: material.id, quantity: 1, unitPrice: 10, gstPercent: 0 }], prisma);
        passes++;
        console.log('[PASS] Sale in May allowed.');
    } catch(e) {
        console.error('[FAIL] Sale in May rejected:', e);
    }

    // Clean up
    await reopenAccountingPeriod(userId, april.id);
    console.log(`\nSUCCESS: Passed ${passes}/2 backdated tests.`);
    process.exit(0);
}
run();
