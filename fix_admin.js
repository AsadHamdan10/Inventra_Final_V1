const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "backend/src/controllers/adminController.ts");
let content = fs.readFileSync(file, "utf8");
content = content.replace(/\n\}\n\n\}\n\n\nexport async function rejectUser/g, "\n}\n\nexport async function rejectUser");
content = content.replace(/\n\}\n\n\}\n\nexport async function suspendUser/g, "\n}\n\nexport async function suspendUser");
fs.writeFileSync(file, content, "utf8");
