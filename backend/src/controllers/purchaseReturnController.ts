import { postPurchaseReturnAccounting } from '../services/accounting/accountingIntegrationService';
import { assertFinancialPeriodOpen } from '../services/financialPeriodService';
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { determineInterStateVendor as determineInterState, calculateGstBreakdownVendor as calculateGstBreakdown } from './purchaseController';


const prisma = new PrismaClient();

const purchaseReturnSchema = z.object({
    purchaseId: z.number(),
    returnDate: z.string().transform(str => new Date(str)),
    reason: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(z.object({
        purchaseItemId: z.number(),
        quantity: z.number().positive()
    }))
});

export const listPurchaseReturns = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const returns = await prisma.purchaseReturn.findMany({
            where: { userId },
            include: { vendors: true, purchase: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(returns);
    } catch (error: any) {
        res.status(500).json({ error: 'Server error.', details: error.message });
    }
};

export const getPurchaseReturn = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const id = Number(req.params.id);
        const ret = await prisma.purchaseReturn.findFirst({
            where: { id, userId },
            include: { vendors: true, items: { include: { material: true } }, purchase: true }
        });
        if (!ret) return res.status(404).json({ error: 'Purchase Return not found.' });
        res.json(ret);
    } catch (error: any) {
        res.status(500).json({ error: 'Server error.', details: error.message });
    }
};

export const createPurchaseReturn = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const parsed = purchaseReturnSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
        const { purchaseId, returnDate, reason, notes, items } = parsed.data;
        await assertFinancialPeriodOpen(userId, returnDate);

        const tenant = await prisma.user.findUnique({ where: { id: userId } });
        if (!tenant) return res.status(401).json({ error: 'Tenant not found' });

        const purchase = await prisma.purchase.findFirst({
            where: { id: purchaseId, userId },
            include: { items: true, purchaseReturns: { include: { items: true } } }
        });
        if (!purchase) return res.status(404).json({ error: 'Purchase not found.' });
        if (purchase.status === 'CANCELLED') return res.status(400).json({ error: 'Cannot return a cancelled purchase.' });

        const isInterState = determineInterState(tenant.id, purchase.vendorId!);
        let totalTaxable = 0, totalGst = 0, igstAmount = 0, cgstAmount = 0, sgstAmount = 0, grandTotal = 0;

        const returnItemsData: any[] = [];

        // Check Inventory Layers to ensure unconsumed stock is sufficient
        for (const inputItem of items) {
            const purchaseItem = purchase.items.find(pi => pi.id === inputItem.purchaseItemId);
            if (!purchaseItem) return res.status(400).json({ error: `PurchaseItem ${inputItem.purchaseItemId} not found.` });

            const layer = await prisma.inventoryLayer.findFirst({
                where: { sourceType: 'PURCHASE', sourceId: purchaseItem.id }
            });
            if (!layer) return res.status(400).json({ error: `InventoryLayer for PurchaseItem ${purchaseItem.id} not found.` });

            let alreadyReturned = 0;
            for (const existingReturn of purchase.purchaseReturns) {
                if (existingReturn.status !== 'CANCELLED') {
                    const matched = existingReturn.items.find(ri => ri.purchaseItemId === purchaseItem.id);
                    if (matched) alreadyReturned += Number(matched.quantity);
                }
            }

            let draftReturned = 0;
            for (const existingReturn of purchase.purchaseReturns) {
                if (existingReturn.status === 'DRAFT') {
                    const matched = existingReturn.items.find(ri => ri.purchaseItemId === purchaseItem.id);
                    if (matched) draftReturned += Number(matched.quantity);
                }
            }

            const returnable = Number(layer.remainingQty) - draftReturned;

            if (inputItem.quantity > returnable) {
                return res.status(400).json({ error: `Cannot return ${inputItem.quantity} for material ${purchaseItem.materialName}. Unconsumed remaining is ${returnable}.` });
            }

            const qty = inputItem.quantity;
            const price = Number(purchaseItem.purchaseRate);
            const gstPct = Number(purchaseItem.gstPercent);

            const itemTaxable = Number((qty * price).toFixed(2));
            const itemGst = Number((itemTaxable * (gstPct / 100)).toFixed(2));
            const itemTotal = Number((itemTaxable + itemGst).toFixed(2));

            const breakdown = {igst:0,cgst:0,sgst:0,totalGst:0};
            igstAmount += breakdown.igst;
            cgstAmount += breakdown.cgst;
            sgstAmount += breakdown.sgst;

            totalTaxable += itemTaxable;
            totalGst += itemGst;
            grandTotal += itemTotal;

            returnItemsData.push({
                purchaseItemId: purchaseItem.id,
                materialId: purchaseItem.materialId,
                materialName: purchaseItem.materialName,
                quantity: qty,
                unitPrice: price,
                gstPercent: gstPct,
                taxableAmount: itemTaxable,
                gstAmount: itemGst,
                itemTotal: itemTotal
            });
        }

        const newReturn = await prisma.purchaseReturn.create({
            data: {
                userId,
                purchaseId: purchase.id,
                vendorId: purchase.vendorId,
                returnDate,
                reason,
                notes,
                totalTaxable,
                totalGst,
                igstAmount,
                cgstAmount,
                sgstAmount,
                grandTotal,
                items: { create: returnItemsData }
            }
        });

        
        res.status(201).json(newReturn);
    } catch (error: any) {
        res.status(500).json({ error: 'Server error.', details: error.message });
    }
};

