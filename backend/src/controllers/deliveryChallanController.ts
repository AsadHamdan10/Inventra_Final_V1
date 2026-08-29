import { assertFinancialPeriodOpen } from '../services/financialPeriodService';
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { safeDecrypt } from '../utils/crypto';
import { auditLog } from '../services/auditService';
import { generateDocumentNumber } from '../utils/tenantId';
import { createSaleInternal, determineInterState, calculateGstBreakdown } from './saleController';

const dcItemSchema = z.object({
  materialId: z.number(),
  materialName: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().default('Nos'),
  notes: z.string().optional().default('')
});

const dcSchema = z.object({
  customerId: z.number().optional().nullable(),
  dcDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional().default(''),
  vehicleNumber: z.string().optional().default(''),
  transporterName: z.string().optional().default(''),
  placeOfSupply: z.string().optional().default(''),
  items: z.array(dcItemSchema).min(1),
});

const decryptCustomer = (c: any) => c ? {
  ...c,
  companyName: safeDecrypt(c.companyName || ''),
  gstin: safeDecrypt(c.gstin || ''),
  address: safeDecrypt(c.address || ''),
  deliveryAddress: safeDecrypt(c.deliveryAddress || ''),
} : null;

export const listDeliveryChallans: import('express').RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to, status, customerId } = req.query;
    const whereClause: any = { userId: req.user!.userId };
    if (status) whereClause.status = status;
    if (customerId) whereClause.customerId = parseInt(customerId as string);
    if (from && to) {
      whereClause.dcDate = { gte: new Date(from as string), lte: new Date(to as string) };
    }
    
    const rows = await prisma.deliveryChallan.findMany({
      where: whereClause,
      include: { customer: true },
      orderBy: [{ dcDate: 'desc' }, { id: 'desc' }]
    });

    res.json(rows.map(r => ({ ...r, customer: decryptCustomer(r.customer) })));
  } catch (err) { next(err); }
};

export const getDeliveryChallan: import('express').RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    const row = await prisma.deliveryChallan.findFirst({
      where: { id, userId },
      include: { items: true, customer: true }
    });
    if (!row) return res.status(404).json({ error: 'Not found.' });
    res.json({ ...row, customer: decryptCustomer(row.customer) });
  } catch (err) { next(err); }
};

export const createDeliveryChallan: import('express').RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const parsed = dcSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed.', details: parsed.error.flatten().fieldErrors });

    const { items, dcDate, ...data } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
        const resolvedItems = await Promise.all(items.map(async (item) => {
            const materialsRaw = await tx.$queryRaw<any[]>`SELECT * FROM materials WHERE "user_id" = ${userId} AND id = ${item.materialId} FOR UPDATE`;
            if (materialsRaw.length === 0) throw new Error(`Material '${item.materialName}' not found.`);
            return { item, material: materialsRaw[0] };
        }));

        for (const { item, material } of resolvedItems) {
            if (!material.is_active) throw new Error(`Material '${item.materialName}' is deactivated.`);
        }

        return await tx.deliveryChallan.create({
            data: {
                userId,
                ...data,
                dcDate: new Date(dcDate),
                status: 'DRAFT',
                items: { create: items },
            },
            include: { items: true },
        });
    });

    res.status(201).json(result);
  } catch (err) { next(err); }
};

export const updateDeliveryChallan: import('express').RequestHandler = async (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    const parsed = dcSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed.', details: parsed.error.flatten().fieldErrors });

    const { items, dcDate, ...data } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.deliveryChallan.findFirst({ where: { id, userId } });
        if (!existing) throw new Error('DC not found.');
        if (existing.status !== 'DRAFT') throw new Error('Only DRAFT DCs can be edited.');

        await tx.deliveryChallanItem.deleteMany({ where: { deliveryChallanId: id } });

        return await tx.deliveryChallan.update({
            where: { id },
            data: {
                ...data,
                dcDate: new Date(dcDate),
                items: { create: items },
            },
            include: { items: true },
        });
    });

    res.status(200).json(result);
  } catch (err) { next(err); }
};

