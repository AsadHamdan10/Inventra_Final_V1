const fs = require('fs');
let code = fs.readFileSync('scripts/manual_qa_init.js', 'utf8');
code = code.replace(/legalName: 'Test Customer A Pvt Ltd', /g, "");
code = code.replace(/isInterState: false/g, "address: 'Local'");
code = code.replace(/legalName: 'Test Vendor A Pvt Ltd', /g, "");
fs.writeFileSync('scripts/manual_qa_init.js', code);
