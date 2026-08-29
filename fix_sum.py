
import os

with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

replacement = """
    let wh1In = await prisma.inventoryLedger.aggregate({ where: { materialId: t1Mat.id, warehouseId: t1Wh1.id, movementType: "IN" }, _sum: { quantity: true } });
    let wh1Out = await prisma.inventoryLedger.aggregate({ where: { materialId: t1Mat.id, warehouseId: t1Wh1.id, movementType: "OUT" }, _sum: { quantity: true } });
    let wh1Stock = (Number(wh1In._sum.quantity || 0)) - (Number(wh1Out._sum.quantity || 0));

    let wh2In = await prisma.inventoryLedger.aggregate({ where: { materialId: t1Mat.id, warehouseId: t1Wh2.id, movementType: "IN" }, _sum: { quantity: true } });
    let wh2Out = await prisma.inventoryLedger.aggregate({ where: { materialId: t1Mat.id, warehouseId: t1Wh2.id, movementType: "OUT" }, _sum: { quantity: true } });
    let wh2Stock = (Number(wh2In._sum.quantity || 0)) - (Number(wh2Out._sum.quantity || 0));

    assert.strictEqual(wh1Stock, 60, "Warehouse 1 stock reduced");
    assert.strictEqual(wh2Stock, 40, "Warehouse 2 stock increased");
"""

import re
data = re.sub(r"let wh1Stock = await prisma\.inventoryLedger.*?\"Warehouse 2 stock increased\"\);", replacement, data, flags=re.DOTALL)

data = data.replace("wh1Stock = await prisma.inventoryLedger.aggregate({ where: { materialId: t1Mat.id, warehouseId: t1Wh1.id }, _sum: { quantity: true } });", "wh1Out = await prisma.inventoryLedger.aggregate({ where: { materialId: t1Mat.id, warehouseId: t1Wh1.id, movementType: \"OUT\" }, _sum: { quantity: true } });\n    wh1Stock = (Number(wh1In._sum.quantity || 0)) - (Number(wh1Out._sum.quantity || 0));")

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)

