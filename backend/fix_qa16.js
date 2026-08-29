const fs = require('fs');
let code = fs.readFileSync('scripts/manual_qa_init.js', 'utf8');
code = code.replace(/name: 'Test Customer A', /g, "");
code = code.replace(/name: 'Test Vendor A', /g, "");
fs.writeFileSync('scripts/manual_qa_init.js', code);
