import re
with open("backend/src/services/inventory/inventoryOperationService.ts", "r", encoding="utf-8") as f:
    data = f.read()

data = re.sub(r"totalActualCost \+= consumeQty \* costPerUnit;", "totalActualCost = 0;", data)

with open("backend/src/services/inventory/inventoryOperationService.ts", "w", encoding="utf-8") as f:
    f.write(data)
