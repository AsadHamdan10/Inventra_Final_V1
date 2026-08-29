
const fs = require("fs");
const path = "backend/src/services/saleInternalService.ts";
let code = fs.readFileSync(path, "utf8");
code = code.replace(
  /shipGSTIN: encryptIfPresent\(d\.shipGSTIN\?\.toUpperCase\(\)\),/,
  `shipGstin: encryptIfPresent(d.shipGstin?.toUpperCase()),`
);
fs.writeFileSync(path, code, "utf8");

