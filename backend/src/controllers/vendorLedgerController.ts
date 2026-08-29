import { postVendorPaymentAccounting, cancelVendorPaymentAccounting } from '../services/accounting/accountingIntegrationService';
import { assertFinancialPeriodOpen } from '../services/financialPeriodService';
import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { assertTenantOwnership } from '../middlewares/auth';

export const addVendorPayment: import('express').RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const parsed = req.body;
    const { vendorId, amount, paymentDate, mode, reference, notes, allocations } = parsed;
      await assertFinancialPeriodOpen(userId, paymentDate || new Date());
    if (!await assertTenantOwnership(userId, 'vendors', vendorId)) return res.status(403).json({ error: 'Access denied.' });
    const result = await prisma.$transaction(async (tx: any) => {
      const payment = await tx.vendorPayment.create({
        data: { userId, vendorId, amount, unallocated: amount, paymentDate: new Date(paymentDate), mode: mode || 'Cash', reference, notes, status: 'ACTIVE' }
      });
      if (allocations && Array.isArray(allocations)) {
        let allocatedTotal = 0;
        for (const alloc of allocations) {
          allocatedTotal += alloc.amount;
          const purchase = await tx.$queryRaw<any[]>`SELECT * FROM purchases WHERE id = ${alloc.purchaseId} AND user_id = ${userId} AND vendor_id = ${vendorId} FOR UPDATE`;
          if (purchase.length === 0) throw new Error('Purchase not found');
          await tx.vendorPaymentAllocation.create({ data: { userId, paymentId: payment.id, purchaseId: alloc.purchaseId, amountAllocated: alloc.amount } });
          const existingAllocs = await tx.vendorPaymentAllocation.aggregate({ where: { purchaseId: alloc.purchaseId, payment: { status: 'ACTIVE' } }, _sum: { amountAllocated: true } });
          await tx.purchase.update({ where: { id: alloc.purchaseId }, data: { paymentPaid: existingAllocs._sum.amountAllocated || 0 } });
        }
        if (allocatedTotal > amount) throw new Error('Allocations exceed amount');
        await tx.vendorPayment.update({ where: { id: payment.id }, data: { unallocated: amount - allocatedTotal } });
      }
      return payment;
    });
    res.status(201).json(result);
  } catch (err) { next(err); }
};

export const cancelVendorPayment: import('express').RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const paymentId = parseInt(req.params.id);
    await prisma.$transaction(async (tx: any) => {
      const payment = await tx.$queryRaw<any[]>`SELECT * FROM vendor_payments WHERE id = ${paymentId} AND user_id = ${userId} FOR UPDATE`;
      if (payment.length === 0) throw new Error('Not found');
      if (payment[0].status === 'CANCELLED') throw new Error('Already cancelled');
      await tx.vendorPayment.update({ where: { id: paymentId }, data: { status: 'CANCELLED', unallocated: payment[0].amount } });
      const allocs = await tx.vendorPaymentAllocation.findMany({ where: { paymentId } });
      await tx.vendorPaymentAllocation.deleteMany({ where: { paymentId } });
      for (const alloc of allocs) {
        const existingAllocs = await tx.vendorPaymentAllocation.aggregate({ where: { purchaseId: alloc.purchaseId, payment: { status: 'ACTIVE' } }, _sum: { amountAllocated: true } });
        await tx.purchase.update({ where: { id: alloc.purchaseId }, data: { paymentPaid: existingAllocs._sum.amountAllocated || 0 } });
      }
    });
    res.json({ message: 'Cancelled' });
  } catch (err) { next(err); }
};

export const allocateVendorPayment: import('express').RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const paymentId = parseInt(req.params.id);
    const { purchaseId, amount } = req.body;
    await prisma.$transaction(async (tx: any) => {
      const payment = await tx.$queryRaw<any[]>`SELECT * FROM vendor_payments WHERE id = ${paymentId} AND user_id = ${userId} FOR UPDATE`;
      if (payment.length === 0) throw new Error('Not found');
      await tx.vendorPaymentAllocation.create({ data: { userId, paymentId, purchaseId, amountAllocated: amount } });
      const newAllocs = await tx.vendorPaymentAllocation.aggregate({ where: { paymentId, payment: { status: 'ACTIVE' } }, _sum: { amountAllocated: true } });
      const newUnallocated = Number(payment[0].amount) - Number(newAllocs._sum.amountAllocated || 0);
      await tx.vendorPayment.update({ where: { id: paymentId }, data: { unallocated: newUnallocated } });
      const allPurchaseAllocs = await tx.vendorPaymentAllocation.aggregate({ where: { purchaseId, payment: { status: 'ACTIVE' } }, _sum: { amountAllocated: true } });
      await tx.purchase.update({ where: { id: purchaseId }, data: { paymentPaid: allPurchaseAllocs._sum.amountAllocated || 0 } });
    });
    res.json({ message: 'Allocated' });
  } catch (err) { next(err); }
};

