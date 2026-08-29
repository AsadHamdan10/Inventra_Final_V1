const fs = require('fs');
let code = fs.readFileSync('test_fiscal_year_numbering_v2.js', 'utf8');
code = code.replace(/split\('-'\)/g, "split('/')");
fs.writeFileSync('test_fiscal_year_numbering_v2.js', code);
