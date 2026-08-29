import os

with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

po_payload = """
  const po = await purchaseService.createPurchaseOrder(t1.id, {
    vendorId: t1Vend.id,
    vendorName: t1Vend.vendorName || "Vendor",
    warehouseId: t1Wh1.id,
    orderDate: new Date(),
    expectedDeliveryDate: new Date(),
    items: [{ materialId: t1Mat.id, materialName: t1Mat.materialName, orderedQty: 100, pendingQty: 100, unit: "KG", rate: 50, gstPercent: 18, taxableAmount: 5000, gstAmount: 900, itemTotal: 5900 }]
  });
"""

data = data.replace("""  const po = await purchaseService.createPurchaseOrder(t1.id, {
    vendorId: t1Vend.id,
    date: new Date(),
    expectedDate: new Date(),
    status: 'DRAFT',
    items: [{ materialId: t1Mat.id, quantity: 100, unitPrice: 50, gstRate: 18 }]
  });""", po_payload)

grn_payload = """
  const grn = await grnService.createGoodsReceipt(t1.id, {
    purchaseOrderId: po.id,
    vendorId: t1Vend.id,
    vendorName: t1Vend.vendorName || "Vendor",
    grnDate: new Date(),
    deliveryChallanNo: 'CH-01',
    warehouseId: t1Wh1.id,
    items: [{ purchaseOrderItemId: po.items[0].id, materialId: t1Mat.id, materialName: t1Mat.materialName, receivedQuantity: 100, acceptedQuantity: 100, rejectedQuantity: 0, unit: "KG", rate: 50 }]
  });
"""

data = data.replace("""  const grn = await grnService.createGoodsReceipt(t1.id, {
    purchaseOrderId: po.id,
    vendorId: t1Vend.id,
    date: new Date(),
    challanNo: 'CH-01',
    warehouseId: t1Wh1.id,
    items: [{ purchaseOrderItemId: po.items[0].id, materialId: t1Mat.id, acceptedQuantity: 100, rejectedQuantity: 0, unitPrice: 50 }]
  });""", grn_payload)

transfer_payload = """
  const transfer = await transferService.postStockTransfer(t1.id, "TR-001", new Date(), t1Wh1.id, t1Wh2.id, [{ materialId: t1Mat.id, quantity: 40 }], t1.id, "Testing Transfer");
"""

data = data.replace("""  const transfer = await transferService.createStockTransfer(t1.id, {
    sourceWarehouseId: t1Wh1.id,
    destinationWarehouseId: t1Wh2.id,
    date: new Date(),
    status: 'COMPLETED',
    items: [{ materialId: t1Mat.id, quantity: 40 }]
  });""", transfer_payload)

bom_payload = """
  const bom = await bomService.createBOM(t1.id, {
    finishedGoodItemId: t1FG.id,
    name: "Test BOM",
    effectiveFrom: new Date(),
    items: [{ componentItemId: t1Mat.id, quantity: 2, unit: "KG" }]
  });
"""

data = data.replace("""  const bom = await bomService.createBom(t1.id, {
    finishedGoodId: t1FG.id,
    items: [{ materialId: t1Mat.id, quantity: 2 }]
  });""", bom_payload)

prod_order_payload = """
  const prodOrder = await prodOrderService.createProductionOrder(t1.id, {
    itemId: t1FG.id,
    plannedQuantity: 10,
    warehouseId: t1Wh1.id,
    productionDate: new Date(),
    bomId: bom.id
  });
"""

data = data.replace("""  const prodOrder = await prodOrderService.createProductionOrder(t1.id, {
    bomId: bom.id,
    warehouseId: t1Wh1.id,
    quantity: 10
  });""", prod_order_payload)

exec_payload = """
  const exec = await require('./dist/services/manufacturing/productionExecutionService').startExecution(t1.id, prodOrder.id, t1.id);
  await require('./dist/services/manufacturing/productionExecutionService').postMaterialIssue(t1.id, exec.id, t1Mat.id, t1Wh1.id, 20, t1.id);
  await require('./dist/services/manufacturing/productionExecutionService').postProductionOutput(t1.id, exec.id, 10, t1.id);
"""

data = data.replace("""  await prodOrderService.updateProductionOrderStatus(t1.id, prodOrder.id, 'COMPLETED');""", exec_payload)


with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)