export const updateOpeningBalance: import('express').RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const vendorId = parseInt(req.params.id);
    const { amount, date } = req.body;
      await assertFinancialPeriodOpen(userId, date || new Date());
    if (!await assertTenantOwnership(userId, 'vendors', vendorId)) return res.status(403).json({ error: 'Access denied' });
    await prisma.vendor.update({ where: { id: vendorId }, data: { openingBalance: amount, openingBalanceDate: date ? new Date(date) : null } });
    res.json({ message: 'Updated' });
  } catch (err) { next(err); }
};

export const getVendorLedger: import('express').RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const vendorId = parseInt(req.params.id);
    if (!await assertTenantOwnership(userId, 'vendors', vendorId)) return res.status(403).json({ error: 'Access denied' });
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    const purchases = await prisma.purchase.findMany({ where: { userId, vendorId, status: { not: 'CANCELLED' } } });
    const payments = await prisma.vendorPayment.findMany({ where: { userId, vendorId, status: { not: 'CANCELLED' } } });
    const returns = await prisma.purchaseReturn.findMany({ where: { userId, vendorId, status: 'FINALIZED' } });
    const entries: any[] = [];
    if (vendor && Number(vendor.openingBalance) > 0) entries.push({ date: vendor.openingBalanceDate || vendor.createdAt, reference: 'OPENING BALANCE', debit: 0, credit: Number(vendor.openingBalance), type: 'OPENING_BALANCE' });
    for (const purchase of purchases) entries.push({ date: purchase.billDate, reference: purchase.billNo, debit: 0, credit: Number(purchase.grandTotal), type: 'PURCHASE' });
    for (const payment of payments) entries.push({ date: payment.paymentDate, reference: payment.reference || `PAY-${payment.id}`, debit: Number(payment.amount), credit: 0, type: 'PAYMENT' });
    for (const ret of returns) entries.push({ date: ret.returnDate, reference: ret.debitNoteNo, debit: Number(ret.grandTotal), credit: 0, type: 'DEBIT_NOTE' });
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let balance = 0, debitTotal = 0, creditTotal = 0;
    for (const entry of entries) { debitTotal += entry.debit; creditTotal += entry.credit; balance += entry.credit - entry.debit; entry.balance = balance; }
    res.json({ entries, openingBalance: vendor ? Number(vendor.openingBalance) : 0, debitTotal, creditTotal, closingBalance: balance });
  } catch (err) { next(err); }
};

export const listVendorPayments: import('express').RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { vendorId, status, unallocatedOnly } = req.query;
    const where: any = { userId };
    if (vendorId) where.vendorId = parseInt(vendorId as string);
    if (status) where.status = status;
    if (unallocatedOnly === 'true') where.unallocated = { gt: 0 };
    const payments = await prisma.vendorPayment.findMany({ where, orderBy: { createdAt: 'desc' }, include: { vendor: true, allocations: true } });
    res.json(payments);
  } catch (err) { next(err); }
};

export const getVendorPayment: import('express').RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    const payment = await prisma.vendorPayment.findFirst({ where: { id, userId }, include: { vendor: true, allocations: { include: { purchase: true } } } });
    if (!payment) return res.status(404).json({ error: 'Not found' });
    res.json(payment);
  } catch (err) { next(err); }
};

export const getOutstanding: import('express').RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const totals = await prisma.purchase.aggregate({ where: { userId, status: 'ISSUED' }, _sum: { grandTotal: true, paymentPaid: true } });
    const advances = await prisma.vendorPayment.aggregate({ where: { userId, status: 'ACTIVE', unallocated: { gt: 0 } }, _sum: { unallocated: true } });
    const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
    const today = await prisma.vendorPayment.aggregate({ where: { userId, status: 'ACTIVE', paymentDate: { gte: startOfDay } }, _sum: { amount: true } });
    res.json({ totalOutstanding: Number(totals._sum.grandTotal || 0) - Number(totals._sum.paymentPaid || 0), unallocatedAdvances: Number(advances._sum.unallocated || 0), todayPayments: Number(today._sum.amount || 0) });
  } catch (err) { next(err); }
};
