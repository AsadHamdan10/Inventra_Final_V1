const fs = require('fs');

let saleStr = fs.readFileSync('src/controllers/saleController.ts', 'utf8');

// Replace import
saleStr = saleStr.replace(
  /import \{ generateTenantId \} from '\.\.\/utils\/tenantId';/,
  "import { generateDocumentNumber } from '../utils/tenantId';"
);

// Replace finalInvoiceNo logic
saleStr = saleStr.replace(
  /const count = await tx\.sale\.count\(\{ where: \{ userId \} \}\);\s*const finalInvoiceNo = invoiceNo \|\| `INV-\$\{Date\.now\(\)\}-\$\{count \+ 1\}`;/,
  "const finalInvoiceNo = await generateDocumentNumber('INV', userId, new Date(data.invoiceDate));"
);

fs.writeFileSync('src/controllers/saleController.ts', saleStr);


let purchaseStr = fs.readFileSync('src/controllers/purchaseController.ts', 'utf8');

purchaseStr = purchaseStr.replace(
  /import \{ generateTenantId \} from '\.\.\/utils\/tenantId';/,
  "import { generateDocumentNumber } from '../utils/tenantId';"
);

purchaseStr = purchaseStr.replace(
  /const count = await tx\.purchase\.count\(\{ where: \{ userId \} \}\);\s*const finalBillNo = billNo \|\| `PUR-\$\{Date\.now\(\)\}-\$\{count \+ 1\}`;/,
  "const finalBillNo = await generateDocumentNumber('PUR', userId, new Date(data.billDate));"
);

fs.writeFileSync('src/controllers/purchaseController.ts', purchaseStr);
