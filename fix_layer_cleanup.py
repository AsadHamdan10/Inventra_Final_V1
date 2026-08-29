
import os
with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("material: { userId: t1.id }", "userId: t1.id")
data = data.replace("material: { userId: t2.id }", "userId: t2.id")
data = data.replace("await prisma.layerConsumption.deleteMany({ where: { userId: t1.id } });", "await prisma.layerConsumption.deleteMany();")
data = data.replace("await prisma.inventoryLayer.deleteMany({ where: { userId: t1.id } });", "await prisma.inventoryLayer.deleteMany();")
data = data.replace("await prisma.inventoryLedger.deleteMany({ where: { userId: t1.id } });", "await prisma.inventoryLedger.deleteMany();")
data = data.replace("await prisma.inventoryLedger.deleteMany({ where: { userId: t2.id } });", "")

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)

