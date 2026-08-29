const fs = require('fs');
let code = fs.readFileSync('test_phase_5_4_production_execution_security.js', 'utf8');
code = code.replace(/safeEncrypt/g, 'encryptData');
code = code.replace(/inventoryLedgerInId: ledgerIn\.id, /g, "userId: userId, sourceType: 'SEED', sourceId: ledgerIn.id, ");
fs.writeFileSync('test_phase_5_4_production_execution_security.js', code);
console.log('Fixed test');
