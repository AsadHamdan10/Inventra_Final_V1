
import os
import re

with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

bom_fix = """  const bom = await bomService.createBOM(t1.id, {
    bomCode: "BOM-001",
    finishedGoodItemId: t1FG.id,
    name: "Standard FG BOM",
    effectiveFrom: new Date(),
    outputQuantity: 1,
    outputUnit: "PCS",
    items: [{ componentItemId: t1Mat.id, quantity: 2, unit: "KG" }]
  });
  await bomService.activateBOM(t1.id, bom.id);"""

data = re.sub(r"const bom = await bomService\.createBOM.*?activateBOM\(t1\.id, bom\.id\);", bom_fix, data, flags=re.DOTALL)

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)

