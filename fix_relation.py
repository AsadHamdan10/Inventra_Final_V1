
import os

with open("backend/src/services/inventory/inventoryOperationService.ts", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("stockTransferId: transfer.id,", "stockTransfer: { connect: { id: transfer.id } },")
data = data.replace("materialId: item.materialId,", "material: { connect: { id: item.materialId } },")

with open("backend/src/services/inventory/inventoryOperationService.ts", "w", encoding="utf-8") as f:
    f.write(data)

