const fs = require('fs');
let code = fs.readFileSync('scripts/manual_qa_init.js', 'utf8');
code = code.replace(/raw_material/g, "RAW_MATERIAL");
code = code.replace(/semi_finished/g, "SEMI_FINISHED");
code = code.replace(/finished_good/g, "FINISHED_GOOD");
code = code.replace(/trading_good/g, "TRADING_GOOD");
code = code.replace(/b2b/g, "B2B");
fs.writeFileSync('scripts/manual_qa_init.js', code);
