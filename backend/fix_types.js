const fs = require('fs');
['src/controllers/saleController.ts', 'src/controllers/purchaseController.ts', 'src/controllers/materialController.ts', 'src/controllers/reportController.ts'].forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  
  c = c.replace(/\/\/ @ts-nocheck\n/g, '');
  
  c = c.replace(/(export\s+async\s+function\s+\w+\s*\([^)]+\))\s*\{/g, '$1: Promise<void> {');
  
  c = c.replace(/return\s+res\.status\(([^)]+)\)\.json\(([\s\S]*?)\);/g, 'res.status($1).json($2); return;');
  c = c.replace(/return\s+res\.json\(([\s\S]*?)\);/g, 'res.json($1); return;');
  
  // also fix destructuring `isInterState`
  c = c.replace(/const \{ invoiceNo, items, companyGstin, dueDate, \.\.\.data \} = parsed\.data;/g, 
                'const { invoiceNo, items, companyGstin, dueDate, isInterState: _ignore1, ...data } = parsed.data;');
  c = c.replace(/const \{ items, \.\.\.data \} = parsed\.data;/g, 
                'const { items, isInterState: _ignore2, ...data } = parsed.data;');

  fs.writeFileSync(f, c);
});
console.log('Fixed typings');
