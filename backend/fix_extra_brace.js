const fs = require('fs');

let saleCode = fs.readFileSync('src/controllers/saleController.ts', 'utf8');
saleCode = saleCode.replace(/export async function deleteSale[^]*?are immutable.' \}\); \}\n\}/g, "export async function deleteSale(req: Request, res: Response, next: NextFunction) { return res.status(405).json({ error: 'Method Not Allowed. Financial records are immutable.' }); }");
fs.writeFileSync('src/controllers/saleController.ts', saleCode);

let purchaseCode = fs.readFileSync('src/controllers/purchaseController.ts', 'utf8');
purchaseCode = purchaseCode.replace(/export async function deletePurchase[^]*?are immutable.' \}\); \}\n\}/g, "export async function deletePurchase(req: Request, res: Response, next: NextFunction) { return res.status(405).json({ error: 'Method Not Allowed. Financial records are immutable.' }); }");
fs.writeFileSync('src/controllers/purchaseController.ts', purchaseCode);
