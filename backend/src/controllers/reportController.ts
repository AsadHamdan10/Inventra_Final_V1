import { Request, Response, NextFunction, RequestHandler } from 'express';
import prisma from '../utils/prisma';
import { safeDecrypt } from '../utils/crypto';
import { safeDecryptFinancial } from '../utils/financialCrypto';

// ── Why this block exists ───────────────────────────────────────
// Every controller in this codebase reads `req.user!.userId`, relying on
// a global augmentation of Express's Request type (adding a `user` field
// populated by the auth middleware). That augmentation is expected to live
// in a shared .d.ts file elsewhere in the project — but it wasn't found
// via `grep -rln "namespace Express" src/`, which is why TypeScript was
// reporting "Property 'user' does not exist on type 'Request<...>'" at
// every req.user!.userId call site in this file (6 occurrences).
//
// This re-declares the same augmentation locally, scoped to this file, so
// reportController.ts compiles correctly on its own regardless of whether
// that other declaration exists, is misplaced, or isn't picked up by
// tsconfig.json's `include`. If a project-wide declaration is later found
// or fixed, this block becomes redundant but harmless — TypeScript merges
// identical interface augmentations without conflict, it does not error
// on a duplicate declare global block as long as the shape matches.
//
// IMPORTANT: if your actual req.user shape differs from this (e.g. it
// also carries `companyName`, or `userId` is actually named `id`), update
// the fields below to match — otherwise this stops the TS2339 errors but
// may silently widen what TypeScript thinks req.user contains.
/*declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        role: string;
        companyName?: string;
      };
    }
  }
}*/

const dateFilter = (from: any, to: any, field: string) =>
  from && to ? { [field]: { gte: new Date(from as string), lte: new Date(to as string) } } : {};

// Same helper as saleController.ts / dashboardController.ts — kept in sync
// deliberately across all three files. Checks presence of the encrypted
// column directly rather than truthiness of its decrypted result, so a
// row with a genuinely-zero profit isn't misread as "missing" and
// incorrectly routed to the plaintext fallback. See saleController.ts for
// the full explanation.
function decryptFinancialWithFallback(encValue: string | null | undefined, plaintextValue: any): number {
  if (encValue !== null && encValue !== undefined && encValue !== '') {
    return safeDecryptFinancial(encValue);
  }
  return Number(plaintextValue ?? 0);
}

export const getProfitReport: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { from, to } = req.query;
    const df = dateFilter(from, to, 'invoiceDate');
    const ef = dateFilter(from, to, 'expenseDate');

    const [sales, expAgg, expenses] = await Promise.all([
      prisma.sale.findMany({ where: { userId, ...df }, include: { items: true }, orderBy: { invoiceDate: 'desc' } }),
      prisma.expense.aggregate({ where: { userId, deductProfit: true, ...ef }, _sum: { amount: true } }),
      prisma.expense.findMany({ where: { userId, ...ef }, orderBy: { expenseDate: 'desc' } }),
    ]);

    // ── Why these two lines changed ─────────────────────────────────
    // Previously this read ONLY r.totalPurchaseCost / r.grossProfit — the
    // plaintext columns — and never touched totalPurchaseCostEnc /
    // grossProfitEnc at all, despite financial encryption being the whole
    // point of Phase 3. That happened to still "work" only because
    // saleController.ts was (until its own fix) writing the plaintext
    // columns; the moment that write-side bug is fixed forward, relying on
    // plaintext here would be reading data that's increasingly stale or
    // absent on records saved by future code that writes *Enc-only.
    // Decrypting *Enc first (with a presence-based, not truthiness-based,
    // fallback to plaintext for legacy pre-encryption rows) makes this
    // report correct regardless of which column a given Sale row actually
    // has populated.
    const totalPurchase   = sales.reduce((s, r) => s + decryptFinancialWithFallback((r as any).totalPurchaseCostEnc, r.totalPurchaseCost), 0);
    const grossProfit     = sales.reduce((s, r) => s + decryptFinancialWithFallback((r as any).grossProfitEnc, r.grossProfit), 0);

    const totalInvExpense = sales.reduce((s, r) => s + Number(r.otherExpense || 0), 0);
    const totalExpenses   = Number(expAgg._sum.amount ?? 0);
    const netProfit        = grossProfit - totalInvExpense - totalExpenses;
    const totalRevenue    = sales.reduce((s, r) => s + Number(r.totalTaxable), 0);

    res.json({
      sales: sales.map(s => ({
        ...s,
        companyGstin:      safeDecrypt(s.companyGstin || ''),
        grandTotal:        Number(s.grandTotal),
        grossProfit:       decryptFinancialWithFallback((s as any).grossProfitEnc, s.grossProfit),
        totalGst:          Number(s.totalGst),
        otherExpense:      Number(s.otherExpense || 0),
        totalPurchaseCost: decryptFinancialWithFallback((s as any).totalPurchaseCostEnc, s.totalPurchaseCost),
        totalTaxable:      Number(s.totalTaxable || 0),
        profitPct:         Number(s.profitPct || 0),
      })),
      expenses: expenses.map(e => ({ ...e, amount: Number(e.amount) })),
      summary: {
        totalRevenue,
        totalPurchase,
        totalInvExpense,
        grossProfit,
        totalExpenses,
        netProfit,
        profitMargin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : '0',
      },
    });
  } catch (err) { next(err); }
}

