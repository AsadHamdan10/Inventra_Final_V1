const fs = require('fs');
let code = fs.readFileSync('scripts/manual_qa_init.js', 'utf8');
code = code.replace(/name: 'General', description/g, "name: 'General', code: 'CAT-GEN', description");
fs.writeFileSync('scripts/manual_qa_init.js', code);
