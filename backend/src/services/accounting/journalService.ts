import prisma from '../../utils/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { auditLog } from '../auditService';
import { assertFinancialPeriodOpen } from '../financialPeriodService';
import { generateDocumentNumber } from '../../utils/tenantId';
import { randomUUID } from 'crypto';

interface JournalLineInput {
  accountId: number;
  description?: string;
  debit: string | number | Decimal;
  credit: string | number | Decimal;
}

interface JournalInput {
  journalDate: Date | string;
  description?: string;
  referenceType?: string;
  referenceId?: number;
  lines: JournalLineInput[];
}

export async function createDraftJournal(userId: number, data: JournalInput, reqUserId: number, txClient?: any, options?: { bypassPeriodCheck?: boolean }) {
  const db = txClient || prisma;
  const { journalDate, description, referenceType, referenceId, lines } = data;
  
  const parsedDate = new Date(journalDate);
  if (isNaN(parsedDate.getTime())) throw new Error('Invalid journal date');

  validateJournalLines(lines);

  const { totalDebit, totalCredit } = calculateTotals(lines);

  await validateAccounts(userId, lines.map(l => l.accountId), db);

  const draftNo = `DRAFT-${Date.now()}-${randomUUID().slice(0, 8)}`;

  const entry = await db.journalEntry.create({
    data: {
      userId,
      journalNo: draftNo,
      journalDate: parsedDate,
      description,
      referenceType,
      referenceId,
      status: 'DRAFT',
      totalDebit,
      totalCredit,
      lines: {
        create: lines.map((l, i) => ({
          userId,
          accountId: l.accountId,
          description: l.description,
          debit: new Decimal(l.debit || 0),
          credit: new Decimal(l.credit || 0),
          lineOrder: i
        }))
      }
    },
    include: { lines: true }
  });

  await db.auditLog.create({
      data: { userId: reqUserId, action: 'JOURNAL_CREATED', details: `Draft journal created` }
  });
  
  return entry;
}

export async function updateDraftJournal(userId: number, id: number, data: JournalInput, reqUserId: number, txClient?: any) {
  const db = txClient || prisma;
  const { journalDate, description, referenceType, referenceId, lines } = data;

  const entry = await db.journalEntry.findFirst({ where: { id, userId } });
  if (!entry) throw new Error('Journal not found');
  if (entry.status !== 'DRAFT') throw new Error('Only DRAFT journals can be updated');

  const parsedDate = new Date(journalDate);
  if (isNaN(parsedDate.getTime())) throw new Error('Invalid journal date');

  validateJournalLines(lines);
  const { totalDebit, totalCredit } = calculateTotals(lines);

  await validateAccounts(userId, lines.map(l => l.accountId), db);

  const performOp = async (tx: any) => {
    await tx.journalLine.deleteMany({ where: { journalEntryId: id } });

    const updated = await tx.journalEntry.update({
      where: { id },
      data: {
        journalDate: parsedDate,
        description,
        referenceType,
        referenceId,
        totalDebit,
        totalCredit,
        lines: {
          create: lines.map((l, i) => ({
            userId,
            accountId: l.accountId,
            description: l.description,
            debit: new Decimal(l.debit || 0),
            credit: new Decimal(l.credit || 0),
            lineOrder: i
          }))
        }
      },
      include: { lines: true }
    });

    await tx.auditLog.create({
        data: { userId: reqUserId, action: 'JOURNAL_UPDATED', details: `Draft journal updated` }
    });
    return updated;
  };

  return txClient ? performOp(txClient) : prisma.$transaction(performOp);
}

export async function getJournal(userId: number, id: number, txClient?: any) {
  const db = txClient || prisma;
  return db.journalEntry.findFirst({
    where: { id, userId },
    include: { lines: { include: { account: true }, orderBy: { lineOrder: 'asc' } } }
  });
}

export async function listJournals(userId: number, fyContext?: { startDate: Date; endDate: Date }) {
  const where: any = { userId };
  if (fyContext) {
    where.journalDate = {
      gte: fyContext.startDate,
      lt: fyContext.endDate
    };
  }
  return prisma.journalEntry.findMany({
    where,
    orderBy: { journalDate: 'desc' },
    include: { lines: { include: { account: true } } }
  });
}

