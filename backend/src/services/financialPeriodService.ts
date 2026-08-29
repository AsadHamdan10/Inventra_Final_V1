import { PrismaClient, PeriodStatus } from '@prisma/client';

const prisma = new PrismaClient();

export async function getFinancialYear(userId: number, targetDate: Date) {
    return prisma.financialYear.findFirst({
        where: {
            userId,
            startDate: { lte: targetDate },
            endDate: { gt: targetDate }
        }
    });
}

export async function getFinancialPeriod(userId: number, targetDate: Date) {
    const periods = await prisma.accountingPeriod.findMany({
        where: {
            userId,
            startDate: { lte: targetDate },
            endDate: { gt: targetDate }
        }
    });
    if (periods.length === 1) return periods[0];
    return null;
}

export class FinancialPeriodError extends Error {
    constructor(message: string, public code: string) {
        super(message);
        this.name = 'FinancialPeriodError';
    }
}

export async function assertFinancialPeriodOpen(userId: number, targetDate: Date | string, customPrismaClient?: any) {
    const db = customPrismaClient || prisma;
    const dateObj = new Date(targetDate);
    
    const fys = await db.financialYear.findMany({
        where: {
            userId,
            startDate: { lte: dateObj },
            endDate: { gt: dateObj }
        }
    });
    
    if (fys.length === 0) {
        throw new FinancialPeriodError('Transaction date is outside any configured Financial Year.', 'FINANCIAL_YEAR_NOT_FOUND');
    }
    if (fys.length > 1) {
        throw new FinancialPeriodError('Configuration error: Multiple Financial Years cover this transaction date.', 'FINANCIAL_YEAR_OVERLAP');
    }

    const periods = await db.accountingPeriod.findMany({
        where: {
            userId,
            startDate: { lte: dateObj },
            endDate: { gt: dateObj }
        }
    });

    if (periods.length === 0) {
        throw new FinancialPeriodError('No accounting period covers this transaction date.', 'FINANCIAL_PERIOD_NOT_FOUND');
    }
    if (periods.length > 1) {
        throw new FinancialPeriodError('Configuration error: Multiple accounting periods cover this transaction date.', 'FINANCIAL_PERIOD_OVERLAP');
    }
    
    const period = periods[0];

    if (period.status === 'CLOSED') {
        throw new FinancialPeriodError('Financial period is closed for this transaction date.', 'FINANCIAL_PERIOD_CLOSED');
    }

    const { assertGstPeriodOpen, GstReturnLockedError } = require('./gst/gstPeriodLockService');
    try {
        await assertGstPeriodOpen(userId, dateObj, db);
    } catch (e: any) {
        if (e.name === 'GstReturnLockedError') {
            throw new FinancialPeriodError(e.message, 'GST_RETURN_LOCKED');
        }
        throw e;
    }

    return period;
}

export async function getCurrentFinancialYear(userId: number) {
    const today = new Date();
    return getFinancialYear(userId, today);
}

export async function closeAccountingPeriod(userId: number, periodId: number, adminId: number) {
    const period = await prisma.accountingPeriod.findUnique({ where: { id: periodId } });
    if (!period || period.userId !== userId) throw new Error('NOT_FOUND');
    if (period.status === 'CLOSED') return period;

    return prisma.accountingPeriod.update({
        where: { id: periodId },
        data: {
            status: 'CLOSED',
            closedAt: new Date(),
            closedBy: adminId
        }
    });
}

export async function reopenAccountingPeriod(userId: number, periodId: number) {
    const period = await prisma.accountingPeriod.findUnique({ where: { id: periodId } });
    if (!period || period.userId !== userId) throw new Error('NOT_FOUND');
    if (period.status === 'OPEN') return period;

    return prisma.accountingPeriod.update({
        where: { id: periodId },
        data: {
            status: 'OPEN',
            closedAt: null,
            closedBy: null
        }
    });
}

export async function closeFinancialYear(userId: number, financialYearId: number) {
    const fy = await prisma.financialYear.findUnique({ where: { id: financialYearId } });
    if (!fy || fy.userId !== userId) throw new Error('NOT_FOUND');
    if (fy.status === 'CLOSED') return fy;

    const openPeriods = await prisma.accountingPeriod.count({
        where: { financialYearId, status: 'OPEN' }
    });
    if (openPeriods > 0) {
        throw new Error('Cannot close Financial Year while accounting periods are still OPEN.');
    }

    return prisma.financialYear.update({
        where: { id: financialYearId },
        data: { status: 'CLOSED' }
    });
}
