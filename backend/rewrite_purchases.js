const fs = require('fs');
const path = require('path');

const srcPurchaseControllerPath = path.join(__dirname, 'src', 'controllers', 'purchaseController.ts');
let content = fs.readFileSync(srcPurchaseControllerPath, 'utf8');

// Replace createPurchase
const startCreate = content.indexOf('export async function createPurchase');
const endCreate = content.indexOf('export async function updatePurchase');
if (startCreate === -1 || endCreate === -1) throw new Error("Could not find createPurchase");

const oldCreate = content.substring(startCreate, endCreate);
const newCreate = `export async function createPurchase(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const parsed = purchaseSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed.',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { 
        vendorName, vendorId, items, vendorGstin, 
        // ignore client totals
        totalTaxable: _tTaxable, totalGst: _tGst, igstAmount: _iGst, cgstAmount: _cGst, sgstAmount: _sGst, grandTotal: _gTotal,
        ...data 
    } = parsed.data;

    const tenant = await prisma.user.findUnique({ where: { id: userId } });
    if (!tenant) return res.status(401).json({ error: 'Tenant not found.' });
    
    // Vendor Validation
    let finalVendorId = null;
    let finalVendorName = vendorName;
    if (vendorId) {
        const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, userId } });
        if (!vendor) return res.status(400).json({ error: 'Invalid Vendor ID.' });
        finalVendorId = vendor.id;
        finalVendorName = vendor.vendorName;
    }

    // Determine Interstate Status
    let isInterState = false;
    let stateDetermined = false;

    const tenantGstin = tenant.gstin ? safeDecrypt(tenant.gstin) : null;
    const vendGstin = vendorGstin;

    if (tenantGstin && tenantGstin.length >= 2 && vendGstin && vendGstin.length >= 2) {
        isInterState = tenantGstin.substring(0, 2) !== vendGstin.substring(0, 2);
        stateDetermined = true;
    } else {
        // We lack a state field on Vendor and PurchaseSchema currently for V1, 
        // if GSTIN is not present, we will fallback to accepting isInterState from client 
        // ONLY if they didn't provide GSTINs. Wait, the user said DO NOT GUESS.
        // Actually, if we can't determine it, and it's a purchase, we must throw an error if GST > 0
    }

    let totalTaxable = 0;
    let totalGst = 0;

    const calculatedItems = await Promise.all(items.map(async (item) => {
        const material = await prisma.material.findFirst({
             where: { materialName: item.materialName, userId }
        });
        if (!material) throw new Error(\`Material '\${item.materialName}' not found or access denied.\`);

        const qty = Number(item.quantity);
        const rate = Number(item.purchaseRate);
        const gstPct = Number(item.gstPercent);

        const itemTaxable = Number((qty * rate).toFixed(2));
        const itemGst = Number((itemTaxable * (gstPct / 100)).toFixed(2));
        const itemTotal = Number((itemTaxable + itemGst).toFixed(2));

        totalTaxable += itemTaxable;
        totalGst += itemGst;

        return {
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
        // As per strictly mandated security rules
        return res.status(400).json({ error: 'Cannot safely determine interstate GST status. Please ensure both Company and Vendor have a valid GSTIN configured.' });
    }

    let igstAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;

    if (totalGst > 0) {
        if (isInterState) {
            igstAmount = totalGst;
        } else {
            cgstAmount = Number((totalGst / 2).toFixed(2));
            sgstAmount = totalGst - cgstAmount;
        }
    }

    const otherExp = Number(data.otherExpense || 0);
    const rndOff = Number(data.roundOff || 0);
    const grandTotal = Number((totalTaxable + totalGst + otherExp + rndOff).toFixed(2));

    const row = await prisma.$transaction(async (tx) => {
        return await tx.purchase.create({
            data: {
                userId,
                ...data,
                vendorId: finalVendorId,
                vendorName: finalVendorName,
                vendorGstin: encryptIfPresent(vendorGstin?.toUpperCase()),
                billDate: new Date(data.billDate),
                
                totalTaxable,
                totalGst,
                igstAmount,
                cgstAmount,
                sgstAmount,
                grandTotal,
                paymentPaid: 0,
                
                items: { create: calculatedItems },
            },
            include: { items: true },
        });
    });

    await auditLog(userId, 'data_create', \`Purchase created: \${row.billNo}\`, req);
    res.status(201).json({
        ...row,
        vendorGstin: safeDecrypt(row.vendorGstin || ''),
        items: row.items.map(item => ({
             ...item,
             purchaseRate: item.purchaseRateEnc ? safeDecryptFinancial(item.purchaseRateEnc) : 0
        }))
    });
  } catch (err) {
    if (err.message && err.message.includes('not found or access denied')) {
        return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

`;
content = content.replace(oldCreate, newCreate);


