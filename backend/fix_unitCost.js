const fs = require('fs');
let code = fs.readFileSync('src/services/saleInternalService.ts', 'utf8');
code = code.replace("referenceType: 'SALE',", "referenceType: 'SALE',\n          unitCostEnc: layer.unitCostEnc,");
fs.writeFileSync('src/services/saleInternalService.ts', code);
