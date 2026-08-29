import * as fs from 'fs';
import * as path from 'path';

const controllerPath = path.join(__dirname, 'src', 'controllers', 'purchaseController.ts');
let content = fs.readFileSync(controllerPath, 'utf8');

const updatePurchaseRegex = /export async function updatePurchase[\s\S]*?export async function deletePurchase/m;
const newUpdatePurchase = `export async function updatePurchase(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);

    if (!(await assertTenantOwnership(userId, 'purchases', id))) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const parsed = purchaseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed.', details: parsed.error.flatten().fieldErrors });
    }

    const { 
        vendorName, vendorId, items, vendorGstin, 
        totalTaxable: _tTaxable, totalGst: _tGst, igstAmount: _iGst, cgstAmount: _cGst, sgstAmount: _sGst, grandTotal: _gTotal,
        ...data 
    } = parsed.data;

    const tenant = await prisma.user.findUnique({ where: { id: userId } });
    if (!tenant) return res.status(401).json({ error: 'Tenant not found.' });
    
    let finalVendorId = null;
    let finalVendorName = vendorName;
    if (vendorId) {
        const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, userId } });
        if (!vendor) return res.status(400).json({ error: 'Invalid Vendor ID.' });
        finalVendorId = vendor.id;
        finalVendorName = vendor.vendorName;
    }

    let isInterState = false;
    let stateDetermined = false;

    const tenantGstin = tenant.gstin ? safeDecrypt(tenant.gstin) : null;
    const vendGstin = vendorGstin;

    if (tenantGstin && tenantGstin.length >= 2 && vendGstin && vendGstin.length >= 2) {
        isInterState = tenantGstin.substring(0, 2) !== vendGstin.substring(0, 2);
        stateDetermined = true;
    }

    const result = await prisma.$transaction(async (tx) => {
        const existingPurchase = await tx.purchase.findUnique({
             where: { id },
             include: { items: true }
        });
        if (!existingPurchase) throw new Error('Purchase not found.');

        // Reversal of existing IN items
        for (const oldItem of existingPurchase.items) {
             await tx.inventoryLedger.create({
                 data: {
                     userId,
                     materialId: oldItem.materialId,
                     txnDate: existingPurchase.billDate,
                     movementType: 'OUT', // Reversal of IN
                     quantity: oldItem.quantity,
                     referenceType: 'REVERSAL',
                     referenceId: existingPurchase.id
                 }
             });
             await tx.$executeRaw\`UPDATE materials SET current_stock = current_stock - \${oldItem.quantity} WHERE id = \${oldItem.materialId}\`;
        }

        await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });

        let totalTaxable = 0;
        let totalGst = 0;

        const calculatedItems = await Promise.all(items.map(async (item) => {
            const materialsRaw = await tx.$queryRaw<any[]>\`SELECT * FROM materials WHERE "user_id" = \${userId} AND material_name = \${item.materialName} FOR UPDATE\`;
            if (materialsRaw.length === 0) throw new Error(\`Material '\${item.materialName}' not found or access denied.\`);
            const material = materialsRaw[0];
            
            if (!material.is_active) throw new Error(\`Material '\${item.materialName}' is deactivated.\`);

            const qty = Number(item.quantity);
            const rate = Number(item.purchaseRate);
            const gstPct = Number(item.gstPercent);

            const itemTaxable = Number((qty * rate).toFixed(2));
            const itemGst = Number((itemTaxable * (gstPct / 100)).toFixed(2));
            const itemTotal = Number((itemTaxable + itemGst).toFixed(2));

            totalTaxable += itemTaxable;
            totalGst += itemGst;

            return {
                materialId: material.id,
                materialName: item.materialName,
                hsnCode: item.hsnCode,
                quantity: qty,
                purchaseRateEnc: encryptFinancialData(rate),
                gstPercent: gstPct,
                taxableAmount: itemTaxable,
                gstAmount: itemGst,
                itemTotal: itemTotal,
            };
        }));

        if (!stateDetermined && totalGst > 0) {
            throw new Error('Cannot safely determine interstate GST status.');
        }

        let igstAmount = 0, cgstAmount = 0, sgstAmount = 0;
        if (totalGst > 0) {
            if (isInterState) { igstAmount = totalGst; } 
            else { cgstAmount = Number((totalGst / 2).toFixed(2)); sgstAmount = totalGst - cgstAmount; }
        }

        const otherExp = Number(data.otherExpense || 0);
        const rndOff = Number(data.roundOff || 0);
        const grandTotal = Number((totalTaxable + totalGst + otherExp + rndOff).toFixed(2));

        const updated = await tx.purchase.update({
            where: { id },
            data: {
                vendorId: finalVendorId,
                vendorName: finalVendorName,
                vendorGstin: vendorGstin ? encryptFinancialData(vendorGstin) : null,
                billNo: data.billNo,
                billDate: new Date(data.billDate),
                otherExpense: otherExp,
                roundOff: rndOff,
                totalTaxable, totalGst, igstAmount, cgstAmount, sgstAmount, grandTotal,
                notes: data.notes,
                items: { create: calculatedItems },
            },
            include: { items: true },
        });

        // Replacement IN movements
        for (const item of updated.items) {
             await tx.inventoryLedger.create({
                 data: {
                     userId,
                     materialId: item.materialId,
                     txnDate: updated.billDate,
                     movementType: 'IN',
                     quantity: item.quantity,
                     referenceType: 'PURCHASE',
                     referenceId: updated.id
                 }
             });
             await tx.$executeRaw\`UPDATE materials SET current_stock = current_stock + \${item.quantity} WHERE id = \${item.materialId}\`;
        }

        return updated;
    });

    await auditLog(userId, 'PURCHASE_UPDATE', \`Bill No: \${result.billNo}\`, req, 'Purchase', id, 'SUCCESS');
    res.json(decryptPurchase(result));
  } catch (err: any) {
    if (err.message && (err.message.includes('not found') || err.message.includes('safely determine') || err.message.includes('deactivated'))) {
        return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

export async function deletePurchase`;

content = content.replace(updatePurchaseRegex, newUpdatePurchase);


const deletePurchaseRegex = /export async function deletePurchase[\s\S]*?export async function getLatestPurchaseRate/m;
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

         // Create Reversals
         for (const oldItem of existingPurchase.items) {
             await tx.inventoryLedger.create({
                 data: {
                     userId,
                     materialId: oldItem.materialId,
                     txnDate: existingPurchase.billDate,
                     movementType: 'OUT', // Reverse IN
                     quantity: oldItem.quantity,
                     referenceType: 'REVERSAL',
                     referenceId: existingPurchase.id
                 }
             });
             await tx.$executeRaw\`UPDATE materials SET current_stock = current_stock - \${oldItem.quantity} WHERE id = \${oldItem.materialId}\`;
         }

         await tx.purchase.delete({ where: { id } });
         return existingPurchase;
    });

    await auditLog(userId, 'PURCHASE_DELETE', \`Purchase cancelled/deleted\`, req, 'Purchase', id, 'SUCCESS');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function getLatestPurchaseRate`;

content = content.replace(deletePurchaseRegex, newDeletePurchase);
fs.writeFileSync(controllerPath, content);
console.log('purchaseController updated successfully.');
