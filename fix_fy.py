import os
import re

with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

fy_code = """
  await prisma.financialYear.create({
    data: {
      userId: t1.id,
      yearName: "2026-2027",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2027-03-31"),
      isActive: true,
      isClosed: false
    }
  });
  await prisma.financialYear.create({
    data: {
      userId: t2.id,
      yearName: "2026-2027",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2027-03-31"),
      isActive: true,
      isClosed: false
    }
  });
"""

data = re.sub(r'const t2 = await prisma\.user\.create\(.*?\);', 'const t2 = await prisma.user.create({ data: { fullName: "Tenant 2", companyName: "Tenant 2", username: "tenant_2", email: "t2@ex.com", role: "admin", status: "active", plan: "V1_BASIC" } });\n' + fy_code, data, flags=re.DOTALL)

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)
