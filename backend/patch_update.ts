import * as fs from 'fs';
import * as path from 'path';

// --- PURCHASE CONTROLLER ---
const purchasePath = path.join(__dirname, 'src', 'controllers', 'purchaseController.ts');
let purchaseContent = fs.readFileSync(purchasePath, 'utf8');

const updatePurchaseRegex = /export async function updatePurchase[\s\S]*?export async function deletePurchase/;
const newUpdatePurchase = `export async function updatePurchase(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);

    if (!(await assertTenantOwnership(userId, 'purchases', id))) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const parsed = purchaseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed.' });

    const { items, ...data } = parsed.data;

    const row = await prisma.$transaction(async (tx) => {
         const existingPurchase = await tx.purchase.findUnique({
              where: { id },
              include: { items: true }
         });
         if (!existingPurchase) throw new Error('Purchase not found.');

         // FIFO Protection
         for (const oldItem of existingPurchase.items) {
             const layer = await tx.inventoryLayer.findFirst({ where: { sourceType: 'PURCHASE', sourceId: oldItem.id } });
             if (layer && Number(layer.remainingQty) !== Number(layer.originalQty)) {
                 throw new Error(\`Cannot edit purchase: items have already been sold/consumed (Material ID \${oldItem.materialId}). Cancel sales first.\`);
             }
             if (layer) await tx.inventoryLayer.delete({ where: { id: layer.id } });

             await tx.inventoryLedger.create({
                 data: {
                     userId, materialId: oldItem.materialId, txnDate: existingPurchase.billDate,
                     movementType: 'OUT', quantity: oldItem.quantity, referenceType: 'REVERSAL', referenceId: existingPurchase.id
                 }
             });
             await tx.$executeRaw\`UPDATE materials SET current_stock = current_stock - \${oldItem.quantity} WHERE id = \${oldItem.materialId}\`;
         }
         
         await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });

         let totalTaxable = 0, totalGst = 0;
         const calculatedItems = [];
         const layerCreates = [];

         for (const item of items) {
            const materialsRaw = await tx.$queryRaw<any[]>\`SELECT * FROM materials WHERE "user_id" = \${userId} AND material_name = \${item.materialName} FOR UPDATE\`;
            if (materialsRaw.length === 0) throw new Error(\`Material '\${item.materialName}' not found.\`);
            const material = materialsRaw[0];
            
            const qty = Number(item.quantity);
            const rate = Number(item.purchaseRate);
            const gstPct = Number(item.gstPercent);
            const itemTaxable = Number((qty * rate).toFixed(2));
            const itemGst = Number((itemTaxable * (gstPct / 100)).toFixed(2));
            
            totalTaxable += itemTaxable;
            totalGst += itemGst;

            calculatedItems.push({
                materialId: material.id, materialName: item.materialName,
                hsnCode: item.hsnCode, quantity: qty, purchaseRateEnc: encryptFinancialData(rate),
                gstPercent: gstPct, taxableAmount: itemTaxable, gstAmount: itemGst, itemTotal: itemTaxable + itemGst,
            });

            layerCreates.push({ materialId: material.id, quantity: qty, rate });
         }

         const updated = await tx.purchase.update({
            where: { id },
            data: {
                ...data, billDate: new Date(data.billDate),
                totalTaxable, totalGst, grandTotal: totalTaxable + totalGst,
                items: { create: calculatedItems },
            },
            include: { items: true },
         });

         // Create Layers for new items
         for (const l of layerCreates) {
            const pi = updated.items.find(i => i.materialId === l.materialId && Number(i.quantity) === l.quantity);
            await tx.inventoryLayer.create({
                data: {
                    userId, materialId: l.materialId, sourceType: 'PURCHASE', sourceId: pi!.id,
                    receivedDate: updated.billDate, originalQty: l.quantity, remainingQty: l.quantity,
                    unitCostEnc: encryptFinancialData(l.rate)
                }
            });
            await tx.inventoryLedger.create({
                data: {
                    userId, materialId: l.materialId, txnDate: updated.billDate,
                    movementType: 'IN', quantity: l.quantity, referenceType: 'PURCHASE', referenceId: updated.id
                }
            });
            await tx.$executeRaw\`UPDATE materials SET current_stock = current_stock + \${l.quantity} WHERE id = \${l.materialId}\`;
         }

         return updated;
    });

    res.json(row);
  } catch (err: any) { 
      if (err.message.includes('sold/consumed')) return res.status(400).json({ error: err.message });
      next(err); 
  }
}

export async function deletePurchase`;
purchaseContent = purchaseContent.replace(updatePurchaseRegex, newUpdatePurchase);
fs.writeFileSync(purchasePath, purchaseContent, 'utf8');

