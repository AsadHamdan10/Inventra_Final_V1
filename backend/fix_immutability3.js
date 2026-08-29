const fs = require('fs');

let saleCode = fs.readFileSync('src/controllers/saleController.ts', 'utf8');

const targetSale = `export const deleteSale: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (!await assertTenantOwnership(userId, 'sales', id)) return res.status(403).json({ error: 'Access denied.' });
    await prisma.sale.delete({ where: { id } });
    await auditLog(userId, 'data_delete', \`Sale deleted: #\${id}\`, req);
    res.json({ message: 'Deleted.' });
  } catch (err) { next(err); }
}`;

const replaceSale = `export const deleteSale: RequestHandler = async (req, res, next) => {
  return res.status(405).json({ error: 'Method Not Allowed. Financial records are immutable.' });
}`;

saleCode = saleCode.replace(targetSale, replaceSale);

if (!saleCode.includes("createSaleInternal")) {
  saleCode += "\nexport { createSaleInternal } from '../services/saleInternalService';\n";
}

fs.writeFileSync('src/controllers/saleController.ts', saleCode);


let purchaseCode = fs.readFileSync('src/controllers/purchaseController.ts', 'utf8');

const targetPurchase = `export const deletePurchase: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (!await assertTenantOwnership(userId, 'purchases', id)) return res.status(403).json({ error: 'Access denied.' });
    await prisma.purchase.delete({ where: { id } });
    await auditLog(userId, 'data_delete', \`Purchase deleted: #\${id}\`, req);
    res.json({ message: 'Deleted.' });
  } catch (err) { next(err); }
}`;

const replacePurchase = `export const deletePurchase: RequestHandler = async (req, res, next) => {
  return res.status(405).json({ error: 'Method Not Allowed. Financial records are immutable.' });
}`;

purchaseCode = purchaseCode.replace(targetPurchase, replacePurchase);

fs.writeFileSync('src/controllers/purchaseController.ts', purchaseCode);
