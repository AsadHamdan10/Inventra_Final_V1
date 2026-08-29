const fs = require('fs');

let saleCode = fs.readFileSync('src/controllers/saleController.ts', 'utf8');
saleCode = saleCode.replace(
  /export async function deleteSale\(req: Request, res: Response, next: NextFunction\) \{\n\s*try \{\n\s*const userId = req\.user!\.userId;\n\s*const id = parseInt\(req\.params\.id\);\n\s*if \(!await assertTenantOwnership\(userId, 'sales', id\)\) return res\.status\(403\)\.json\(\{ error: 'Access denied\.' \}\);\n\s*await prisma\.sale\.delete\(\{ where: \{ id \} \}\);\n\s*await auditLog\(userId, 'data_delete', `Sale deleted: #\$\{id\}`, req\);\n\s*res\.json\(\{ message: 'Deleted\.' \}\);\n\s*\} catch \(err\) \{ next\(err\); \}\n\s*\}/,
  "export async function deleteSale(req: Request, res: Response, next: NextFunction) { return res.status(405).json({ error: 'Method Not Allowed. Financial records are immutable.' }); }"
);
fs.writeFileSync('src/controllers/saleController.ts', saleCode);

let purchaseCode = fs.readFileSync('src/controllers/purchaseController.ts', 'utf8');
purchaseCode = purchaseCode.replace(
  /export async function deletePurchase\(req: Request, res: Response, next: NextFunction\) \{\n\s*try \{\n\s*const userId = req\.user!\.userId;\n\s*const id = parseInt\(req\.params\.id\);\n\s*if \(!await assertTenantOwnership\(userId, 'purchases', id\)\) return res\.status\(403\)\.json\(\{ error: 'Access denied\.' \}\);\n\s*await prisma\.purchase\.delete\(\{ where: \{ id \} \}\);\n\s*await auditLog\(userId, 'data_delete', `Purchase deleted: #\$\{id\}`, req\);\n\s*res\.json\(\{ message: 'Deleted\.' \}\);\n\s*\} catch \(err\) \{ next\(err\); \}\n\s*\}/,
  "export async function deletePurchase(req: Request, res: Response, next: NextFunction) { return res.status(405).json({ error: 'Method Not Allowed. Financial records are immutable.' }); }"
);
fs.writeFileSync('src/controllers/purchaseController.ts', purchaseCode);
