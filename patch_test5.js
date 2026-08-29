
const fs = require("fs");
const path = "backend/test_phase_6_8_api_integration2.js";
let code = fs.readFileSync(path, "utf8");
code = code.replace(
  /items: \[\{ materialId: mData\.id, warehouseId: wh1\.id, quantity: 2, unitPrice: 50000 \}\]/,
  `items: [{ materialId: mData.id, warehouseId: wh1.id, quantity: 2, unitPrice: 50000, gstPercent: 18 }]`
);
fs.writeFileSync(path, code, "utf8");

