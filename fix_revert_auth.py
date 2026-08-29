
import re

with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

target = """  const authService = require("./dist/services/authService");
  const t1Res = await authService.register({ fullName: "Tenant 1", companyName: "Tenant 1", email: "t1@ex.com", password: "password123", role: "admin", status: "active", plan: "V1_BASIC" });
  const t2Res = await authService.register({ fullName: "Tenant 2", companyName: "Tenant 2", email: "t2@ex.com", password: "password123", role: "admin", status: "active", plan: "V1_BASIC" });
  const t1 = t1Res.user;
  const t2 = t2Res.user;"""

new_code = """
  const t1 = await prisma.user.create({ data: { fullName: "Tenant 1", companyName: "Tenant 1", username: "tenant_1", email: "t1@ex.com", role: "admin", status: "active", plan: "V1_BASIC" } });
  const t2 = await prisma.user.create({ data: { fullName: "Tenant 2", companyName: "Tenant 2", username: "tenant_2", email: "t2@ex.com", role: "admin", status: "active", plan: "V1_BASIC" } });
"""

data = data.replace(target, new_code)

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)

