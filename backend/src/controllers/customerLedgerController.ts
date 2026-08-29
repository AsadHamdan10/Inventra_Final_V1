import { postCustomerPaymentAccounting, cancelCustomerPaymentAccounting } from '../services/accounting/accountingIntegrationService';
import { assertFinancialPeriodOpen } from '../services/financialPeriodService';
import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { assertTenantOwnership } from '../middlewares/auth';

export const addCustomerPayment: import('express').RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const parsed = req.body;
    const { customerId, amount, paymentDate, mode, reference, notes, allocations } = parsed;
      await assertFinancialPeriodOpen(userId, paymentDate || new Date());
    if (!await assertTenantOwnership(userId, 'customers', customerId)) return res.status(403).json({ error: 'Access denied.' });
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.customerPayment.create({
        data: { userId, customerId, amount, unallocated: amount, paymentDate: new Date(paymentDate), mode: mode || 'Cash', reference, notes, status: 'ACTIVE' }
      });
      if (allocations && Array.isArray(allocations)) {
        let allocatedTotal = 0;
        for (const alloc of allocations) {
          allocatedTotal += alloc.amount;
          const sale = await tx.$queryRaw<any[]>`SELECT * FROM sales WHERE id = ${alloc.saleId} AND user_id = ${userId} AND customer_id = ${customerId} FOR UPDATE`;
          if (sale.length === 0) throw new Error('Sale not found');
          await tx.customerPaymentAllocation.create({ data: { userId, paymentId: payment.id, saleId: alloc.saleId, amountAllocated: alloc.amount } });
          const existingAllocs = await tx.customerPaymentAllocation.aggregate({ where: { saleId: alloc.saleId, customerPayment: { status: 'ACTIVE' } }, _sum: { amountAllocated: true } });
          await tx.sale.update({ where: { id: alloc.saleId }, data: { paymentReceived: existingAllocs._sum.amountAllocated || 0 } });
        }
        if (allocatedTotal > amount) throw new Error('Allocations exceed amount');
        await tx.customerPayment.update({ where: { id: payment.id }, data: { unallocated: amount - allocatedTotal } });
      }
      return payment;
    });
    res.status(201).json(result);
  } catch (err) { next(err); }
};

export const cancelCustomerPayment: import('express').RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const paymentId = parseInt(req.params.id);
    await prisma.$transaction(async (tx) => {
      const payment = await tx.$queryRaw<any[]>`SELECT * FROM customer_payments WHERE id = ${paymentId} AND user_id = ${userId} FOR UPDATE`;
      if (payment.length === 0) throw new Error('Not found');
      if (payment[0].status === 'CANCELLED') throw new Error('Already cancelled');
      await tx.customerPayment.update({ where: { id: paymentId }, data: { status: 'CANCELLED', unallocated: payment[0].amount } });
      const allocs = await tx.customerPaymentAllocation.findMany({ where: { paymentId } });
      await tx.customerPaymentAllocation.deleteMany({ where: { paymentId } });
      for (const alloc of allocs) {
        const existingAllocs = await tx.customerPaymentAllocation.aggregate({ where: { saleId: alloc.saleId, customerPayment: { status: 'ACTIVE' } }, _sum: { amountAllocated: true } });
        await tx.sale.update({ where: { id: alloc.saleId }, data: { paymentReceived: existingAllocs._sum.amountAllocated || 0 } });
      }
    });
    res.json({ message: 'Cancelled' });
  } catch (err) { next(err); }
};

export const allocateCustomerPayment: import('express').RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const paymentId = parseInt(req.params.id);
    const { saleId, amount } = req.body;
    await prisma.$transaction(async (tx) => {
      const payment = await tx.$queryRaw<any[]>`SELECT * FROM customer_payments WHERE id = ${paymentId} AND user_id = ${userId} FOR UPDATE`;
      if (payment.length === 0) throw new Error('Not found');
      await tx.customerPaymentAllocation.create({ data: { userId, paymentId, saleId, amountAllocated: amount } });
      const newAllocs = await tx.customerPaymentAllocation.aggregate({ where: { paymentId, customerPayment: { status: 'ACTIVE' } }, _sum: { amountAllocated: true } });
      const newUnallocated = Number(payment[0].amount) - Number(newAllocs._sum.amountAllocated || 0);
      await tx.customerPayment.update({ where: { id: paymentId }, data: { unallocated: newUnallocated } });
      const allSaleAllocs = await tx.customerPaymentAllocation.aggregate({ where: { saleId, customerPayment: { status: 'ACTIVE' } }, _sum: { amountAllocated: true } });
      await tx.sale.update({ where: { id: saleId }, data: { paymentReceived: allSaleAllocs._sum.amountAllocated || 0 } });
    });
    res.json({ message: 'Allocated' });
  } catch (err) { next(err); }
};

