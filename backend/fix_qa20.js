const fs = require('fs');
let code = fs.readFileSync('scripts/manual_qa_init.js', 'utf8');
code = code.replace(/gstin: '29XYZDE2222F1Z5'/g, "vendorGstin: '29XYZDE2222F1Z5'");
fs.writeFileSync('scripts/manual_qa_init.js', code);
