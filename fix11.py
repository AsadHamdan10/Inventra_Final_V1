
with open("backend/test_phase_6_5_e2e_integration.js", "r", encoding="utf-8") as f:
    data = f.read()
data = data.replace("require('./dist/services/procurement/purchaseOrderService').purchaseOrderService", "require('./dist/services/procurement/purchaseOrderService')")
data = data.replace("require('./dist/services/procurement/goodsReceiptService').goodsReceiptService", "require('./dist/services/procurement/goodsReceiptService')")
data = data.replace("purchaseService.create", "purchaseService.createPurchaseOrder")
data = data.replace("purchaseService.updateStatus", "purchaseService.updatePurchaseOrderStatus")
data = data.replace("grnService.create(", "grnService.createGoodsReceipt(")

data = data.replace("require('./dist/services/inventory/stockTransferService').stockTransferService", "require('./dist/services/inventory/stockTransferService')")
data = data.replace("transferService.create(", "transferService.createStockTransfer(")

data = data.replace("require('./dist/services/manufacturing/bomService').bomService", "require('./dist/services/manufacturing/bomService')")
data = data.replace("require('./dist/services/manufacturing/productionOrderService').productionOrderService", "require('./dist/services/manufacturing/productionOrderService')")
data = data.replace("require('./dist/services/manufacturing/productionExecutionService').productionExecutionService", "require('./dist/services/manufacturing/productionExecutionService')")
data = data.replace("bomService.create(", "bomService.createBom(")
data = data.replace("prodOrderService.create(", "prodOrderService.createProductionOrder(")
data = data.replace("prodOrderService.updateStatus(", "prodOrderService.updateProductionOrderStatus(")

data = data.replace("saleService.createSale(", "saleService.create(")
with open("backend/test_phase_6_5_e2e_integration.js", "w", encoding="utf-8") as f:
    f.write(data)

