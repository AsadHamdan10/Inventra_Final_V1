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
  materialName: z.string().min(1),
  hsnCode: z.string().optional().default(''),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  purchasePrice: z.number().min(0).default(0),
  gstPercent: z.number().min(0).max(100),
  taxableAmount: z.number().min(0),
  gstAmount: z.number().min(0),
  itemTotal: z.number().min(0),
  avgPurchaseCost: z.number().min(0).default(0),
  itemProfit: z.number().default(0),
});

const saleSchema = z.object({
  invoiceNo: z.string().optional().default(''),

  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  customerId: z.number().optional().nullable(),
  companyName: z.string().min(1).max(200),
  companyGstin: z.string().optional().default(''),

  paymentTerms: z.number().default(30),
  poNo: z.string().optional().default(''),
  otherExpense: z.number().min(0).default(0),

  roundOff: z.number().default(0),
  paymentReceived: z.number().min(0).default(0),

  dueDate: z.string().optional().nullable(),

  totalTaxable: z.number().min(0),
  totalGst: z.number().min(0),

  igstAmount: z.number().min(0).default(0),
  cgstAmount: z.number().min(0).default(0),
  sgstAmount: z.number().min(0).default(0),

  grandTotal: z.number().min(0),
  totalPurchaseCost: z.number().min(0).default(0),

  grossProfit: z.number().default(0),
  profitPct: z.number().default(0),

  isInterState: z.boolean().optional().default(false),
  notes: z.string().optional().default(''),
  customerAddress: z.string().optional().default(''),
  deliveryAddress: z.string().optional().default(''),

  // ── Professional GST Invoice Template — additive-only, all optional ──
  // Nothing here is required; omitting them entirely (as every existing
  // caller does today) behaves exactly as before.
  referenceNo: z.string().optional().nullable(),
  referenceDate: z.string().optional().nullable(),
  deliveryNote: z.string().optional().nullable(),
  buyerOrderNo: z.string().optional().nullable(),
  buyerOrderDate: z.string().optional().nullable(),
  dispatchDocNo: z.string().optional().nullable(),
  deliveryNoteDate: z.string().optional().nullable(),
  modeOfPayment: z.string().optional().nullable(),
  otherReference: z.string().optional().nullable(),
  transportName: z.string().optional().nullable(),
  lrNumber: z.string().optional().nullable(),
  destination: z.string().optional().nullable(),
  vehicleNumber: z.string().optional().nullable(),
  ewayBillNo: z.string().optional().nullable(),
  termsOfDelivery: z.string().optional().nullable(),

  shipCompanyName: z.string().optional().nullable(),
  shipAddressLine1: z.string().optional().nullable(),
  shipAddressLine2: z.string().optional().nullable(),
  shipCity: z.string().optional().nullable(),
  shipState: z.string().optional().nullable(),
  shipPincode: z.string().optional().nullable(),
  shipGSTIN: z.string().optional().nullable(),
  shipContactPerson: z.string().optional().nullable(),
  shipMobile: z.string().optional().nullable(),
  useBuyerAsShipping: z.boolean().optional().nullable(),

  items: z.array(saleItemSchema).min(1),
});

