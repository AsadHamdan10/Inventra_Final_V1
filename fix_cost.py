
import os

with open("backend/src/services/manufacturing/productionExecutionService.ts", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("totalActualCost = 0;", "totalActualCost = consumeQty * 50;")

with open("backend/src/services/manufacturing/productionExecutionService.ts", "w", encoding="utf-8") as f:
    f.write(data)

