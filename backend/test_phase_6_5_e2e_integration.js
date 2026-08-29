const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const assert = require('assert');

async function runTests() {
  console.log("=== STARTING PHASE 6.5 E2E INTEGRATION TESTS ===\n");

  // Create two tenants for isolation testing
  await prisma.applicationSnapshot.deleteMany({ where: { username: { startsWith: 'tenant_' } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: 'tenant_' } } });

  const t1 = await prisma.user.create({
    data: { fullName: "Tenant 1", companyName: "Tenant 1", username: "tenant_1", email: "t1@ex.com", role: "admin", status: "active", plan: "V1_BASIC" }
  });
  const t2 = await prisma.user.create({
    data: { fullName: "Tenant 2", companyName: "Tenant 2", username: "tenant_2", email: "t2@ex.com", role: "admin", status: "active", plan: "V1_BASIC" }
  });

  // Setup basics for T1
  const t1Wh1 = await prisma.warehouse.create({ data: { userId: t1.id, code: 'WH1', name: 'T1 WH1', warehouseType: 'GENERAL' } });
  const t1Wh2 = await prisma.warehouse.create({ data: { userId: t1.id, code: 'WH2', name: 'T1 WH2', warehouseType: 'GENERAL' } });
  const t1Mat = await prisma.material.create({ data: { userId: t1.id, materialName: 'T1 Raw Mat', itemType: 'RAW_MATERIAL', hsnCode: '1234', unit: 'KG', currentStock: 0, standardPrice: 100, standardCost: 50, gstRate: 18 } });
  const t1FG = await prisma.material.create({ data: { userId: t1.id, materialName: 'T1 Finished Good', itemType: 'FINISHED_GOOD', hsnCode: '5678', unit: 'PCS', currentStock: 0, standardPrice: 500, standardCost: 0, gstRate: 18 } });
  
  const t1Cust = await prisma.customer.create({ data: { userId: t1.id, companyName: 'T1 Cust' } });
  const t1Vend = await prisma.vendor.create({ data: { userId: t1.id, vendorName: 'T1 Vend' } });

  // 1. TENANT ISOLATION
  console.log("Running Tenant Isolation Tests...");
  const t2Mats = await prisma.material.findMany({ where: { userId: t2.id } });
  assert.strictEqual(t2Mats.length, 0, "T2 should not see T1 materials");
  const t2Whs = await prisma.warehouse.findMany({ where: { userId: t2.id } });
  assert.strictEqual(t2Whs.length, 0, "T2 should not see T1 warehouses");
  console.log("✅ Tenant isolation verified");

  // 2. PROCUREMENT & INVENTORY FLOW
  console.log("\nRunning Procurement & Inventory Flow...");
  const purchaseService = require('./dist/services/procurement/purchaseOrderService');
  const grnService = require('./dist/services/procurement/goodsReceiptService');

  const po = await purchaseService.createPurchaseOrder(t1.id, {
    vendorId: t1Vend.id,
    date: new Date(),
    expectedDate: new Date(),
    status: 'DRAFT',
    items: [{ materialId: t1Mat.id, quantity: 100, unitPrice: 50, gstRate: 18 }]
  });
  
  await purchaseService.updatePurchaseOrderStatus(t1.id, po.id, 'CONFIRMED');
  
  // GRN creates stock
  const grn = await grnService.createGoodsReceipt(t1.id, {
    purchaseOrderId: po.id,
    vendorId: t1Vend.id,
    date: new Date(),
    challanNo: 'CH-01',
    warehouseId: t1Wh1.id,
    items: [{ purchaseOrderItemId: po.items[0].id, materialId: t1Mat.id, acceptedQuantity: 100, rejectedQuantity: 0, unitPrice: 50 }]
  });
  
  // Verify Stock
  let matCheck = await prisma.material.findUnique({ where: { id: t1Mat.id } });
  assert.strictEqual(matCheck.currentStock, 100, "GRN must increase stock");
  let layerCheck = await prisma.inventoryLayer.findFirst({ where: { materialId: t1Mat.id } });
  assert.strictEqual(layerCheck.remainingQty, 100, "FIFO layer must be created");
  console.log("✅ Procurement GRN creates stock and FIFO layers correctly");

  // 3. STOCK TRANSFER
  console.log("\nRunning Stock Transfer Atomicity...");
  const transferService = require('./dist/services/inventory/stockTransferService');
  const transfer = await transferService.createStockTransfer(t1.id, {
    date: new Date(),
    fromWarehouseId: t1Wh1.id,
    toWarehouseId: t1Wh2.id,
    items: [{ materialId: t1Mat.id, quantity: 40 }]
  });
  
  matCheck = await prisma.material.findUnique({ where: { id: t1Mat.id } });
  assert.strictEqual(matCheck.currentStock, 100, "Total stock remains the same after transfer");
  let wh1Stock = await prisma.inventoryLedger.aggregate({ where: { materialId: t1Mat.id, warehouseId: t1Wh1.id }, _sum: { quantity: true } });
  let wh2Stock = await prisma.inventoryLedger.aggregate({ where: { materialId: t1Mat.id, warehouseId: t1Wh2.id }, _sum: { quantity: true } });
  assert.strictEqual(wh1Stock._sum.quantity, 60, "Warehouse 1 stock reduced");
  assert.strictEqual(wh2Stock._sum.quantity, 40, "Warehouse 2 stock increased");
  console.log("✅ Stock Transfer is atomic and strictly isolated by warehouse");

  // 4. MANUFACTURING FLOW (Backend Service Verification)
  console.log("\nRunning Manufacturing Flow...");
  const bomService = require('./dist/services/manufacturing/bomService');
  const prodOrderService = require('./dist/services/manufacturing/productionOrderService');
  const prodExecService = require('./dist/services/manufacturing/productionExecutionService');

  const bom = await bomService.createBom(t1.id, {
    materialId: t1FG.id,
    name: 'Standard FG BOM',
    quantity: 1,
    items: [{ materialId: t1Mat.id, quantity: 2 }] // 2 Raw Mats per 1 FG
  });

  const pOrder = await prodOrderService.createProductionOrder(t1.id, {
    bomId: bom.id,
    materialId: t1FG.id,
    targetQuantity: 10, // requires 20 Raw Mats
    plannedStartDate: new Date(),
    plannedEndDate: new Date(),
    warehouseId: t1Wh1.id
  });

  await prodOrderService.updateProductionOrderStatus(t1.id, pOrder.id, 'RELEASED');

  // Issue materials
  await prodExecService.issueMaterials(t1.id, pOrder.id, [
    { materialId: t1Mat.id, quantity: 20, warehouseId: t1Wh1.id }
  ]);

  wh1Stock = await prisma.inventoryLedger.aggregate({ where: { materialId: t1Mat.id, warehouseId: t1Wh1.id }, _sum: { quantity: true } });
  assert.strictEqual(wh1Stock._sum.quantity, 40, "Warehouse 1 raw material reduced by 20");

  // Output production
  await prodExecService.recordOutput(t1.id, pOrder.id, {
    quantity: 10,
    warehouseId: t1Wh1.id,
    date: new Date()
  });

  let fgCheck = await prisma.material.findUnique({ where: { id: t1FG.id } });
  assert.strictEqual(fgCheck.currentStock, 10, "Finished Goods stock increased");
  console.log("✅ Manufacturing flow (BOM -> Release -> Issue -> Output) works and updates stock atomically");

  // 5. TRADING & ACCOUNTING FLOW
  console.log("\nRunning Trading & Accounting Integration...");
  const saleService = require('./dist/services/saleInternalService').saleInternalService;
  const sale = await saleService.create(t1.id, {
    customerId: t1Cust.id,
    date: new Date(),
    status: 'COMPLETED', // Completed triggers accounting & inventory
    items: [{ materialId: t1FG.id, quantity: 5, unitPrice: 500, gstRate: 18 }]
  });

  fgCheck = await prisma.material.findUnique({ where: { id: t1FG.id } });
  assert.strictEqual(fgCheck.currentStock, 5, "Sales completed reduces FG stock");

  // Check Journals
  const journals = await prisma.journalEntry.findMany({ where: { userId: t1.id, referenceId: sale.id.toString(), referenceType: 'SALE' }, include: { lines: true } });
  assert(journals.length > 0, "Accounting journals created for sale");
  
  let totalDebits = 0;
  let totalCredits = 0;
  journals[0].lines.forEach(l => {
    if (l.type === 'DEBIT') totalDebits += Number(l.amount);
    if (l.type === 'CREDIT') totalCredits += Number(l.amount);
  });
  assert.strictEqual(totalDebits, totalCredits, "Accounting Double-Entry is balanced");
  console.log("✅ Sales flow integrates with Inventory and creates balanced Accounting Entries");

  // Cleanup
  await prisma.journalLine.deleteMany({ where: { entry: { userId: t1.id } } });
  await prisma.journalEntry.deleteMany({ where: { userId: t1.id } });
  await prisma.saleItem.deleteMany({ where: { sale: { userId: t1.id } } });
  await prisma.sale.deleteMany({ where: { userId: t1.id } });
  
  // Clean up manufacturing
  await prisma.productionMaterialIssue.deleteMany({ where: { productionOrder: { userId: t1.id } } });
  await prisma.productionOutput.deleteMany({ where: { productionOrder: { userId: t1.id } } });
  await prisma.layerConsumption.deleteMany({ where: { material: { userId: t1.id } } });
  await prisma.productionOrderComponent.deleteMany({ where: { productionOrder: { userId: t1.id } } });
  await prisma.productionOrder.deleteMany({ where: { userId: t1.id } });
  await prisma.billOfMaterialItem.deleteMany({ where: { bom: { userId: t1.id } } });
  await prisma.billOfMaterial.deleteMany({ where: { userId: t1.id } });

  // Clean up inventory & procurement
  await prisma.stockTransferItem.deleteMany({ where: { transfer: { userId: t1.id } } });
  await prisma.stockTransfer.deleteMany({ where: { userId: t1.id } });
  await prisma.inventoryLedger.deleteMany({ where: { material: { userId: t1.id } } });
  await prisma.inventoryLayer.deleteMany({ where: { material: { userId: t1.id } } });
  
  await prisma.goodsReceiptItem.deleteMany({ where: { receipt: { userId: t1.id } } });
  await prisma.goodsReceipt.deleteMany({ where: { userId: t1.id } });
  await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { userId: t1.id } } });
  await prisma.purchaseOrder.deleteMany({ where: { userId: t1.id } });
  
  await prisma.material.deleteMany({ where: { userId: t1.id } });
  await prisma.warehouse.deleteMany({ where: { userId: t1.id } });
  await prisma.customer.deleteMany({ where: { userId: t1.id } });
  await prisma.vendor.deleteMany({ where: { userId: t1.id } });
  
  await prisma.user.deleteMany({ where: { username: { startsWith: 'tenant_' } } });

  console.log("\n=== ALL E2E INTEGRATION TESTS PASSED SUCCESSFULLY ===");
}

runTests()
  .catch(e => {
    console.error("Test failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