export const getInventoryReport: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const [purchased, sold, materials] = await Promise.all([
      prisma.purchaseItem.groupBy({ by: ['materialName'], where: { purchase: { userId } }, _sum: { quantity: true, itemTotal: true } }),
      prisma.saleItem.groupBy({ by: ['materialName'], where: { sale: { userId } }, _sum: { quantity: true, itemTotal: true } }),
      prisma.material.findMany({ where: { userId } }),
    ]);
    const soldMap  = Object.fromEntries(sold.map(s => [s.materialName, { qty: Number(s._sum.quantity ?? 0), val: Number(s._sum.itemTotal ?? 0) }]));
    const purchMap = Object.fromEntries(purchased.map(p => [p.materialName, { qty: Number(p._sum.quantity ?? 0), val: Number(p._sum.itemTotal ?? 0) }]));

    const inventory = materials.map(m => {
      const p       = purchMap[m.materialName] ?? { qty: 0, val: 0 };
      const s       = soldMap[m.materialName]  ?? { qty: 0, val: 0 };
      const stock    = p.qty - s.qty;
      const avgCost  = p.qty > 0 ? p.val / p.qty : 0;
      return {
        materialName: m.materialName,
        hsnCode:      m.hsnCode,
        unit:         m.unit,
        purchased:    p.qty,
        sold:         s.qty,
        stock,
        avgCost,
        stockValue:   stock * avgCost,
        isLow:        stock < 10,
      };
    });
    res.json(inventory);
  } catch (err) { next(err); }
}

// ─── Day Book ────────────────────────────────────────────────────────────────
// GET /api/reports/ledger  (no party param)
// Returns ALL business transactions: Sales, Purchases, Expenses, Bank Credits/Debits
// Opening/Closing balance is business-wide.

// ─── Party Ledger ────────────────────────────────────────────────────────────
// GET /api/reports/ledger?party=XYZ
// Returns Sale + Purchase rows + individual PayablePayment / ReceivablePayment
// rows for the selected party. Opening balance calculated for that party only.

