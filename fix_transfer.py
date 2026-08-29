
import os

with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("./dist/services/inventory/stockTransferService", "./dist/services/inventory/inventoryOperationService")
data = data.replace("transferService.postStockTransfer", "transferService.createStockTransfer")

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)

