
import os
import re

with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

mfg_fix = """
    // Issue materials
    const exec = await prodExecService.startExecution(t1.id, pOrder.id, t1.id);
    await prodExecService.postMaterialIssue(t1.id, exec.id, t1Mat.id, t1Wh1.id, 20, t1.id);

    wh1In = await prisma.inventoryLedger.aggregate({ where: { materialId: t1Mat.id, warehouseId: t1Wh1.id, movementType: "IN" }, _sum: { quantity: true } });
    wh1Out = await prisma.inventoryLedger.aggregate({ where: { materialId: t1Mat.id, warehouseId: t1Wh1.id, movementType: "OUT" }, _sum: { quantity: true } });
    wh1Stock = (Number(wh1In._sum.quantity || 0)) - (Number(wh1Out._sum.quantity || 0));
    assert.strictEqual(wh1Stock, 40, "Warehouse 1 raw material reduced by 20");

    // Output production
    await prodExecService.postProductionOutput(t1.id, exec.id, 10, t1.id);
"""

data = re.sub(r"// Issue materials.*?date: new Date\(\)\n    \}\);", mfg_fix, data, flags=re.DOTALL)

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)

