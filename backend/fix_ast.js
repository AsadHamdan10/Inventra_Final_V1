const fs = require('fs');

let saleCode = fs.readFileSync('src/controllers/saleController.ts', 'utf8');
saleCode = saleCode.replace(/export async function deleteSale\(req: Request, res: Response, next: NextFunction\) \{ return res\.status\(405\)\.json\(\{ error: 'Method Not Allowed\. Financial records are immutable\.' \}\); \}\n\}/, "export async function deleteSale(req: Request, res: Response, next: NextFunction) { return res.status(405).json({ error: 'Method Not Allowed. Financial records are immutable.' }); }");
fs.writeFileSync('src/controllers/saleController.ts', saleCode);

let purchaseCode = fs.readFileSync('src/controllers/purchaseController.ts', 'utf8');
const targetPurchaseStart = purchaseCode.indexOf("export async function deletePurchase");
if (targetPurchaseStart !== -1) {
  const catchIndex = purchaseCode.indexOf("catch (err) { next(err); }", targetPurchaseStart);
  if (catchIndex !== -1) {
    const endBlock = purchaseCode.indexOf("}", catchIndex + 26);
    if (endBlock !== -1) {
      const before = purchaseCode.substring(0, targetPurchaseStart);
      const after = purchaseCode.substring(endBlock + 1);
      purchaseCode = before + "export async function deletePurchase(req: Request, res: Response, next: NextFunction) { return res.status(405).json({ error: 'Method Not Allowed. Financial records are immutable.' }); }" + after;
      fs.writeFileSync('src/controllers/purchaseController.ts', purchaseCode);
    }
  }
}
