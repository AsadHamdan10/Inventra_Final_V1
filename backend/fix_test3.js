const fs = require('fs');
let code = fs.readFileSync('test_phase_5_4_production_execution_security.js', 'utf8');
code = code.replace(/referenceType: 'SEED', referenceId: ledgerIn/g, "sourceType: 'SEED', sourceId: ledgerIn");
fs.writeFileSync('test_phase_5_4_production_execution_security.js', code);
