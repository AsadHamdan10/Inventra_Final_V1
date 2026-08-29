const fs = require('fs');
let code = fs.readFileSync('scripts/manual_qa_init.js', 'utf8');
code = code.replace(/name: "System Super Admin",/g, '');
code = code.replace(/name: "Tenant Admin",/g, '');
fs.writeFileSync('scripts/manual_qa_init.js', code);
