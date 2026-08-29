import * as fs from 'fs';
import * as path from 'path';

// --- SALE CONTROLLER ---
const salePath = path.join(__dirname, 'src', 'controllers', 'saleController.ts');
let saleContent = fs.readFileSync(salePath, 'utf8');

// The replacement for createSale (FIFO implementation)
const createSaleRegex = /export async function createSale[\s\S]*?export async function updateSale/;
const newCreateSale = `export async function createSale(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed.', details: parsed.error.flatten().fieldErrors });

    const { invoiceNo, items, companyGstin, dueDate, ...data } = parsed.data;

    const tenant = await prisma.user.findUnique({ where: { id: userId } });
    if (!tenant) return res.status(401).json({ error: 'Tenant not found.' });
    const isInterState = determineInterState(tenant, data, companyGstin);

    const result = await prisma.$transaction(async (tx) => {
        let totalTaxable = 0, totalGst = 0, totalPurchaseCost = 0;
        
        // Ensure all requested items are resolved
        const resolvedItems = await Promise.all(items.map(async (item) => {
            const materialsRaw = await tx.$queryRaw<any[]>\`SELECT * FROM materials WHERE "user_id" = \${userId} AND material_name = \${item.materialName} FOR UPDATE\`;
            if (materialsRaw.length === 0) throw new Error(\`Material '\${item.materialName}' not found.\`);
            return { item, material: materialsRaw[0] };
        }));

        const calculatedItems = [];
        const consumptionsToCreate: any[] = [];
        const ledgerOuts: any[] = [];
        const stockUpdates: any[] = [];

        for (const { item, material } of resolvedItems) {
            if (!material.is_active) throw new Error(\`Material '\${item.materialName}' is deactivated.\`);
            const qty = Number(item.quantity);
            if (Number(material.current_stock) < qty) {
                throw new Error(\`Insufficient stock for '\${item.materialName}'. Available: \${material.current_stock}\`);
            }

            // FIFO Consumption
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
                
                await tx.inventoryLayer.update({
                    where: { id: layer.id },
                    data: { remainingQty: new Prisma.Decimal(available - consume) }
                });

                consumptionsToCreate.push({
                    userId,
                    layerId: layer.id,
                    quantityConsumed: consume,
                    unitCostEnc: layer.unitCostEnc || '' // Safe snapshot
                });

                qtyToConsume -= consume;
            }

            if (qtyToConsume > 0) {
                throw new Error(\`FIFO calculation error: Insufficient layers for '\${item.materialName}'.\`);
            }

            const price = Number(item.unitPrice);
            const gstPct = Number(item.gstPercent);
            const itemTaxable = Number((qty * price).toFixed(2));
            const itemGst = Number((itemTaxable * (gstPct / 100)).toFixed(2));
            const itemTotal = Number((itemTaxable + itemGst).toFixed(2));
            
            totalTaxable += itemTaxable;
            totalGst += itemGst;
            totalPurchaseCost += itemCogs;

            calculatedItems.push({
                materialId: material.id,
                materialName: item.materialName,
                hsnCode: item.hsnCode,
                quantity: qty,
                unitPrice: price,
                gstPercent: gstPct,
                taxableAmount: itemTaxable,
                gstAmount: itemGst,
                itemTotal: itemTotal,
                purchasePriceEnc: encryptFinancialData(itemCogs), // Now represents precise COGS
                avgPurchaseCostEnc: encryptFinancialData(itemCogs)
            });

            ledgerOuts.push({ userId, materialId: material.id, quantity: qty });
            stockUpdates.push({ materialId: material.id, quantity: qty });
        }

        const { igstAmount, cgstAmount, sgstAmount } = calculateGstBreakdown(totalGst, isInterState);
        const otherExp = Number(data.otherExpense || 0), rndOff = Number(data.roundOff || 0);
        const grandTotal = Number((totalTaxable + totalGst + otherExp + rndOff).toFixed(2));
        const grossProfit = Number((totalTaxable - totalPurchaseCost).toFixed(2));
        const profitPct = totalTaxable > 0 ? Number(((grossProfit / totalTaxable) * 100).toFixed(4)) : 0;

        const sale = await tx.sale.create({
            data: {
                userId,
                ...data,
                invoiceDate: new Date(data.invoiceDate),
                dueDate: dueDate ? new Date(dueDate) : null,
                totalTaxable, totalGst, igstAmount, cgstAmount, sgstAmount, grandTotal,
                totalPurchaseCostEnc: encryptFinancialData(totalPurchaseCost),
                grossProfitEnc: encryptFinancialData(grossProfit),
                profitPct,
                items: { create: calculatedItems },
            },
            include: { items: true },
        });

        // Insert consumptions with their saleItemIds
        for (const cons of consumptionsToCreate) {
             // Find matching saleItem by layer material matching (hacky but items array ordering matches)
             const layerMatId = (await tx.inventoryLayer.findUnique({ where: { id: cons.layerId } }))?.materialId;
             const sItem = sale.items.find(si => si.materialId === layerMatId);
             await tx.layerConsumption.create({
                 data: { ...cons, saleItemId: sItem!.id }
             });
        }

        for (const l of ledgerOuts) {
            await tx.inventoryLedger.create({
                data: {
                    userId, materialId: l.materialId, txnDate: sale.invoiceDate,
                    movementType: 'OUT', quantity: l.quantity,
                    referenceType: 'SALE', referenceId: sale.id
                }
            });
        }
        for (const s of stockUpdates) {
            await tx.$executeRaw\`UPDATE materials SET current_stock = current_stock - \${s.quantity} WHERE id = \${s.materialId}\`;
        }

        return sale;
    });

    await auditLog(userId, 'SALE_CREATE', \`Invoice: \${result.invoiceNo}\`, req, 'Sale', result.id, 'SUCCESS');
    res.status(201).json(result);
  } catch (err: any) { next(err); }
}

// Helpers missing in scope
function determineInterState(tenant: any, data: any, companyGstin?: string) {
    let isInterState = false;
    const tenantGstin = tenant.gstin ? safeDecrypt(tenant.gstin) : null;
    const custGstin = companyGstin;
    if (tenantGstin && tenantGstin.length >= 2 && custGstin && custGstin.length >= 2) {
        isInterState = tenantGstin.substring(0, 2) !== custGstin.substring(0, 2);
    } else {
        const tenantState = tenant.state?.trim().toLowerCase();
        const custState = data.shipState?.trim().toLowerCase();
        if (tenantState && custState) {
            isInterState = tenantState !== custState;
        }
    }
    return isInterState;
}
function calculateGstBreakdown(totalGst: number, isInterState: boolean) {
    let igstAmount = 0, cgstAmount = 0, sgstAmount = 0;
    if (totalGst > 0) {
        if (isInterState) { igstAmount = totalGst; } 
        else { cgstAmount = Number((totalGst / 2).toFixed(2)); sgstAmount = totalGst - cgstAmount; }
    }
    return { igstAmount, cgstAmount, sgstAmount };
}

export async function updateSale`;

