const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { analyzeHistoricalAccounting, executeHistoricalBackfill } = require('../dist/services/accounting/historicalBackfillService');
const fs = require('fs');

async function run() {
    const args = process.argv.slice(2);
    const execute = args.includes('--execute');
    let tenantId = null;

    const tenantArg = args.find(a => a.startsWith('--tenant='));
    if (tenantArg) {
        tenantId = parseInt(tenantArg.split('=')[1]);
    }

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl || !dbUrl.includes('inventra_v1_development')) {
        console.error("ABORT IMMEDIATELY: Target database is NOT inventra_v1_development");
        process.exit(1);
    }

    console.log("=== HISTORICAL ACCOUNTING BACKFILL ===");
    console.log(`TARGET DATABASE: ${dbUrl}`);

    const users = tenantId ? [{ id: tenantId }] : await prisma.user.findMany();

    // Use a dedicated connection for advisory lock to avoid pool reuse issues if possible,
    // but in Prisma we can't easily hold a raw connection. We will use a soft lock in memory
    // for the script duration, and try advisory lock via an interactive transaction if needed.
    // Actually, since this is a CLI script, we just run sequentially.

    let totalSuccess = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    const artifacts = {
        excluded: []
    };

    for (const user of users) {
        console.log(`\n--- TENANT ${user.id} ---`);
        const lockAcquired = await prisma.$queryRaw`SELECT pg_try_advisory_lock(${user.id}::integer) as locked`;
        if (!lockAcquired[0].locked) {
            console.error(`BACKFILL_ALREADY_RUNNING for tenant ${user.id}. Aborting safely.`);
            continue;
        }

        try {
            const report = await analyzeHistoricalAccounting(user.id, true);
            
            console.log("SOURCE COUNTS:");
            console.log(`  Sales: ${report.sales.total} (Accounted: ${report.sales.accounted}, Unaccounted: ${report.sales.unaccounted}, Cancelled: ${report.sales.cancelled})`);
            console.log(`  Purchases: ${report.purchases.total} (Accounted: ${report.purchases.accounted}, Unaccounted: ${report.purchases.unaccounted})`);
            console.log(`  Customer Payments: ${report.customerPayments.total} (Accounted: ${report.customerPayments.accounted}, Unaccounted: ${report.customerPayments.unaccounted}, Excluded Test: ${report.customerPayments.excluded})`);
            console.log(`  Vendor Payments: ${report.vendorPayments.total} (Accounted: ${report.vendorPayments.accounted}, Unaccounted: ${report.vendorPayments.unaccounted})`);
            console.log(`  Expenses: ${report.expenses.total} (Accounted: ${report.expenses.accounted}, Unaccounted: ${report.expenses.unaccounted})`);
            console.log(`  Opening Inventory Layers: ${report.inventory.openingLayers}`);

            console.log("EXPECTED JOURNALS:");
            const expected = report.sales.candidates.length + report.purchases.candidates.length + 
                report.customerPayments.candidates.length + report.vendorPayments.candidates.length + 
                report.expenses.candidates.length + report.salesReturns.candidates.length + 
                report.purchaseReturns.candidates.length + report.inventory.candidates.length;
            console.log(`  ${expected}`);

            console.log("EXCLUDED TEST ARTIFACTS:");
            if (report.customerPayments.excluded > 0) {
                console.log(`  Customer Payment ID 1 (Known test artifact)`);
                artifacts.excluded.push({ tenantId: user.id, type: 'CUSTOMER_PAYMENT', id: 1, reason: 'test_financial_reconciliation_v2.js artifact' });
            } else {
                console.log(`  None`);
            }

            console.log("UNRESOLVED ANOMALIES:");
            if (report.unresolvedAnomalies.length > 0) {
                for (const a of report.unresolvedAnomalies) console.log(`  - ${a}`);
            } else {
                console.log(`  None`);
            }

            if (!execute) {
                console.log("\n[DRY RUN] Execute flag not provided. Skipping backfill.");
                continue;
            }

            if (report.unresolvedAnomalies.length > 0) {
                console.log("\n[BLOCKED] Cannot execute backfill due to unresolved anomalies.");
                continue;
            }

            console.log("\n[EXECUTE] Starting backfill...");
            const res = await executeHistoricalBackfill(user.id, user.id); // reqUserId = user.id for CLI
            console.log(`[SUCCESS] Accounted: ${res.successful}, Skipped: ${res.skipped}, Failed: ${res.failed}`);
            
            totalSuccess += res.successful;
            totalSkipped += res.skipped;
            totalFailed += res.failed;

            // Generate Trial Balance to ensure DR == CR
            const tb = await prisma.$queryRaw`
                SELECT a.code, a.name, SUM(l.debit) as dr, SUM(l.credit) as cr
                FROM journal_entries j
                JOIN journal_lines l ON j.id = l.journal_entry_id
                JOIN chart_of_accounts a ON l.account_id = a.id
                WHERE j.user_id = ${user.id} AND j.status = 'POSTED'
                GROUP BY a.code, a.name
            `;
            
            let totalDr = 0;
            let totalCr = 0;
            for (const row of tb) {
                totalDr += Number(row.dr);
                totalCr += Number(row.cr);
            }
            if (Math.abs(totalDr - totalCr) > 0.01) {
                console.error(`BACKFILL FAILED: Trial Balance mismatch. DR: ${totalDr}, CR: ${totalCr}`);
            } else {
                console.log(`[TRIAL BALANCE] Balanced perfectly at ${totalDr}`);
            }

        } finally {
            await prisma.$executeRaw`SELECT pg_advisory_unlock(${user.id}::integer)`;
        }
    }

    fs.writeFileSync('./backfill_test_artifacts.json', JSON.stringify(artifacts, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
