import { Request, Response, NextFunction, RequestHandler } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { safeDecrypt, encryptIfPresent } from '../utils/crypto';

import {
  encryptFinancialData,
  safeDecryptFinancial,
} from '../utils/financialCrypto';
import { auditLog } from '../services/auditService';
import { postPurchaseAccounting } from '../services/accounting/accountingIntegrationService';
import { assertFinancialPeriodOpen } from '../services/financialPeriodService';
import { assertTenantOwnership } from '../middlewares/auth';
import { generateTenantId } from '../utils/tenantId';
import { calculateGstBreakdown } from './saleController';
import { determineInterStateByGstin } from '../utils/gstStateUtil';

// ── Schemas ────────────────────────────────────────────────────

const purchaseItemSchema = z.object({
  materialName:  z.string().min(1),
  hsnCode:       z.string().optional().default(''),
  quantity:      z.number().positive(),
  purchaseRate:  z.number().min(0).default(0),
  gstPercent:    z.number().min(0).max(100).default(0),
  taxableAmount: z.number().min(0).default(0),
  gstAmount:     z.number().min(0).default(0),
  itemTotal:     z.number().min(0).default(0),
});

const purchaseSchema = z.object({
  billNo:       z.string().optional().default(''),
  billDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vendorId:     z.number().optional().nullable(),
  vendorName:   z.string().min(1).max(200),
  vendorGstin:  z.string().optional().default(''),
  otherExpense: z.number().min(0).default(0),
  roundOff:     z.number().default(0),
  // paymentPaid is intentionally excluded from the schema —
  // it is managed automatically via PayablePayment records.
  totalTaxable: z.number().min(0).default(0),
  totalGst:     z.number().min(0).default(0),
  igstAmount:   z.number().min(0).default(0),
  cgstAmount:   z.number().min(0).default(0),
  sgstAmount:   z.number().min(0).default(0),
  grandTotal:   z.number().min(0),
  notes:        z.string().optional().default(''),
  items:        z.array(purchaseItemSchema).min(1),
});

const gstInputBillSchema = z.object({
  billNo:      z.string().min(1),
  billDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sellerName:  z.string().min(1).max(200),
  sellerGstin: z.string().optional().default(''),
  gstAmount:   z.number().min(0).default(0),
  igstAmount:  z.number().min(0).default(0),
  cgstAmount:  z.number().min(0).default(0),
  sgstAmount:  z.number().min(0).default(0),
  amountPaid:  z.number().min(0).default(0),
  category:    z.string().optional().default('General'),
  notes:       z.string().optional().default(''),
});

const payablePaymentSchema = z.object({
  amount:    z.number().positive(),
  datePaid:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode:      z.string().default('Cash'),
  reference: z.string().optional().default(''),
  notes:     z.string().optional().default(''),
});

// ── Helpers ────────────────────────────────────────────────────

// Same pattern as saleController.ts / dashboardController.ts /
// reportController.ts — kept in sync deliberately across all four files.
// Checks presence of the encrypted value directly rather than truthiness
// of its decrypted result, so a genuinely-zero purchase rate isn't
// misread as "missing" and incorrectly routed to the plaintext fallback.
function decryptFinancialWithFallback(encValue: string | null | undefined, plaintextValue: any): number {
  if (encValue !== null && encValue !== undefined && encValue !== '') {
    return safeDecryptFinancial(encValue);
  }
  return Number(plaintextValue ?? 0);
}

const decryptPurchase = (p: any) => ({
  ...p,

  vendorGstin: safeDecrypt(p.vendorGstin || ''),

  items:
    p.items?.map((item: any) => ({
      ...item,

      // Previously: safeDecryptFinancial(item.purchaseRateEnc) with no
      // fallback. Any purchase item created before financial encryption
      // existed has purchaseRateEnc = NULL, which silently decrypted to 0
      // — this is what the original bug report's Prisma Studio screenshot
      // was showing (purchaseRate=126 plaintext, purchaseRateEnc=null).
      // Now falls back to the plaintext purchaseRate column when the
      // encrypted column is genuinely absent.
      purchaseRate: decryptFinancialWithFallback(
        item.purchaseRateEnc,
        item.purchaseRate
      ),
    })) || [],
});

/**
 * Recalculate purchase.paymentPaid as SUM of all PayablePayment rows.
 * Called after every add / edit / delete of a payment.
 */
async function syncPaymentPaid(purchaseId: number) {
  const totals = await prisma.payablePayment.aggregate({
    where: { purchaseId },
    _sum: { amount: true },
  });
  await prisma.purchase.update({
    where: { id: purchaseId },
    data: { paymentPaid: totals._sum.amount ?? 0 },
  });
}

