const fs = require('fs');
let code = fs.readFileSync('scripts/manual_qa_init.js', 'utf8');
code = code.replace(/companyName: 'INVENTRA'/g, "companyName: 'INVENTRA', username: 'user_' + Date.now()");
fs.writeFileSync('scripts/manual_qa_init.js', code);
