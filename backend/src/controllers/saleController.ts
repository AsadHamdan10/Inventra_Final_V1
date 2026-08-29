import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { safeDecrypt, encryptIfPresent } from '../utils/crypto';

import {
  encryptFinancialData,
  safeDecryptFinancial,
} from '../utils/financialCrypto';
import { auditLog } from '../services/auditService';
import { assertTenantOwnership } from '../middlewares/auth';
import { generateTenantId } from '../utils/tenantId';

const saleItemSchema = z.object({
  materialId: z.number(),
  warehouseId: z.number().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  gstPercent: z.number().min(0).max(100).optional(),
});

const saleSchema = z.object({
  invoiceNo: z.string().optional().default(""),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/),
  customerId: z.number(),
  paymentTerms: z.number().default(30),
  poNo: z.string().optional().default(""),
  otherExpense: z.number().min(0).default(0),
  roundOff: z.number().default(0),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  customerAddress: z.string().optional().nullable(),
  deliveryAddress: z.string().optional().nullable(),
  isInterState: z.boolean().optional().default(false),
  referenceNo: z.string().optional(),
  referenceDate: z.string().optional(),
  deliveryNote: z.string().optional(),
  buyerOrderNo: z.string().optional(),
  buyerOrderDate: z.string().optional(),
  dispatchDocNo: z.string().optional(),
  deliveryNoteDate: z.string().optional(),
  modeOfPayment: z.string().optional(),
  otherReference: z.string().optional(),
  transportName: z.string().optional(),
  lrNumber: z.string().optional(),
  destination: z.string().optional(),
  vehicleNumber: z.string().optional(),
  ewayBillNo: z.string().optional(),
  termsOfDelivery: z.string().optional(),
  shipCompanyName: z.string().optional(),
  shipAddressLine1: z.string().optional(),
  shipAddressLine2: z.string().optional(),
  shipCity: z.string().optional(),
  shipState: z.string().optional(),
  shipPincode: z.string().optional(),
  shipGSTIN: z.string().optional(),
  shipContactPerson: z.string().optional(),
  shipMobile: z.string().optional(),
  useBuyerAsShipping: z.boolean().optional(),
  items: z.array(saleItemSchema).min(1),
});

