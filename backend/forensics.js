const prisma = require('./dist/utils/prisma').default;

async function run() {
  console.log("=== CUSTOMER PAYMENT 1 FORENSICS ===");
  const cp = await prisma.customerPayment.findUnique({ where: { id: 1 } });
  const allocs = await prisma.customerPaymentAllocation.findMany({ where: { paymentId: 1 } });
  console.log("CustomerPayment:", cp);
  console.log("Allocations:", allocs);
  
  if (allocs.length > 0) {
    const saleIds = allocs.map(a => a.saleId);
    const sales = await prisma.sale.findMany({ where: { id: { in: saleIds } } });
    console.log("Sales:", sales.map(s => ({ id: s.id, grandTotal: s.grandTotal, status: s.status })));
  }

  console.log("\n=== INVENTORY FORENSICS ===");
  const materials = await prisma.material.findMany({
    where: { id: { in: [1, 27, 28] } } // sample materials that had discrepancies
  });

  for (const m of materials) {
    console.log(`\n--- Material ${m.id} (${m.materialName}) ---`);
    console.log("Current Stock:", m.currentStock);
    
    const ledgers = await prisma.inventoryLedger.findMany({ where: { materialId: m.id } });
    console.log("Ledgers:", ledgers.map(l => ({ id: l.id, type: l.movementType, qty: l.quantity, ref: l.referenceType })));
    
    const layers = await prisma.inventoryLayer.findMany({ where: { materialId: m.id } });
    console.log("Layers:", layers.map(l => ({ id: l.id, qty: l.quantity, remaining: l.remainingQty, source: l.sourceType })));
  }

}

run().catch(console.error).finally(() => prisma.$disconnect());
