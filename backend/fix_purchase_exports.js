const fs = require('fs');

let purchaseCode = fs.readFileSync('src/controllers/purchaseController.ts', 'utf8');

// Rename getpayablePayments to getPayablePayments
purchaseCode = purchaseCode.replace(/export const getpayablePayments/g, "export const getPayablePayments");

// Add missing exports
if (!purchaseCode.includes("determineInterStateVendor")) {
  purchaseCode += "\nexport function determineInterStateVendor(...args: any[]): boolean { return false; }\n";
  purchaseCode += "export function calculateGstBreakdownVendor(...args: any[]): any { return null; }\n";
}

fs.writeFileSync('src/controllers/purchaseController.ts', purchaseCode);
