
import os
with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("await prisma.goodsReceiptItem.deleteMany({ where: { receipt: { userId: t1.id } } });", "await prisma.goodsReceiptItem.deleteMany({ where: { goodsReceipt: { userId: t1.id } } });")
data = data.replace("await prisma.goodsReceiptItem.deleteMany({ where: { receipt: { userId: t2.id } } });", "await prisma.goodsReceiptItem.deleteMany({ where: { goodsReceipt: { userId: t2.id } } });")
data = data.replace("await prisma.purchaseOrderItem.deleteMany({ where: { order: { userId: t1.id } } });", "await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { userId: t1.id } } });")
data = data.replace("await prisma.purchaseOrderItem.deleteMany({ where: { order: { userId: t2.id } } });", "await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { userId: t2.id } } });")

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)