export const updatePurchaseReturn = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const id = Number(req.params.id);
        const parsed = purchaseReturnSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
        const { returnDate, reason, notes, items } = parsed.data;

        const ret = await prisma.purchaseReturn.findFirst({ where: { id, userId }, include: { purchase: { include: { items: true, purchaseReturns: { include: { items: true } } } } } });
        if (!ret) return res.status(404).json({ error: 'Purchase Return not found.' });
        if (ret.status !== 'DRAFT') return res.status(400).json({ error: 'Only DRAFT returns can be updated.' });

        const tenant = await prisma.user.findUnique({ where: { id: userId } });
        const purchase = ret.purchase;
        const isInterState = determineInterState(tenant!.id, purchase.vendorId!);

        let totalTaxable = 0, totalGst = 0, igstAmount = 0, cgstAmount = 0, sgstAmount = 0, grandTotal = 0;
        const returnItemsData: any[] = [];

        for (const inputItem of items) {
            const purchaseItem = purchase.items.find(pi => pi.id === inputItem.purchaseItemId);
            if (!purchaseItem) return res.status(400).json({ error: `PurchaseItem ${inputItem.purchaseItemId} not found.` });

            const layer = await prisma.inventoryLayer.findFirst({
                where: { sourceType: 'PURCHASE', sourceId: purchaseItem.id }
            });
            if (!layer) return res.status(400).json({ error: `InventoryLayer for PurchaseItem ${purchaseItem.id} not found.` });

            let draftReturned = 0;
            for (const existingReturn of purchase.purchaseReturns) {
                if (existingReturn.status === 'DRAFT' && existingReturn.id !== id) {
                    const matched = existingReturn.items.find(ri => ri.purchaseItemId === purchaseItem.id);
                    if (matched) draftReturned += Number(matched.quantity);
                }
            }

            const returnable = Number(layer.remainingQty) - draftReturned;

            if (inputItem.quantity > returnable) {
                return res.status(400).json({ error: `Cannot return ${inputItem.quantity} for material ${purchaseItem.materialName}. Unconsumed remaining is ${returnable}.` });
            }

            const qty = inputItem.quantity;
            const price = Number(purchaseItem.purchaseRate);
            const gstPct = Number(purchaseItem.gstPercent);

            const itemTaxable = Number((qty * price).toFixed(2));
            const itemGst = Number((itemTaxable * (gstPct / 100)).toFixed(2));
            const itemTotal = Number((itemTaxable + itemGst).toFixed(2));

            const breakdown = {igst:0,cgst:0,sgst:0,totalGst:0};
            igstAmount += breakdown.igst;
            cgstAmount += breakdown.cgst;
            sgstAmount += breakdown.sgst;

            totalTaxable += itemTaxable;
            totalGst += itemGst;
            grandTotal += itemTotal;

            returnItemsData.push({
                purchaseItemId: purchaseItem.id,
                materialId: purchaseItem.materialId,
                materialName: purchaseItem.materialName,
                quantity: qty,
                unitPrice: price,
                gstPercent: gstPct,
                taxableAmount: itemTaxable,
                gstAmount: itemGst,
                itemTotal: itemTotal
            });
        }

        const updated = await prisma.$transaction(async (tx) => {
            await tx.purchaseReturnItem.deleteMany({ where: { purchaseReturnId: id } });
            return tx.purchaseReturn.update({
                where: { id },
                data: {
                    returnDate, reason, notes, totalTaxable, totalGst, igstAmount, cgstAmount, sgstAmount, grandTotal,
                    items: { create: returnItemsData }
                }
            });
        });

        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ error: 'Server error.', details: error.message });
    }
};

