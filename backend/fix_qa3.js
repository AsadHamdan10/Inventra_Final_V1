const fs = require('fs');
let code = fs.readFileSync('scripts/manual_qa_init.js', 'utf8');
code = code.replace(/passwordHash: hash,/g, "passwordHash: hash, password: hash,");
code = code.replace(/passwordHash: tenantHash,/g, "passwordHash: tenantHash, password: tenantHash,");
fs.writeFileSync('scripts/manual_qa_init.js', code);
