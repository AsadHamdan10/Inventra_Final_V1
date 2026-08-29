const fs = require('fs');

let saleStr = fs.readFileSync('src/controllers/saleController.ts', 'utf8');

saleStr = saleStr.replace(
  /const \{ invoiceNo, items, companyGstin, dueDate, isInterState: _ignore1, \.\.\.data \} = parsed\.data;/,
  "const { invoiceNo: clientInvoiceNo, items, companyGstin, dueDate, isInterState: _ignore1, ...data } = parsed.data;"
);

saleStr = saleStr.replace(
  /const count = await tx\.sale\.count\(\{ where: \{ userId \} \}\);\s*const finalInvoiceNo = invoiceNo \|\| `INV-\$\{Date\.now\(\)\}-\$\{count \+ 1\}`;/,
  "const finalInvoiceNo = await generateDocumentNumber('INV', userId, new Date(data.invoiceDate));"
);

// If it still hasn't replaced generateTenantId
saleStr = saleStr.replace(
  /import \{ generateTenantId \} from '\.\.\/utils\/tenantId';/,
  "import { generateDocumentNumber } from '../utils/tenantId';"
);

fs.writeFileSync('src/controllers/saleController.ts', saleStr);


let purchStr = fs.readFileSync('src/controllers/purchaseController.ts', 'utf8');
purchStr = purchStr.replace(
  /import \{ generateTenantId \} from '\.\.\/utils\/tenantId';/,
  "import { generateDocumentNumber } from '../utils/tenantId';"
);
fs.writeFileSync('src/controllers/purchaseController.ts', purchStr);