// ── Helpers for the new optional GST-invoice fields ────────────────
// Converts a possibly-empty date string to a Date, or null. Never throws
// on blank/undefined input (all these fields are optional).
function toDateOrNull(v: string | null | undefined): Date | null {
  if (!v || !v.trim()) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// Trims a possibly-empty string to null (keeps nullable columns clean).
function toTextOrNull(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const t = v.trim();
  return t === '' ? null : t;
}

// Builds the shared "extra fields" object used by both createSale and
// updateSale so the two stay in sync. Ship-to address lines and GSTIN are
// encrypted the same way customerAddress/deliveryAddress/companyGstin are.
function buildGstExtrasData(d: z.infer<typeof saleSchema>) {
  return {
    referenceNo: toTextOrNull(d.referenceNo),
    referenceDate: toDateOrNull(d.referenceDate),
    deliveryNote: toTextOrNull(d.deliveryNote),
    buyerOrderNo: toTextOrNull(d.buyerOrderNo),
    buyerOrderDate: toDateOrNull(d.buyerOrderDate),
    dispatchDocNo: toTextOrNull(d.dispatchDocNo),
    deliveryNoteDate: toDateOrNull(d.deliveryNoteDate),
    modeOfPayment: toTextOrNull(d.modeOfPayment),
    otherReference: toTextOrNull(d.otherReference),
    transportName: toTextOrNull(d.transportName),
    lrNumber: toTextOrNull(d.lrNumber),
    destination: toTextOrNull(d.destination),
    vehicleNumber: toTextOrNull(d.vehicleNumber),
    ewayBillNo: toTextOrNull(d.ewayBillNo),
    termsOfDelivery: toTextOrNull(d.termsOfDelivery),

    shipCompanyName: toTextOrNull(d.shipCompanyName),
    shipAddressLine1: encryptIfPresent(d.shipAddressLine1),
    shipAddressLine2: encryptIfPresent(d.shipAddressLine2),
    shipCity: toTextOrNull(d.shipCity),
    shipState: toTextOrNull(d.shipState),
    shipPincode: toTextOrNull(d.shipPincode),
    shipGSTIN: encryptIfPresent(d.shipGSTIN?.toUpperCase()),
    shipContactPerson: toTextOrNull(d.shipContactPerson),
    shipMobile: toTextOrNull(d.shipMobile),
    useBuyerAsShipping: d.useBuyerAsShipping ?? null,
  };
}

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
        error: 'Validation failed.',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const {
      invoiceNo: enteredInvoiceNo,
      items,
      companyGstin,
      dueDate,
      isInterState,
      customerAddress,
      deliveryAddress,
      ...data
    } = parsed.data;

    const invoiceNo =
      enteredInvoiceNo?.trim()
        ? enteredInvoiceNo.trim()
        : await generateTenantId('INV', userId);

    const row = await prisma.sale.create({
      data: {
        userId,
        invoiceNo,
        customerAddress: encryptIfPresent(customerAddress),
        deliveryAddress: encryptIfPresent(deliveryAddress),
        companyName: data.companyName,
customerId: data.customerId,
paymentTerms: data.paymentTerms,
poNo: data.poNo,
otherExpense: data.otherExpense,
roundOff: data.roundOff,
paymentReceived: data.paymentReceived,
totalTaxable: data.totalTaxable,
totalGst: data.totalGst,
igstAmount: data.igstAmount,
cgstAmount: data.cgstAmount,
sgstAmount: data.sgstAmount,
grandTotal: data.grandTotal,
notes: data.notes,
profitPct: data.profitPct,
        invoiceDate: new Date(data.invoiceDate),
        dueDate: dueDate ? new Date(dueDate) : null,
        companyGstin: encryptIfPresent(companyGstin?.toUpperCase()),
        // ── Phase 3 financial encryption ───────────────────────
        // Both the plaintext column AND the encrypted column are written
        // here, intentionally, during this transitional period. The
        // plaintext columns remain populated so every existing reader
        // (dashboard "recent sales", any report not yet updated to read
        // *Enc) keeps working correctly and consistently for OLD and NEW
        // records alike, while the *Enc columns are what the application
        // actually displays going forward via decryptFinancialWithFallback()
        // above. Once every read path in the codebase is confirmed to read
        // only the *Enc columns, these plaintext writes (and the matching
        // plaintext columns in schema.prisma) can be removed — see the
        // migration/rollout notes for this change.
        totalPurchaseCost: data.totalPurchaseCost,
        totalPurchaseCostEnc: encryptFinancialData(
  data.totalPurchaseCost
),

        grossProfit: data.grossProfit,
grossProfitEnc: encryptFinancialData(
  data.grossProfit
),
        // Professional GST Invoice Template — additive-only, all optional.
        ...buildGstExtrasData(parsed.data),
        items: {
  create: items.map(item => ({
    materialName: item.materialName,
    hsnCode: item.hsnCode,
    quantity: item.quantity,
    unitPrice: item.unitPrice,

    gstPercent: item.gstPercent,
    taxableAmount: item.taxableAmount,
    gstAmount: item.gstAmount,
    itemTotal: item.itemTotal,

    // Same transitional dual-write pattern as above, at item level.
    purchasePrice: item.purchasePrice,
    purchasePriceEnc: encryptFinancialData(
      item.purchasePrice
    ),

    avgPurchaseCost: item.avgPurchaseCost,
    avgPurchaseCostEnc: encryptFinancialData(
      item.avgPurchaseCost
    ),

    itemProfit: item.itemProfit,
    itemProfitEnc: encryptFinancialData(
      item.itemProfit
    ),
  })),
},
      },
      include: {
        items: true,
        receivablePayments: true,
      },
    });

    await auditLog(
      userId,
      'data_create',
      `Sale: ${invoiceNo} — ${data.companyName} — ₹${data.grandTotal}`,
      req
    );

    res.status(201).json(decrypt(row));
  } catch (err) {
    next(err);
  }
}

