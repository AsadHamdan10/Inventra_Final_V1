
const fs = require("fs");
const path = "backend/test_phase_6_8_api_integration2.js";
let code = fs.readFileSync(path, "utf8");
code = code.replace(
  /await fetchJSON\(`\$\{API\}\/goods-receipts\/\$\{grnReq\.data\.id\}\/status`.*\);/,
  `const grnPostReq = await fetchJSON(\`\${API}/goods-receipts/\${grnReq.data.id}/status\`, { method: "PATCH", headers: h1, body: JSON.stringify({ status: "POSTED" }) });
        if (!grnPostReq.ok) throw new Error("GRN POST failed: " + JSON.stringify(grnPostReq.data));`
);
fs.writeFileSync(path, code, "utf8");

