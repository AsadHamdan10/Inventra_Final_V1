import { PrismaClient, Prisma } from '@prisma/client';
const prisma = new PrismaClient();

async function migrate() {
  console.log('--- Phase 2.2B Material Migration ---');
  
  // 1. Fetch all items
  const saleItems = await prisma.saleItem.findMany({ include: { sale: true } });
  const purchaseItems = await prisma.purchaseItem.findMany({ include: { purchase: true } });
  const materials = await prisma.material.findMany();
  
  const userMaterials = new Map<number, Map<string, number>>();
  
  for (const m of materials) {
    if (!userMaterials.has(m.userId)) {
      userMaterials.set(m.userId, new Map());
    }
    const mmap = userMaterials.get(m.userId)!;
    // Map both exact and lowercase to handle slight typos safely
    mmap.set(m.materialName.toLowerCase().trim(), m.id);
  }
  
  const orphanCreates = new Map<string, number>(); // 'userId_materialName' -> new materialId
  
  let unmappedSale = 0;
  let unmappedPurchase = 0;
  
  for (const si of saleItems) {
    const userId = si.sale.userId;
    const nameKey = si.materialName.toLowerCase().trim();
    let matId = userMaterials.get(userId)?.get(nameKey);
    
    if (!matId) {
      const orphanKey = `${userId}_${nameKey}`;
      if (orphanCreates.has(orphanKey)) {
        matId = orphanCreates.get(orphanKey);
      } else {
        // Create orphan material
        const newMat = await prisma.material.create({
          data: {
            userId,
            materialName: si.materialName,
            isActive: false, // orphaned
            unit: 'Nos',
            currentStock: 0,
          }
        });
        matId = newMat.id;
        orphanCreates.set(orphanKey, matId);
        if (!userMaterials.has(userId)) userMaterials.set(userId, new Map());
        userMaterials.get(userId)!.set(nameKey, matId);
        console.log(`Created orphan material for SaleItem: ${si.materialName} (Tenant ${userId}) -> ID ${matId}`);
      }
    }
    
    await prisma.saleItem.update({
      where: { id: si.id },
      data: { materialId: matId }
    });
  }

  for (const pi of purchaseItems) {
    const userId = pi.purchase.userId;
    const nameKey = pi.materialName.toLowerCase().trim();
    let matId = userMaterials.get(userId)?.get(nameKey);
    
    if (!matId) {
      const orphanKey = `${userId}_${nameKey}`;
      if (orphanCreates.has(orphanKey)) {
        matId = orphanCreates.get(orphanKey);
      } else {
        const newMat = await prisma.material.create({
          data: {
            userId,
            materialName: pi.materialName,
            isActive: false, 
            unit: 'Nos',
            currentStock: 0,
          }
        });
        matId = newMat.id;
        orphanCreates.set(orphanKey, matId);
        if (!userMaterials.has(userId)) userMaterials.set(userId, new Map());
        userMaterials.get(userId)!.set(nameKey, matId);
        console.log(`Created orphan material for PurchaseItem: ${pi.materialName} (Tenant ${userId}) -> ID ${matId}`);
      }
    }
    
    await prisma.purchaseItem.update({
      where: { id: pi.id },
      data: { materialId: matId }
    });
  }

  console.log('--- Relational Mapping Complete ---');
  
  // Now backfill Inventory Ledger
  console.log('--- Backfilling Inventory Ledger ---');
  
  // Clear any existing ledger if running multiple times safely
  await prisma.inventoryLedger.deleteMany();
  
  // Create IN movements for purchases
  const updatedPurchaseItems = await prisma.purchaseItem.findMany({ include: { purchase: true } });
  for (const pi of updatedPurchaseItems) {
    await prisma.inventoryLedger.create({
      data: {
        userId: pi.purchase.userId,
        materialId: pi.materialId!,
        txnDate: pi.purchase.billDate,
        movementType: 'IN',
        quantity: pi.quantity,
        referenceType: 'PURCHASE',
        referenceId: pi.purchaseId,
        createdAt: pi.purchase.createdAt // Preserve creation time
      }
    });
  }

  // Create OUT movements for sales
  const updatedSaleItems = await prisma.saleItem.findMany({ include: { sale: true } });
  for (const si of updatedSaleItems) {
    await prisma.inventoryLedger.create({
      data: {
        userId: si.sale.userId,
        materialId: si.materialId!,
        txnDate: si.sale.invoiceDate,
        movementType: 'OUT',
        quantity: si.quantity,
        referenceType: 'SALE',
        referenceId: si.saleId,
        createdAt: si.sale.createdAt
      }
    });
  }
  
  // Reconstruct Current Stock
  console.log('--- Reconstructing Current Stock ---');
  const allMaterials = await prisma.material.findMany();
  
  for (const m of allMaterials) {
    const movements = await prisma.inventoryLedger.findMany({
      where: { materialId: m.id }
    });
    
    let stock = new Prisma.Decimal(0);
    for (const mov of movements) {
      if (mov.movementType === 'IN') {
        stock = stock.add(mov.quantity);
      } else if (mov.movementType === 'OUT') {
        stock = stock.sub(mov.quantity);
      }
    }
    
    await prisma.material.update({
      where: { id: m.id },
      data: { currentStock: stock }
    });
  }
  
  console.log('--- Phase 2.2B Migration Successful ---');
}

migrate().catch(console.error).finally(() => prisma.$disconnect());
