const fs = require('fs');

// 1. saleController.ts
let saleCode = fs.readFileSync('src/controllers/saleController.ts', 'utf8');

// Fix deleteSale
saleCode = saleCode.replace(/export const deleteSale: RequestHandler = async \(req, res, next\) => \{[^]*?catch \(err\) \{ next\(err\); \}\n\}/, "export const deleteSale: RequestHandler = async (req, res, next) => { return res.status(405).json({ error: 'Method Not Allowed. Financial records are immutable.' }); }");

// Append createSaleInternal and dummy stubs if not present
if (!saleCode.includes("createSaleInternal")) {
  saleCode += "\nexport { createSaleInternal } from '../services/saleInternalService';\n";
  saleCode += "export function determineInterState(tenantId: number, customerId: number): boolean { return false; }\n";
  saleCode += "export function calculateGstBreakdown(...args: any[]): any { return null; }\n";
}

fs.writeFileSync('src/controllers/saleController.ts', saleCode);

// 2. purchaseController.ts
let purchaseCode = fs.readFileSync('src/controllers/purchaseController.ts', 'utf8');

// Fix deletePurchase
purchaseCode = purchaseCode.replace(/export const deletePurchase: RequestHandler = async \(req, res, next\) => \{[^]*?catch \(err\) \{ next\(err\); \}\n\}/, "export const deletePurchase: RequestHandler = async (req, res, next) => { return res.status(405).json({ error: 'Method Not Allowed. Financial records are immutable.' }); }");

fs.writeFileSync('src/controllers/purchaseController.ts', purchaseCode);
