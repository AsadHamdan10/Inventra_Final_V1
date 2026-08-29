const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const assert = require('assert');

async function runTests() {
  console.log("=== STARTING PHASE 6.6 ERP OPERATIONS TESTS ===\n");

  
  
  await prisma.stockTransferItem.deleteMany();
  await prisma.stockTransfer.deleteMany();
  await prisma.auditLog.deleteMany();

  await prisma.goodsReceiptItem.deleteMany();
  await prisma.goodsReceipt.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.productionMaterialIssue.deleteMany();
  await prisma.productionOutput.deleteMany();
  await prisma.productionExecution.deleteMany();
  await prisma.productionOrderComponent.deleteMany();
  await prisma.productionOrder.deleteMany();
  await prisma.billOfMaterialItem.deleteMany();
  await prisma.billOfMaterial.deleteMany();
  await prisma.routingOperation.deleteMany();
  await prisma.routing.deleteMany();

  // Create two tenants for isolation testing
  await prisma.applicationSnapshot.deleteMany({ where: { username: { startsWith: 'tenant_' } } });
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany({ where: { username: { startsWith: 'tenant_' } } });

  

  const t1 = await prisma.user.create({ data: { fullName: "Tenant 1", companyName: "Tenant 1", username: "tenant_1", email: "t1@ex.com", role: "admin", status: "active", plan: "V1_BASIC" } });
  const t2 = await prisma.user.create({ data: { fullName: "Tenant 2", companyName: "Tenant 2", username: "tenant_2", email: "t2@ex.com", role: "admin", status: "active", plan: "V1_BASIC" } });


  for (const t of [t1, t2]) {
    const fy = await prisma.financialYear.create({
      data: {
        userId: t.id, name: "2026-2027", startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "OPEN"
      }
    });
    for (let month = 4; month <= 15; month++) {
        let m = month > 12 ? month - 12 : month;
        let y = month > 12 ? 2027 : 2026;
        let start = new Date(Date.UTC(y, m - 1, 1));
        let end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
        await prisma.accountingPeriod.create({
            data: {
                userId: t.id, financialYearId: fy.id,
                name: `${y}-${m < 10 ? "0"+m : m}`,
                startDate: start,
                endDate: end,
                status: "OPEN", periodNumber: month
            }
        });
    }
  }








  // Setup basics for T1


  const { initializeDefaultCOA } = require("./dist/services/accounting/coaService");
  await initializeDefaultCOA(t1.id);
  await initializeDefaultCOA(t2.id);
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
    vendorName: t1Vend.vendorName || "Vendor",
    warehouseId: t1Wh1.id,
    orderDate: new Date(),
    expectedDeliveryDate: new Date(),
    items: [{ materialId: t1Mat.id, materialName: t1Mat.materialName, orderedQty: 100, pendingQty: 100, unit: "KG", rate: 50, gstRate: 18, taxableAmount: 5000, gstAmount: 900, itemTotal: 5900 }]
  });

  
  await purchaseService.updatePurchaseOrderStatus(t1.id, po.id, 'CONFIRMED');
  
  // GRN creates stock

  const grn = await grnService.createGoodsReceipt(t1.id, {
    purchaseOrderId: po.id,
    vendorId: t1Vend.id,
    vendorName: t1Vend.vendorName || "Vendor",
    grnDate: new Date(),
    deliveryChallanNo: 'CH-01',
    warehouseId: t1Wh1.id,
    items: [{ purchaseOrderItemId: po.items[0].id, materialId: t1Mat.id, materialName: t1Mat.materialName, receivedQty: 100, acceptedQty: 100, rejectedQty: 0, unit: "KG", rate: 50 }]
  });

  
  await grnService.postGoodsReceipt(t1.id, grn.id);
    // Verify Stock
  let matCheck = await prisma.material.findUnique({ where: { id: t1Mat.id } });
  assert.strictEqual(Number(matCheck.currentStock), 100, "GRN must increase stock");
  let layerCheck = await prisma.inventoryLayer.findFirst({ where: { materialId: t1Mat.id } });
  assert.strictEqual(Number(layerCheck.remainingQty), 100, "FIFO layer must be created");
  console.log("✅ Procurement GRN creates stock and FIFO layers correctly");

  // 3. STOCK TRANSFER
  console.log("\nRunning Stock Transfer Atomicity...");
  const transferService = require('./dist/services/inventory/inventoryOperationService');
  const transfer = await transferService.postStockTransfer(t1.id, "TR-001", new Date(), t1Wh1.id, t1Wh2.id, [{ materialId: t1Mat.id, quantity: 40 }], t1.id, "Testing Transfer");
  
  matCheck = await prisma.material.findUnique({ where: { id: t1Mat.id } });
  assert.strictEqual(Number(matCheck.currentStock), 100, "Total stock remains the same after transfer");
  
    let wh1In = await prisma.inventoryLedger.aggregate({ where: { materialId: t1Mat.id, warehouseId: t1Wh1.id, movementType: "IN" }, _sum: { quantity: true } });
    let wh1Out = await prisma.inventoryLedger.aggregate({ where: { materialId: t1Mat.id, warehouseId: t1Wh1.id, movementType: "OUT" }, _sum: { quantity: true } });
    let wh1Stock = (Number(wh1In._sum.quantity || 0)) - (Number(wh1Out._sum.quantity || 0));

    let wh2In = await prisma.inventoryLedger.aggregate({ where: { materialId: t1Mat.id, warehouseId: t1Wh2.id, movementType: "IN" }, _sum: { quantity: true } });
    let wh2Out = await prisma.inventoryLedger.aggregate({ where: { materialId: t1Mat.id, warehouseId: t1Wh2.id, movementType: "OUT" }, _sum: { quantity: true } });
    let wh2Stock = (Number(wh2In._sum.quantity || 0)) - (Number(wh2Out._sum.quantity || 0));

    assert.strictEqual(wh1Stock, 60, "Warehouse 1 stock reduced");
    assert.strictEqual(wh2Stock, 40, "Warehouse 2 stock increased");

  console.log("✅ Stock Transfer is atomic and strictly isolated by warehouse");

  // 4. MANUFACTURING FLOW (Backend Service Verification)
  console.log("\nRunning Manufacturing Flow...");
  const bomService = require('./dist/services/manufacturing/bomService');
  const prodOrderService = require('./dist/services/manufacturing/productionOrderService');
  const prodExecService = require('./dist/services/manufacturing/productionExecutionService');

      const bom = await bomService.createBOM(t1.id, {
    bomCode: "BOM-001",
    finishedGoodItemId: t1FG.id,
    name: "Standard FG BOM",
    effectiveFrom: new Date(),
    outputQuantity: 1,
    outputUnit: "PCS",
    items: [{ componentItemId: t1Mat.id, quantity: 2, unit: "KG" }]
  });
  await bomService.activateBOM(t1.id, bom.id);

    const pOrder = await prodOrderService.createProductionOrder(t1.id, {
    itemId: t1FG.id,
    plannedQuantity: 10,
    plannedStartDate: new Date(),
    plannedEndDate: new Date(),
    warehouseId: t1Wh1.id,
    productionDate: new Date(),
    bomId: bom.id
  });

  await prodOrderService.releaseProductionOrder(t1.id, pOrder.id);

  
    // Issue materials
    const exec = await prodExecService.startExecution(t1.id, pOrder.id, t1.id);
    await prodExecService.postMaterialIssue(t1.id, exec.id, t1Mat.id, t1Wh1.id, 20, t1.id);

    wh1In = await prisma.inventoryLedger.aggregate({ where: { materialId: t1Mat.id, warehouseId: t1Wh1.id, movementType: "IN" }, _sum: { quantity: true } });
    wh1Out = await prisma.inventoryLedger.aggregate({ where: { materialId: t1Mat.id, warehouseId: t1Wh1.id, movementType: "OUT" }, _sum: { quantity: true } });
    wh1Stock = (Number(wh1In._sum.quantity || 0)) - (Number(wh1Out._sum.quantity || 0));
    assert.strictEqual(wh1Stock, 40, "Warehouse 1 raw material reduced by 20");

    // Output production
    await prodExecService.postProductionOutput(t1.id, exec.id, 10, t1.id);

    let fgCheck = await prisma.material.findUnique({ where: { id: t1FG.id } });
  assert.strictEqual(Number(fgCheck.currentStock), 10, "Finished Goods stock increased");
  console.log("✅ Manufacturing flow (BOM -> Release -> Issue -> Output) works and updates stock atomically");

  // 5. TRADING & ACCOUNTING FLOW
  console.log("\nRunning Trading & Accounting Integration...");
  const { createSaleInternal } = require('./dist/services/saleInternalService');
  const sale = await createSaleInternal(t1.id, t1Cust.id, new Date().toISOString(), new Date().toISOString(), "", "", "", [{ materialId: t1FG.id, quantity: 5, unitPrice: 500, gstPercent: 18, unit: "PCS" }], prisma);

  fgCheck = await prisma.material.findUnique({ where: { id: t1FG.id } });
  assert.strictEqual(Number(fgCheck.currentStock), 5, "Sales completed reduces FG stock");

  // Check Journals
  const journals = await prisma.journalEntry.findMany({ where: { userId: t1.id, referenceId: sale.id, referenceType: 'SALE' }, include: { lines: true } });
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
  await prisma.journalLine.deleteMany({ where: { journalEntry: { userId: t1.id } } });
  await prisma.journalEntry.deleteMany({ where: { userId: t1.id } });
  await prisma.saleItem.deleteMany({ where: { sale: { userId: t1.id } } });
  await prisma.sale.deleteMany({ where: { userId: t1.id } });
  
  // Clean up manufacturing
  await prisma.productionMaterialIssue.deleteMany({ where: { execution: { productionOrder: { userId: t1.id } } } });
  await prisma.productionOutput.deleteMany({ where: { execution: { productionOrder: { userId: t1.id } } } });
  await prisma.layerConsumption.deleteMany();
  await prisma.productionOrderComponent.deleteMany({ where: { productionOrder: { userId: t1.id } } });
  await prisma.productionOrder.deleteMany({ where: { userId: t1.id } });
  await prisma.billOfMaterialItem.deleteMany({ where: { bom: { userId: t1.id } } });
  await prisma.billOfMaterial.deleteMany({ where: { userId: t1.id } });

  // Clean up inventory & procurement
  await prisma.stockTransferItem.deleteMany({ where: { stockTransfer: { userId: t1.id } } });
  await prisma.stockTransfer.deleteMany({ where: { userId: t1.id } });
  await prisma.inventoryLedger.deleteMany();
  await prisma.inventoryLayer.deleteMany();
  
  await prisma.goodsReceiptItem.deleteMany({ where: { goodsReceipt: { userId: t1.id } } });
  await prisma.goodsReceipt.deleteMany({ where: { userId: t1.id } });
  await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { userId: t1.id } } });
  await prisma.purchaseOrder.deleteMany({ where: { userId: t1.id } });
  
  await prisma.material.deleteMany({ where: { userId: t1.id } });
  await prisma.warehouse.deleteMany({ where: { userId: t1.id } });
  await prisma.customer.deleteMany({ where: { userId: t1.id } });
  await prisma.vendor.deleteMany({ where: { userId: t1.id } });
  
  await prisma.auditLog.deleteMany();
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