saleContent = saleContent.replace(createSaleRegex, newCreateSale);

// Update deleteSale to restore layers
const deleteSaleRegex = /export async function deleteSale[\s\S]*?export async function addPayment/;
const newDeleteSale = `export async function deleteSale(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);

    if (!(await assertTenantOwnership(userId, 'sales', id))) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const row = await prisma.$transaction(async (tx) => {
         const existingSale = await tx.sale.findUnique({
              where: { id },
              include: { items: true }
         });
         if (!existingSale) throw new Error('Sale not found.');

         // Restore FIFO layers
         for (const oldItem of existingSale.items) {
             const consumptions = await tx.layerConsumption.findMany({ where: { saleItemId: oldItem.id } });
             for (const cons of consumptions) {
                 await tx.inventoryLayer.update({
                     where: { id: cons.layerId },
                     data: { remainingQty: { increment: cons.quantityConsumed } }
                 });
             }
             await tx.layerConsumption.deleteMany({ where: { saleItemId: oldItem.id } });

             // Inventory Ledger REVERSAL
             await tx.inventoryLedger.create({
                 data: {
                     userId,
                     materialId: oldItem.materialId,
                     txnDate: existingSale.invoiceDate,
                     movementType: 'IN', // Reverse OUT
                     quantity: oldItem.quantity,
                     referenceType: 'REVERSAL',
                     referenceId: existingSale.id
                 }
             });
             await tx.$executeRaw\`UPDATE materials SET current_stock = current_stock + \${oldItem.quantity} WHERE id = \${oldItem.materialId}\`;
         }

         await tx.sale.delete({ where: { id } });
         return existingSale;
    });

    await auditLog(userId, 'SALE_DELETE', \`Sale cancelled/deleted\`, req, 'Sale', id, 'SUCCESS');
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function addPayment`;

