import os
with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

data = data.replace("const saleService = require('./dist/services/saleInternalService').saleInternalService;", "const { createSaleInternal } = require('./dist/services/saleInternalService');")
data = data.replace("""const sale = await saleService.create(t1.id, {
    customerId: t1Cust.id,
    date: new Date(),
    status: 'COMPLETED', // Completed triggers accounting & inventory
    items: [{ materialId: t1FG.id, quantity: 5, unitPrice: 500, gstRate: 18 }]
  });""", "const sale = await createSaleInternal(t1.id, t1Cust.id, new Date(), \"COMPLETED\", [{ materialId: t1FG.id, quantity: 5, unitPrice: 500, gstRate: 18 }]);")

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)