// ══════════════════════════════════════════════════════════════
// PURCHASE CRUD
// ══════════════════════════════════════════════════════════════

export const listPurchases: RequestHandler = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const rows = await prisma.purchase.findMany({
      where: {
        userId: req.user!.userId,
        ...(from && to
          ? { billDate: { gte: new Date(from as string), lte: new Date(to as string) } }
          : {}),
      },
      include: { items: true, payablePayments: true },
      orderBy: [{ billDate: 'desc' }, { id: 'desc' }, { billNo: 'desc' }],
    });
    res.json(rows.map(decryptPurchase));
  } catch (err) {
    next(err);
  }
}

export const getPurchase: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const id     = parseInt(req.params.id);

    if (!(await assertTenantOwnership(userId, 'purchases', id))) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const row = await prisma.purchase.findUnique({
      where: { id },
      include: { items: true, payablePayments: true },
    });

    if (!row) return res.status(404).json({ error: 'Not found.' });
    res.json(decryptPurchase(row));
  } catch (err) {
    next(err);
  }
}


// SECURITY/CORRECTNESS FIX: createPurchase/updatePurchase previously stored
// totalTaxable/totalGst/igstAmount/cgstAmount/sgstAmount/grandTotal and every
// item's taxableAmount/gstAmount/itemTotal exactly as submitted by the
// client, with zero backend verification — unlike sales, which are fully
// recalculated server-side in saleInternalService. This helper ports the
// same pattern to purchases: recompute every figure from quantity/rate/GST%
// and the backend-authoritative inter-state determination, and IGNORE
// whatever totals the client submitted.
async function recalculatePurchaseFinancials(
  userId: number,
  vendorGstin: string | undefined,
  items: { quantity: number; purchaseRate: number; gstPercent: number }[],
  otherExpense: number,
  roundOff: number
) {
  const tenant = await prisma.user.findUnique({ where: { id: userId }, select: { gstin: true, state: true } });
  const isInterState = determineInterStateByGstin(
    safeDecrypt(tenant?.gstin) || null,
    tenant?.state || null,
    vendorGstin ? vendorGstin.toUpperCase() : null,
    null
  );

  let totalTaxable = 0, totalGst = 0, igstAmount = 0, cgstAmount = 0, sgstAmount = 0;
  const recalculatedItems = items.map(item => {
    const quantity = Number(item.quantity);
    const rate = Number(item.purchaseRate);
    const gstPercent = Number(item.gstPercent);
    const taxableAmount = Number((quantity * rate).toFixed(2));
    const breakdown = calculateGstBreakdown(taxableAmount, gstPercent, isInterState);
    const gstAmount = Number(breakdown.totalGst.toFixed(2));
    const itemTotal = Number((taxableAmount + gstAmount).toFixed(2));

    totalTaxable += taxableAmount;
    totalGst += gstAmount;
    igstAmount += breakdown.igst;
    cgstAmount += breakdown.cgst;
    sgstAmount += breakdown.sgst;

    return { taxableAmount, gstAmount, itemTotal };
  });

  const grandTotal = Number((totalTaxable + totalGst + Number(otherExpense || 0) - Number(roundOff || 0)).toFixed(2));

  return {
    isInterState,
    recalculatedItems,
    totals: {
      totalTaxable: Number(totalTaxable.toFixed(2)),
      totalGst: Number(totalGst.toFixed(2)),
      igstAmount: Number(igstAmount.toFixed(2)),
      cgstAmount: Number(cgstAmount.toFixed(2)),
      sgstAmount: Number(sgstAmount.toFixed(2)),
      grandTotal,
    },
  };
}

