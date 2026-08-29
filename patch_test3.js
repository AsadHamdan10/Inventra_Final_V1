
const fs = require("fs");
const path = "backend/test_phase_6_8_api_integration2.js";
let code = fs.readFileSync(path, "utf8");
code = code.replace(
  /const \{ createFinancialYear \} = require\("\.\/src\/services\/financialPeriodService"\);\s*await createFinancialYear\(t1\.id, \{\s*yearName: "2026-27", startDate: new Date\("2026-04-01"\), endDate: new Date\("2027-03-31"\), isActive: true\s*\}\);/,
  `await prisma.financialYear.create({
            data: { userId: t1.id, yearName: "2026-27", startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), isActive: true }
        });
        await prisma.accountingPeriod.create({
            data: { userId: t1.id, periodName: "Apr 2026", startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "OPEN" }
        });`
);
fs.writeFileSync(path, code, "utf8");

