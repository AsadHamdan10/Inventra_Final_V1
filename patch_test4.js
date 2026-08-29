
const fs = require("fs");
const path = "backend/test_phase_6_8_api_integration2.js";
let code = fs.readFileSync(path, "utf8");
code = code.replace(
  /yearName: "2026-27"/,
  \`name: "2026-27"\`
);
code = code.replace(
  /periodName: "Apr 2026"/,
  \`name: "Apr 2026"\`
);
fs.writeFileSync(path, code, "utf8");

