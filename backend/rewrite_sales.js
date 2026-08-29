const fs = require('fs');
const path = require('path');

const saleControllerPath = path.join(__dirname, 'dist', 'controllers', 'saleController.js');
const srcSaleControllerPath = path.join(__dirname, 'src', 'controllers', 'saleController.ts');

let content = fs.readFileSync(srcSaleControllerPath, 'utf8');

// 1. Rewrite createSale
const createSaleMatch = content.match(/export async function createSale[\s\S]*?res\.status\(201\)\.json\(decrypt\(row\)\);\n  \} catch \(err\) \{\n    next\(err\);\n  \}\n\}/);

if (!createSaleMatch) throw new Error("Could not find createSale");

const newCreateSale = `export async function createSale(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed.', details: parsed.error.flatten().fieldErrors });
    }

    const {
      invoiceNo: enteredInvoiceNo,
      items,
      companyGstin,
      dueDate,
      isInterState: clientIsInterState,
      customerAddress,
      deliveryAddress,
      referenceNo, referenceDate, deliveryNote, buyerOrderNo, buyerOrderDate,
      dispatchDocNo, deliveryNoteDate, modeOfPayment, otherReference,
      transportName, lrNumber, destination, vehicleNumber, ewayBillNo,
      termsOfDelivery, shipCompanyName, shipAddressLine1, shipAddressLine2,
      shipCity, shipState, shipPincode, shipGSTIN, shipContactPerson,
      shipMobile, useBuyerAsShipping,
      // Ignore frontend totals
      totalTaxable: _tTaxable, totalGst: _tGst, igstAmount: _iGst, cgstAmount: _cGst, sgstAmount: _sGst,
      grandTotal: _gTotal, totalPurchaseCost: _tCost, grossProfit: _gProfit, profitPct: _pPct, paymentReceived: _pRecv,
      ...data
    } = parsed.data;

    const invoiceNo = enteredInvoiceNo?.trim() ? enteredInvoiceNo.trim() : await generateTenantId('INV', userId);

    // 1. Determine Interstate Status Safely
    const tenant = await prisma.user.findUnique({ where: { id: userId } });
    if (!tenant) return res.status(401).json({ error: 'Tenant not found.' });
    let isInterState = false;
    let stateDetermined = false;

    const tenantGstin = tenant.gstin ? safeDecrypt(tenant.gstin) : null;
    const custGstin = companyGstin;

    if (tenantGstin && tenantGstin.length >= 2 && custGstin && custGstin.length >= 2) {
        isInterState = tenantGstin.substring(0, 2) !== custGstin.substring(0, 2);
        stateDetermined = true;
    } else {
        const tenantState = tenant.state?.trim().toLowerCase();
        const custState = shipState?.trim().toLowerCase();
        if (tenantState && custState) {
            isInterState = tenantState !== custState;
            stateDetermined = true;
        }
    }

    // 2. Process Items & Calculate Totals
    let totalTaxable = 0;
    let totalGst = 0;
    let totalPurchaseCost = 0;

    const calculatedItems = await Promise.all(items.map(async (item) => {
        // Material Validation
        const material = await prisma.material.findFirst({
             where: { materialName: item.materialName, userId }
        });
        if (!material) throw new Error(\`Material '\${item.materialName}' not found or access denied.\`);

        // Last Purchase Rate Lookup
        const lastPurchase = await prisma.purchaseItem.findFirst({
             where: { materialName: item.materialName, purchase: { userId } },
             orderBy: { id: 'desc' }
        });
        const costBasis = lastPurchase && lastPurchase.purchaseRateEnc 
             ? safeDecryptFinancial(lastPurchase.purchaseRateEnc) 
             : 0;

        const qty = Number(item.quantity);
        const price = Number(item.unitPrice);
        const gstPct = Number(item.gstPercent);

        const itemTaxable = Number((qty * price).toFixed(2));
        const itemGst = Number((itemTaxable * (gstPct / 100)).toFixed(2));
        const itemTotal = Number((itemTaxable + itemGst).toFixed(2));
        
        totalTaxable += itemTaxable;
        totalGst += itemGst;
        totalPurchaseCost += (costBasis * qty);

        return {
            materialName: item.materialName,
            hsnCode: item.hsnCode,
            quantity: qty,
            unitPrice: price,
            gstPercent: gstPct,
            taxableAmount: itemTaxable,
            gstAmount: itemGst,
            itemTotal: itemTotal,
            purchasePriceEnc: encryptFinancialData(costBasis),
            avgPurchaseCostEnc: encryptFinancialData(costBasis) // For V1 compatibility
        };
    }));

    if (!stateDetermined && totalGst > 0) {
        return res.status(400).json({ error: 'Cannot safely determine interstate GST status. Please ensure both Company and Customer have a valid GSTIN or State configured.' });
    }

    // 3. Tax Splitting & Grand Total
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
    const grossProfit = Number((totalTaxable - totalPurchaseCost).toFixed(2));
    const profitPct = totalTaxable > 0 ? Number(((grossProfit / totalTaxable) * 100).toFixed(4)) : 0;

    // Execute atomic transaction for sale creation
    const row = await prisma.$transaction(async (tx) => {
        const sale = await tx.sale.create({
            data: {
                invoiceNo,
                ...data,
                customerAddress: encryptIfPresent(customerAddress),
                deliveryAddress: encryptIfPresent(deliveryAddress),
                invoiceDate: new Date(data.invoiceDate),
                dueDate: dueDate ? new Date(dueDate) : null,
                companyGstin: encryptIfPresent(companyGstin?.toUpperCase()),
                
                // GST template fields
                referenceNo, referenceDate: referenceDate ? new Date(referenceDate) : null,
                deliveryNote, buyerOrderNo, buyerOrderDate: buyerOrderDate ? new Date(buyerOrderDate) : null,
                dispatchDocNo, deliveryNoteDate: deliveryNoteDate ? new Date(deliveryNoteDate) : null,
                modeOfPayment, otherReference, transportName, lrNumber, destination, vehicleNumber, ewayBillNo,
                termsOfDelivery, shipCompanyName,
                shipAddressLine1: encryptIfPresent(shipAddressLine1),
                shipAddressLine2: encryptIfPresent(shipAddressLine2),
                shipCity, shipState, shipPincode,
                shipGSTIN: encryptIfPresent(shipGSTIN?.toUpperCase()),
                shipContactPerson, shipMobile, useBuyerAsShipping,

                // Computed Financials
                totalTaxable,
                totalGst,
                igstAmount,
                cgstAmount,
                sgstAmount,
                grandTotal,
                paymentReceived: 0,
                
                // Encrypted Profit & Cost
                totalPurchaseCostEnc: encryptFinancialData(totalPurchaseCost),
                grossProfitEnc: encryptFinancialData(grossProfit),
                profitPct,

                items: {
                    create: calculatedItems
                },
            },
            include: { items: true, receivablePayments: true },
        });
        
        return sale;
    });

    await auditLog(userId, 'data_create', \`Sale created: \${invoiceNo}\`, req);

    // Provide the decrypt wrapper for the response
    const safeRow = { ...row, grossProfit, totalPurchaseCost };
    res.status(201).json(decrypt(safeRow));
  } catch (err) {
    if (err.message && err.message.includes('not found or access denied')) {
        return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}`;

