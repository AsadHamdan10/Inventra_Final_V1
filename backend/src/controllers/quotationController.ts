import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { safeDecrypt } from '../utils/crypto';
import { auditLog } from '../services/auditService';
import { assertTenantOwnership } from '../middlewares/auth';
import { generateDocumentNumber } from '../utils/tenantId';
import { calculateGstBreakdown, createSaleInternal } from './saleController';
import { determineInterStateByGstin } from '../utils/gstStateUtil';

const quotationItemSchema = z.object({
  materialName: z.string().min(1),
  hsnCode: z.string().optional().default(''),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  gstPercent: z.number().min(0).max(100)
});

const quotationSchema = z.object({
  customerId: z.number().optional().nullable(),
  quotationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional().default(''),
  termsAndConditions: z.string().optional().default(''),
  items: z.array(quotationItemSchema).min(1),
  companyGstin: z.string().optional().default('') // Used to determine interstate
});

const decryptCustomer = (c: any) => c ? {
  ...c,
  companyName: safeDecrypt(c.companyName || ''),
  gstin: safeDecrypt(c.gstin || ''),
  address: safeDecrypt(c.address || ''),
  deliveryAddress: safeDecrypt(c.deliveryAddress || ''),
  phone: safeDecrypt(c.phone || ''),
  email: safeDecrypt(c.email || ''),
} : null;

export const listQuotations: import('express').RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to, status, customerId } = req.query;
    const whereClause: any = { userId: req.user!.userId };
    if (status) whereClause.status = status;
    if (customerId) whereClause.customerId = parseInt(customerId as string);
    if (from && to) {
      whereClause.quotationDate = { gte: new Date(from as string), lte: new Date(to as string) };
    }
    
    const rows = await prisma.quotation.findMany({
      where: whereClause,
      include: { customer: true },
      orderBy: [{ quotationDate: 'desc' }, { id: 'desc' }]
    });

    res.json(rows.map(r => ({
      ...r,
      customer: decryptCustomer(r.customer)
    })));
  } catch (err) { next(err); }
};

export const getQuotation: import('express').RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    const row = await prisma.quotation.findFirst({
      where: { id, userId },
      include: { items: true, customer: true }
    });
    if (!row) return res.status(404).json({ error: 'Not found.' });
    res.json({
      ...row,
      customer: decryptCustomer(row.customer)
    });
  } catch (err) { next(err); }
};

export const createQuotation: import('express').RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const parsed = quotationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed.', details: parsed.error.flatten().fieldErrors });

    const { items, companyGstin, quotationDate, validUntil, ...data } = parsed.data;

        const tenant = await prisma.user.findUnique({ where: { id: userId } });
    if (!tenant) return res.status(401).json({ error: 'Tenant not found.' });
    const customer = data.customerId ? await prisma.customer.findUnique({ where: { id: data.customerId } }) : null;
    // SECURITY: customerId is client-supplied and must be tenant-scoped, otherwise
    // this quotation could be linked to (and later expose, via ?customer include)
    // another tenant's customer record.
    if (data.customerId && (!customer || customer.userId !== userId)) {
      return res.status(400).json({ error: 'Customer not found.' });
    }
    // GST FIX: was comparing tenant.state against the customer's full
    // deliveryAddress string (not a state at all) - almost always evaluated
    // as inter-state. Now derived from GST State Codes.
    const isInterState = determineInterStateByGstin(
      safeDecrypt(tenant.gstin) || null,
      tenant.state || null,
      safeDecrypt(customer?.gstin) || null,
      null
    );

    const result = await prisma.$transaction(async (tx) => {
        let totalTaxable = 0, totalGst = 0;
        
        const resolvedItems = await Promise.all(items.map(async (item) => {
            const materialsRaw = await tx.$queryRaw<any[]>`SELECT * FROM materials WHERE "user_id" = ${userId} AND material_name = ${item.materialName} FOR UPDATE`;
            if (materialsRaw.length === 0) throw new Error(`Material '${item.materialName}' not found.`);
            return { item, material: materialsRaw[0] };
        }));

        const calculatedItems = [];

        for (const { item, material } of resolvedItems) {
            if (!material.is_active) throw new Error(`Material '${item.materialName}' is deactivated.`);
            const qty = Number(item.quantity);
            const price = Number(item.unitPrice);
            const gstPct = Number(item.gstPercent);
            
            const itemTaxable = Number((qty * price).toFixed(2));
            const itemGst = Number((itemTaxable * (gstPct / 100)).toFixed(2));
            const itemTotal = Number((itemTaxable + itemGst).toFixed(2));
            
            totalTaxable += itemTaxable;
            totalGst += itemGst;

            calculatedItems.push({
                materialId: material.id,
                materialName: item.materialName,
                hsnCode: item.hsnCode,
                quantity: qty,
                unitPrice: price,
                gstPercent: gstPct,
                taxableAmount: itemTaxable,
                totalGst: itemGst,
                itemTotal: itemTotal
            });
        }

        const { igst: igstAmount, cgst: cgstAmount, sgst: sgstAmount, totalGst: _ignoredGst } = calculateGstBreakdown(totalTaxable, 18, isInterState);
        const grandTotal = Number((totalTaxable + totalGst).toFixed(2));

        return await tx.quotation.create({
            data: {
                userId,
                ...data,
                quotationDate: new Date(quotationDate),
                validUntil: new Date(validUntil),
                totalTaxable, totalGst, igstAmount, cgstAmount, sgstAmount, grandTotal,
                status: 'DRAFT',
                items: { create: calculatedItems },
            },
            include: { items: true },
        });
    });

    res.status(201).json(result);
  } catch (err) { next(err); }
};

