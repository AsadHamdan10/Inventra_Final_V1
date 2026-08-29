const fs = require('fs');
let code = fs.readFileSync('test_phase_5_4_production_execution_security.js', 'utf8');
code = code.replace(/bomCode: 'EXEC-BOM-001'/g, "bomCode: 'EXEC-BOM-' + Date.now()");
fs.writeFileSync('test_phase_5_4_production_execution_security.js', code);