export const updateOpeningBalance: import('express').RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const customerId = parseInt(req.params.id);
    const { amount, date } = req.body;
      await assertFinancialPeriodOpen(userId, date || new Date());
    if (!await assertTenantOwnership(userId, 'customers', customerId)) return res.status(403).json({ error: 'Access denied' });
    await prisma.customer.update({ where: { id: customerId }, data: { openingBalance: amount, openingBalanceDate: date ? new Date(date) : null } });
    res.json({ message: 'Updated' });
  } catch (err) { next(err); }
};

export const getCustomerLedger: import('express').RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const customerId = parseInt(req.params.id);
    if (!await assertTenantOwnership(userId, 'customers', customerId)) return res.status(403).json({ error: 'Access denied' });
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    const sales = await prisma.sale.findMany({ where: { userId, customerId, status: { not: 'CANCELLED' } } });
    const payments = await prisma.customerPayment.findMany({ where: { userId, customerId, status: { not: 'CANCELLED' } } });
    const returns = await prisma.salesReturn.findMany({ where: { userId, customerId, status: 'FINALIZED' } });
    const entries: any[] = [];
    if (customer && Number(customer.openingBalance) > 0) entries.push({ date: customer.openingBalanceDate || customer.createdAt, reference: 'OPENING BALANCE', debit: Number(customer.openingBalance), credit: 0, type: 'OPENING_BALANCE' });
    for (const sale of sales) entries.push({ date: sale.invoiceDate, reference: sale.invoiceNo, debit: Number(sale.grandTotal), credit: 0, type: 'SALE' });
    for (const payment of payments) entries.push({ date: payment.paymentDate, reference: payment.reference || `PAY-${payment.id}`, debit: 0, credit: Number(payment.amount), type: 'RECEIPT' });
    for (const ret of returns) entries.push({ date: ret.returnDate, reference: ret.creditNoteNo, debit: 0, credit: Number(ret.grandTotal), type: 'CREDIT_NOTE' });
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let balance = 0, debitTotal = 0, creditTotal = 0;
    for (const entry of entries) { debitTotal += entry.debit; creditTotal += entry.credit; balance += entry.debit - entry.credit; entry.balance = balance; }
    res.json({ entries, openingBalance: customer ? Number(customer.openingBalance) : 0, debitTotal, creditTotal, closingBalance: balance });
  } catch (err) { next(err); }
};

export const listCustomerPayments: import('express').RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { customerId, status, unallocatedOnly } = req.query;
    const where: any = { userId };
    if (customerId) where.customerId = parseInt(customerId as string);
    if (status) where.status = status;
    if (unallocatedOnly === 'true') where.unallocated = { gt: 0 };
    const payments = await prisma.customerPayment.findMany({ where, orderBy: { createdAt: 'desc' }, include: { customer: true, allocations: true } });
    res.json(payments);
  } catch (err) { next(err); }
};

export const getCustomerPayment: import('express').RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id);
    const payment = await prisma.customerPayment.findFirst({ where: { id, userId }, include: { customer: true, allocations: { include: { sale: true } } } });
    if (!payment) return res.status(404).json({ error: 'Not found' });
    res.json(payment);
  } catch (err) { next(err); }
};

export const getOutstanding: import('express').RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const totals = await prisma.sale.aggregate({ where: { userId, status: 'ISSUED' }, _sum: { grandTotal: true, paymentReceived: true } });
    const advances = await prisma.customerPayment.aggregate({ where: { userId, status: 'ACTIVE', unallocated: { gt: 0 } }, _sum: { unallocated: true } });
    const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
    const today = await prisma.customerPayment.aggregate({ where: { userId, status: 'ACTIVE', paymentDate: { gte: startOfDay } }, _sum: { amount: true } });
    res.json({ totalOutstanding: Number(totals._sum.grandTotal || 0) - Number(totals._sum.paymentReceived || 0), unallocatedAdvances: Number(advances._sum.unallocated || 0), todayPayments: Number(today._sum.amount || 0) });
  } catch (err) { next(err); }
};