// Replace updatePurchase
const startUpdate = content.indexOf('export async function updatePurchase');
const endUpdate = content.indexOf('export async function deletePurchase');
if (startUpdate === -1 || endUpdate === -1) throw new Error("Could not find updatePurchase");

const oldUpdate = content.substring(startUpdate, endUpdate);
const newUpdate = `export async function updatePurchase(req: Request, res: Response, next: NextFunction) {
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

    const tenantGstin = tenant?.gstin ? safeDecrypt(tenant.gstin) : null;
    const vendGstin = vendorGstin;

    if (tenantGstin && tenantGstin.length >= 2 && vendGstin && vendGstin.length >= 2) {
        isInterState = tenantGstin.substring(0, 2) !== vendGstin.substring(0, 2);
        stateDetermined = true;
    }

    let totalTaxable = 0;
    let totalGst = 0;

    const calculatedItems = await Promise.all(items.map(async (item) => {
        const material = await prisma.material.findFirst({
             where: { materialName: item.materialName, userId }
        });
        if (!material) throw new Error(\`Material '\${item.materialName}' not found or access denied.\`);

        const qty = Number(item.quantity);
        const rate = Number(item.purchaseRate);
        const gstPct = Number(item.gstPercent);

        const itemTaxable = Number((qty * rate).toFixed(2));
        const itemGst = Number((itemTaxable * (gstPct / 100)).toFixed(2));
        const itemTotal = Number((itemTaxable + itemGst).toFixed(2));

        totalTaxable += itemTaxable;
        totalGst += itemGst;

        return {
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
        return res.status(400).json({ error: 'Cannot safely determine interstate GST status. Please ensure both Company and Vendor have a valid GSTIN configured.' });
    }

    let igstAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;

    if (totalGst > 0) {
        if (isInterState) {
            igstAmount = totalGst;
        } else {
            cgstAmount = Number((totalGst / 2).toFixed(2));
            sgstAmount = totalGst - cgstAmount;
        }
    }

    const otherExp = Number(data.otherExpense || 0);
    const rndOff = Number(data.roundOff || 0);
    const grandTotal = Number((totalTaxable + totalGst + otherExp + rndOff).toFixed(2));

    const row = await prisma.$transaction(async (tx) => {
        await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });

        return await tx.purchase.update({
            where: { id },
            data: {
                ...data,
                vendorId: finalVendorId,
                vendorName: finalVendorName,
                vendorGstin: encryptIfPresent(vendorGstin?.toUpperCase()),
                billDate: new Date(data.billDate),
                
                totalTaxable,
                totalGst,
                igstAmount,
                cgstAmount,
                sgstAmount,
                grandTotal,
                
                items: { create: calculatedItems },
            },
            include: { items: true },
        });
    });

    await auditLog(userId, 'data_update', \`Purchase updated: \${row.billNo}\`, req);

    res.json({
        ...row,
        vendorGstin: safeDecrypt(row.vendorGstin || ''),
        items: row.items.map(item => ({
             ...item,
             purchaseRate: item.purchaseRateEnc ? safeDecryptFinancial(item.purchaseRateEnc) : 0
        }))
    });
  } catch (err) {
    if (err.message && err.message.includes('not found or access denied')) {
        return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

`;
content = content.replace(oldUpdate, newUpdate);


