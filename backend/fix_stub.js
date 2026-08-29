const fs = require('fs');
let code = fs.readFileSync('src/controllers/saleController.ts', 'utf8');
code = code.replace(/export async function createSaleInternal[^]*?\}\n?/g, "export { createSaleInternal } from '../services/saleInternalService';\n");
fs.writeFileSync('src/controllers/saleController.ts', code);
