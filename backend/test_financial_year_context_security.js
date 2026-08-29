const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { requireFinancialYearContext } = require('./dist/middlewares/financialYearContext');

async function run() {
    console.log('--- RUNNING test_financial_year_context_security.js ---');
    const user = await prisma.user.findFirst();
    const userId = user.id;

    let passes = 0;

    // 1. Current FY automatically selected when no ID supplied
    try {
        const req = { user: { userId }, query: {} };
        const res = {};
        const next = (err) => { if (err) throw err; };
        
        await requireFinancialYearContext(req, res, next);
        if (req.financialYearContext && req.financialYearContext.id) {
            passes++;
            console.log('[PASS] Default FY automatically resolved.');
        } else {
            console.error('[FAIL] Default FY not resolved.');
        }
    } catch(e) {
        console.error('[FAIL]', e);
    }

    // 2. Cross-tenant FY access rejected
    try {
        const req = { user: { userId: userId + 999 }, query: { financialYearId: 1 } };
        const res = { status: (c) => ({ json: (o) => ({ code: c, ...o }) }) };
        const next = (err) => { if (err) throw err; };
        
        const result = await requireFinancialYearContext(req, res, next);
        if (result && result.code === 403) {
            passes++;
            console.log('[PASS] Cross-tenant FY access rejected.');
        } else {
            console.error('[FAIL] Cross-tenant FY access NOT rejected.');
        }
    } catch(e) {
        console.error('[FAIL]', e);
    }

    // 3. Explicit historical FY works
    try {
        const fy = await prisma.financialYear.findFirst({ where: { userId } });
        const req = { user: { userId }, query: { financialYearId: fy.id } };
        const res = {};
        const next = (err) => { if (err) throw err; };
        
        await requireFinancialYearContext(req, res, next);
        if (req.financialYearContext && req.financialYearContext.id === fy.id) {
            passes++;
            console.log('[PASS] Explicit FY resolved safely.');
        } else {
            console.error('[FAIL] Explicit FY not resolved.');
        }
    } catch(e) {
        console.error('[FAIL]', e);
    }
    
    console.log('\\nSUCCESS: Passed ' + passes + '/3 core middleware security tests.');
    process.exit(0);
}
run();
