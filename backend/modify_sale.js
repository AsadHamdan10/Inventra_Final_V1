const fs = require('fs');
let code = fs.readFileSync('src/controllers/saleController.ts', 'utf8');

// Replace deleteSale with cancelSale
const deleteSaleRegex = /export const deleteSale: import\('express'\)\.RequestHandler = async \(req: Request, res: Response, next: NextFunction\) => \{[\s\S]*?res\.json\(\{ message: 'Deleted\.' \}\);\s*\} catch \(err\) \{ next\(err\); \}\s*\}/;

const cancelSaleCode = `
export const cancelSale: import('express').RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);

    await prisma.$transaction(async (tx) => {
      // 1. Lock the Sale row & verify tenant
      const sale = await tx.$queryRaw<any[]>\`SELECT * FROM sales WHERE id = \${id} AND user_id = \${userId} FOR UPDATE\`;
      if (sale.length === 0) throw new Error('Sale not found or access denied.');
      
      const existingSale = sale[0];

      // 3. Verify the Sale is not already cancelled
      if (existingSale.status === 'CANCELLED') {
        throw new Error('Sale is already cancelled.');
      }

      // 5. Fetch all LayerConsumption records and Sale Items
      const saleItems = await tx.saleItem.findMany({
        where: { saleId: id },
        include: { layerConsumptions: true }
      });

      for (const item of saleItems) {
        // 4. Lock affected Material row
        await tx.$queryRaw\`SELECT * FROM materials WHERE id = \${item.materialId} FOR UPDATE\`;

        for (const consumption of item.layerConsumptions) {
          // 6. Restore consumed quantity to InventoryLayer
          await tx.$executeRaw\`UPDATE inventory_layers SET remaining_qty = remaining_qty + \${consumption.quantityConsumed} WHERE id = \${consumption.layerId}\`;
        }

        // 7. Create InventoryLedger REVERSAL entry
        await tx.inventoryLedger.create({
          data: {
            userId,
            materialId: item.materialId,
            txnDate: new Date(),
            movementType: 'ADJUST_IN',
            quantity: item.quantity,
            referenceType: 'SALE_CANCEL',
            referenceId: id,
            notes: 'Sale Cancellation Reversal'
          }
        });

        // 8. Restore Material.currentStock
        await tx.$executeRaw\`UPDATE materials SET current_stock = current_stock + \${item.quantity} WHERE id = \${item.materialId}\`;
      }

      // 9. Mark Sale as CANCELLED
      await tx.sale.update({
        where: { id },
        data: { status: 'CANCELLED' }
      });
    });

    // 11. Record AuditLog
    await auditLog(userId, 'SALE_CANCELLED', \`Sale cancelled: #\${id}\`, req, 'Sale', id, 'SUCCESS');
    res.json({ message: 'Cancelled.' });
  } catch (err: any) {
    if (err.message === 'Sale is already cancelled.') {
      return res.json({ message: 'Sale is already cancelled.' });
    }
    if (err.message === 'Sale not found or access denied.') {
      return res.status(403).json({ error: 'Access denied.' });
    }
    next(err);
  }
}
`;

code = code.replace(deleteSaleRegex, cancelSaleCode);

// Block updateSale
const updateSaleRegex = /export const updateSale: import\('express'\)\.RequestHandler = async \(req: Request, res: Response, next: NextFunction\) => \{[\s\S]*?(?=export const deleteSale|export const cancelSale)/;

const blockUpdateCode = `export const updateSale: import('express').RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  return res.status(400).json({ error: 'Posted sales cannot be updated to preserve FIFO integrity. Please cancel this sale and create a new one.' });
}

`;

code = code.replace(updateSaleRegex, blockUpdateCode);

fs.writeFileSync('src/controllers/saleController.ts', code);
