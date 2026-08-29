const fs = require('fs');
let code = fs.readFileSync('src/controllers/purchaseController.ts', 'utf8');

const deletePurchaseRegex = /export const deletePurchase: import\('express'\)\.RequestHandler = async \(req: Request, res: Response, next:\s*NextFunction\) => \{[\s\S]*?res\.json\(\{ message: 'Deleted\.' \}\);\s*\} catch \(err\) \{\s*next\(err\);\s*\}\s*\}/;

const cancelPurchaseCode = `
export const cancelPurchase: import('express').RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);

    await prisma.$transaction(async (tx) => {
      // 1. Lock Purchase
      const purchase = await tx.$queryRaw<any[]>\`SELECT * FROM purchases WHERE id = \${id} AND user_id = \${userId} FOR UPDATE\`;
      if (purchase.length === 0) throw new Error('Purchase not found or access denied.');
      
      const existingPurchase = purchase[0];

      if (existingPurchase.status === 'CANCELLED') {
        throw new Error('Purchase is already cancelled.');
      }

      // Check InventoryLayer consumption
      const layers = await tx.inventoryLayer.findMany({
        where: { sourceType: 'PURCHASE', sourceId: id }
      });

      for (const layer of layers) {
        if (Number(layer.remainingQty) < Number(layer.originalQty)) {
          throw new Error('Purchase cannot be cancelled because its stock has already been consumed by a sale. Cancel the dependent sales first.');
        }
      }

      const purchaseItems = await tx.purchaseItem.findMany({ where: { purchaseId: id } });

      for (const item of purchaseItems) {
        // Lock Material
        await tx.$queryRaw\`SELECT * FROM materials WHERE id = \${item.materialId} FOR UPDATE\`;

        // Reverse Ledger
        await tx.inventoryLedger.create({
          data: {
            userId,
            materialId: item.materialId,
            txnDate: new Date(),
            movementType: 'ADJUST_OUT',
            quantity: item.quantity,
            referenceType: 'PURCHASE_CANCEL',
            referenceId: id,
            notes: 'Purchase Cancellation Reversal'
          }
        });

        // Decrement Material stock
        await tx.$executeRaw\`UPDATE materials SET current_stock = current_stock - \${item.quantity} WHERE id = \${item.materialId}\`;
      }

      // Reverse Layers by deleting them safely (since they are 100% unconsumed)
      await tx.inventoryLayer.deleteMany({
        where: { sourceType: 'PURCHASE', sourceId: id }
      });

      // Mark Purchase as cancelled
      await tx.purchase.update({
        where: { id },
        data: { status: 'CANCELLED' }
      });
    });

    await auditLog(userId, 'PURCHASE_CANCELLED', \`Purchase cancelled: #\${id}\`, req, 'Purchase', id, 'SUCCESS');
    res.json({ message: 'Cancelled.' });
  } catch (err: any) {
    if (err.message === 'Purchase is already cancelled.') {
      return res.json({ message: 'Purchase is already cancelled.' });
    }
    if (err.message.includes('consumed by a sale')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message === 'Purchase not found or access denied.') {
      return res.status(403).json({ error: 'Access denied.' });
    }
    next(err);
  }
}
`;

code = code.replace(deletePurchaseRegex, cancelPurchaseCode);

const updatePurchaseRegex = /export const updatePurchase: import\('express'\)\.RequestHandler = async \(req: Request, res: Response, next: NextFunction\) => \{[\s\S]*?(?=export const deletePurchase|export const cancelPurchase)/;

const blockUpdatePurchaseCode = `export const updatePurchase: import('express').RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  return res.status(400).json({ error: 'Posted purchases cannot be updated to preserve FIFO integrity. Please cancel this purchase and create a new one.' });
}

`;

code = code.replace(updatePurchaseRegex, blockUpdatePurchaseCode);

fs.writeFileSync('src/controllers/purchaseController.ts', code);