export const updateQuotation: import('express').RequestHandler = async (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    const parsed = quotationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed.', details: parsed.error.flatten().fieldErrors });

    const { items, companyGstin, quotationDate, validUntil, ...data } = parsed.data;

        const tenant = await prisma.user.findUnique({ where: { id: userId } });
    if (!tenant) return res.status(401).json({ error: 'Tenant not found.' });
    const customer = data.customerId ? await prisma.customer.findUnique({ where: { id: data.customerId } }) : null;
    // SECURITY: customerId is client-supplied and must be tenant-scoped, otherwise
    // this quotation could be linked to (and later expose, via ?customer include)
    // another tenant's customer record.
    if (data.customerId && (!customer || customer.userId !== userId)) {
      return res.status(400).json({ error: 'Customer not found.' });
    }
    // GST FIX: was comparing tenant.state against the customer's full
    // deliveryAddress string (not a state at all) - almost always evaluated
    // as inter-state. Now derived from GST State Codes.
    const isInterState = determineInterStateByGstin(
      safeDecrypt(tenant.gstin) || null,
      tenant.state || null,
      safeDecrypt(customer?.gstin) || null,
      null
    );

    const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.quotation.findFirst({ where: { id, userId } });
        if (!existing) throw new Error('Quotation not found.');
        if (existing.status !== 'DRAFT') throw new Error('Only DRAFT quotations can be edited.');

        await tx.quotationItem.deleteMany({ where: { quotationId: id } });

        let totalTaxable = 0, totalGst = 0;
        
        const resolvedItems = await Promise.all(items.map(async (item) => {
            const materialsRaw = await tx.$queryRaw<any[]>`SELECT * FROM materials WHERE "user_id" = ${userId} AND material_name = ${item.materialName} FOR UPDATE`;
            if (materialsRaw.length === 0) throw new Error(`Material '${item.materialName}' not found.`);
            return { item, material: materialsRaw[0] };
        }));

        const calculatedItems = [];

        for (const { item, material } of resolvedItems) {
            if (!material.is_active) throw new Error(`Material '${item.materialName}' is deactivated.`);
            const qty = Number(item.quantity);
            const price = Number(item.unitPrice);
            const gstPct = Number(item.gstPercent);
            
            const itemTaxable = Number((qty * price).toFixed(2));
            const itemGst = Number((itemTaxable * (gstPct / 100)).toFixed(2));
            const itemTotal = Number((itemTaxable + itemGst).toFixed(2));
            
            totalTaxable += itemTaxable;
            totalGst += itemGst;

            calculatedItems.push({
                materialId: material.id,
                materialName: item.materialName,
                hsnCode: item.hsnCode,
                quantity: qty,
                unitPrice: price,
                gstPercent: gstPct,
                taxableAmount: itemTaxable,
                totalGst: itemGst,
                itemTotal: itemTotal
            });
        }

        const { igst: igstAmount, cgst: cgstAmount, sgst: sgstAmount, totalGst: _ignoredGst } = calculateGstBreakdown(totalTaxable, 18, isInterState);
        const grandTotal = Number((totalTaxable + totalGst).toFixed(2));

        return await tx.quotation.update({
            where: { id },
            data: {
                ...data,
                quotationDate: new Date(quotationDate),
                validUntil: new Date(validUntil),
                totalTaxable, totalGst, igstAmount, cgstAmount, sgstAmount, grandTotal,
                items: { create: calculatedItems },
            },
            include: { items: true },
        });
    });

    res.status(200).json(result);
  } catch (err) { next(err); }
};

