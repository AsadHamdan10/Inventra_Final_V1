const fs = require('fs');
let code = fs.readFileSync('scripts/manual_qa_init.js', 'utf8');
code = code.replace(/companyName: 'Test Vendor A Pvt Ltd'/g, "vendorName: 'Test Vendor A Pvt Ltd'");
fs.writeFileSync('scripts/manual_qa_init.js', code);
