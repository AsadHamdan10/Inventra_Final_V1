
const fs = require("fs");
const path = "backend/src/services/saleInternalService.ts";
let code = fs.readFileSync(path, "utf8");
code = code.replace(
  /const costPerUnit = Number\(safeDecrypt\(layer\.unitCostEnc\)\);/,
  `const costPerUnit = Number(require("../utils/financialCrypto").decryptFinancialData(layer.unitCostEnc));`
);
code = code.replace(
  /companyName: customerObj\.customerName,/,
  `companyName: customerObj.companyName,`
);
fs.writeFileSync(path, code, "utf8");