export const finalizeQuotation: import('express').RequestHandler = async (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);

    const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.quotation.findFirst({ where: { id, userId } });
        if (!existing) throw new Error('Quotation not found.');
        if (existing.status !== 'DRAFT') throw new Error('Only DRAFT quotations can be finalized.');

        const finalQuotationNo = await "DOC-123";

        return await tx.quotation.update({
            where: { id },
            data: { status: 'FINALIZED', quotationNo: finalQuotationNo }
        });
    });

    res.status(200).json(result);
  } catch (err) { next(err); }
};

export const cancelQuotation: import('express').RequestHandler = async (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);

    const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.quotation.findFirst({ where: { id, userId } });
        if (!existing) throw new Error('Quotation not found.');
        if (existing.status === 'CONVERTED') throw new Error('Cannot cancel a converted quotation.');
        
        return await tx.quotation.update({
            where: { id },
            data: { status: 'CANCELLED' }
        });
    });

    res.status(200).json(result);
  } catch (err) { next(err); }
};

export const convertQuotationToSale: import('express').RequestHandler = async (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);

    const result = await prisma.$transaction(async (tx) => {
        // Use row lock on Quotation
        const rows = await tx.$queryRaw<any[]>`SELECT * FROM quotations WHERE id = ${id} AND user_id = ${userId} FOR UPDATE`;
        if (rows.length === 0) throw new Error('Quotation not found.');
        const quotation = rows[0];

        if (quotation.status !== 'FINALIZED') throw new Error('Only FINALIZED quotations can be converted directly to sale.');
        if (quotation.converted_sale_id) throw new Error('Quotation has already been converted.');
        if (new Date(quotation.valid_until) < new Date()) {
            await tx.quotation.update({ where: { id }, data: { status: 'EXPIRED' } });
            throw new Error('Quotation has expired.');
        }

        const qItems = await tx.quotationItem.findMany({ where: { quotationId: id } });

        // Retrieve customer for GST/State logic
        let companyGstin = '';
        if (quotation.customer_id) {
            const cust = await tx.customer.findUnique({ where: { id: quotation.customer_id } });
            if (cust && cust.gstin) {
                companyGstin = safeDecrypt(cust.gstin);
            }
        }

        // Prepare sale data
        const saleData = {
            invoiceNo: '', // Will be generated
            invoiceDate: new Date().toISOString().split('T')[0],
            customerId: quotation.customer_id,
            companyName: 'Derived from Customer', // Handled if customerId is passed, but client often passes it. We should fetch it.
            companyGstin,
            paymentTerms: 30, // Default or fetch
            totalTaxable: Number(quotation.total_taxable),
            totalGst: Number(quotation.total_gst),
            igst: Number(quotation.igstAmountAmount_amount),
            cgst: Number(quotation.cgstAmountAmount_amount),
            sgst: Number(quotation.sgstAmountAmount_amount),
            grandTotal: Number(quotation.grand_total),
            notes: quotation.notes || '',
            isInterState: Number(quotation.igstAmountAmount_amount) > 0,
            items: qItems.map(qi => ({
                materialName: qi.materialName,
                hsnCode: qi.hsnCode || '',
                quantity: Number(qi.quantity),
                unitPrice: Number(qi.unitPrice),
                gstPercent: Number(qi.gstPercent),
                taxableAmount: Number(qi.taxableAmount),
                totalGst: Number(qi.gstAmount),
                itemTotal: Number(qi.itemTotal),
                alreadyDeliveredQty: 0 // Direct conversion = no DC
            }))
        };
        
                // Fetch companyName if needed
        if (quotation.customer_id) {
            const cust = await tx.customer.findUnique({ where: { id: quotation.customer_id } });
            if (cust) saleData.companyName = cust.companyName; // Note: decryption handled if needed
        } else {
            saleData.companyName = 'Cash Sale';
        }

        const sale = await createSaleInternal(userId, { customerId: quotation.customer_id, items: saleData.items }, tx);

        const updatedQuotation = await tx.quotation.update({
            where: { id },
            data: { status: 'CONVERTED', convertedSaleId: sale.id }
        });

        return { sale, updatedQuotation };
    });

    res.status(200).json(result);
  } catch (err) { next(err); }
};

