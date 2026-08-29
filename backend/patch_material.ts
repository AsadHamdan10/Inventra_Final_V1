import * as fs from 'fs';
import * as path from 'path';

const materialPath = path.join(__dirname, 'src', 'controllers', 'materialController.ts');
let materialContent = fs.readFileSync(materialPath, 'utf8');

const adjustStockRegex = /export async function adjustStock[\s\S]*?export async function deleteMaterial/;
const newAdjustStock = `export async function adjustStock(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { adjustmentType, quantity, notes, unitCost } = req.body;

    if (!adjustmentType || !['IN', 'OUT'].includes(adjustmentType)) {
      return res.status(400).json({ error: 'Valid adjustmentType (IN or OUT) is required.' });
    }
    if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) {
      return res.status(400).json({ error: 'Valid positive quantity is required.' });
    }

    if (adjustmentType === 'IN' && (unitCost === undefined || isNaN(Number(unitCost)))) {
      return res.status(400).json({ error: 'Valid unitCost is required for ADJUSTMENT_IN.' });
    }

    const materialId = parseInt(id);
    const qty = Number(quantity);

    const result = await prisma.$transaction(async (tx) => {
        const materialsRaw = await tx.$queryRaw<any[]>\`SELECT * FROM materials WHERE "user_id" = \${userId} AND id = \${materialId} FOR UPDATE\`;
        if (materialsRaw.length === 0) throw new Error('Material not found.');
        const material = materialsRaw[0];

        if (adjustmentType === 'IN') {
             await tx.inventoryLayer.create({
                 data: {
                     userId, materialId, sourceType: 'ADJUSTMENT_IN', sourceId: null,
                     receivedDate: new Date(), originalQty: qty, remainingQty: qty,
                     unitCostEnc: encryptFinancialData(Number(unitCost))
                 }
             });
             await tx.inventoryLedger.create({
                 data: { userId, materialId, txnDate: new Date(), movementType: 'IN', quantity: qty, referenceType: 'ADJUSTMENT', notes }
             });
             await tx.$executeRaw\`UPDATE materials SET current_stock = current_stock + \${qty} WHERE id = \${materialId}\`;
        } else {
             if (Number(material.current_stock) < qty) throw new Error(\`Insufficient stock. Available: \${material.current_stock}\`);

             let qtyToConsume = qty;
             const layers = await tx.inventoryLayer.findMany({
                 where: { userId, materialId, remainingQty: { gt: 0 } },
                 orderBy: [ { receivedDate: 'asc' }, { id: 'asc' } ]
             });
             for (const layer of layers) {
                 if (qtyToConsume <= 0) break;
                 const available = Number(layer.remainingQty);
                 const consume = Math.min(available, qtyToConsume);
                 await tx.inventoryLayer.update({ where: { id: layer.id }, data: { remainingQty: new Prisma.Decimal(available - consume) } });
                 
                 // For adjustments, we don't have a saleItem, so we don't create LayerConsumption (or we could make saleItemId nullable, but currently it's not nullable).
                 // In an ERP, OUT adjustments consume layers permanently.
                 
                 qtyToConsume -= consume;
             }
             if (qtyToConsume > 0) throw new Error('FIFO error: Insufficient layers.');

             await tx.inventoryLedger.create({
                 data: { userId, materialId, txnDate: new Date(), movementType: 'OUT', quantity: qty, referenceType: 'ADJUSTMENT', notes }
             });
             await tx.$executeRaw\`UPDATE materials SET current_stock = current_stock - \${qty} WHERE id = \${materialId}\`;
        }

        const updated = await tx.material.findUnique({ where: { id: materialId } });
        return updated;
    });

    await auditLog(userId, 'STOCK_ADJUSTMENT', \`Adjusted \${adjustmentType} \${qty} for \${result?.materialName}\`, req, 'Material', materialId, 'SUCCESS');
    res.json(result);
  } catch (err: any) { next(err); }
}

export async function deleteMaterial`;

materialContent = materialContent.replace(adjustStockRegex, newAdjustStock);
fs.writeFileSync(materialPath, materialContent, 'utf8');

console.log('Patched materialController');
