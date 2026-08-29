
const fs = require("fs");

let data = fs.readFileSync("backend/src/controllers/authController.ts", "utf-8");

const createStr = `const user = await prisma.user.create({
      data: {
        fullName:        d.fullName,
          companyName:     d.companyName,
        username:        d.username,
        email:           d.email,
        mobile:          encryptIfPresent(d.mobile),
        mobileHash:      blindIndex(d.mobile),
        role:            "admin",
        status:          "pending",
        applicationRef,
        plan:            d.plan,
      }
    });`;

const replaceStr = `const user = await prisma.user.create({
      data: {
        fullName:        d.fullName,
          companyName:     d.companyName,
        username:        d.username,
        email:           d.email,
        mobile:          encryptIfPresent(d.mobile),
        mobileHash:      blindIndex(d.mobile),
        role:            "admin",
        status:          "pending",
        applicationRef,
        plan:            d.plan,
        applicationSnapshot: {
          create: {
            applicationRef,
            fullName: d.fullName,
            companyName: d.companyName,
            username: d.username,
            email: d.email,
            mobile: d.mobile,
            businessType: d.businessType || "TRADING",
            industry: d.industry || "",
            plan: d.plan || "PROFESSIONAL",
            billingCycle: d.billingCycle || "YEARLY",
            originalStatus: "pending"
          }
        }
      }
    });`;

data = data.replace(createStr, replaceStr);
fs.writeFileSync("backend/src/controllers/authController.ts", data);
console.log("Patched authController.ts");

