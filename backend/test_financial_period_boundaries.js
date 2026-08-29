const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { assertFinancialPeriodOpen } = require('./dist/services/financialPeriodService');

async function run() {
    console.log('--- RUNNING test_financial_period_boundaries.js ---');
    const user = await prisma.user.findFirst();
    const userId = user.id;

    let passes = 0;

    async function check(dateStr, expectedName) {
        try {
            const period = await assertFinancialPeriodOpen(userId, new Date(dateStr));
            if (period.name === expectedName) {
                passes++;
                console.log(`[PASS] ${dateStr} resolved to ${expectedName}`);
            } else {
                console.error(`[FAIL] ${dateStr} resolved to ${period.name}, expected ${expectedName}`);
            }
        } catch (e) {
            console.error(`[FAIL] ${dateStr} threw error: ${e.message}`);
        }
    }

    await check('2026-04-30T10:00:00.000Z', 'April 2026');
    await check('2026-05-01T00:00:00.000Z', 'May 2026');
    await check('2026-05-31T23:59:59.999Z', 'May 2026');
    await check('2026-06-01T00:00:00.000Z', 'June 2026');
    await check('2027-02-28T12:00:00.000Z', 'February 2027');
    await check('2027-03-01T00:00:00.000Z', 'March 2027');
    await check('2027-03-31T23:59:59.999Z', 'March 2027');

    console.log('\n--- Checking EXACTLY-ONE-PERIOD Invariant ---');
    let startDate = new Date('2026-04-01T00:00:00.000Z');
    let endDate = new Date('2027-03-31T23:59:59.999Z');
    
    let current = new Date(startDate);
    let invariantPassed = true;
    let daysChecked = 0;
    while (current <= endDate) {
        // Query DB manually to find matching periods
        const periods = await prisma.accountingPeriod.findMany({
            where: {
                userId,
                startDate: { lte: current },
                endDate: { gt: current }
            }
        });
        if (periods.length !== 1) {
            console.error(`[FAIL] Invariant broken on ${current.toISOString()}: matched ${periods.length} periods.`);
            invariantPassed = false;
            break;
        }
        current.setDate(current.getDate() + 1);
        daysChecked++;
    }

    if (invariantPassed) {
        passes++;
        console.log(`[PASS] EXACTLY-ONE-PERIOD Invariant holds for all ${daysChecked} days.`);
    }

    console.log(`\nSUCCESS: Passed ${passes}/8 boundary assertions.`);
    process.exit(0);
}
run();