export const createPurchase: RequestHandler = async (req, res, next) => {
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
      billNo: enteredBillNo,
      items,
      vendorGstin,
      ...data
    } = parsed.data;

    const billNo = enteredBillNo?.trim()
      ? enteredBillNo.trim()
      : await generateTenantId('BILL', userId);

    const { recalculatedItems, totals } = await recalculatePurchaseFinancials(
      userId, vendorGstin, items, data.otherExpense, data.roundOff
    );

    const row = await prisma.purchase.create({
      data: {
        userId,
        billNo,
        ...data,
        ...totals, // backend-authoritative — overrides whatever the client submitted above
        billDate:    new Date(data.billDate),
        paymentPaid: 0, // always starts at 0; use Payables page to record payments
        vendorGstin: encryptIfPresent(vendorGstin?.toUpperCase()),
        items: {
  create: items.map((item, i) => ({
  materialName: item.materialName,
  hsnCode: item.hsnCode,
  quantity: item.quantity,

  gstPercent: item.gstPercent,
  taxableAmount: recalculatedItems[i].taxableAmount,
  gstAmount: recalculatedItems[i].gstAmount,
  itemTotal: recalculatedItems[i].itemTotal,

  // Transitional dual-write: plaintext purchaseRate is written alongside
  // purchaseRateEnc, same rationale as totalPurchaseCost/grossProfit in
  // saleController.ts — keeps any reader that hasn't been updated to
  // decrypt *Enc (or any legacy report) correct, until every read path
  // is confirmed to use the encrypted column and the plaintext column is
  // formally retired.
  purchaseRate: item.purchaseRate,
  purchaseRateEnc: encryptFinancialData(
    item.purchaseRate
  ),
})),
},
      },
      include: { items: true, payablePayments: true },
    });

    await auditLog(
      userId,
      'data_create',
      `Purchase: ${billNo} — ${data.vendorName} — ₹${row.grandTotal}`,
      req
    );

    res.status(201).json(decryptPurchase(row));
  } catch (err) {
    next(err);
  }
}

export const updatePurchase: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const id     = parseInt(req.params.id);

    if (!(await assertTenantOwnership(userId, 'purchases', id))) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const parsed = purchaseSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed.',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { billNo, items, vendorGstin, ...data } = parsed.data;

    const { recalculatedItems, totals } = await recalculatePurchaseFinancials(
      userId, vendorGstin, items, data.otherExpense, data.roundOff
    );

    // Replace line items
    await prisma.purchaseItem.deleteMany({ where: { purchaseId: id } });

    const row = await prisma.purchase.update({
      where: { id },
      data: {
        billNo,
        ...data,
        ...totals, // backend-authoritative — overrides whatever the client submitted above
        billDate:    new Date(data.billDate),
        vendorGstin: encryptIfPresent(vendorGstin?.toUpperCase()),
        // paymentPaid is intentionally NOT updated here — it is
        // controlled exclusively by PayablePayment sync.
        items: {
  create: items.map((item, i) => ({
  materialName: item.materialName,
  hsnCode: item.hsnCode,
  quantity: item.quantity,

  gstPercent: item.gstPercent,
  taxableAmount: recalculatedItems[i].taxableAmount,
  gstAmount: recalculatedItems[i].gstAmount,
  itemTotal: recalculatedItems[i].itemTotal,

  purchaseRate: item.purchaseRate,
  purchaseRateEnc: encryptFinancialData(
    item.purchaseRate
  ),
})),
},
      },
      include: { items: true, payablePayments: true },
    });

    await auditLog(
      userId,
      'data_update',
      `Purchase updated: ${billNo} — ${data.vendorName}`,
      req
    );

    res.json(decryptPurchase(row));
  } catch (err) {
    next(err);
  }
}

export const deletePurchase: RequestHandler = async (req, res, next) => {
  return res.status(405).json({ error: 'Method Not Allowed. Financial records are immutable.' });
}

export const getLastPurchasePrice: RequestHandler = async (req, res, next) => {
  try {
    const userId       = req.user!.userId;
    const materialName = req.query.materialName as string;

    if (!materialName) {
      return res.status(400).json({ error: 'materialName is required.' });
    }

    const item = await prisma.purchaseItem.findFirst({
      where: { materialName, purchase: { userId } },
      orderBy: { id: 'desc' },
    });

    res.json({
  // Previously: safeDecryptFinancial(item.purchaseRateEnc) only — silently
  // returned 0 for the most recent purchase of a material if that purchase
  // predates encryption (purchaseRateEnc null). Now falls back to the
  // plaintext purchaseRate for that same legacy case.
  purchaseRate: item
    ? decryptFinancialWithFallback(item.purchaseRateEnc, item.purchaseRate)
    : 0,
});
  } catch (err) {
    next(err);
  }
}

// ══════════════════════════════════════════════════════════════
// GST INPUT BILLS
// ══════════════════════════════════════════════════════════════

export const listGstInputBills: RequestHandler = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const rows = await prisma.gstInputBill.findMany({
      where: {
        userId: req.user!.userId,
        ...(from && to
          ? { billDate: { gte: new Date(from as string), lte: new Date(to as string) } }
          : {}),
      },
      orderBy: [{ billDate: 'desc' }, { id: 'desc' }],
    });
    res.json(
      rows.map(r => ({
        ...r,
        sellerGstin: safeDecrypt(r.sellerGstin || ''),
      }))
    );
  } catch (err) {
    next(err);
  }
}

