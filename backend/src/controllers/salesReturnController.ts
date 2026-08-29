import { postSalesReturnAccounting } from '../services/accounting/accountingIntegrationService';
import { assertFinancialPeriodOpen } from '../services/financialPeriodService';
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { determineInterState, calculateGstBreakdown } from './saleController';


const prisma = new PrismaClient();

const salesReturnSchema = z.object({
    saleId: z.number(),
    returnDate: z.string().transform(str => new Date(str)),
    reason: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(z.object({
        saleItemId: z.number(),
        quantity: z.number().positive()
    }))
});

export const listSalesReturns = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const returns = await prisma.salesReturn.findMany({
            where: { userId },
            include: { customer: true, sale: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(returns);
    } catch (error: any) {
        res.status(500).json({ error: 'Server error.', details: error.message });
    }
};

export const getSalesReturn = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const id = Number(req.params.id);
        const ret = await prisma.salesReturn.findFirst({
            where: { id, userId },
            include: { customer: true, items: { include: { material: true } }, sale: true }
        });
        if (!ret) return res.status(404).json({ error: 'Sales Return not found.' });
        res.json(ret);
    } catch (error: any) {
        res.status(500).json({ error: 'Server error.', details: error.message });
    }
};

export const createSalesReturn = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const parsed = salesReturnSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
        const { saleId, returnDate, reason, notes, items } = parsed.data;
        await assertFinancialPeriodOpen(userId, returnDate);

        const tenant = await prisma.user.findUnique({ where: { id: userId } });
        if (!tenant) return res.status(401).json({ error: 'Tenant not found' });

        const sale = await prisma.sale.findFirst({
            where: { id: saleId, userId },
            include: { items: true, returns: { include: { items: true } } }
        });
        if (!sale) return res.status(404).json({ error: 'Sale not found.' });
        if (sale.status === 'CANCELLED') return res.status(400).json({ error: 'Cannot return a cancelled sale.' });

        const customer = await prisma.customer.findUnique({ where: { id: sale.customerId! } });
        const isInterState = determineInterState(tenant.state, customer?.deliveryAddress);
        let totalTaxable = 0, totalGst = 0, igstAmount = 0, cgstAmount = 0, sgstAmount = 0, grandTotal = 0;

        const returnItemsData: any[] = [];

        for (const inputItem of items) {
            const saleItem = sale.items.find(si => si.id === inputItem.saleItemId);
            if (!saleItem) return res.status(400).json({ error: `SaleItem ${inputItem.saleItemId} not found in this sale.` });

            let alreadyReturned = 0;
            for (const existingReturn of sale.returns) {
                if (existingReturn.status !== 'CANCELLED') {
                    const matched = existingReturn.items.find(ri => ri.saleItemId === saleItem.id);
                    if (matched) alreadyReturned += Number(matched.quantity);
                }
            }

            const returnable = Number(saleItem.quantity) - alreadyReturned;
            if (inputItem.quantity > returnable) {
                return res.status(400).json({ error: `Cannot return ${inputItem.quantity} for material ${saleItem.materialName}. Maximum returnable is ${returnable}.` });
            }

            const qty = inputItem.quantity;
            const price = Number(saleItem.unitPrice);
            const gstPct = Number(saleItem.gstPercent);

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
                saleItemId: saleItem.id,
                materialId: saleItem.materialId,
                materialName: saleItem.materialName,
                quantity: qty,
                unitPrice: price,
                gstPercent: gstPct,
                taxableAmount: itemTaxable,
                gstAmount: itemGst,
                itemTotal: itemTotal
            });
        }

        const newReturn = await prisma.salesReturn.create({
            data: {
                userId,
                saleId: sale.id,
                customerId: sale.customerId,
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

export const updateSalesReturn = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const id = Number(req.params.id);
        const parsed = salesReturnSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
        const { returnDate, reason, notes, items } = parsed.data;

        const ret = await prisma.salesReturn.findFirst({ where: { id, userId }, include: { sale: { include: { items: true, returns: { include: { items: true } } } } } });
        if (!ret) return res.status(404).json({ error: 'Sales Return not found.' });
        if (ret.status !== 'DRAFT') return res.status(400).json({ error: 'Only DRAFT returns can be updated.' });

        const tenant = await prisma.user.findUnique({ where: { id: userId } });
        const sale = ret.sale;
                const customer = await prisma.customer.findUnique({ where: { id: sale.customerId! } });
        const isInterState = determineInterState(tenant?.state, customer?.deliveryAddress);

        let totalTaxable = 0, totalGst = 0, igstAmount = 0, cgstAmount = 0, sgstAmount = 0, grandTotal = 0;
        const returnItemsData: any[] = [];

        for (const inputItem of items) {
            const saleItem = sale.items.find(si => si.id === inputItem.saleItemId);
            if (!saleItem) return res.status(400).json({ error: `SaleItem ${inputItem.saleItemId} not found.` });

            let alreadyReturned = 0;
            for (const existingReturn of sale.returns) {
                if (existingReturn.status !== 'CANCELLED' && existingReturn.id !== id) {
                    const matched = existingReturn.items.find(ri => ri.saleItemId === saleItem.id);
                    if (matched) alreadyReturned += Number(matched.quantity);
                }
            }

            const returnable = Number(saleItem.quantity) - alreadyReturned;
            if (inputItem.quantity > returnable) {
                return res.status(400).json({ error: `Cannot return ${inputItem.quantity} for material ${saleItem.materialName}. Maximum returnable is ${returnable}.` });
            }

            const qty = inputItem.quantity;
            const price = Number(saleItem.unitPrice);
            const gstPct = Number(saleItem.gstPercent);

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
                saleItemId: saleItem.id,
                materialId: saleItem.materialId,
                materialName: saleItem.materialName,
                quantity: qty,
                unitPrice: price,
                gstPercent: gstPct,
                taxableAmount: itemTaxable,
                gstAmount: itemGst,
                itemTotal: itemTotal
            });
        }

        const updated = await prisma.$transaction(async (tx) => {
            await tx.salesReturnItem.deleteMany({ where: { salesReturnId: id } });
            return tx.salesReturn.update({
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

export const finalizeSalesReturn = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const id = Number(req.params.id);

        const result = await prisma.$transaction(async (tx) => {
            const retRaw = await tx.$queryRaw<any[]>`SELECT * FROM sales_returns WHERE id = ${id} AND user_id = ${userId} FOR UPDATE`;
            if (!retRaw.length) throw new Error('Return not found.');
            const ret = retRaw[0];
            if (ret.status !== 'DRAFT') throw new Error('Only DRAFT returns can be finalized.');

            const sale = await tx.sale.findUnique({
                where: { id: ret.sale_id },
                include: { returns: { include: { items: true } }, items: { include: { layerConsumptions: { orderBy: { id: 'desc' } } } } }
            });
            if (!sale || sale.status === 'CANCELLED') throw new Error('Invalid or cancelled sale.');

            const retItems = await tx.salesReturnItem.findMany({ where: { salesReturnId: id } });

            for (const rItem of retItems) {
                const saleItem = sale.items.find(si => si.id === rItem.saleItemId);
                if (!saleItem) throw new Error('Sale item mismatch.');

                let alreadyReturned = 0;
                for (const existingReturn of sale.returns) {
                    if (existingReturn.status === 'POSTED' && existingReturn.id !== id) {
                        const matched = existingReturn.items.find(ri => ri.saleItemId === saleItem.id);
                        if (matched) alreadyReturned += Number(matched.quantity);
                    }
                }

                const newQty = Number(rItem.quantity);
                const returnable = Number(saleItem.quantity) - alreadyReturned;
                if (newQty > returnable) throw new Error(`Over-return detected for ${rItem.materialName}. Max: ${returnable}`);

                // 1. Restore Stock & Ledger
                const matRaw = await tx.$queryRaw<any[]>`SELECT * FROM materials WHERE id = ${rItem.materialId} AND user_id = ${userId} FOR UPDATE`;
                if (!matRaw.length) throw new Error('Material not found');
                const material = matRaw[0];

                const newStock = Number(material.current_stock) + newQty;
                await tx.$queryRaw`UPDATE materials SET current_stock = ${newStock} WHERE id = ${material.id}`;

                await tx.inventoryLedger.create({
                    data: {
                        userId,
                        materialId: material.id,
                        txnDate: ret.return_date,
                        movementType: 'IN',
                        quantity: newQty,
                        referenceType: 'SALES_RETURN',
                        referenceId: ret.id,
                        notes: `Credit Note for Sale ${sale.invoiceNo}`
                    }
                });

                // 2. Restore FIFO Layers (LIFO order of consumption)
                let alreadyRestored = alreadyReturned;
                let currentlyRestoring = newQty;

                for (const lc of saleItem.layerConsumptions) {
                    let qtyToProcess = Number(lc.quantityConsumed);

                    if (alreadyRestored > 0) {
                        if (alreadyRestored >= qtyToProcess) {
                            alreadyRestored -= qtyToProcess;
                            continue;
                        } else {
                            qtyToProcess -= alreadyRestored;
                            alreadyRestored = 0;
                        }
                    }

                    if (currentlyRestoring > 0 && qtyToProcess > 0) {
                        let restoreAmount = Math.min(currentlyRestoring, qtyToProcess);
                        
                        // Restore layer
                        const layerRaw = await tx.$queryRaw<any[]>`SELECT * FROM inventory_layers WHERE id = ${lc.layerId} FOR UPDATE`;
                        if (layerRaw.length > 0) {
                            const newRemaining = Number(layerRaw[0].remaining_qty) + restoreAmount;
                            await tx.$queryRaw`UPDATE inventory_layers SET remaining_qty = ${newRemaining} WHERE id = ${lc.layerId}`;
                        }

                        currentlyRestoring -= restoreAmount;
                    }
                    if (currentlyRestoring <= 0) break;
                }
            }

            // Sequence Generation
            const financialYear = sale.invoiceNo.split('-')[1] + '-' + sale.invoiceNo.split('-')[2];
            const currentYearStr = new Date().getFullYear().toString();
            const nextYearStr = (new Date().getFullYear() + 1).toString();
            const fallbackFY = `${currentYearStr}-${nextYearStr}`;

            const fy = financialYear && financialYear.length === 9 ? financialYear : fallbackFY;

            const seq = await tx.$queryRaw<any[]>`
                INSERT INTO tenant_sequences (user_id, document_type, financial_year, seq, prefix)
                VALUES (${userId}, 'SalesReturn', ${fy}, 1, '')
                ON CONFLICT (user_id, document_type, financial_year)
                DO UPDATE SET seq = tenant_sequences.seq + 1
                RETURNING seq;
            `;
            const seqNumber = Number(seq[0].seq);
            const paddedSeq = seqNumber.toString().padStart(6, '0');
            const crn = `CRN-${fy}-${paddedSeq}`;

            const updatedReturn = await tx.salesReturn.update({
                where: { id },
                data: { status: 'POSTED', creditNoteNo: crn },
                include: { sale: true }
            });

            return updatedReturn;
        });

        
        res.json(result);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
};

export const cancelSalesReturn = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const id = Number(req.params.id);

        const result = await prisma.$transaction(async (tx) => {
            const retRaw = await tx.$queryRaw<any[]>`SELECT * FROM sales_returns WHERE id = ${id} AND user_id = ${userId} FOR UPDATE`;
            if (!retRaw.length) throw new Error('Return not found.');
            const ret = retRaw[0];
            if (ret.status !== 'POSTED') throw new Error('Only POSTED returns can be cancelled.');

            const sale = await tx.sale.findUnique({
                where: { id: ret.sale_id },
                include: { returns: { include: { items: true } }, items: { include: { layerConsumptions: { orderBy: { id: 'desc' } } } } }
            });
            if (!sale) throw new Error('Invalid sale.');

            const retItems = await tx.salesReturnItem.findMany({ where: { salesReturnId: id } });

            for (const rItem of retItems) {
                const saleItem = sale.items.find(si => si.id === rItem.saleItemId);
                const newQty = Number(rItem.quantity);

                // 1. Reverse Stock & Ledger (decrease stock, write OUT ledger)
                const matRaw = await tx.$queryRaw<any[]>`SELECT * FROM materials WHERE id = ${rItem.materialId} AND user_id = ${userId} FOR UPDATE`;
                if (!matRaw.length) throw new Error('Material not found');
                const material = matRaw[0];

                const newStock = Number(material.current_stock) - newQty;
                if (newStock < 0) throw new Error(`Insufficient stock to cancel return for ${rItem.materialName}`);
                await tx.$queryRaw`UPDATE materials SET current_stock = ${newStock} WHERE id = ${material.id}`;

                await tx.inventoryLedger.create({
                    data: {
                        userId,
                        materialId: material.id,
                        txnDate: new Date(),
                        movementType: 'OUT',
                        quantity: newQty,
                        referenceType: 'SALES_RETURN_CANCEL',
                        referenceId: ret.id,
                        notes: `Cancellation of Credit Note ${ret.credit_note_no}`
                    }
                });

                // 2. Undo FIFO Layer Restoration (decrease remainingQty)
                let alreadyReturned = 0;
                for (const existingReturn of sale.returns) {
                    if (existingReturn.status === 'POSTED' && existingReturn.id < id) {
                        const matched = existingReturn.items.find(ri => ri.saleItemId === saleItem!.id);
                        if (matched) alreadyReturned += Number(matched.quantity);
                    }
                }

                let alreadyRestored = alreadyReturned;
                let currentlyCancelling = newQty;

                for (const lc of saleItem!.layerConsumptions) {
                    let qtyToProcess = Number(lc.quantityConsumed);

                    if (alreadyRestored > 0) {
                        if (alreadyRestored >= qtyToProcess) {
                            alreadyRestored -= qtyToProcess;
                            continue;
                        } else {
                            qtyToProcess -= alreadyRestored;
                            alreadyRestored = 0;
                        }
                    }

                    if (currentlyCancelling > 0 && qtyToProcess > 0) {
                        let cancelAmount = Math.min(currentlyCancelling, qtyToProcess);
                        
                        const layerRaw = await tx.$queryRaw<any[]>`SELECT * FROM inventory_layers WHERE id = ${lc.layerId} FOR UPDATE`;
                        if (layerRaw.length > 0) {
                            const newRemaining = Number(layerRaw[0].remaining_qty) - cancelAmount;
                            if (newRemaining < 0) throw new Error('Cannot reverse return: Layer would become negative.');
                            await tx.$queryRaw`UPDATE inventory_layers SET remaining_qty = ${newRemaining} WHERE id = ${lc.layerId}`;
                        }

                        currentlyCancelling -= cancelAmount;
                    }
                    if (currentlyCancelling <= 0) break;
                }
            }

            const updatedReturn = await tx.salesReturn.update({
                where: { id },
                data: { status: 'CANCELLED' },
                include: { sale: true }
            });

            return updatedReturn;
        });

        
        res.json(result);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
};



