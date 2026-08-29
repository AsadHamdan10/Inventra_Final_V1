const fs = require('fs');

let content = fs.readFileSync('src/controllers/purchaseController.ts', 'utf8');

// 1. Add import for postPurchaseAccounting
if (!content.includes('postPurchaseAccounting')) {
    content = content.replace("import { auditLog } from '../services/auditService';", 
    "import { auditLog } from '../services/auditService';\nimport { postPurchaseAccounting } from '../services/accounting/accountingIntegrationService';\nimport { assertFinancialPeriodOpen } from '../services/accounting/financialPeriodService';");
}

// 2. Wrap createPurchase in a transaction and call accounting
const createPattern = /const row = await prisma\.purchase\.create\(\{([\s\S]*?)include: \{ items: true, payablePayments: true \},\n\s*\}\);/;
const match = content.match(createPattern);

if (match) {
    const replacement = `const row = await prisma.$transaction(async (tx) => {
      await assertFinancialPeriodOpen(userId, new Date(data.billDate), tx);
      const purchase = await tx.purchase.create({${match[1]}include: { items: true, payablePayments: true },
      });

      // Legacy support: if no GRNs exist, create stock directly
      for (const item of items) {
         if (item.materialId) {
             const mat = await tx.material.findUnique({ where: { id: item.materialId } });
             let targetWarehouse = null;
             
             // get default warehouse if not specified
             if (!targetWarehouse) {
                 const config = await tx.tenantConfiguration.findUnique({ where: { userId } });
                 targetWarehouse = config?.defaultWarehouseId || null;
             }

             if (targetWarehouse) {
                 await tx.material.update({
                     where: { id: item.materialId },
                     data: { currentStock: { increment: item.quantity } }
                 });

                 await tx.inventoryLedger.create({
                     data: {
                         userId,
                         materialId: item.materialId,
                         warehouseId: targetWarehouse,
                         date: new Date(data.billDate),
                         movementType: 'IN',
                         quantity: item.quantity,
                         referenceType: 'PURCHASE',
                         referenceId: purchase.id,
                         unitCost: item.purchaseRate
                     }
                 });

                 await tx.inventoryLayer.create({
                     data: {
                         userId,
                         materialId: item.materialId,
                         warehouseId: targetWarehouse,
                         sourceType: 'PURCHASE',
                         sourceId: purchase.id,
                         receivedDate: new Date(data.billDate),
                         originalQty: item.quantity,
                         remainingQty: item.quantity,
                         unitCostEnc: encryptFinancialData(item.purchaseRate)
                     }
                 });
             }
         }
      }

      await postPurchaseAccounting(userId, purchase, userId, tx);
      return purchase;
    });`;
    
    content = content.replace(createPattern, replacement);
}

fs.writeFileSync('src/controllers/purchaseController.ts', content);
console.log('purchaseController patched successfully');
