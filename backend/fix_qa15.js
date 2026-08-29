const fs = require('fs');
let code = fs.readFileSync('scripts/manual_qa_init.js', 'utf8');
code = code.replace(/name: 'Test Customer A'/g, "name: 'Test Customer A', companyName: 'Test Customer A Pvt Ltd'");
code = code.replace(/name: 'Test Vendor A'/g, "name: 'Test Vendor A', companyName: 'Test Vendor A Pvt Ltd'");
fs.writeFileSync('scripts/manual_qa_init.js', code);
