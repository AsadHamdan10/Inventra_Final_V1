const fs = require('fs');
let code = fs.readFileSync('test_phase_5_5_inventory_security.js', 'utf8');
code = code.replace(/location: 'L1'/g, "location: 'L1', code: 'W1-' + Date.now()");
code = code.replace(/location: 'L2'/g, "location: 'L2', code: 'W2-' + Date.now()");
fs.writeFileSync('test_phase_5_5_inventory_security.js', code);
