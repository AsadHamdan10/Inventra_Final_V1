
import re

with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

fy_code = """
  for (const t of [t1, t2]) {
    const fy = await prisma.financialYear.create({
      data: {
        userId: t.id, name: "2026-2027", startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "OPEN"
      }
    });
    for (let month = 4; month <= 15; month++) {
        let m = month > 12 ? month - 12 : month;
        let y = month > 12 ? 2027 : 2026;
        let start = new Date(Date.UTC(y, m - 1, 1));
        let end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
        await prisma.accountingPeriod.create({
            data: {
                financialYearId: fy.id,
                periodName: `${y}-${m < 10 ? "0"+m : m}`,
                startDate: start,
                endDate: end,
                status: "OPEN"
            }
        });
    }
  }
"""

data = re.sub(r"const t1 = t1Res\.user;\n  const t2 = t2Res\.user;", "const t1 = t1Res.user;\n  const t2 = t2Res.user;\n" + fy_code, data, flags=re.DOTALL)

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)

