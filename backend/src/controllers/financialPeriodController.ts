import { Request, Response, NextFunction } from 'express';
import { closeAccountingPeriod, reopenAccountingPeriod, closeFinancialYear, getFinancialYear } from '../services/financialPeriodService';
import { auditLog } from '../services/auditService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function listFinancialYears(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.user!.userId;
        const years = await prisma.financialYear.findMany({
            where: { userId },
            include: { accountingPeriods: { orderBy: { periodNumber: 'asc' } } },
            orderBy: { startDate: 'desc' }
        });
        res.json(years);
    } catch (err) { next(err); }
}

export async function closePeriodEndpoint(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.user!.userId;
        const periodId = parseInt(req.params.id);
        const adminId = req.user!.userId; // assuming `id` is the actual User table ID representing the staff/admin. Wait, userId is the tenant ID.

        const period = await closeAccountingPeriod(userId, periodId, adminId);
        await auditLog(userId, 'FINANCIAL_PERIOD_CLOSED', `Period #${periodId} closed.`, req);
        res.json(period);
    } catch (err) { next(err); }
}

export async function reopenPeriodEndpoint(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.user!.userId;
        const periodId = parseInt(req.params.id);

        if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
            return res.status(403).json({ error: 'Only admins can reopen periods.' });
        }

        const period = await reopenAccountingPeriod(userId, periodId);
        await auditLog(userId, 'FINANCIAL_PERIOD_REOPENED', `Period #${periodId} reopened.`, req);
        res.json(period);
    } catch (err) { next(err); }
}

export async function closeYearEndpoint(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.user!.userId;
        const yearId = parseInt(req.params.id);
        
        if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
            return res.status(403).json({ error: 'Only admins can close financial years.' });
        }

        const fy = await closeFinancialYear(userId, yearId);
        await auditLog(userId, 'FINANCIAL_YEAR_CLOSED', `Financial Year #${yearId} closed.`, req);
        res.json(fy);
    } catch (err) { next(err); }
}
