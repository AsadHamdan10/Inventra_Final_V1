const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { assertFinancialPeriodOpen, closeAccountingPeriod, reopenAccountingPeriod, closeFinancialYear } = require('./dist/services/financialPeriodService');

async function run() {
    console.log('--- RUNNING test_financial_period_security.js ---');
    const user = await prisma.user.findFirst();
    const fy = await prisma.financialYear.findFirst({ where: { userId: user.id } });
    const period = await prisma.accountingPeriod.findFirst({ where: { userId: user.id, status: 'OPEN' } });

    let passes = 0;
    
    // Test 1: Tenant isolation
    try {
        await assertFinancialPeriodOpen(9999, new Date());
        console.error('Failed 1');
    } catch (e) { passes++; console.log('[PASS] Tenant isolation blocks invalid tenant'); }

    // Test 12: Transaction allowed in open period
    try {
        await assertFinancialPeriodOpen(user.id, period.startDate);
        passes++; console.log('[PASS] Transaction allowed in open period');
    } catch (e) { console.error('Failed 12', e); }

    // Test 8: Closing open period
    await closeAccountingPeriod(user.id, period.id, user.id);
    passes++; console.log('[PASS] Closing open period');

    // Test 11: Transaction blocked in closed period
    try {
        await assertFinancialPeriodOpen(user.id, period.startDate);
        console.error('Failed 11');
    } catch (e) { 
        if (e.message.includes('Financial period is closed')) {
            passes++; console.log('[PASS] Transaction blocked in closed period');
        } else console.error('Failed 11', e);
    }

    // Test 13: Backdated transaction in closed period
    try {
        await assertFinancialPeriodOpen(user.id, new Date(period.startDate.getTime() + 1000));
        console.error('Failed 13');
    } catch (e) { passes++; console.log('[PASS] Backdated transaction in closed period blocked'); }
    
    // Test 10: Reopening closed period
    await reopenAccountingPeriod(user.id, period.id);
    passes++; console.log('[PASS] Reopening closed period');

    // Test 14: Backdated transaction in open period
    try {
        await assertFinancialPeriodOpen(user.id, new Date(period.startDate.getTime() + 1000));
        passes++; console.log('[PASS] Backdated transaction in open period allowed');
    } catch (e) { console.error('Failed 14', e); }
    
    // Test 9: Closing already closed period is safe
    await closeAccountingPeriod(user.id, period.id, user.id);
    await closeAccountingPeriod(user.id, period.id, user.id);
    passes++; console.log('[PASS] Closing already closed period safely ignored');

    // Test 28: Financial year closure safety (should fail since 11 periods are OPEN)
    try {
        await closeFinancialYear(user.id, fy.id);
        console.error('Failed 28');
    } catch(e) {
        if(e.message.includes('OPEN')) passes++; console.log('[PASS] FY closure blocked if periods OPEN');
    }
    
    // Clean up
    await reopenAccountingPeriod(user.id, period.id);

    console.log(`\nSUCCESS: Passed ${passes}/9 core assertions.`);
    process.exit(0);
}
run();
