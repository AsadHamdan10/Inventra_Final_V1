const fs = require('fs');
let code = fs.readFileSync('scripts/manual_qa_init.js', 'utf8');
code = code.replace(/isTaxable: true/g, "taxability: 'TAXABLE'");
code = code.replace(/taxRate: 18/g, "gstRate: 18");
fs.writeFileSync('scripts/manual_qa_init.js', code);