export const finalizePurchaseReturn = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const id = Number(req.params.id);

        const result = await prisma.$transaction(async (tx) => {
            const retRaw = await tx.$queryRaw<any[]>`SELECT * FROM purchase_returns WHERE id = ${id} AND user_id = ${userId} FOR UPDATE`;
            if (!retRaw.length) throw new Error('Return not found.');
            const ret = retRaw[0];
            if (ret.status !== 'DRAFT') throw new Error('Only DRAFT returns can be finalized.');

            const purchase = await tx.purchase.findUnique({
                where: { id: ret.purchase_id },
                include: { purchaseReturns: { include: { items: true } }, items: true }
            });
            if (!purchase || purchase.status === 'CANCELLED') throw new Error('Invalid or cancelled purchase.');

            const retItems = await tx.purchaseReturnItem.findMany({ where: { purchaseReturnId: id } });

            for (const rItem of retItems) {
                const purchaseItem = purchase.items.find(pi => pi.id === rItem.purchaseItemId);
                if (!purchaseItem) throw new Error('Purchase item mismatch.');

                const newQty = Number(rItem.quantity);

                // Re-verify layer remaining quantity with FOR UPDATE lock
                const layerRaw = await tx.$queryRaw<any[]>`SELECT * FROM inventory_layers WHERE source_type = 'PURCHASE' AND source_id = ${purchaseItem.id} FOR UPDATE`;
                if (!layerRaw.length) throw new Error(`Inventory layer missing for ${rItem.materialName}`);
                const layer = layerRaw[0];

                const currentRemaining = Number(layer.remaining_qty);
                if (newQty > currentRemaining) throw new Error(`Over-return detected for ${rItem.materialName}. Unconsumed stock: ${currentRemaining}`);

                // 1. Reduce Stock & Ledger
                const matRaw = await tx.$queryRaw<any[]>`SELECT * FROM materials WHERE id = ${rItem.materialId} AND user_id = ${userId} FOR UPDATE`;
                if (!matRaw.length) throw new Error('Material not found');
                const material = matRaw[0];

                const newStock = Number(material.current_stock) - newQty;
                if (newStock < 0) throw new Error(`Negative stock prevention: cannot return ${newQty} of ${rItem.materialName}. Stock is ${material.current_stock}.`);
                await tx.$queryRaw`UPDATE materials SET current_stock = ${newStock} WHERE id = ${material.id}`;

                await tx.inventoryLedger.create({
                    data: {
                        userId,
                        materialId: material.id,
                        txnDate: ret.return_date,
                        movementType: 'OUT',
                        quantity: newQty,
                        referenceType: 'PURCHASE_RETURN',
                        referenceId: ret.id,
                        notes: `Debit Note for Purchase ${purchase.billNo}`
                    }
                });

                // 2. Reduce FIFO Layer unconsumed qty
                const newRemaining = currentRemaining - newQty;
                await tx.$queryRaw`UPDATE inventory_layers SET remaining_qty = ${newRemaining} WHERE id = ${layer.id}`;
            }

            // Sequence Generation
            const financialYear = purchase.billNo.split('-')[1] + '-' + purchase.billNo.split('-')[2];
            const currentYearStr = new Date().getFullYear().toString();
            const nextYearStr = (new Date().getFullYear() + 1).toString();
            const fallbackFY = `${currentYearStr}-${nextYearStr}`;

            const fy = financialYear && financialYear.length === 9 ? financialYear : fallbackFY;

            const seq = await tx.$queryRaw<any[]>`
                INSERT INTO tenant_sequences (user_id, document_type, financial_year, seq, prefix)
                VALUES (${userId}, 'PurchaseReturn', ${fy}, 1, '')
                ON CONFLICT (user_id, document_type, financial_year)
                DO UPDATE SET seq = tenant_sequences.seq + 1
                RETURNING seq;
            `;
            const seqNumber = Number(seq[0].seq);
            const paddedSeq = seqNumber.toString().padStart(6, '0');
            const dbn = `DBN-${fy}-${paddedSeq}`;

            const updatedReturn = await tx.purchaseReturn.update({
                where: { id },
                data: { status: 'POSTED', debitNoteNo: dbn },
                include: { purchase: true }
            });

            return updatedReturn;
        });

        
        res.json(result);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
};

