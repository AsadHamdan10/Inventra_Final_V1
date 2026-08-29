import os

with open("backend/src/services/inventory/inventoryOperationService.ts", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("stockTransfer: { connect: { id: transfer.id } },", "stockTransferId: transfer.id,")
data = data.replace("material: { connect: { id: item.materialId } },", "materialId: item.materialId,")

with open("backend/src/services/inventory/inventoryOperationService.ts", "w", encoding="utf-8") as f:
    f.write(data)
