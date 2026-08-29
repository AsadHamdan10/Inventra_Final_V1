const fs = require("fs");
let admin = fs.readFileSync("backend/src/controllers/adminController.ts", "utf8");
admin = admin.replace(/\} catch \(err\) \{ next\(err\); \}\n\}\n\}\n\n\nexport async function rejectUser/g, "} catch (err) { next(err); }\n}\n\nexport async function rejectUser");
admin = admin.replace(/\} catch \(err\) \{ next\(err\); \}\n\}\n\}\n\nexport async function suspendUser/g, "} catch (err) { next(err); }\n}\n\nexport async function suspendUser");
fs.writeFileSync("backend/src/controllers/adminController.ts", admin, "utf8");
