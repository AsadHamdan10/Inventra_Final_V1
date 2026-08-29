const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { assertFinancialPeriodOpen, closeAccountingPeriod, reopenAccountingPeriod } = require('./dist/services/financialPeriodService');

async function run() {
    console.log('--- RUNNING test_closed_periods.js ---');
    const user = await prisma.user.findFirst();
    const userId = user.id;

    const april = await prisma.accountingPeriod.findFirst({ where: { userId, name: 'April 2026' } });
    const may = await prisma.accountingPeriod.findFirst({ where: { userId, name: 'May 2026' } });

    let passes = 0;

    // Ensure they are open
    await reopenAccountingPeriod(userId, april.id);
    await reopenAccountingPeriod(userId, may.id);

    // 1. Close April
    await closeAccountingPeriod(userId, april.id, userId);

    // 2. Attempt 2026-04-30
    try {
        await assertFinancialPeriodOpen(userId, new Date('2026-04-30T10:00:00.000Z'));
        console.error('[FAIL] 2026-04-30 allowed despite April being closed.');
    } catch(e) {
        if(e.code === 'FINANCIAL_PERIOD_CLOSED') {
            passes++;
            console.log('[PASS] 2026-04-30 correctly rejected.');
        } else {
            console.error('[FAIL] Unexpected error:', e.message);
        }
    }

    // 3. Attempt 2026-05-01
    try {
        await assertFinancialPeriodOpen(userId, new Date('2026-05-01T00:00:00.000Z'));
        passes++;
        console.log('[PASS] 2026-05-01 correctly allowed (May is open).');
    } catch(e) {
        console.error('[FAIL] 2026-05-01 rejected:', e.message);
    }

    // 4. Close May
    await closeAccountingPeriod(userId, may.id, userId);

    // 5. Attempt 2026-05-01
    try {
        await assertFinancialPeriodOpen(userId, new Date('2026-05-01T00:00:00.000Z'));
        console.error('[FAIL] 2026-05-01 allowed despite May being closed.');
    } catch(e) {
        if(e.code === 'FINANCIAL_PERIOD_CLOSED') {
            passes++;
            console.log('[PASS] 2026-05-01 correctly rejected.');
        } else {
            console.error('[FAIL] Unexpected error:', e.message);
        }
    }

    // Clean up
    await reopenAccountingPeriod(userId, april.id);
    await reopenAccountingPeriod(userId, may.id);

    console.log(`\nSUCCESS: Passed ${passes}/3 closed period tests.`);
    process.exit(0);
}
run();
