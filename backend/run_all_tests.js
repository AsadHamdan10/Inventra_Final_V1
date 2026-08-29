const { execSync } = require('child_process');

const tests = [
    'test_financial_authority_v2.js',
    'test_sale_purchase_concurrency.js',
    'test_fiscal_year_numbering_v2.js',
    'test_financial_immutability_v2.js',
    'test_financial_reconciliation_v2.js'
, 'test_financial_period_security.js', 'test_financial_year_context_security.js', 'test_reporting_security.js', 'test_chart_of_accounts_security.js', 'test_journal_engine_security.js', 'test_accounting_integration_security.js', 'test_accounting_reconciliation_security.js', 'test_gst_compliance_security.js', 'test_einvoice_security.js', 'test_ewaybill_security.js', 'test_gst_filing_immutability.js', 'test_gstr1_b2b_b2c_classification.js', 'test_rcm_itc_extraction.js', 'test_gst_return_security.js', 'test_phase_4_5e_final_reconciliation.js', 'test_phase_4_5e_compliance_links.js', 'test_phase_4_5e_tenant_security.js', 'test_phase_4_5e_concurrency.js', 'test_phase_4_5e_immutability.js'];

console.log("=========================================");
console.log("INVENTRA V1 - PHASE 3.4B REGRESSION SUITE");
console.log("=========================================");

let allPassed = true;

for (const test of tests) {
    console.log(`\n=> Running ${test}...`);
    try {
        const output = execSync(`node ${test}`, { encoding: 'utf8', stdio: 'pipe' });
        console.log(output.trim());
        console.log(`[PASS] ${test}`);
    } catch (e) {
        console.log(e.stdout ? e.stdout.trim() : '');
        console.error(e.stderr ? e.stderr.trim() : e.message);
        console.error(`[FAIL] ${test}`);
        allPassed = false;
    }
}

console.log("\n=========================================");
if (allPassed) {
    console.log("ALL TESTS PASSED SUCCESSFULLY.");
    process.exit(0);
} else {
    console.error("SOME TESTS FAILED.");
    process.exit(1);
}
