
import os

with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

cleanup = """
  await prisma.goodsReceiptItem.deleteMany();
  await prisma.goodsReceipt.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.productionMaterialIssue.deleteMany();
  await prisma.productionOutput.deleteMany();
  await prisma.productionExecution.deleteMany();
  await prisma.productionOrderComponent.deleteMany();
  await prisma.productionOrder.deleteMany();
  await prisma.billOfMaterialItem.deleteMany();
  await prisma.billOfMaterial.deleteMany();
  await prisma.routingOperation.deleteMany();
  await prisma.routing.deleteMany();
"""

data = data.replace("// Create two tenants for isolation testing", cleanup + "\n  // Create two tenants for isolation testing")

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)