const paymentSchema = z.object({
  amount: z.number().positive(),
  dateReceived: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode: z.string().default('Cash'),
  reference: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

// ── Why this helper exists ──────────────────────────────────────
// safeDecryptFinancial() returns 0 both when the encrypted column is
// genuinely empty (legacy pre-encryption rows) AND when it successfully
// decrypts a real, legitimate value of 0 (e.g. a break-even sale). Those
// are different situations and `decryptedValue || plaintextFallback || 0`
// can't tell them apart — it would incorrectly fall through to the
// plaintext column even when the encrypted value correctly decrypted to 0.
//
// This helper checks presence of the encrypted column directly instead of
// checking truthiness of its decrypted result, so a legitimate zero is
// trusted and only a genuinely-missing encrypted value triggers the
// plaintext fallback (relevant for rows created before Phase 3 financial
// encryption existed, where *Enc columns are NULL).
function decryptFinancialWithFallback(encValue: string | null | undefined, plaintextValue: any): number {
  if (encValue !== null && encValue !== undefined && encValue !== '') {
    return safeDecryptFinancial(encValue);
  }
  return Number(plaintextValue ?? 0);
}

const decrypt = (s: any) => ({
  ...s,

  companyGstin: safeDecrypt(s.companyGstin || ''),
  customerAddress: safeDecrypt(s.customerAddress || ''),
  deliveryAddress: safeDecrypt(s.deliveryAddress || ''),

  // Professional GST Invoice Template — additive fields (undefined-safe:
  // legacy rows simply have these as null/undefined and decrypt to '').
  shipAddressLine1: safeDecrypt(s.shipAddressLine1 || ''),
  shipAddressLine2: safeDecrypt(s.shipAddressLine2 || ''),
  shipGSTIN: safeDecrypt(s.shipGSTIN || ''),

  totalPurchaseCost: decryptFinancialWithFallback(
    s.totalPurchaseCostEnc,
    s.totalPurchaseCost
  ),

  grossProfit: decryptFinancialWithFallback(
    s.grossProfitEnc,
    s.grossProfit
  ),

  items:
    s.items?.map((item: any) => ({
      ...item,

      purchasePrice: decryptFinancialWithFallback(
        item.purchasePriceEnc,
        item.purchasePrice
      ),

      avgPurchaseCost: decryptFinancialWithFallback(
        item.avgPurchaseCostEnc,
        item.avgPurchaseCost
      ),

      itemProfit: decryptFinancialWithFallback(
        item.itemProfitEnc,
        item.itemProfit
      ),
    })) || [],

  customer: s.customer
    ? {
        ...s.customer,
        companyName: safeDecrypt(
          s.customer.companyName || ''
        ),
        gstin: safeDecrypt(
          s.customer.gstin || ''
        ),
        address: safeDecrypt(
          s.customer.address || ''
        ),
        deliveryAddress: safeDecrypt(
          s.customer.deliveryAddress || ''
        ),
        phone: safeDecrypt(
          s.customer.phone || ''
        ),
        email: safeDecrypt(
          s.customer.email || ''
        ),
      }
    : null,
});

export async function listSales(req: Request, res: Response, next: NextFunction) {
  try {
    const { from, to } = req.query;
    const rows = await prisma.sale.findMany({
      where: {
        userId: req.user!.userId,
        ...(from && to ? { invoiceDate: { gte: new Date(from as string), lte: new Date(to as string) } } : {}),
      },
      include: { items: true, receivablePayments: true, customer: true },
      orderBy: [{ invoiceDate: 'desc' },
      { id: 'desc' },
    { invoiceNo: 'desc' },],
    });
    res.json(rows.map(decrypt));
  } catch (err) { next(err); }
}

export async function getSale(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (!await assertTenantOwnership(userId, 'sales', id)) return res.status(403).json({ error: 'Access denied.' });
    const row = await prisma.sale.findUnique({ where: { id }, include: { items: true, receivablePayments: true } });
    if (!row) return res.status(404).json({ error: 'Not found.' });
    res.json(decrypt(row));
  } catch (err) { next(err); }
}

export async function createSale(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const parsed = saleSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Validation failed.", details: parsed.error.flatten().fieldErrors }
      });
    }

    const { invoiceDate, customerId, items, ...options } = parsed.data;

    const sale = await prisma.$transaction(async (tx) => {
      const { createSaleInternal } = await import("../services/saleInternalService");
      return await createSaleInternal(
        userId,
        { customerId, invoiceDate, items, ...options },
        tx
      );
    });

    res.status(201).json({ success: true, data: decrypt(sale) });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: { code: "SALE_CREATE_ERROR", message: err.message || "Failed to create sale." } });
  }
}

export async function updateSale(req: Request, res: Response, next: NextFunction) {
  return res.status(405).json({ success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Financial records are immutable. Use Credit Notes to adjust completed sales." } });
}

export async function deleteSale(req: Request, res: Response, next: NextFunction) { return res.status(405).json({ error: 'Method Not Allowed. Financial records are immutable.' }); }

export async function addReceivablePayment(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const saleId = parseInt(req.params.id);
    if (!await assertTenantOwnership(userId, 'sales', saleId)) return res.status(403).json({ error: 'Access denied.' });
    const parsed = paymentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed.' });
    const payment = await prisma.receivablePayment.create({
      data: { saleId, ...parsed.data, dateReceived: new Date(parsed.data.dateReceived) },
    });
    const totals = await prisma.receivablePayment.aggregate({ where: { saleId }, _sum: { amount: true } });
    await prisma.sale.update({ where: { id: saleId }, data: { paymentReceived: totals._sum.amount || 0 } });
    await auditLog(userId, 'data_create', `Payment received for sale #${saleId}: ₹${parsed.data.amount}`, req);
    res.status(201).json(payment);
  } catch (err) { next(err); }
}

export async function getSalePayments(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.userId;
    const saleId = parseInt(req.params.saleId);

    if (!(await assertTenantOwnership(userId, 'sales', saleId))) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const payments = await prisma.receivablePayment.findMany({
  where: { saleId },
  orderBy: [
    { dateReceived: 'desc' },
    { id: 'desc' },
  ],
});

    res.json(payments);
  } catch (err) {
    next(err);
  }
}

