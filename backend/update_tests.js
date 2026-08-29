const fs = require('fs');
let s = fs.readFileSync('run_all_tests.js', 'utf8');

const newTests = [
    'test_financial_period_security.js',
    'test_financial_year_context_security.js',
    'test_reporting_security.js',
    'test_chart_of_accounts_security.js',
    'test_journal_engine_security.js',
    'test_accounting_integration_security.js',
    'test_accounting_reconciliation_security.js',
    'test_gst_compliance_security.js',
    'test_einvoice_security.js',
    'test_ewaybill_security.js',
    'test_gst_filing_immutability.js',
    'test_gstr1_b2b_b2c_classification.js',
    'test_rcm_itc_extraction.js',
    'test_gst_return_security.js',
    'test_phase_4_5e_final_reconciliation.js',
    'test_phase_4_5e_compliance_links.js',
    'test_phase_4_5e_tenant_security.js',
    'test_phase_4_5e_concurrency.js',
    'test_phase_4_5e_immutability.js'
];

const replaceTarget = /const tests = \[[^\]]*\];/;
const match = s.match(replaceTarget);
if (match) {
    let listStr = match[0];
    listStr = listStr.substring(0, listStr.length - 2); // remove "];"
    if (!listStr.trim().endsWith('[')) {
        listStr += ', ';
    }
    listStr += newTests.map(t => `'${t}'`).join(', ');
    listStr += '];';
    s = s.replace(replaceTarget, listStr);
}
fs.writeFileSync('run_all_tests.js', s);
