const fs = require('fs');
let code = fs.readFileSync('scripts/manual_qa_init.js', 'utf8');
code = code.replace(/status: 'active'/g, "status: 'OPEN'");
fs.writeFileSync('scripts/manual_qa_init.js', code);
