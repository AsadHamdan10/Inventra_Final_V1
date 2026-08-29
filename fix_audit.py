
import os

with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("await prisma.stockTransfer.deleteMany();", "await prisma.stockTransfer.deleteMany();\n  await prisma.auditLog.deleteMany();")

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)