export async function postJournal(userId: number, id: number, reqUserId: number, txClient?: any, options?: { bypassPeriodCheck?: boolean }) {
  const performOp = async (tx: any) => {
    const [entry] = await tx.$queryRawUnsafe(`SELECT * FROM journal_entries WHERE id = ${id} AND user_id = ${userId} FOR UPDATE`);
    
    if (!entry) throw new Error('JOURNAL_NOT_FOUND');
    if (entry.status === 'POSTED') return { message: 'JOURNAL_ALREADY_POSTED', status: 'POSTED', journalNo: entry.journal_no };
    if (entry.status !== 'DRAFT') throw new Error('Invalid status for posting');

    const lines = await tx.journalLine.findMany({ where: { journalEntryId: id }, orderBy: { lineOrder: 'asc' } });
    if (lines.length < 2) throw new Error('Journal must have at least 2 lines');

    await assertFinancialPeriodOpen(userId, entry.journal_date, tx);

    const accountIds = lines.map((l: any) => l.accountId);
    const accounts = await tx.$queryRawUnsafe(`SELECT id, user_id, is_active FROM chart_of_accounts WHERE id IN (${accountIds.join(',')}) FOR SHARE`);
    
    if (accounts.length !== new Set(accountIds).size) throw new Error('ACCOUNT_NOT_FOUND');
    
    for (const acc of accounts) {
      if (acc.user_id !== userId) throw new Error('ACCOUNT_TENANT_MISMATCH');
      if (!acc.is_active) throw new Error('ACCOUNT_INACTIVE');
    }

    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);
    
    for (const line of lines) {
        totalDebit = totalDebit.plus(new Decimal(line.debit));
        totalCredit = totalCredit.plus(new Decimal(line.credit));
    }

    if (!totalDebit.equals(totalCredit)) {
        throw new Error(`JOURNAL_NOT_BALANCED`);
    }

    const journalNo = await generateDocumentNumber('JRN', userId, entry.journal_date, tx);

    const posted = await tx.journalEntry.update({
      where: { id },
      data: {
        status: 'POSTED',
        journalNo,
        totalDebit,
        totalCredit,
        postedAt: new Date(),
        postedBy: reqUserId
      },
      include: { lines: true }
    });

    await tx.auditLog.create({
        data: { userId: reqUserId, action: 'JOURNAL_POSTED', details: `Posted journal ${journalNo}` }
    });

    return posted;
  };

  return txClient ? performOp(txClient) : prisma.$transaction(performOp);
}

export async function cancelJournal(userId: number, id: number, reqUserId: number, txClient?: any) {
  const performOp = async (tx: any) => {
    const [entry] = await tx.$queryRawUnsafe(`SELECT * FROM journal_entries WHERE id = ${id} AND user_id = ${userId} FOR UPDATE`);
    
    if (!entry) throw new Error('JOURNAL_NOT_FOUND');
    if (entry.status === 'CANCELLED') return { message: 'JOURNAL_ALREADY_CANCELLED', status: 'CANCELLED' };
    if (entry.status !== 'POSTED') throw new Error('Only POSTED journals can be cancelled');

    await assertFinancialPeriodOpen(userId, entry.journal_date, tx);

    const cancelled = await tx.journalEntry.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: reqUserId
      }
    });

    await tx.auditLog.create({
        data: { userId: reqUserId, action: 'JOURNAL_CANCELLED', details: `Cancelled journal ${entry.journal_no}` }
    });

    return cancelled;
  };

  return txClient ? performOp(txClient) : prisma.$transaction(performOp);
}

function validateJournalLines(lines: JournalLineInput[]) {
  if (!lines || lines.length < 2) throw new Error('At least 2 lines required');
  
  for (const line of lines) {
    const debit = new Decimal(line.debit || 0);
    const credit = new Decimal(line.credit || 0);
    
    if (debit.isNegative()) throw new Error('Negative debit rejected');
    if (credit.isNegative()) throw new Error('Negative credit rejected');
    
    if (debit.isZero() && credit.isZero()) throw new Error('Zero-value line rejected');
    if (!debit.isZero() && !credit.isZero()) throw new Error('Debit and credit on same line rejected');
  }
}

function calculateTotals(lines: JournalLineInput[]) {
  let totalDebit = new Decimal(0);
  let totalCredit = new Decimal(0);
  for (const line of lines) {
    totalDebit = totalDebit.plus(new Decimal(line.debit || 0));
    totalCredit = totalCredit.plus(new Decimal(line.credit || 0));
  }
  return { totalDebit, totalCredit };
}

async function validateAccounts(userId: number, accountIds: number[], db: any) {
  const accounts = await db.chartOfAccount.findMany({
    where: { id: { in: accountIds } }
  });
  if (accounts.length !== new Set(accountIds).size) throw new Error('ACCOUNT_NOT_FOUND');
  for (const acc of accounts) {
    if (acc.userId !== userId) throw new Error('ACCOUNT_TENANT_MISMATCH');
    if (!acc.isActive) throw new Error('ACCOUNT_INACTIVE');
  }
}
