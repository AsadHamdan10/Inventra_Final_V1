import { PrismaClient, Prisma } from '@prisma/client';
const prisma = new PrismaClient();

async function migrateFifo() {
  console.log('--- Phase 2.3B FIFO Migration ---');
  
  await prisma.layerConsumption.deleteMany();
  await prisma.inventoryLayer.deleteMany();

  // 1. Create layers for all existing purchases
  console.log('Creating Purchase Layers...');
  const purchases = await prisma.purchaseItem.findMany({
    include: { purchase: true },
    orderBy: [
      { purchase: { billDate: 'asc' } },
      { id: 'asc' }
    ]
  });

  for (const pi of purchases) {
    await prisma.inventoryLayer.create({
      data: {
        userId: pi.purchase.userId,
        materialId: pi.materialId,
        sourceType: 'PURCHASE',
        sourceId: pi.id,
        receivedDate: pi.purchase.billDate,
        originalQty: pi.quantity,
        remainingQty: pi.quantity,
        unitCostEnc: pi.purchaseRateEnc || 'UNKNOWN'
      }
    });
  }

  // 2. Consume layers chronologically for all sales
  console.log('Consuming Layers for Sales...');
  const sales = await prisma.saleItem.findMany({
    include: { sale: true },
    orderBy: [
      { sale: { invoiceDate: 'asc' } },
      { id: 'asc' }
    ]
  });

  for (const si of sales) {
    let qtyToConsume = Number(si.quantity);
    
    while (qtyToConsume > 0) {
      const layers = await prisma.inventoryLayer.findMany({
        where: {
          userId: si.sale.userId,
          materialId: si.materialId,
          remainingQty: { gt: 0 }
        },
        orderBy: [
          { receivedDate: 'asc' },
          { id: 'asc' }
        ]
      });

      if (layers.length === 0) {
        console.log(`Injecting dummy OPENING layer for material ${si.materialId} due to historical negative stock: qty ${qtyToConsume}`);
        const dummyLayer = await prisma.inventoryLayer.create({
          data: {
            userId: si.sale.userId,
            materialId: si.materialId,
            sourceType: 'OPENING',
            sourceId: null,
            receivedDate: new Date('2000-01-01'),
            originalQty: qtyToConsume,
            remainingQty: qtyToConsume,
            unitCostEnc: '' // zero val
          }
        });
        
        // Fix Ledger and Stock to match the injected dummy layer
        await prisma.inventoryLedger.create({
            data: {
                userId: si.sale.userId,
                materialId: si.materialId,
                txnDate: new Date('2000-01-01'),
                movementType: 'IN',
                quantity: qtyToConsume,
                referenceType: 'OPENING',
            }
        });
        
        await prisma.$executeRawUnsafe(`UPDATE materials SET current_stock = current_stock + $1 WHERE id = $2`, qtyToConsume, si.materialId);

        layers.push(dummyLayer);
      }

      const layer = layers[0];
      const available = Number(layer.remainingQty);
      const consume = Math.min(available, qtyToConsume);

      await prisma.inventoryLayer.update({
        where: { id: layer.id },
        data: { remainingQty: new Prisma.Decimal(available - consume) }
      });

      await prisma.layerConsumption.create({
        data: {
          userId: si.sale.userId,
          layerId: layer.id,
          saleItemId: si.id,
          quantityConsumed: consume,
          unitCostEnc: layer.unitCostEnc
        }
      });

      qtyToConsume -= consume;
    }
  }

  // 3. Reconcile
  console.log('--- Reconciliation ---');
  const materials = await prisma.material.findMany();
  let valid = true;

  for (const m of materials) {
    const layers = await prisma.inventoryLayer.aggregate({
      where: { materialId: m.id },
      _sum: { remainingQty: true }
    });

    const sumLayers = Number(layers._sum.remainingQty || 0);
    const currStock = Number(m.currentStock);

    if (Math.abs(sumLayers - currStock) > 0.001) {
      console.error(`Mismatch for material ${m.id}: Layers ${sumLayers} != Stock ${currStock}`);
      valid = false;
    }
  }

  if (valid) {
    console.log('Reconciliation passed! SUM(remainingQty) === currentStock');
  } else {
    console.error('Reconciliation failed!');
  }
}

migrateFifo()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
