
import os

with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

target = """      data: { fullName: "Tenant 2", companyName: "Tenant 2", username: "tenant_2", email: "t2@ex.com", role: "admin", status: "active", plan: "V1_BASIC" }
    });"""

data = data.replace(target, "")

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)

