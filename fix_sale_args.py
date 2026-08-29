
import os

with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("const sale = await createSaleInternal(t1.id, t1Cust.id, new Date(), \"COMPLETED\", [{ materialId: t1FG.id, quantity: 5, unitPrice: 500, gstRate: 18 }]);", "const sale = await createSaleInternal(t1.id, t1Cust.id, new Date().toISOString(), new Date().toISOString(), \"\", \"\", \"\", [{ materialId: t1FG.id, quantity: 5, unitPrice: 500, gstRate: 18, unit: \"PCS\" }], prisma);")

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)

