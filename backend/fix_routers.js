import { Request, Response, NextFunction, RequestHandler } from 'express';
const fs = require('fs');

function fixRouter(file) {
    let content = fs.readFileSync(file, 'utf8');
    // Replace router.post('/', createSale); with router.post('/', createSale as any);
    content = content.replace(/, (create\w+|update\w+|delete\w+|get\w+|add\w+)\);/g, ', $1 as any);');
    fs.writeFileSync(file, content, 'utf8');
}

fixRouter('src/routes/sales.ts');
fixRouter('src/routes/purchases.ts');
fixRouter('src/routes/materials.ts');
fixRouter('src/routes/reports.ts');
console.log('Fixed routers');
