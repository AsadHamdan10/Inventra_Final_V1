const fs = require("fs");
let admin = fs.readFileSync("backend/src/controllers/adminController.ts", "utf8");
admin = admin.replace(/\}\n\}\n\n\nexport async function rejectUser/g, "}\n\nexport async function rejectUser");
admin = admin.replace(/\}\n\}\n\nexport async function suspendUser/g, "}\n\nexport async function suspendUser");
fs.writeFileSync("backend/src/controllers/adminController.ts", admin, "utf8");