// Payable Payments Overpayment Protection
const startAddPmt = content.indexOf('export async function addPayablePayment');
const endAddPmt = content.indexOf('export async function getPayablePayments');
if (startAddPmt !== -1 && endAddPmt !== -1) {
    const oldAddPmt = content.substring(startAddPmt, endAddPmt);
    const newAddPmt = `export async function addPayablePayment(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const purchaseId = parseInt(req.body.purchaseId);

    if (isNaN(purchaseId)) return res.status(400).json({ error: 'purchaseId is required.' });
    if (!(await assertTenantOwnership(userId, 'purchases', purchaseId))) return res.status(403).json({ error: 'Access denied.' });

    const parsed = payablePaymentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed.' });

    const payment = await prisma.$transaction(async (tx) => {
        const purchase = await tx.$queryRaw\`SELECT grand_total as "grandTotal", payment_paid as "paymentPaid" FROM purchases WHERE id = \${purchaseId} FOR UPDATE\`;
        if (!purchase || purchase.length === 0) throw new Error('Purchase not found');
        
        const grandTotal = Number(purchase[0].grandTotal);
        const currentPaid = Number(purchase[0].paymentPaid);
        const newPayment = Number(parsed.data.amount);
        
        if (currentPaid + newPayment > grandTotal) {
             throw new Error(\`Overpayment rejected. Outstanding balance is \${grandTotal - currentPaid}\`);
        }
        
        const pmt = await tx.payablePayment.create({
            data: { purchaseId, ...parsed.data, datePaid: new Date(parsed.data.datePaid) },
        });
        
        await tx.purchase.update({ 
            where: { id: purchaseId }, 
            data: { paymentPaid: currentPaid + newPayment } 
        });
        
        return pmt;
    });

    await auditLog(userId, 'data_create', \`Payment made for purchase #\${purchaseId}: \${parsed.data.amount}\`, req);
    res.status(201).json(payment);
  } catch (err) {
    if (err.message && err.message.includes('Overpayment rejected')) return res.status(400).json({ error: err.message });
    next(err);
  }
}

`;
    content = content.replace(oldAddPmt, newAddPmt);
}

const startUpdatePmt = content.indexOf('export async function updatePayablePayment');
const endUpdatePmt = content.indexOf('export async function deletePayablePayment');
if (startUpdatePmt !== -1 && endUpdatePmt !== -1) {
    const oldUpdatePmt = content.substring(startUpdatePmt, endUpdatePmt);
    const newUpdatePmt = `export async function updatePayablePayment(req: Request, res: Response, next: NextFunction) {
  try {
    const paymentId = parseInt(req.params.paymentId);
    const parsed = payablePaymentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed.' });

    const userId = req.user!.userId;
    
    const payment = await prisma.$transaction(async (tx) => {
        const existing = await tx.payablePayment.findUnique({ where: { id: paymentId } });
        if (!existing) throw new Error('Payment not found');
        
        const purchaseId = existing.purchaseId;
        const purchaseOwned = await tx.purchase.findFirst({ where: { id: purchaseId, userId } });
        if (!purchaseOwned) throw new Error('Access denied');

        const purchase = await tx.$queryRaw\`SELECT grand_total as "grandTotal", payment_paid as "paymentPaid" FROM purchases WHERE id = \${purchaseId} FOR UPDATE\`;
        
        const grandTotal = Number(purchase[0].grandTotal);
        const currentPaid = Number(purchase[0].paymentPaid);
        const oldPayment = Number(existing.amount);
        const newPayment = Number(parsed.data.amount);
        
        if ((currentPaid - oldPayment) + newPayment > grandTotal) {
             throw new Error(\`Overpayment rejected. Outstanding balance is \${grandTotal - (currentPaid - oldPayment)}\`);
        }
        
        const pmt = await tx.payablePayment.update({
            where: { id: paymentId },
            data: {
              amount: parsed.data.amount,
              datePaid: new Date(parsed.data.datePaid),
              mode: parsed.data.mode,
              reference: parsed.data.reference,
              notes: parsed.data.notes,
            },
        });
        
        await tx.purchase.update({
            where: { id: purchaseId },
            data: { paymentPaid: (currentPaid - oldPayment) + newPayment }
        });
        
        return pmt;
    });

    await auditLog(userId, 'data_update', \`Payable payment updated #\${paymentId}\`, req);
    res.json(payment);
  } catch (err) {
    if (err.message && err.message.includes('Overpayment rejected')) return res.status(400).json({ error: err.message });
    if (err.message === 'Payment not found') return res.status(404).json({ error: err.message });
    if (err.message === 'Access denied') return res.status(403).json({ error: err.message });
    next(err);
  }
}

`;
    content = content.replace(oldUpdatePmt, newUpdatePmt);
}

fs.writeFileSync(srcPurchaseControllerPath, content, 'utf8');
console.log('purchaseController.ts updated for Purchases creation/update and payments authority.');