export async function updateSale(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);

    if (!(await assertTenantOwnership(userId, 'sales', id))) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const parsed = saleSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed.',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const {
      invoiceNo,
      items,
      companyGstin,
      dueDate,
      isInterState,
      customerAddress,
      deliveryAddress,
      // Professional GST Invoice Template — additive-only fields, pulled
      // out of the `...data` spread below so they can be converted
      // (date strings → Date) and encrypted (ship address/GSTIN) the
      // same way customerAddress/deliveryAddress/companyGstin already are.
      referenceNo, referenceDate, deliveryNote, buyerOrderNo, buyerOrderDate,
      dispatchDocNo, deliveryNoteDate, modeOfPayment, otherReference,
      transportName, lrNumber, destination, vehicleNumber, ewayBillNo,
      termsOfDelivery, shipCompanyName, shipAddressLine1, shipAddressLine2,
      shipCity, shipState, shipPincode, shipGSTIN, shipContactPerson,
      shipMobile, useBuyerAsShipping,
      ...data
    } = parsed.data;

    await prisma.saleItem.deleteMany({
      where: { saleId: id },
    });

    const row = await prisma.sale.update({
      where: { id },
      data: {
        invoiceNo,
        ...data,
        customerAddress: encryptIfPresent(customerAddress),
        deliveryAddress: encryptIfPresent(deliveryAddress),
        invoiceDate: new Date(data.invoiceDate),
        dueDate: dueDate ? new Date(dueDate) : null,
        companyGstin: encryptIfPresent(companyGstin?.toUpperCase()),
        // Professional GST Invoice Template — additive-only, all optional.
        ...buildGstExtrasData(parsed.data),
        // `...data` above already includes plaintext totalPurchaseCost and
        // grossProfit (they were never destructured out), so only the
        // *Enc columns need to be set explicitly here. This mirrors the
        // same transitional dual-write described in createSale() above.
        totalPurchaseCostEnc: encryptFinancialData(
  data.totalPurchaseCost
),

grossProfitEnc: encryptFinancialData(
  data.grossProfit
),
        items: {
  create: items.map(item => ({
    materialName: item.materialName,
    hsnCode: item.hsnCode,
    quantity: item.quantity,
    unitPrice: item.unitPrice,

    gstPercent: item.gstPercent,
    taxableAmount: item.taxableAmount,
    gstAmount: item.gstAmount,
    itemTotal: item.itemTotal,

    purchasePrice: item.purchasePrice,
    purchasePriceEnc: encryptFinancialData(
      item.purchasePrice
    ),

    avgPurchaseCost: item.avgPurchaseCost,
    avgPurchaseCostEnc: encryptFinancialData(
      item.avgPurchaseCost
    ),

    itemProfit: item.itemProfit,
    itemProfitEnc: encryptFinancialData(
      item.itemProfit
    ),
  })),
},
      },
      include: {
        items: true,
        receivablePayments: true,
      },
    });

    await auditLog(
      userId,
      'data_update',
      `Sale updated: ${invoiceNo}`,
      req
    );

    res.json(decrypt(row));
  } catch (err) {
    next(err);
  }
}

export async function deleteSale(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    if (!await assertTenantOwnership(userId, 'sales', id)) return res.status(403).json({ error: 'Access denied.' });
    await prisma.sale.delete({ where: { id } });
    await auditLog(userId, 'data_delete', `Sale deleted: #${id}`, req);
    res.json({ message: 'Deleted.' });
  } catch (err) { next(err); }
}

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