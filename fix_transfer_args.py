
import os

with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("""    const transfer = await transferService.postStockTransfer(t1.id, {
      date: new Date(),
      fromWarehouseId: t1Wh1.id,
      toWarehouseId: t1Wh2.id,
      items: [{ materialId: t1Mat.id, quantity: 40 }]
    });""", "const transfer = await transferService.postStockTransfer(t1.id, \"TR-001\", new Date(), t1Wh1.id, t1Wh2.id, [{ materialId: t1Mat.id, quantity: 40 }], t1.id, \"Testing Transfer\");")

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)

