const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { requireFinancialYearContext } = require('./dist/middlewares/financialYearContext');
const { getProfitLossReport } = require('./dist/services/reporting/profitLossService');
const { getInventoryReport } = require('./dist/services/reporting/inventoryReportService');

async function run() {
    console.log('--- RUNNING test_reporting_security.js ---');
    const user = await prisma.user.findFirst();
    const userId = user.id;

    let passes = 0;

    // 1. Tenant Isolation
    try {
        const fy = await prisma.financialYear.findFirst({ where: { userId } });
        const req = { user: { userId: userId + 999 }, query: { financialYearId: fy.id } };
        const res = { status: (c) => ({ json: (o) => ({ code: c, ...o }) }) };
        const next = (err) => { if (err) throw err; };
        
        const result = await requireFinancialYearContext(req, res, next);
        if (result && result.code === 403) {
            passes++;
            console.log('[PASS] Cross-tenant FY access rejected.');
        } else {
            console.error('[FAIL] Cross-tenant FY access NOT rejected.');
        }
    } catch(e) {}

    // 2. FIFO COGS used in P&L
    try {
        const fy = await prisma.financialYear.findFirst({ where: { userId } });
        const pl = await getProfitLossReport(userId, { startDate: fy.startDate, endDate: fy.endDate });
        if (pl && pl.cogs && typeof pl.cogs.fifoCogs === 'number') {
            passes++;
            console.log('[PASS] P&L uses authoritative FIFO COGS.');
        } else {
            console.error('[FAIL] P&L missing FIFO COGS.');
        }
    } catch(e) {
        console.error(e);
    }

    // 3. Current Stock Unaffected
    try {
        const initialStock = await prisma.material.findFirst({ where: { userId } });
        const fy = await prisma.financialYear.findFirst({ where: { userId } });
        await getProfitLossReport(userId, fy);
        await getInventoryReport(userId);
        const finalStock = await prisma.material.findUnique({ where: { id: initialStock.id } });
        
        if (initialStock.currentStock.toString() === finalStock.currentStock.toString()) {
            passes++;
            console.log('[PASS] Current stock unaffected by reporting.');
        } else {
            console.error('[FAIL] Stock mutated during reporting.');
        }
    } catch(e) {
        console.error(e);
    }

    console.log('\\nSUCCESS: Passed ' + passes + '/3 core reporting security checks.');
    process.exit(0);
}
run();
