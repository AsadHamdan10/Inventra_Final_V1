
import os
with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("await prisma.productionOrderComponent.deleteMany({ where: { execution: { productionOrder: { userId: t1.id } } } });", "await prisma.productionOrderComponent.deleteMany({ where: { productionOrder: { userId: t1.id } } });")
data = data.replace("await prisma.productionExecution.deleteMany({ where: { execution: { productionOrder: { userId: t1.id } } } });", "await prisma.productionExecution.deleteMany({ where: { productionOrder: { userId: t1.id } } });")

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)

