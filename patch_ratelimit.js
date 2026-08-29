
const fs = require("fs");

// 1. authController.ts
let auth = fs.readFileSync("backend/src/controllers/authController.ts", "utf8");
auth = auth.replace(
  /message: \{ success: false, message: .Too many login attempts[^}]+\},/,
  `message: { success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many login attempts. Please try again in 5 minutes." } },`
);
fs.writeFileSync("backend/src/controllers/authController.ts", auth, "utf8");

// 2. index.ts
let idx = fs.readFileSync("backend/src/index.ts", "utf8");
idx = idx.replace(
  /message: \{ error: .Too many requests[^}]+\},/,
  `message: { success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests from this IP, please try again after 15 minutes." } },`
);
fs.writeFileSync("backend/src/index.ts", idx, "utf8");

console.log("Rate limits patched");