export const createDeliveryChallanFromQuotation: import('express').RequestHandler = async (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    const { vehicleNumber, transporterName, placeOfSupply, notes, items: reqItems } = req.body;
    
    // reqItems expects { quotationItemId: number, quantity: number }[]

    const result = await prisma.$transaction(async (tx) => {
        // Lock Quotation
        const rows = await tx.$queryRaw<any[]>`SELECT * FROM quotations WHERE id = ${id} AND user_id = ${userId} FOR UPDATE`;
        if (rows.length === 0) throw new Error('Quotation not found.');
        const quotation = rows[0];

        if (quotation.status !== 'FINALIZED') throw new Error('Only FINALIZED quotations can be used for Delivery Challan.');
        if (new Date(quotation.valid_until) < new Date()) throw new Error('Quotation has expired.');

        const qItems = await tx.quotationItem.findMany({ where: { quotationId: id } });
        
        // Find existing DCs to calculate remaining quantities
        const existingDCs = await tx.deliveryChallan.findMany({
            where: { quotationId: id, status: { not: 'CANCELLED' } },
            include: { items: true }
        });
        
        const deliveredQuantities: Record<number, number> = {};
        for (const dc of existingDCs) {
            for (const dci of dc.items) {
                if (dci.quotationItemId) {
                    deliveredQuantities[dci.quotationItemId] = (deliveredQuantities[dci.quotationItemId] || 0) + Number(dci.quantity);
                }
            }
        }

        const dcItemsToCreate = [];
        for (const reqItem of reqItems) {
            const qItem = qItems.find(qi => qi.id === reqItem.quotationItemId);
            if (!qItem) throw new Error(`Quotation item ${reqItem.quotationItemId} not found.`);
            
            const delivered = deliveredQuantities[qItem.id] || 0;
            const remaining = Number(qItem.quantity) - delivered;
            const requestedQty = Number(reqItem.quantity);
            
            if (requestedQty <= 0) continue;
            if (requestedQty > remaining) {
                throw new Error(`Cannot deliver ${requestedQty} of '${qItem.materialName}'. Only ${remaining} remaining in quotation.`);
            }

            dcItemsToCreate.push({
                materialId: qItem.materialId,
                quotationItemId: qItem.id,
                materialName: qItem.materialName,
                quantity: requestedQty,
                unit: 'Nos',
                notes: reqItem.notes || ''
            });
        }

        if (dcItemsToCreate.length === 0) throw new Error('No valid items to deliver.');

        const dc = await tx.deliveryChallan.create({
            data: {
                userId,
                customerId: quotation.customer_id,
                quotationId: id,
                dcDate: new Date(),
                status: 'DRAFT',
                notes: notes || '',
                vehicleNumber: vehicleNumber || '',
                transporterName: transporterName || '',
                placeOfSupply: placeOfSupply || '',
                items: { create: dcItemsToCreate }
            },
            include: { items: true }
        });

        return dc;
    });

    await auditLog(userId, 'DELIVERY_CHALLAN_CREATE', `DC Draft from Quotation ${id}`, req);
    res.status(201).json(result);
  } catch (err: any) { next(err); }
};


