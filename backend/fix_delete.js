const fs = require('fs');
let code = fs.readFileSync('src/controllers/saleController.ts', 'utf8');
code = code.replace(/await prisma\.sale\.delete\(\{ where: \{ id \} \}\);/g, "return res.status(405).json({ error: 'Method Not Allowed. Financial records are immutable.' });");
fs.writeFileSync('src/controllers/saleController.ts', code);
