const fs = require('fs');
let code = fs.readFileSync('test_journal_engine_security.js', 'utf8');
code = code.replace("await assert(e.code === 'P2003'", "console.log(e); await assert(e.code === 'P2003'");
fs.writeFileSync('test_journal_engine_security.js', code);
