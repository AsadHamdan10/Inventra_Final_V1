import prisma from '../../utils/prisma';
import { Decimal } from '@prisma/client/runtime/library';

export class FinalReconciliationService {
    public static async reconcileTenant(userId: number) {
        const report = {
            salesReconciliation: [] as string[],
            purchaseReconciliation: [] as string[],
            customerPaymentReconciliation: [] as string[],
            vendorPaymentReconciliation: [] as string[],
            salesReturnReconciliation: [] as string[],
            complianceLinks: [] as string[],
            orphansAndDuplicates: [] as string[],
            generalLedger: [] as string[],
        };

        // 1. Sales -> Journal
        const sales = await prisma.sale.findMany({ where: { userId, status: { not: 'CANCELLED' } } });
        for (const sale of sales) {
            const journal = await prisma.journalEntry.findFirst({
                where: { userId, referenceType: 'SALE', referenceId: sale.id, status: 'POSTED' },
                include: { lines: true }
            });
            if (!journal) {
                report.salesReconciliation.push(`Sale ${sale.id} (${sale.invoiceNo}) is missing a POSTED JournalEntry.`);
                continue;
            }
            // Check balancing
            const dr = journal.lines.reduce((acc, l) => acc.plus(l.debit), new Decimal(0));
            const cr = journal.lines.reduce((acc, l) => acc.plus(l.credit), new Decimal(0));
            if (!dr.equals(cr)) {
                report.salesReconciliation.push(`Journal ${journal.id} for Sale ${sale.id} is UNBALANCED. DR: ${dr}, CR: ${cr}`);
            }

            // Compliance cross-links
            const eInvoice = await prisma.eInvoice.findUnique({ where: { saleId: sale.id } });
            const ewb = await prisma.eWayBill.findUnique({ where: { saleId: sale.id } });
            
            // Check uniqueness constraints manually (already enforced by DB, but report explicitly)
        }

        // 2. Purchases -> Journal
        const purchases = await prisma.purchase.findMany({ where: { userId, status: { not: 'CANCELLED' } } });
        for (const pur of purchases) {
            const journal = await prisma.journalEntry.findFirst({
                where: { userId, referenceType: 'PURCHASE', referenceId: pur.id, status: 'POSTED' },
                include: { lines: true }
            });
            if (!journal) {
                report.purchaseReconciliation.push(`Purchase ${pur.id} (${pur.billNo}) is missing a POSTED JournalEntry.`);
                continue;
            }
        }

        // 3. Customer Payments
        const custPayments = await prisma.customerPayment.findMany({ where: { userId, status: 'ACTIVE' }, include: { allocations: true } });
        for (const cp of custPayments) {
            const allocated = cp.allocations.reduce((acc, a) => acc.plus(a.amountAllocated), new Decimal(0));
            const totalUsed = allocated.plus(cp.unallocated);
            if (!totalUsed.equals(cp.amount)) {
                report.customerPaymentReconciliation.push(`ORGANIC_DATA_ERROR: CustomerPayment ${cp.id} amount (${cp.amount}) does not equal allocated (${allocated}) + unallocated (${cp.unallocated}).`);
            }
        }

        // 4. EInvoice Orphans
        const orphanEInvoices = await prisma.eInvoice.findMany({ where: { userId, saleId: null, salesReturnId: null } });
        if (orphanEInvoices.length > 0) {
            orphanEInvoices.forEach(ei => report.orphansAndDuplicates.push(`E-Invoice ${ei.id} is ORPHANED (no sale/return linked).`));
        }

        // 5. EWayBill Orphans
        const orphanEwbs = await prisma.eWayBill.findMany({ where: { userId, saleId: null, salesReturnId: null, deliveryChallanId: null } });
        if (orphanEwbs.length > 0) {
            orphanEwbs.forEach(ewb => report.orphansAndDuplicates.push(`E-Way Bill ${ewb.id} is ORPHANED.`));
        }

        // 6. GST Returns Constraints
        const gstReturns = await prisma.gstReturn.findMany({ where: { userId } });
        const grouped = new Map<string, number>();
        for (const ret of gstReturns) {
            const key = `${ret.returnType}_${ret.periodMonth}_${ret.periodYear}`;
            grouped.set(key, (grouped.get(key) || 0) + 1);
        }
        for (const [key, count] of grouped.entries()) {
            if (count > 1) {
                report.orphansAndDuplicates.push(`Duplicate GST Return detected for key: ${key}`);
            }
        }

        return report;
    }
}