export const issueDeliveryChallan: import('express').RequestHandler = async (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);

    const result = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<any[]>`SELECT * FROM delivery_challans WHERE id = ${id} AND user_id = ${userId} FOR UPDATE`;
        if (rows.length === 0) throw new Error('DC not found.');
        const existing = rows[0];

        if (existing.status !== 'DRAFT') throw new Error('Only DRAFT DCs can be issued.');

        const dcItems = await tx.deliveryChallanItem.findMany({ where: { deliveryChallanId: id } });
        
        for (const item of dcItems) {
            const materialsRaw = await tx.$queryRaw<any[]>`SELECT * FROM materials WHERE id = ${item.materialId} FOR UPDATE`;
            if (materialsRaw.length === 0) throw new Error(`Material not found.`);
            const material = materialsRaw[0];
            
            if (!material.is_active) throw new Error(`Material '${item.materialName}' is deactivated.`);
            
            const qty = Number(item.quantity);
            if (Number(material.current_stock) < qty) {
                throw new Error(`Insufficient stock for '${item.materialName}'. Available: ${material.current_stock}`);
            }
            
            await tx.$executeRaw`UPDATE materials SET current_stock = current_stock - ${qty} WHERE id = ${material.id}`;
            
            await tx.inventoryLedger.create({
                data: {
                    userId, materialId: material.id, txnDate: existing.dc_date,
                    movementType: 'OUT', quantity: qty,
                    referenceType: 'DELIVERY_CHALLAN', referenceId: existing.id
                }
            });
        }

        const finalDcNo = await generateDocumentNumber('DC', userId, existing.dc_date);

        return await tx.deliveryChallan.update({
            where: { id },
            data: { status: 'ISSUED', dcNo: finalDcNo },
            include: { items: true }
        });
    });

    res.status(200).json(result);
  } catch (err) { next(err); }
};

export const cancelDeliveryChallan: import('express').RequestHandler = async (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);

    const result = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<any[]>`SELECT * FROM delivery_challans WHERE id = ${id} AND user_id = ${userId} FOR UPDATE`;
        if (rows.length === 0) throw new Error('DC not found.');
        const existing = rows[0];

        if (existing.status === 'CANCELLED') return existing; // Idempotent
        if (existing.status === 'CONVERTED') throw new Error('Cannot cancel a converted DC.');
        
        if (existing.status === 'ISSUED') {
            const dcItems = await tx.deliveryChallanItem.findMany({ where: { deliveryChallanId: id }, include: { dcInvoiceItems: true } });
            
            for (const item of dcItems) {
                const invoicedQty = item.dcInvoiceItems.reduce((acc, curr) => acc + Number(curr.quantity), 0);
                if (invoicedQty > 0) throw new Error('Cannot cancel a DC that has been partially invoiced.');

                const qty = Number(item.quantity);
                await tx.$executeRaw`UPDATE materials SET current_stock = current_stock + ${qty} WHERE id = ${item.materialId}`;
                
                await tx.inventoryLedger.create({
                    data: {
                        userId, materialId: item.materialId, txnDate: new Date(),
                        movementType: 'IN', quantity: qty,
                        referenceType: 'DC_CANCEL', referenceId: existing.id
                    }
                });
            }
        }

        return await tx.deliveryChallan.update({
            where: { id },
            data: { status: 'CANCELLED' }
        });
    });

    res.status(200).json(result);
  } catch (err) { next(err); }
};