// --- SALE CONTROLLER UPDATE SALE ---
const salePath = path.join(__dirname, 'src', 'controllers', 'saleController.ts');
let saleContent = fs.readFileSync(salePath, 'utf8');

const updateSaleRegex = /export async function updateSale[\s\S]*?export async function deleteSale/;
const newUpdateSale = `export async function updateSale(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);

    if (!(await assertTenantOwnership(userId, 'sales', id))) return res.status(403).json({ error: 'Access denied.' });
    
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed.' });

    const { invoiceNo, items, companyGstin, dueDate, ...data } = parsed.data;
    const tenant = await prisma.user.findUnique({ where: { id: userId } });
    const isInterState = determineInterState(tenant, data, companyGstin);

    const result = await prisma.$transaction(async (tx) => {
         const existingSale = await tx.sale.findUnique({ where: { id }, include: { items: true } });
         if (!existingSale) throw new Error('Sale not found.');

         // Reverse old layers entirely
         for (const oldItem of existingSale.items) {
             const consumptions = await tx.layerConsumption.findMany({ where: { saleItemId: oldItem.id } });
             for (const cons of consumptions) {
                 await tx.inventoryLayer.update({
                     where: { id: cons.layerId },
                     data: { remainingQty: { increment: cons.quantityConsumed } }
                 });
             }
             await tx.layerConsumption.deleteMany({ where: { saleItemId: oldItem.id } });

             await tx.inventoryLedger.create({
                 data: { userId, materialId: oldItem.materialId, txnDate: existingSale.invoiceDate, movementType: 'IN', quantity: oldItem.quantity, referenceType: 'REVERSAL', referenceId: existingSale.id }
             });
             await tx.$executeRaw\`UPDATE materials SET current_stock = current_stock + \${oldItem.quantity} WHERE id = \${oldItem.materialId}\`;
         }
         await tx.saleItem.deleteMany({ where: { saleId: id } });

         let totalTaxable = 0, totalGst = 0, totalPurchaseCost = 0;
         const calculatedItems = [];
         const consumptionsToCreate: any[] = [];
         const ledgerOuts: any[] = [];
         const stockUpdates: any[] = [];

         for (const item of items) {
             const materialsRaw = await tx.$queryRaw<any[]>\`SELECT * FROM materials WHERE "user_id" = \${userId} AND material_name = \${item.materialName} FOR UPDATE\`;
             if (materialsRaw.length === 0) throw new Error(\`Material '\${item.materialName}' not found.\`);
             const material = materialsRaw[0];
             const qty = Number(item.quantity);
             if (Number(material.current_stock) < qty) throw new Error(\`Insufficient stock for '\${item.materialName}'.\`);

             let qtyToConsume = qty;
             let itemCogs = 0;
             const layers = await tx.inventoryLayer.findMany({
                 where: { userId, materialId: material.id, remainingQty: { gt: 0 } },
                 orderBy: [ { receivedDate: 'asc' }, { id: 'asc' } ]
             });
             for (const layer of layers) {
                 if (qtyToConsume <= 0) break;
                 const available = Number(layer.remainingQty);
                 const consume = Math.min(available, qtyToConsume);
                 const layerCost = layer.unitCostEnc ? safeDecryptFinancial(layer.unitCostEnc) : 0;
                 itemCogs += (consume * layerCost);
                 await tx.inventoryLayer.update({ where: { id: layer.id }, data: { remainingQty: new Prisma.Decimal(available - consume) } });
                 consumptionsToCreate.push({ userId, layerId: layer.id, quantityConsumed: consume, unitCostEnc: layer.unitCostEnc || '' });
                 qtyToConsume -= consume;
             }
             if (qtyToConsume > 0) throw new Error(\`FIFO error: Insufficient layers for '\${item.materialName}'.\`);

             const price = Number(item.unitPrice), gstPct = Number(item.gstPercent);
             const itemTaxable = Number((qty * price).toFixed(2)), itemGst = Number((itemTaxable * (gstPct / 100)).toFixed(2));
             
             totalTaxable += itemTaxable; totalGst += itemGst; totalPurchaseCost += itemCogs;
             calculatedItems.push({
                 materialId: material.id, materialName: item.materialName, hsnCode: item.hsnCode, quantity: qty,
                 unitPrice: price, gstPercent: gstPct, taxableAmount: itemTaxable, gstAmount: itemGst, itemTotal: itemTaxable + itemGst,
                 purchasePriceEnc: encryptFinancialData(itemCogs), avgPurchaseCostEnc: encryptFinancialData(itemCogs)
             });
             ledgerOuts.push({ userId, materialId: material.id, quantity: qty });
             stockUpdates.push({ materialId: material.id, quantity: qty });
         }

         const { igstAmount, cgstAmount, sgstAmount } = calculateGstBreakdown(totalGst, isInterState);
         const otherExp = Number(data.otherExpense || 0), rndOff = Number(data.roundOff || 0);
         const grandTotal = Number((totalTaxable + totalGst + otherExp + rndOff).toFixed(2));
         const grossProfit = Number((totalTaxable - totalPurchaseCost).toFixed(2));
         const profitPct = totalTaxable > 0 ? Number(((grossProfit / totalTaxable) * 100).toFixed(4)) : 0;

         const updated = await tx.sale.update({
             where: { id },
             data: {
                 ...data, invoiceDate: new Date(data.invoiceDate), dueDate: dueDate ? new Date(dueDate) : null,
                 totalTaxable, totalGst, igstAmount, cgstAmount, sgstAmount, grandTotal,
                 totalPurchaseCostEnc: encryptFinancialData(totalPurchaseCost),
                 grossProfitEnc: encryptFinancialData(grossProfit), profitPct,
                 items: { create: calculatedItems },
             },
             include: { items: true },
         });

         for (const cons of consumptionsToCreate) {
             const layerMatId = (await tx.inventoryLayer.findUnique({ where: { id: cons.layerId } }))?.materialId;
             const sItem = updated.items.find(si => si.materialId === layerMatId);
             await tx.layerConsumption.create({ data: { ...cons, saleItemId: sItem!.id } });
         }

         for (const l of ledgerOuts) {
             await tx.inventoryLedger.create({ data: { userId, materialId: l.materialId, txnDate: updated.invoiceDate, movementType: 'OUT', quantity: l.quantity, referenceType: 'SALE', referenceId: updated.id } });
         }
         for (const s of stockUpdates) {
             await tx.$executeRaw\`UPDATE materials SET current_stock = current_stock - \${s.quantity} WHERE id = \${s.materialId}\`;
         }

         return updated;
    });

    await auditLog(userId, 'SALE_UPDATE', \`Invoice: \${result.invoiceNo}\`, req, 'Sale', result.id, 'SUCCESS');
    res.json(result);
  } catch (err: any) { next(err); }
}

export async function deleteSale`;
saleContent = saleContent.replace(updateSaleRegex, newUpdateSale);
fs.writeFileSync(salePath, saleContent, 'utf8');

console.log('Patched update controllers');
