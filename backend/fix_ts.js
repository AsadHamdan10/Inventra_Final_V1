const fs = require('fs');

// Fix purchaseController
let pController = fs.readFileSync('src/controllers/purchaseController.ts', 'utf8');
pController = pController.replace("import { assertFinancialPeriodOpen } from '../services/accounting/financialPeriodService';", "import { assertFinancialPeriodOpen } from '../services/financialPeriodService';");
pController = pController.replace(/date:\s*new Date\(data\.billDate\)/g, 'txnDate: new Date(data.billDate)');
fs.writeFileSync('src/controllers/purchaseController.ts', pController);

// Fix goodsReceiptService
let grService = fs.readFileSync('src/services/procurement/goodsReceiptService.ts', 'utf8');
grService = grService.replace("import { assertFinancialPeriodOpen } from '../accounting/financialPeriodService';", "import { assertFinancialPeriodOpen } from '../financialPeriodService';");
grService = grService.replace(/generateDocumentNumber\(userId, 'GRN', data\.grnDate\)/g, "generateDocumentNumber('GRN', userId, data.grnDate)");
grService = grService.replace(/date: grn\.grnDate/g, 'txnDate: grn.grnDate');
fs.writeFileSync('src/services/procurement/goodsReceiptService.ts', grService);

// Fix purchaseInvoiceService
let piService = fs.readFileSync('src/services/procurement/purchaseInvoiceService.ts', 'utf8');
piService = piService.replace("import { assertFinancialPeriodOpen } from '../accounting/financialPeriodService';", "import { assertFinancialPeriodOpen } from '../financialPeriodService';");
piService = piService.replace(/generateDocumentNumber\(userId, 'BILL', data\.billDate\)/g, "generateDocumentNumber('BILL', userId, data.billDate)");
fs.writeFileSync('src/services/procurement/purchaseInvoiceService.ts', piService);

// Fix others
['purchaseOrderService', 'purchaseQuotationService', 'purchaseRequisitionService'].forEach(name => {
    let file = `src/services/procurement/${name}.ts`;
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/generateDocumentNumber\(userId, '(.*?)', data\.(.*?)\)/, "generateDocumentNumber('$1', userId, data.$2)");
    fs.writeFileSync(file, content);
});
console.log('Fixed TypeScript errors');