export const invoiceDeliveryChallan: import('express').RequestHandler = async (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    const { itemsToInvoice } = req.body; 
    // itemsToInvoice: { deliveryChallanItemId: number, quantityToInvoice: number, unitPrice: number, gstPercent: number }[]

    const result = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<any[]>`SELECT * FROM delivery_challans WHERE id = ${id} AND user_id = ${userId} FOR UPDATE`;
        if (rows.length === 0) throw new Error('DC not found.');
        const dc = rows[0];

        if (dc.status !== 'ISSUED') throw new Error('Only ISSUED DCs can be invoiced.');
        
        const dcItems = await tx.deliveryChallanItem.findMany({ where: { deliveryChallanId: id }, include: { dcInvoiceItems: true } });

        let companyGstin = '';
        if (dc.customer_id) {
            const cust = await tx.customer.findUnique({ where: { id: dc.customer_id } });
            if (cust && cust.gstin) {
                companyGstin = safeDecrypt(cust.gstin);
            }
        }

        let totalTaxable = 0, totalGst = 0;
        const saleItems: any[] = [];
        const linkageToCreate = [];
        
        for (const reqItem of itemsToInvoice) {
            const dcItem = dcItems.find(i => i.id === reqItem.deliveryChallanItemId);
            if (!dcItem) throw new Error(`DC item ${reqItem.deliveryChallanItemId} not found.`);
            
            const alreadyInvoiced = dcItem.dcInvoiceItems.reduce((sum, inv) => sum + Number(inv.quantity), 0);
            const remaining = Number(dcItem.quantity) - alreadyInvoiced;
            
            const qty = Number(reqItem.quantityToInvoice);
            if (qty <= 0) continue;
            if (qty > remaining) throw new Error(`Cannot invoice ${qty} of '${dcItem.materialName}'. Only ${remaining} uninvoiced quantity remaining.`);
            
            const price = Number(reqItem.unitPrice);
            const gstPct = Number(reqItem.gstPercent);
            
            saleItems.push({
                materialName: dcItem.materialName,
                hsnCode: '', 
                quantity: qty,
                unitPrice: price,
                gstPercent: gstPct,
                taxableAmount: 0,
                gstAmount: 0,
                itemTotal: 0,
                alreadyDeliveredQty: qty // CRITICAL: prevent double stock deduction
            });
            
            linkageToCreate.push({
                deliveryChallanItemId: dcItem.id,
                quantity: qty,
                materialName: dcItem.materialName
            });
        }
        
        if (saleItems.length === 0) throw new Error('No items to invoice.');
        
        const saleData: any = {
            invoiceNo: '',
            invoiceDate: new Date().toISOString().split('T')[0],
            customerId: dc.customer_id,
            companyName: 'Derived from Customer',
            companyGstin,
            paymentTerms: 30,
            items: saleItems,
            deliveryNote: dc.dc_no,
            deliveryNoteDate: new Date(dc.dc_date).toISOString().split('T')[0],
            vehicleNumber: dc.vehicle_number,
            transportName: dc.transporter_name,
            destination: dc.place_of_supply,
        };
        
        if (dc.customer_id) {
            const cust = await tx.customer.findUnique({ where: { id: dc.customer_id } });
            if (cust) saleData.companyName = safeDecrypt(cust.companyName);
        } else {
            saleData.companyName = 'Cash Sale';
        }
        
        const tenant = await tx.user.findUnique({ where: { id: userId } });
        

                // This will calculate FIFO layers and generate invoice, but skip stock deduction due to alreadyDeliveredQty.
        const sale = await createSaleInternal(userId, {
            customerId: saleData.customerId,
            invoiceDate: saleData.invoiceDate,
            dueDate: saleData.dueDate,
            notes: saleData.notes,
            customerAddress: saleData.customerAddress,
            deliveryAddress: saleData.deliveryAddress,
            items: saleData.dcInvoiceItems
        }, tx);
        
        for (const link of linkageToCreate) {
            const sItem = sale.items.find((si: any) => si.materialName === link.materialName);
            if (sItem) {
                await tx.dcInvoiceItem.create({
                    data: {
                        deliveryChallanItemId: link.deliveryChallanItemId,
                        saleItemId: sItem.id,
                        saleId: sale.id,
                        quantity: link.quantity
                    }
                });
            }
        }
        
        let fullyInvoiced = true;
        for (const dcItem of dcItems) {
            const alreadyInvoiced = dcItem.dcInvoiceItems.reduce((sum, inv) => sum + Number(inv.quantity), 0);
            const thisInvoiceQty = linkageToCreate.find(l => l.deliveryChallanItemId === dcItem.id)?.quantity || 0;
            if (Number(dcItem.quantity) > (alreadyInvoiced + thisInvoiceQty)) {
                fullyInvoiced = false;
                break;
            }
        }
        
        const updatedDc = await tx.deliveryChallan.update({
            where: { id },
            data: { status: fullyInvoiced ? 'CONVERTED' : 'ISSUED' }
        });

        return { sale, updatedDc };
    });

    await auditLog(userId, 'DELIVERY_CHALLAN_CONVERT', `DC Converted: ${result.updatedDc.dcNo}`, req);
    res.status(201).json(result);
  } catch (err: any) { next(err); }
};


