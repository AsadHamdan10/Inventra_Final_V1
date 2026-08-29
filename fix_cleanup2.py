
import os

with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

cleanup2 = """
  await prisma.stockTransferItem.deleteMany();
  await prisma.stockTransfer.deleteMany();
"""

data = data.replace("await prisma.goodsReceiptItem.deleteMany();", cleanup2 + "\n  await prisma.goodsReceiptItem.deleteMany();")

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)

