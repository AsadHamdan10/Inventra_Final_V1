const fs = require('fs');
let code = fs.readFileSync('scripts/manual_qa_init.js', 'utf8');
code = code.replace(/customerType: 'B2B', /g, "");
code = code.replace(/vendorType: 'B2B', /g, "");
fs.writeFileSync('scripts/manual_qa_init.js', code);