export const cancelPurchaseReturn = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const id = Number(req.params.id);

        const result = await prisma.$transaction(async (tx) => {
            const retRaw = await tx.$queryRaw<any[]>`SELECT * FROM purchase_returns WHERE id = ${id} AND user_id = ${userId} FOR UPDATE`;
            if (!retRaw.length) throw new Error('Return not found.');
            const ret = retRaw[0];
            if (ret.status !== 'POSTED') throw new Error('Only POSTED returns can be cancelled.');

            const purchase = await tx.purchase.findUnique({
                where: { id: ret.purchase_id },
                include: { items: true }
            });
            if (!purchase) throw new Error('Invalid purchase.');

            const retItems = await tx.purchaseReturnItem.findMany({ where: { purchaseReturnId: id } });

            for (const rItem of retItems) {
                const purchaseItem = purchase.items.find(pi => pi.id === rItem.purchaseItemId);
                const newQty = Number(rItem.quantity);

                // 1. Reverse Stock & Ledger (increase stock, write IN ledger)
                const matRaw = await tx.$queryRaw<any[]>`SELECT * FROM materials WHERE id = ${rItem.materialId} AND user_id = ${userId} FOR UPDATE`;
                if (!matRaw.length) throw new Error('Material not found');
                const material = matRaw[0];

                const newStock = Number(material.current_stock) + newQty;
                await tx.$queryRaw`UPDATE materials SET current_stock = ${newStock} WHERE id = ${material.id}`;

                await tx.inventoryLedger.create({
                    data: {
                        userId,
                        materialId: material.id,
                        txnDate: new Date(),
                        movementType: 'IN',
                        quantity: newQty,
                        referenceType: 'PURCHASE_RETURN_CANCEL',
                        referenceId: ret.id,
                        notes: `Cancellation of Debit Note ${ret.debit_note_no}`
                    }
                });

                // 2. Undo FIFO Layer Reduction (increase remainingQty)
                const layerRaw = await tx.$queryRaw<any[]>`SELECT * FROM inventory_layers WHERE source_type = 'PURCHASE' AND source_id = ${purchaseItem!.id} FOR UPDATE`;
                if (layerRaw.length > 0) {
                    const newRemaining = Number(layerRaw[0].remaining_qty) + newQty;
                    await tx.$queryRaw`UPDATE inventory_layers SET remaining_qty = ${newRemaining} WHERE id = ${layerRaw[0].id}`;
                }
            }

            const updatedReturn = await tx.purchaseReturn.update({
                where: { id },
                data: { status: 'CANCELLED' },
                include: { purchase: true }
            });

            return updatedReturn;
        });

        
        res.json(result);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
};
