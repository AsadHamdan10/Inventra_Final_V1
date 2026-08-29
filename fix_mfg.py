
import os
import re

with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

bom_fix = """  const bom = await bomService.createBOM(t1.id, {
    finishedGoodItemId: t1FG.id,
    name: "Standard FG BOM",
    effectiveFrom: new Date(),
    items: [{ componentItemId: t1Mat.id, quantity: 2, unit: "KG" }]
  });
  await bomService.activateBOM(t1.id, bom.id);"""

data = re.sub(r"const bom = await bomService\.createBom.*?\}\);", bom_fix, data, flags=re.DOTALL)

porder_fix = """  const pOrder = await prodOrderService.createProductionOrder(t1.id, {
    itemId: t1FG.id,
    plannedQuantity: 10,
    plannedStartDate: new Date(),
    plannedEndDate: new Date(),
    warehouseId: t1Wh1.id,
    productionDate: new Date(),
    bomId: bom.id
  });"""

data = re.sub(r"const pOrder = await prodOrderService\.createProductionOrder.*?\}\);", porder_fix, data, flags=re.DOTALL)

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)