export const getLedger: RequestHandler = async (req, res, next) => {
  try {
    const userId        = req.user!.userId;
    const { from, to, party } = req.query;
    const isPartyLedger = Boolean(party && (party as string).trim());
    const partyName     = isPartyLedger ? (party as string).trim() : undefined;

    const df = from && to
      ? { gte: new Date(from as string), lte: new Date(to as string) }
      : undefined;

    const beforeDate = from ? { lt: new Date(from as string) } : undefined;

    if (isPartyLedger) {
      // ── PARTY LEDGER MODE ────────────────────────────────────────────────────
      // Fetch sales, purchases, receivable payments, and payable payments
      // for the selected party within the date range, plus pre-period rows
      // needed to compute the opening balance.
      const [
        sales,
        purchases,
        receipts,
        payablePayments,
        oldSales,
        oldPurchases,
        oldReceipts,
        oldpayablePayments,
      ] = await Promise.all([
        prisma.sale.findMany({
          where: {
            userId,
            companyName: partyName,
            ...(df ? { invoiceDate: df } : {}),
          },
          orderBy: { invoiceDate: 'asc' },
        }),

        prisma.purchase.findMany({
          where: {
            userId,
            vendorName: partyName,
            ...(df ? { billDate: df } : {}),
          },
          orderBy: { billDate: 'asc' },
        }),

        prisma.receivablePayment.findMany({
          where: {
            ...(df ? { dateReceived: df } : {}),
            sale: { userId, companyName: partyName },
          },
          include: { sale: true },
          orderBy: { dateReceived: 'asc' },
        }),

        // Individual vendor payment rows from PayablePayment table
        prisma.payablePayment.findMany({
          where: {
            ...(df ? { datePaid: df } : {}),
            purchase: { userId, vendorName: partyName },
          },
          include: { purchase: true },
          orderBy: { datePaid: 'asc' },
        }),

        // Pre-period rows for opening balance
        beforeDate
          ? prisma.sale.findMany({
              where: { userId, companyName: partyName, invoiceDate: beforeDate },
            })
          : Promise.resolve([]),

        beforeDate
          ? prisma.purchase.findMany({
              where: { userId, vendorName: partyName, billDate: beforeDate },
            })
          : Promise.resolve([]),

        beforeDate
          ? prisma.receivablePayment.findMany({
              where: {
                dateReceived: beforeDate,
                sale: { userId, companyName: partyName },
              },
              include: { sale: true },
            })
          : Promise.resolve([]),

        beforeDate
          ? prisma.payablePayment.findMany({
              where: {
                datePaid: beforeDate,
                purchase: { userId, vendorName: partyName },
              },
              include: { purchase: true },
            })
          : Promise.resolve([]),
      ]);

      // Opening balance for this party:
      //   Sales before period      → credit (customer owes us)
      //   Receipts before period   → debit  (reduces what customer owes)
      //   Purchases before period  → debit  (we owe vendor)
      //   Payments before period   → credit (reduces what we owe vendor)
      const salesBefore           = oldSales.reduce((s, r) => s + Number(r.grandTotal), 0);
      const receiptsBefore        = oldReceipts.reduce((s, r) => s + Number(r.amount), 0);
      const purchasesBefore       = oldPurchases.reduce((s, r) => s + Number(r.grandTotal), 0);
      const payablePaymentsBefore = oldpayablePayments.reduce((s, r) => s + Number(r.amount), 0);

      const openingBalance =
        salesBefore - receiptsBefore - purchasesBefore + payablePaymentsBefore;

      const ledger = [
        ...sales.map(s => ({
          date:   s.invoiceDate,
          type:   'Sale' as const,
          ref:    s.invoiceNo,
          party:  s.companyName,
          credit: Number(s.grandTotal),
          debit:  0,
        })),

        ...receipts.map(r => ({
          date:   r.dateReceived,
          type:   'Receipt' as const,
          ref:    r.reference || '',
          party:  r.sale.companyName,
          credit: 0,
          debit:  Number(r.amount),
        })),

        ...purchases.map(p => ({
          date:   p.billDate,
          type:   'Purchase' as const,
          ref:    p.billNo,
          party:  p.vendorName,
          credit: 0,
          debit:  Number(p.grandTotal),
        })),

        // Each PayablePayment is its own ledger row with the exact date paid
        ...payablePayments.map(pp => ({
          date:   pp.datePaid,
          type:   'Payment' as const,
          ref:    pp.reference || `Payment - ${pp.purchase.billNo}`,
          party:  pp.purchase.vendorName,
          credit: Number(pp.amount),
          debit:  0,
        })),
      ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const totalCredit = ledger.reduce((s, e) => s + e.credit, 0);
      const totalDebit  = ledger.reduce((s, e) => s + e.debit,  0);

      return res.json({ openingBalance, totalCredit, totalDebit, ledger });
    }

    // ── DAY BOOK MODE ──────────────────────────────────────────────────────────
    // All business transactions: Sales, Purchases, Expenses, Bank Credits/Debits.
    // Unchanged from original — paymentPaid is not shown here, only bill totals.
    const [
      sales,
      purchases,
      expenses,
      bankStatements,
      oldSales,
      oldPurchases,
      oldExpenses,
      oldBankStatements,
    ] = await Promise.all([
      prisma.sale.findMany({
        where: { userId, ...(df ? { invoiceDate: df } : {}) },
        orderBy: { invoiceDate: 'asc' },
      }),
      prisma.purchase.findMany({
        where: { userId, ...(df ? { billDate: df } : {}) },
        orderBy: { billDate: 'asc' },
      }),
      prisma.expense.findMany({
        where: { userId, ...(df ? { expenseDate: df } : {}) },
        orderBy: { expenseDate: 'asc' },
      }),
      prisma.bankStatement.findMany({
        where: { userId, ...(df ? { txnDate: df } : {}) },
        orderBy: { txnDate: 'asc' },
      }),
      // Before-date rows for opening balance
      beforeDate ? prisma.sale.findMany({ where: { userId, invoiceDate: beforeDate } })        : Promise.resolve([]),
      beforeDate ? prisma.purchase.findMany({ where: { userId, billDate: beforeDate } })       : Promise.resolve([]),
      beforeDate ? prisma.expense.findMany({ where: { userId, expenseDate: beforeDate } })     : Promise.resolve([]),
      beforeDate ? prisma.bankStatement.findMany({ where: { userId, txnDate: beforeDate } })   : Promise.resolve([]),
    ]);

    // Business-wide opening balance
    const creditsBefore =
      oldSales.reduce((s, r) => s + Number(r.grandTotal), 0) +
      oldBankStatements
        .filter((b: any) => b.txnType === 'credit')
        .reduce((s: number, b: any) => s + Number(b.amount), 0);

    const debitsBefore =
      oldPurchases.reduce((s, r) => s + Number(r.grandTotal), 0) +
      oldExpenses.reduce((s, r) => s + Number(r.amount), 0) +
      oldBankStatements
        .filter((b: any) => b.txnType === 'debit')
        .reduce((s: number, b: any) => s + Number(b.amount), 0);

    const openingBalance = creditsBefore - debitsBefore;

    const ledger = [
      ...sales.map(s => ({
        date:   s.invoiceDate,
        type:   'Sale' as const,
        ref:    s.invoiceNo,
        party:  s.companyName,
        credit: Number(s.grandTotal),
        debit:  0,
      })),
      ...purchases.map(p => ({
        date:   p.billDate,
        type:   'Purchase' as const,
        ref:    p.billNo,
        party:  p.vendorName,
        credit: 0,
        debit:  Number(p.grandTotal),
      })),
      ...expenses.map(e => ({
        date:   (e as any).expenseDate,
        type:   'Expense' as const,
        ref:    (e as any).reference || '',
        party:  (e as any).category || '',
        credit: 0,
        debit:  Number(e.amount),
      })),
      ...bankStatements
        .filter((b: any) => b.txnType === 'credit')
        .map((b: any) => ({
          date:   b.txnDate,
          type:   'Bank credit' as const,
          ref:    b.category || '',
          party:  b.description || 'Bank',
          credit: Number(b.amount),
          debit:  0,
        })),
      ...bankStatements
        .filter((b: any) => b.txnType === 'debit')
        .map((b: any) => ({
          date:   b.txnDate,
          type:   'Bank debit' as const,
          ref:    b.category || '',
          party:  b.description || 'Bank',
          credit: 0,
          debit:  Number(b.amount),
        })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const totalCredit = ledger.reduce((s, e) => s + e.credit, 0);
    const totalDebit  = ledger.reduce((s, e) => s + e.debit,  0);

    return res.json({ openingBalance, totalCredit, totalDebit, ledger });
  } catch (err) {
    next(err);
  }
}

export const getGstReport: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { from, to } = req.query;
    const df = from && to ? { gte: new Date(from as string), lte: new Date(to as string) } : undefined;

    const [sales, purchases, payments] = await Promise.all([
      prisma.sale.findMany({ where: { userId, ...(df ? { invoiceDate: df } : {}) }, orderBy: { invoiceDate: 'desc' } }),
      prisma.purchase.findMany({ where: { userId, ...(df ? { billDate: df } : {}) }, orderBy: { billDate: 'desc' } }),
      prisma.gstPayment.findMany({ where: { userId, ...(df ? { paymentDate: df } : {}) }, orderBy: { paymentDate: 'desc' } }),
    ]);

    const outputGst  = sales.reduce((s, r) => s + Number(r.totalGst), 0);
    const inputGst   = purchases.reduce((s, r) => s + Number(r.totalGst), 0);
    const gstPaid    = payments.reduce((s, r) => s + Number(r.amountPaid), 0);
    const netPayable = Math.max(0, outputGst - inputGst - gstPaid);

    res.json({
      sales: sales.map(s => ({
        ...s,
        companyGstin:    safeDecrypt(s.companyGstin || ''),
        customerAddress: safeDecrypt(s.customerAddress || ''),
        deliveryAddress: safeDecrypt(s.deliveryAddress || ''),
      })),
      purchases: purchases.map(p => ({
        ...p,
        vendorGstin: safeDecrypt(p.vendorGstin || ''),
      })),
      payments,
      summary: { outputGst, inputGst, gstPaid, netPayable },
    });
  } catch (err) { next(err); }
}

export const getReceivables: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { from, to } = req.query;
    const df = dateFilter(from, to, 'invoiceDate');
    const sales = await prisma.sale.findMany({
      where: { userId, ...df },
      include: { receivablePayments: true },
      orderBy: { invoiceDate: 'desc' },
    });
    const rows = sales.map(s => ({
      ...s,
      companyGstin:    safeDecrypt(s.companyGstin || ''),
      customerAddress: safeDecrypt(s.customerAddress || ''),
      deliveryAddress: safeDecrypt(s.deliveryAddress || ''),
      grandTotal:      Number(s.grandTotal),
      paymentReceived: Number(s.paymentReceived),
      balance:         Number(s.grandTotal) - Number(s.paymentReceived),
    }));
    res.json({ rows, totalOutstanding: rows.reduce((s, r) => s + r.balance, 0) });
  } catch (err) { next(err); }
}

export const getPayables: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { from, to } = req.query;
    const df = dateFilter(from, to, 'billDate');

    const purchases = await prisma.purchase.findMany({
      where: { userId, ...df },
      include: {
        items: true,
        // Include individual payment rows so PayablesPage can show history
        payablePayments: {
          orderBy: [{ datePaid: 'desc' }, { id: 'desc' }],
        },
      },
      orderBy: { billDate: 'desc' },
    });

    const rows = purchases.map(p => ({
      ...p,
      vendorGstin: safeDecrypt(p.vendorGstin || ''),
      grandTotal:  Number(p.grandTotal),
      paymentPaid: Number(p.paymentPaid),
      balance:     Number(p.grandTotal) - Number(p.paymentPaid),
    }));

    res.json({ rows, totalPayable: rows.reduce((s, r) => s + r.balance, 0) });
  } catch (err) { next(err); }
}