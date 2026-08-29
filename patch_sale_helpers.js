
const fs = require("fs");
const path = "backend/src/services/saleInternalService.ts";
let code = fs.readFileSync(path, "utf8");

code = code.replace(
  /import \{ toTextOrNull, toDateOrNull \} from "\.\.\/utils\/helpers";/,
  `function toTextOrNull(v: any) { return v ? String(v).trim() : null; }
function toDateOrNull(v: any) { return v ? new Date(v) : null; }`
);

fs.writeFileSync(path, code, "utf8");

