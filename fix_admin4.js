const fs = require("fs");
let admin = fs.readFileSync("backend/src/controllers/adminController.ts", "utf8");
// Normalize newlines to \n for easier regex
admin = admin.replace(/\r\n/g, "\n");
admin = admin.replace(/\} catch \(err\) \{ next\(err\); \}\n\}\n\}\n\n\nexport async function rejectUser/g, "} catch (err) { next(err); }\n}\n\nexport async function rejectUser");
admin = admin.replace(/\} catch \(err\) \{ next\(err\); \}\n\}\n\}\n\nexport async function suspendUser/g, "} catch (err) { next(err); }\n}\n\nexport async function suspendUser");
// Also remove extra closing brace if any
admin = admin.replace(/\n\}\n\nexport async function/g, "\n\nexport async function");
fs.writeFileSync("backend/src/controllers/adminController.ts", admin, "utf8");
