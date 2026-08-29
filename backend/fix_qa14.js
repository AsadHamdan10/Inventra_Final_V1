const fs = require('fs');
let code = fs.readFileSync('scripts/manual_qa_init.js', 'utf8');
code = code.replace(/SEMI_FINISHED/g, "SEMI_FINISHED_GOOD");
fs.writeFileSync('scripts/manual_qa_init.js', code);