saleContent = saleContent.replace(deleteSaleRegex, newDeleteSale);

fs.writeFileSync(salePath, saleContent, 'utf8');

// --- PURCHASE CONTROLLER ---
const purchasePath = path.join(__dirname, 'src', 'controllers', 'purchaseController.ts');
let purchaseContent = fs.readFileSync(purchasePath, 'utf8');

const createPurchaseRegex = /export async function createPurchase[\s\S]*?export async function updatePurchase/;
const newCreatePurchase = `export async function createPurchase(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const parsed = purchaseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed.' });

    const { items, ...data } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
        let totalTaxable = 0, totalGst = 0;
        
        const calculatedItems = [];
        const layerCreates: any[] = [];

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
                materialId: material.id,
                materialName: item.materialName,
                hsnCode: item.hsnCode,
                quantity: qty,
                purchaseRateEnc: encryptFinancialData(rate),
                gstPercent: gstPct,
                taxableAmount: itemTaxable,
                gstAmount: itemGst,
                itemTotal: itemTaxable + itemGst,
            });

            layerCreates.push({
                userId, materialId: material.id, quantity: qty, rate
            });
        }

        const purchase = await tx.purchase.create({
            data: {
                userId, ...data,
                billDate: new Date(data.billDate),
                totalTaxable, totalGst, grandTotal: totalTaxable + totalGst,
                items: { create: calculatedItems },
            },
            include: { items: true },
        });

        // FIFO Layer Creation
        for (const l of layerCreates) {
            const pi = purchase.items.find(i => i.materialId === l.materialId && Number(i.quantity) === l.quantity);
            await tx.inventoryLayer.create({
                data: {
                    userId, materialId: l.materialId, sourceType: 'PURCHASE', sourceId: pi!.id,
                    receivedDate: purchase.billDate, originalQty: l.quantity, remainingQty: l.quantity,
                    unitCostEnc: encryptFinancialData(l.rate)
                }
            });

            await tx.inventoryLedger.create({
                data: {
                    userId, materialId: l.materialId, txnDate: purchase.billDate,
                    movementType: 'IN', quantity: l.quantity, referenceType: 'PURCHASE', referenceId: purchase.id
                }
            });
            await tx.$executeRaw\`UPDATE materials SET current_stock = current_stock + \${l.quantity} WHERE id = \${l.materialId}\`;
        }

        return purchase;
    });

    res.status(201).json(result);
  } catch (err: any) { next(err); }
}

export async function updatePurchase`;
purchaseContent = purchaseContent.replace(createPurchaseRegex, newCreatePurchase);

// Purchase Edit and Delete protection
const deletePurchaseRegex = /export async function deletePurchase[\s\S]*?export async function getLatestPurchaseRate/;
const newDeletePurchase = `export async function deletePurchase(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);

    if (!(await assertTenantOwnership(userId, 'purchases', id))) {
      return res.status(403).json({ error: 'Access denied.' });
    }

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
                 throw new Error(\`Cannot delete purchase: items have already been sold/consumed (Material ID \${oldItem.materialId}). Cancel sales first.\`);
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

         await tx.purchase.delete({ where: { id } });
         return existingPurchase;
    });

    res.json({ success: true });
  } catch (err: any) { 
      if (err.message.includes('sold/consumed')) return res.status(400).json({ error: err.message });
      next(err); 
  }
}

export async function getLatestPurchaseRate`;
purchaseContent = purchaseContent.replace(deletePurchaseRegex, newDeletePurchase);

fs.writeFileSync(purchasePath, purchaseContent, 'utf8');

console.log('Patched controllers');