export async function updatePayment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const paymentId = parseInt(req.params.paymentId);
    const parsed = paymentSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed.',
      });
    }

    const existing =
      await prisma.receivablePayment.findUnique({
        where: { id: paymentId },
        include: {
          sale: true,
        },
      });

    if (!existing) {
      return res.status(404).json({
        error: 'Payment not found.',
      });
    }

    const userId = req.user!.userId;

    if (
      !(await assertTenantOwnership(
        userId,
        'sales',
        existing.saleId
      ))
    ) {
      return res.status(403).json({
        error: 'Access denied.',
      });
    }

    const payment =
      await prisma.receivablePayment.update({
        where: { id: paymentId },
        data: {
          amount: parsed.data.amount,
          dateReceived: new Date(
            parsed.data.dateReceived
          ),
          mode: parsed.data.mode,
          reference: parsed.data.reference,
          notes: parsed.data.notes,
        },
      });

    const totals =
      await prisma.receivablePayment.aggregate({
        where: {
          saleId: existing.saleId,
        },
        _sum: {
          amount: true,
        },
      });

    await prisma.sale.update({
      where: {
        id: existing.saleId,
      },
      data: {
        paymentReceived:
          totals._sum.amount || 0,
      },
    });

    await auditLog(
      userId,
      'data_update',
      `Payment updated #${paymentId}`,
      req
    );

    res.json(payment);
  } catch (err) {
    next(err);
  }
}

export async function deletePayment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const paymentId = parseInt(
      req.params.paymentId
    );

    const existing =
  await prisma.receivablePayment.findUnique({
    where: {
      id: paymentId,
    },
    include: {
      sale: true,
    },
  });

    if (!existing) {
      return res.status(404).json({
        error: 'Payment not found.',
      });
    }

    const userId = req.user!.userId;

    if (
      !(await assertTenantOwnership(
        userId,
        'sales',
        existing.saleId
      ))
    ) {
      return res.status(403).json({
        error: 'Access denied.',
      });
    }

    await prisma.receivablePayment.delete({
      where: {
        id: paymentId,
      },
    });

    const totals =
      await prisma.receivablePayment.aggregate({
        where: {
          saleId: existing.saleId,
        },
        _sum: {
          amount: true,
        },
      });

    await prisma.sale.update({
      where: {
        id: existing.saleId,
      },
      data: {
        paymentReceived:
          totals._sum.amount || 0,
      },
    });

    await auditLog(
      userId,
      'data_delete',
      `Payment deleted #${paymentId}`,
      req
    );

    res.json({
      success: true,
    });
  } catch (err) {
    next(err);
  }
}

export async function listReceivables(req: Request, res: Response, next: NextFunction) {
  try {
    const { from, to } = req.query;
    const rows = await prisma.sale.findMany({
      where: {
        userId: req.user!.userId,
        ...(from && to ? { invoiceDate: { gte: new Date(from as string), lte: new Date(to as string) } } : {}),
      },
      orderBy: [{ invoiceDate: 'desc' },
        { id: 'desc' },
      { invoiceNo: 'desc' },],
    });
    res.json(rows.map(s => ({ ...decrypt(s), balance: Number(s.grandTotal) - Number(s.paymentReceived) })));
  } catch (err) { next(err); }
}



export { createSaleInternal } from '../services/saleInternalService';
export function determineInterState(companyState: string | null | undefined, customerState: string | null | undefined): boolean {
    if (!companyState || !customerState) return false;
    return companyState.trim().toLowerCase() !== customerState.trim().toLowerCase();
}

export function calculateGstBreakdown(taxableAmount: number, gstPercent: number, isInterState: boolean) {
    const totalGst = (taxableAmount * (gstPercent || 0)) / 100;
    if (isInterState) {
        return { cgst: 0, sgst: 0, igst: totalGst, totalGst };
    } else {
        const half = totalGst / 2;
        return { cgst: half, sgst: half, igst: 0, totalGst };
    }
}

