import os
import re

with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

tenant_code = """
  const authService = require("./dist/services/authService");
  const t1Res = await authService.register({ fullName: "Tenant 1", companyName: "Tenant 1", email: "t1@ex.com", password: "password123", role: "admin", status: "active", plan: "V1_BASIC" });
  const t2Res = await authService.register({ fullName: "Tenant 2", companyName: "Tenant 2", email: "t2@ex.com", password: "password123", role: "admin", status: "active", plan: "V1_BASIC" });
  const t1 = t1Res.user;
  const t2 = t2Res.user;
"""

# I need to match everything between `const t1 = ` and `} catch(e) {}` and replace it.
# Instead of regex, I will just manually find and slice.

idx_start = data.find("const t1 = await prisma.user.create")
idx_end = data.rfind("} catch(e) {}") + len("} catch(e) {}")

if idx_start != -1 and idx_end != -1:
    data = data[:idx_start] + tenant_code + data[idx_end:]

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)
