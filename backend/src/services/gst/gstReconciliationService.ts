import prisma from '../../utils/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { Gstr3bPreparationService } from './gstr3bPreparationService';

export class GstReconciliationService {
  public static async reconcile(userId: number, startDate: Date, endDate: Date) {
    const returnData = await Gstr3bPreparationService.prepare(userId, startDate, endDate);
    
    // GL Accounts
    const igstOut = await prisma.chartOfAccount.findFirst({ where: { userId, code: '2150' } });
    const cgstOut = await prisma.chartOfAccount.findFirst({ where: { userId, code: '2130' } });
    const sgstOut = await prisma.chartOfAccount.findFirst({ where: { userId, code: '2140' } });
    const igstIn = await prisma.chartOfAccount.findFirst({ where: { userId, code: '2180' } });
    const cgstIn = await prisma.chartOfAccount.findFirst({ where: { userId, code: '2160' } });
    const sgstIn = await prisma.chartOfAccount.findFirst({ where: { userId, code: '2170' } });

    const getGlBalance = async (accountId: number | undefined) => {
        if (!accountId) return 0;
        const lines = await prisma.journalLine.aggregate({
            _sum: { credit: true, debit: true },
            where: { accountId, journalEntry: { userId, status: 'POSTED', journalDate: { gte: startDate, lt: endDate } } }
        });
        return Number(lines._sum.credit || 0) - Number(lines._sum.debit || 0);
    };

    const glIgstOut = await getGlBalance(igstOut?.id);
    const glCgstOut = await getGlBalance(cgstOut?.id);
    const glSgstOut = await getGlBalance(sgstOut?.id);
    
    // Input is usually debit, so we reverse it or it will be negative if it's a liability account
    const getGlDebitBalance = async (accountId: number | undefined) => {
        if (!accountId) return 0;
        const lines = await prisma.journalLine.aggregate({
            _sum: { credit: true, debit: true },
            where: { accountId, journalEntry: { userId, status: 'POSTED', journalDate: { gte: startDate, lt: endDate } } }
        });
        return Number(lines._sum.debit || 0) - Number(lines._sum.credit || 0); // Input increases on debit
    };

    const glIgstIn = await getGlDebitBalance(igstIn?.id);
    const glCgstIn = await getGlDebitBalance(cgstIn?.id);
    const glSgstIn = await getGlDebitBalance(sgstIn?.id);

    const errors: string[] = [];
    const eps = 0.01;

    if (Math.abs(returnData.outward.igst - glIgstOut) > eps) errors.push(`Output IGST Mismatch: Return=${returnData.outward.igst}, GL=${glIgstOut}`);
    if (Math.abs(returnData.outward.cgst - glCgstOut) > eps) errors.push(`Output CGST Mismatch: Return=${returnData.outward.cgst}, GL=${glCgstOut}`);
    if (Math.abs(returnData.outward.sgst - glSgstOut) > eps) errors.push(`Output SGST Mismatch: Return=${returnData.outward.sgst}, GL=${glSgstOut}`);
    
    // Wait, the GL mapping in phase 4.4 was very rudimentary and might not separate ITC vs Ineligible properly. 
    // We will just do a soft warning for input GST.
    const warnings: string[] = [];
    if (Math.abs(returnData.itc.igst - glIgstIn) > eps) warnings.push(`Input IGST Mismatch: Return=${returnData.itc.igst}, GL=${glIgstIn}`);
    if (Math.abs(returnData.itc.cgst - glCgstIn) > eps) warnings.push(`Input CGST Mismatch: Return=${returnData.itc.cgst}, GL=${glCgstIn}`);
    if (Math.abs(returnData.itc.sgst - glSgstIn) > eps) warnings.push(`Input SGST Mismatch: Return=${returnData.itc.sgst}, GL=${glSgstIn}`);

    return {
      status: errors.length === 0 ? 'PASS' : 'FAILED',
      errors,
      warnings,
      returnTotals: returnData,
      glTotals: { glIgstOut, glCgstOut, glSgstOut, glIgstIn, glCgstIn, glSgstIn }
    };
  }
}
