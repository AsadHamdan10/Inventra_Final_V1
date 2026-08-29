
import os
with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("await prisma.stockTransferItem.deleteMany({ where: { transfer: { userId: t1.id } } });", "await prisma.stockTransferItem.deleteMany({ where: { stockTransfer: { userId: t1.id } } });")

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)

