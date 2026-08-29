const fs = require('fs');
let code = fs.readFileSync('scripts/manual_qa_init.js', 'utf8');
code = code.replace(/isActive: true,/g, "status: 'approved',");
fs.writeFileSync('scripts/manual_qa_init.js', code);
