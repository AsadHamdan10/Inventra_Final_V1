
const fs = require("fs");
const path = "backend/test_phase_6_8_api_integration2.js";
let code = fs.readFileSync(path, "utf8");
code = code.replace(
  /await initializeDefaultCOA\(t1\.id\);/,
  `await initializeDefaultCOA(t1.id);
        const { createFinancialYear } = require("./src/services/financialPeriodService");
        await createFinancialYear(t1.id, {
            yearName: "2026-27", startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), isActive: true
        });`
);
fs.writeFileSync(path, code, "utf8");

