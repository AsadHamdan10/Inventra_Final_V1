
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { createGoodsReceipt, postGoodsReceipt } = require("./src/services/procurement/goodsReceiptService");
const { createSaleInternal, completeSale } = require("./src/services/saleInternalService");
const { initializeDefaultCOA } = require("./src/services/accounting/coaService");

async function run() {
  let u = null;
  try {
    // 1. Setup User
    u = await prisma.user.create({ data: {
      username: "uat_qa_" + Date.now(), companyName: "UAT QA Corp", email: "uatqa" + Date.now() + "@test.com",
      status: "active", plan: "PROFESSIONAL", role: "admin", applicationRef: "INV-UAT-" + Date.now()
    }});
    console.log("Created user:", u.id);
    
    await initializeDefaultCOA(u.id);

    // 2. Masters
    const wh = await prisma.warehouse.create({ data: { userId: u.id, code: "W-UAT", name: "UAT WH", warehouseType: "GENERAL" }});
    const vendor = await prisma.vendor.create({ data: { userId: u.id, vendorName: "UAT Vendor", email: "vend@uat.com" }});
    const cust = await prisma.customer.create({ data: { userId: u.id, customerName: "UAT Customer", email: "cust@uat.com" }});
    const item = await prisma.material.create({ data: { userId: u.id, itemType: "FINISHED_GOOD", materialName: "UAT Laptop", hsnCode: "8471", unit: "NOS", standardPrice: 50000, standardCost: 40000, inventoryTracked: true, purchaseEnabled: true, salesEnabled: true, gstRate: 18, taxability: "TAXABLE", currentStock: 0 }});
    
    // 3. Procurement (GRN)
    const grn = await createGoodsReceipt(u.id, {
      vendorId: vendor.id,
      vendorName: vendor.vendorName,
      warehouseId: wh.id,
      grnDate: new Date(),
      deliveryChallanNo: "CH-UAT-1",
      items: [{ materialId: item.id, materialName: item.materialName, orderedQty: 100, receivedQty: 100, acceptedQty: 100, unitPrice: 40000, unit: "NOS", gstPercent: 18, warehouseId: wh.id }]
    });
    console.log("Created GRN:", grn.grnNo);
    await postGoodsReceipt(u.id, grn.id);
    console.log("Posted GRN!");

    // Stock check
    let stock = await prisma.inventoryLayer.findMany({ where: { materialId: item.id, warehouseId: wh.id }});
    console.log("Stock after GRN (qty, cost):", stock.map(s => `${s.remainingQty} @ ${s.unitCost}`));
    
    // 4. Sales
    const sale = await createSaleInternal(u.id, {
      customerId: cust.id,
      companyName: cust.customerName,
      invoiceDate: new Date(),
      items: [{ materialId: item.id, quantity: 30, unitPrice: 50000, gstPercent: 18, warehouseId: wh.id }]
    });
    console.log("Created Sale:", sale.invoiceNo);
    await completeSale(u.id, sale.id);
    console.log("Completed Sale!");

    // Stock check
    stock = await prisma.inventoryLayer.findMany({ where: { materialId: item.id, warehouseId: wh.id }});
    console.log("Stock after Sale (qty, cost):", stock.map(s => `${s.remainingQty} @ ${s.unitCost}`));
    
    // Ledger check
    const ledgers = await prisma.journalEntry.findMany({ where: { userId: u.id }, include: { lines: { include: { account: true } } }});
    console.log(`Journals created: ${ledgers.length}`);
    for(let l of ledgers) {
      console.log(`Journal ${l.journalNo}:`);
      for(let line of l.lines) {
        console.log(`  ${line.account.name}: ${Number(line.debit) > 0 ? "Dr " + line.debit : "Cr " + line.credit}`);
      }
    }

  } catch(e) {
    console.error("Error:", e);
  } finally {
    prisma.$disconnect();
  }
}
run();