export const createGstInputBill: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const parsed = gstInputBillSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed.',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { sellerGstin, ...data } = parsed.data;

    const row = await prisma.gstInputBill.create({
      data: {
        userId,
        ...data,
        billDate:    new Date(data.billDate),
        sellerGstin: encryptIfPresent(sellerGstin?.toUpperCase()),
      },
    });

    await auditLog(
      userId,
      'data_create',
      `GST Input Bill: ${data.billNo} — ${data.sellerName}`,
      req
    );

    res.status(201).json({
      ...row,
      sellerGstin: safeDecrypt(row.sellerGstin || ''),
    });
  } catch (err) {
    next(err);
  }
}

export const deleteGstInputBill: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const id     = parseInt(req.params.id);

    // Verify ownership via userId on the record itself
    const existing = await prisma.gstInputBill.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    await prisma.gstInputBill.delete({ where: { id } });
    await auditLog(userId, 'data_delete', `GST Input Bill deleted: #${id}`, req);
    res.json({ message: 'Deleted.' });
  } catch (err) {
    next(err);
  }
}

// ══════════════════════════════════════════════════════════════
// PAYABLE PAYMENTS
// Mirror of receivable payment functions in saleController.ts
// ══════════════════════════════════════════════════════════════

export const addPayablePayment: RequestHandler = async (req, res, next) => {
  try {
    const userId     = req.user!.userId;
    const purchaseId = parseInt(req.body.purchaseId);

    if (isNaN(purchaseId)) {
      return res.status(400).json({ error: 'purchaseId is required.' });
    }

    if (!(await assertTenantOwnership(userId, 'purchases', purchaseId))) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const parsed = payablePaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed.',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const payment = await prisma.payablePayment.create({
      data: {
        purchaseId,
        amount:    parsed.data.amount,
        datePaid:  new Date(parsed.data.datePaid),
        mode:      parsed.data.mode,
        reference: parsed.data.reference,
        notes:     parsed.data.notes,
      },
    });

    await syncPaymentPaid(purchaseId);

    await auditLog(
      userId,
      'data_create',
      `Payment made for purchase #${purchaseId}: ₹${parsed.data.amount}`,
      req
    );

    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
}

export const getPayablePayments: RequestHandler = async (req, res, next) => {
  try {
    const userId     = req.user!.userId;
    const purchaseId = parseInt(req.params.purchaseId);

    if (!(await assertTenantOwnership(userId, 'purchases', purchaseId))) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const payments = await prisma.payablePayment.findMany({
      where: { purchaseId },
      orderBy: [{ datePaid: 'desc' }, { id: 'desc' }],
    });

    res.json(payments);
  } catch (err) {
    next(err);
  }
}

export const updatePayablePayment: RequestHandler = async (req, res, next) => {
  try {
    const paymentId = parseInt(req.params.paymentId);
    const parsed    = payablePaymentSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed.' });
    }

    const existing = await prisma.payablePayment.findUnique({
      where: { id: paymentId },
      include: { purchase: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Payment not found.' });
    }

    const userId = req.user!.userId;

    if (!(await assertTenantOwnership(userId, 'purchases', existing.purchaseId))) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const payment = await prisma.payablePayment.update({
      where: { id: paymentId },
      data: {
        amount:    parsed.data.amount,
        datePaid:  new Date(parsed.data.datePaid),
        mode:      parsed.data.mode,
        reference: parsed.data.reference,
        notes:     parsed.data.notes,
      },
    });

    await syncPaymentPaid(existing.purchaseId);

    await auditLog(
      userId,
      'data_update',
      `Payable payment updated #${paymentId}`,
      req
    );

    res.json(payment);
  } catch (err) {
    next(err);
  }
}

export const deletePayablePayment: RequestHandler = async (req, res, next) => {
  try {
    const paymentId = parseInt(req.params.paymentId);

    const existing = await prisma.payablePayment.findUnique({
      where: { id: paymentId },
      include: { purchase: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Payment not found.' });
    }

    const userId = req.user!.userId;

    if (!(await assertTenantOwnership(userId, 'purchases', existing.purchaseId))) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    await prisma.payablePayment.delete({ where: { id: paymentId } });

    await syncPaymentPaid(existing.purchaseId);

    await auditLog(
      userId,
      'data_delete',
      `Payable payment deleted #${paymentId}`,
      req
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
// (removed: determineInterStateVendor/calculateGstBreakdownVendor were dead stubs
// that always returned false/null; purchaseReturnController now uses the real
// determineInterStateByGstin + calculateGstBreakdown implementations.)
