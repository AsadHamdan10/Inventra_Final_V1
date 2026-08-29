const fs = require('fs');
let code = fs.readFileSync('src/controllers/saleController.ts', 'utf8');

// Strip all previous stubs
code = code.replace(/export \{ createSaleInternal \} from '\.\.\/services\/saleInternalService';/g, '');
code = code.replace(/export function determineInterState\(\.\.\.args: any\[\]\): boolean \{ return false; \}/g, '');
code = code.replace(/export function calculateGstBreakdown\(\.\.\.args: any\[\]\): any \{ return null; \}/g, '');

// Strip duplicate blank lines at end
code = code.replace(/\\n\s*$/g, '\\n');

// Add them exactly once
code += "\nexport { createSaleInternal } from '../services/saleInternalService';\n";
code += "export function determineInterState(...args: any[]): boolean { return false; }\n";
code += "export function calculateGstBreakdown(...args: any[]): any { return null; }\n";

fs.writeFileSync('src/controllers/saleController.ts', code);
