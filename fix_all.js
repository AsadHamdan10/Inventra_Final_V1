const fs = require("fs");

function removeBackslashes(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  // Only remove backslashes before backticks and dollar signs if it was a mistake.
  content = content.replace(/\\`/g, "`");
  content = content.replace(/\\\$/g, "$");
  fs.writeFileSync(filePath, content, "utf8");
}

removeBackslashes("frontend/src/pages/admin/AdminUsersPage.tsx");
removeBackslashes("frontend/src/pages/auth/RegisterPage.tsx");

// Fix admin controller
let admin = fs.readFileSync("backend/src/controllers/adminController.ts", "utf8");
admin = admin.replace(/\n\}\n\n\}\n\n\nexport async function rejectUser/g, "\n}\n\nexport async function rejectUser");
admin = admin.replace(/\n\}\n\n\}\n\nexport async function suspendUser/g, "\n}\n\nexport async function suspendUser");
fs.writeFileSync("backend/src/controllers/adminController.ts", admin, "utf8");