content = content.replace(createSaleMatch[0], newCreateSale);

// Update Sale
const updateSaleMatch = content.match(/export async function updateSale[\s\S]*?res\.json\(decrypt\(row\)\);\n  \} catch \(err\) \{\n    next\(err\);\n  \}\n\}/);

if (!updateSaleMatch) throw new Error("Could not find updateSale");

const newUpdateSale = `export async function updateSale(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);

    if (!(await assertTenantOwnership(userId, 'sales', id))) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed.', details: parsed.error.flatten().fieldErrors });
    }

    const {
      invoiceNo: enteredInvoiceNo,
      items,
      companyGstin,
      dueDate,
      isInterState: clientIsInterState,
      customerAddress,
      deliveryAddress,
      referenceNo, referenceDate, deliveryNote, buyerOrderNo, buyerOrderDate,
      dispatchDocNo, deliveryNoteDate, modeOfPayment, otherReference,
      transportName, lrNumber, destination, vehicleNumber, ewayBillNo,
      termsOfDelivery, shipCompanyName, shipAddressLine1, shipAddressLine2,
      shipCity, shipState, shipPincode, shipGSTIN, shipContactPerson,
      shipMobile, useBuyerAsShipping,
      // Ignore frontend totals
      totalTaxable: _tTaxable, totalGst: _tGst, igstAmount: _iGst, cgstAmount: _cGst, sgstAmount: _sGst,
      grandTotal: _gTotal, totalPurchaseCost: _tCost, grossProfit: _gProfit, profitPct: _pPct, paymentReceived: _pRecv,
      ...data
    } = parsed.data;

    const invoiceNo = enteredInvoiceNo?.trim() ? enteredInvoiceNo.trim() : undefined;

    // 1. Determine Interstate Status Safely
    const tenant = await prisma.user.findUnique({ where: { id: userId } });
    let isInterState = false;
    let stateDetermined = false;

    const tenantGstin = tenant?.gstin ? safeDecrypt(tenant.gstin) : null;
    const custGstin = companyGstin;

    if (tenantGstin && tenantGstin.length >= 2 && custGstin && custGstin.length >= 2) {
        isInterState = tenantGstin.substring(0, 2) !== custGstin.substring(0, 2);
        stateDetermined = true;
    } else {
        const tenantState = tenant?.state?.trim().toLowerCase();
        const custState = shipState?.trim().toLowerCase();
        if (tenantState && custState) {
            isInterState = tenantState !== custState;
            stateDetermined = true;
        }
    }

    // 2. Process Items & Calculate Totals
    let totalTaxable = 0;
    let totalGst = 0;
    let totalPurchaseCost = 0;

    const calculatedItems = await Promise.all(items.map(async (item) => {
        const material = await prisma.material.findFirst({
             where: { materialName: item.materialName, userId }
        });
        if (!material) throw new Error(\`Material '\${item.materialName}' not found or access denied.\`);

        const lastPurchase = await prisma.purchaseItem.findFirst({
             where: { materialName: item.materialName, purchase: { userId } },
             orderBy: { id: 'desc' }
        });
        const costBasis = lastPurchase && lastPurchase.purchaseRateEnc 
             ? safeDecryptFinancial(lastPurchase.purchaseRateEnc) : 0;

        const qty = Number(item.quantity);
        const price = Number(item.unitPrice);
        const gstPct = Number(item.gstPercent);

        const itemTaxable = Number((qty * price).toFixed(2));
        const itemGst = Number((itemTaxable * (gstPct / 100)).toFixed(2));
        const itemTotal = Number((itemTaxable + itemGst).toFixed(2));
        
        totalTaxable += itemTaxable;
        totalGst += itemGst;
        totalPurchaseCost += (costBasis * qty);

        return {
            materialName: item.materialName,
            hsnCode: item.hsnCode,
            quantity: qty,
            unitPrice: price,
            gstPercent: gstPct,
            taxableAmount: itemTaxable,
            gstAmount: itemGst,
            itemTotal: itemTotal,
            purchasePriceEnc: encryptFinancialData(costBasis),
            avgPurchaseCostEnc: encryptFinancialData(costBasis)
        };
    }));

    if (!stateDetermined && totalGst > 0) {
        return res.status(400).json({ error: 'Cannot safely determine interstate GST status.' });
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
    const grossProfit = Number((totalTaxable - totalPurchaseCost).toFixed(2));
    const profitPct = totalTaxable > 0 ? Number(((grossProfit / totalTaxable) * 100).toFixed(4)) : 0;

    const row = await prisma.$transaction(async (tx) => {
        await tx.saleItem.deleteMany({ where: { saleId: id } });

        return await tx.sale.update({
            where: { id },
            data: {
                ...(invoiceNo ? { invoiceNo } : {}),
                ...data,
                customerAddress: encryptIfPresent(customerAddress),
                deliveryAddress: encryptIfPresent(deliveryAddress),
                invoiceDate: new Date(data.invoiceDate),
                dueDate: dueDate ? new Date(dueDate) : null,
                companyGstin: encryptIfPresent(companyGstin?.toUpperCase()),
                
                referenceNo, referenceDate: referenceDate ? new Date(referenceDate) : null,
                deliveryNote, buyerOrderNo, buyerOrderDate: buyerOrderDate ? new Date(buyerOrderDate) : null,
                dispatchDocNo, deliveryNoteDate: deliveryNoteDate ? new Date(deliveryNoteDate) : null,
                modeOfPayment, otherReference, transportName, lrNumber, destination, vehicleNumber, ewayBillNo,
                termsOfDelivery, shipCompanyName,
                shipAddressLine1: encryptIfPresent(shipAddressLine1),
                shipAddressLine2: encryptIfPresent(shipAddressLine2),
                shipCity, shipState, shipPincode,
                shipGSTIN: encryptIfPresent(shipGSTIN?.toUpperCase()),
                shipContactPerson, shipMobile, useBuyerAsShipping,

                totalTaxable,
                totalGst,
                igstAmount,
                cgstAmount,
                sgstAmount,
                grandTotal,
                
                totalPurchaseCostEnc: encryptFinancialData(totalPurchaseCost),
                grossProfitEnc: encryptFinancialData(grossProfit),
                profitPct,

                items: { create: calculatedItems },
            },
            include: { items: true, receivablePayments: true },
        });
    });

    await auditLog(userId, 'data_update', \`Sale updated: \${row.invoiceNo}\`, req);
    
    const safeRow = { ...row, grossProfit, totalPurchaseCost };
    res.json(decrypt(safeRow));
  } catch (err) {
    if (err.message && err.message.includes('not found or access denied')) {
        return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}`;

content = content.replace(updateSaleMatch[0], newUpdateSale);

fs.writeFileSync(srcSaleControllerPath, content, 'utf8');
console.log('saleController.ts updated for Sales creation/update authority.');
