
import os

with open("backend/src/services/manufacturing/productionExecutionService.ts", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("let totalActualCost = consumeQty * 50;", "let totalActualCost = 0;")
data = data.replace("totalActualCost = consumeQty * 50;", "totalActualCost += consumeQty * 50;")

with open("backend/src/services/manufacturing/productionExecutionService.ts", "w", encoding="utf-8") as f:
    f.write(data)

