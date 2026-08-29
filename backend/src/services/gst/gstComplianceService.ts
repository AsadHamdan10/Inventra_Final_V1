import prisma from '../../utils/prisma';
import { Decimal } from '@prisma/client/runtime/library';

async function getFYRange(userId: number, financialYearId?: number) {
    if (!financialYearId) return { startDate: new Date(0), endDate: new Date('9999-12-31') };
    const fy = await prisma.financialYear.findUnique({ where: { id: financialYearId } });
    if (!fy || fy.userId !== userId) throw new Error('Invalid Financial Year');
    return { startDate: fy.startDate, endDate: fy.endDate };
}

export function validateGSTINState(gstin: string | null | undefined): 'VALID' | 'INVALID' | 'MISSING' {
    if (!gstin) return 'MISSING';
    const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/;
    if (gstin.length === 15 && regex.test(gstin)) return 'VALID';
    // Let's also accept anything that is 15 chars and starts with 2 digits as a weaker fallback if regex fails
    if (gstin.length === 15 && /^[0-9]{2}/.test(gstin)) return 'VALID';
    return 'INVALID';
}

function classifySupply(tenantGstin: string | null | undefined, customerGstin: string | null | undefined): 'INTER_STATE' | 'INTRA_STATE' | 'UNKNOWN' {
    if (!tenantGstin || !customerGstin || tenantGstin.length < 2 || customerGstin.length < 2) return 'UNKNOWN';
    const tState = tenantGstin.substring(0, 2);
    const cState = customerGstin.substring(0, 2);
    return tState === cState ? 'INTRA_STATE' : 'INTER_STATE';
}

function determineB2B(gstin: string | null | undefined) {
    const status = validateGSTINState(gstin);
    return status === 'VALID' ? 'B2B' : 'B2C';
}

export async function getOutwardSupplyRegister(userId: number, financialYearId?: number) {
    const { startDate, endDate } = await getFYRange(userId, financialYearId);
    
    // Get company profile for tenant state code
    const profile = await prisma.user.findUnique({ where: { id: userId } });
    const tenantGstin = profile?.gstin || null;

    const sales = await prisma.sale.findMany({
        where: { userId, status: { not: 'CANCELLED' }, invoiceDate: { gte: startDate, lte: endDate } },
        include: { items: true }
    });

    return sales.map(s => {
        const classification = classifySupply(tenantGstin, s.companyGstin);
        return {
            id: s.id,
            invoiceNo: s.invoiceNo,
            invoiceDate: s.invoiceDate,
            customerId: s.customerId,
            customerName: s.companyName,
            customerGSTIN: s.companyGstin,
            placeOfSupply: s.companyGstin ? s.companyGstin.substring(0, 2) : 'UNKNOWN',
            supplyType: classification,
            b2bType: determineB2B(s.companyGstin),
            taxableValue: s.totalTaxable,
            igst: s.igstAmount,
            cgst: s.cgstAmount,
            sgst: s.sgstAmount,
            totalGST: s.totalGst,
            grandTotal: s.grandTotal,
            referenceId: s.id,
            financialYearId
        };
    });
}
export async function getCreditNoteRegister(userId: number, financialYearId?: number) {
    const { startDate, endDate } = await getFYRange(userId, financialYearId);
    
    const returns = await prisma.salesReturn.findMany({
        where: { userId, status: { not: 'CANCELLED' }, returnDate: { gte: startDate, lte: endDate } },
        include: { sale: true }
    });

    return returns.map(r => ({
        id: r.id,
        creditNoteNo: r.creditNoteNo,
        returnDate: r.returnDate,
        originalInvoiceNo: r.sale.invoiceNo,
        originalSaleId: r.saleId,
        customerName: r.sale.companyName,
        customerGSTIN: r.sale.companyGstin,
        b2bType: determineB2B(r.sale.companyGstin),
        taxableValue: r.totalTaxable,
        igst: r.igstAmount,
        cgst: r.cgstAmount,
        sgst: r.sgstAmount,
        totalGST: r.totalGst,
        grandTotal: r.grandTotal,
        status: r.status
    }));
}

export async function getHSNSummary(userId: number, financialYearId?: number) {
    const { startDate, endDate } = await getFYRange(userId, financialYearId);
    
    // Aggregate from SaleItem directly because prisma does not support group by across relations easily, 
    // we'll fetch items and group in memory to avoid N+1 and keep it simple.
    const items = await prisma.saleItem.findMany({
        where: {
            sale: { userId, status: { not: 'CANCELLED' }, invoiceDate: { gte: startDate, lte: endDate } }
        },
        include: { sale: true }
    });

    const hsnMap = new Map<string, any>();
    
    for (const item of items) {
        const code = item.hsnCode || 'UNSPECIFIED';
        if (!hsnMap.has(code)) {
            hsnMap.set(code, {
                hsnSac: code,
                description: 'N/A',
                quantity: new Decimal(0),
                taxableValue: new Decimal(0),
                igst: new Decimal(0),
                cgst: new Decimal(0),
                sgst: new Decimal(0),
                totalGST: new Decimal(0),
                invoiceSet: new Set()
            });
        }
        const data = hsnMap.get(code);
        data.quantity = data.quantity.plus(new Decimal(item.quantity));
        data.taxableValue = data.taxableValue.plus(new Decimal(item.taxableAmount));
        // Approximate tax split based on sale's tax proportion or from item if available.
        // The schema doesn't split item tax into igst/cgst/sgst, it only has gstAmount.
        // We will do a proportional allocation based on the parent sale's IGST/CGST/SGST ratios.
        const itemGST = new Decimal(item.gstAmount);
        const saleTotalGST = new Decimal(item.sale.totalGst);
        if (saleTotalGST.gt(0)) {
            const igstRatio = new Decimal(item.sale.igstAmount).dividedBy(saleTotalGST);
            const cgstRatio = new Decimal(item.sale.cgstAmount).dividedBy(saleTotalGST);
            const sgstRatio = new Decimal(item.sale.sgstAmount).dividedBy(saleTotalGST);
            data.igst = data.igst.plus(itemGST.times(igstRatio));
            data.cgst = data.cgst.plus(itemGST.times(cgstRatio));
            data.sgst = data.sgst.plus(itemGST.times(sgstRatio));
        }
        data.totalGST = data.totalGST.plus(itemGST);
        data.invoiceSet.add(item.saleId);
    }

    return Array.from(hsnMap.values()).map(d => ({
        ...d,
        invoices: d.invoiceSet.size,
        invoiceSet: undefined // drop set
    }));
}

export async function getGSTSummary(userId: number, financialYearId?: number) {
    const outward = await getOutwardSupplyRegister(userId, financialYearId);
    const returns = await getCreditNoteRegister(userId, financialYearId);

    const grossTaxable = outward.reduce((sum, s) => sum.plus(new Decimal(s.taxableValue)), new Decimal(0));
    const grossIgst = outward.reduce((sum, s) => sum.plus(new Decimal(s.igst)), new Decimal(0));
    const grossCgst = outward.reduce((sum, s) => sum.plus(new Decimal(s.cgst)), new Decimal(0));
    const grossSgst = outward.reduce((sum, s) => sum.plus(new Decimal(s.sgst)), new Decimal(0));
    
    const cnTaxable = returns.reduce((sum, s) => sum.plus(new Decimal(s.taxableValue)), new Decimal(0));
    const cnIgst = returns.reduce((sum, s) => sum.plus(new Decimal(s.igst)), new Decimal(0));
    const cnCgst = returns.reduce((sum, s) => sum.plus(new Decimal(s.cgst)), new Decimal(0));
    const cnSgst = returns.reduce((sum, s) => sum.plus(new Decimal(s.sgst)), new Decimal(0));

    return {
        outputGST: {
            igst: grossIgst.minus(cnIgst),
            cgst: grossCgst.minus(cnCgst),
            sgst: grossSgst.minus(cnSgst),
            total: grossIgst.plus(grossCgst).plus(grossSgst).minus(cnIgst).minus(cnCgst).minus(cnSgst)
        },
        netOutwardSupply: {
            grossTaxableSales: grossTaxable,
            creditNotes: cnTaxable,
            netTaxableSales: grossTaxable.minus(cnTaxable)
        }
    };
}
export async function getGSTR1Dataset(userId: number, financialYearId?: number) {
    const outward = await getOutwardSupplyRegister(userId, financialYearId);
    const returns = await getCreditNoteRegister(userId, financialYearId);
    const hsn = await getHSNSummary(userId, financialYearId);

    return {
        b2b: outward.filter(s => s.b2bType === 'B2B'),
        b2c: outward.filter(s => s.b2bType === 'B2C'),
        creditNotes: returns,
        hsnSummary: hsn,
        limitations: [
            "Customer type attribution is based on GSTIN presence.",
            "Government return fields such as e-invoice hash are not included in this internal dataset."
        ]
    };
}

export async function getGSTR3BSummary(userId: number, financialYearId?: number) {
    const summary = await getGSTSummary(userId, financialYearId);
    return {
        outwardSupplies: summary.netOutwardSupply,
        creditNotes: {
            taxableReduction: summary.netOutwardSupply.creditNotes,
            // we'll send it back from the summary
        },
        netOutputTax: summary.outputGST,
        limitations: [
            "Input GST (ITC) is not reconciled in this phase.",
            "GSTR-3B must be prepared using additional ITC data."
        ]
    };
}

export async function reconcileGSTWithGL(userId: number, financialYearId?: number) {
    const { startDate, endDate } = await getFYRange(userId, financialYearId);
    const outward = await getOutwardSupplyRegister(userId, financialYearId);
    const returns = await getCreditNoteRegister(userId, financialYearId);

    const txIgst = outward.reduce((sum, s) => sum.plus(new Decimal(s.igst)), new Decimal(0)).minus(
        returns.reduce((sum, s) => sum.plus(new Decimal(s.igst)), new Decimal(0))
    );
    const txCgst = outward.reduce((sum, s) => sum.plus(new Decimal(s.cgst)), new Decimal(0)).minus(
        returns.reduce((sum, s) => sum.plus(new Decimal(s.cgst)), new Decimal(0))
    );
    const txSgst = outward.reduce((sum, s) => sum.plus(new Decimal(s.sgst)), new Decimal(0)).minus(
        returns.reduce((sum, s) => sum.plus(new Decimal(s.sgst)), new Decimal(0))
    );

    // Assume generic GST codes. Phase 4.4A created: Output IGST 2150, CGST 2160, SGST 2170
    const glIgstAcc = await prisma.chartOfAccount.findFirst({ where: { userId, code: '2150' } });
    const glCgstAcc = await prisma.chartOfAccount.findFirst({ where: { userId, code: '2160' } });
    const glSgstAcc = await prisma.chartOfAccount.findFirst({ where: { userId, code: '2170' } });

    async function getGlNet(accId?: number) {
        if (!accId) return new Decimal(0);
        const lines = await prisma.journalLine.aggregate({
            _sum: { credit: true, debit: true },
            where: { accountId: accId, journalEntry: { userId, status: 'POSTED', journalDate: { gte: startDate, lte: endDate } } }
        });
        return new Decimal(lines._sum.credit || 0).minus(new Decimal(lines._sum.debit || 0));
    }

    const glIgst = await getGlNet(glIgstAcc?.id);
    const glCgst = await getGlNet(glCgstAcc?.id);
    const glSgst = await getGlNet(glSgstAcc?.id);

    return {
        igst: { transactionAmount: txIgst, journalAmount: glIgst, difference: txIgst.minus(glIgst), status: txIgst.equals(glIgst) ? 'MATCHED' : 'GL_GST_MISMATCH' },
        cgst: { transactionAmount: txCgst, journalAmount: glCgst, difference: txCgst.minus(glCgst), status: txCgst.equals(glCgst) ? 'MATCHED' : 'GL_GST_MISMATCH' },
        sgst: { transactionAmount: txSgst, journalAmount: glSgst, difference: txSgst.minus(glSgst), status: txSgst.equals(glSgst) ? 'MATCHED' : 'GL_GST_MISMATCH' },
    };
}

export async function getWarnings(userId: number, financialYearId?: number) {
    const outward = await getOutwardSupplyRegister(userId, financialYearId);
    const profile = await prisma.user.findUnique({ where: { id: userId } });
    const tenantGstin = profile?.gstin || null;

    const warnings: string[] = [];
    outward.forEach(s => {
        if (!s.customerGSTIN) {
            // Check if it's B2B (large amount implies it should maybe have GSTIN, but strictly missing GSTIN is just B2C)
            // But we don't necessarily warn on every B2C.
        } else {
            if (validateGSTINState(s.customerGSTIN) === 'INVALID') {
                warnings.push(`INVALID_GSTIN: Invoice ${s.invoiceNo} has invalid GSTIN ${s.customerGSTIN}`);
            }
        }
        
        // Math mismatch
        const txTot = new Decimal(s.taxableValue).plus(new Decimal(s.totalGST));
        // There could be roundOff and otherExpense.
        // We skip exact grandTotal matching here to avoid false positives unless we reconstruct fully,
        // but we can check if totalGST = IGST + CGST + SGST
        const sumGst = new Decimal(s.igst).plus(new Decimal(s.cgst)).plus(new Decimal(s.sgst));
        if (!new Decimal(s.totalGST).equals(sumGst)) {
            warnings.push(`GST_AMOUNT_MISMATCH: Invoice ${s.invoiceNo} total GST ${s.totalGST} != ${sumGst}`);
        }

        // State mismatch
        const classification = classifySupply(tenantGstin, s.customerGSTIN);
        if (classification === 'INTER_STATE' && new Decimal(s.igst).equals(0)) {
            warnings.push(`GST_CLASSIFICATION_MISMATCH: Invoice ${s.invoiceNo} is INTER_STATE but has no IGST`);
        }
        if (classification === 'INTRA_STATE' && new Decimal(s.cgst).equals(0)) {
            warnings.push(`GST_CLASSIFICATION_MISMATCH: Invoice ${s.invoiceNo} is INTRA_STATE but has no CGST/SGST`);
        }
    });

    return warnings;
}

export async function getMonthlyTrend(userId: number, financialYearId?: number) {
    const { startDate, endDate } = await getFYRange(userId, financialYearId);
    
    // Simple grouping in memory
    const sales = await prisma.sale.findMany({
        where: { userId, status: { not: 'CANCELLED' }, invoiceDate: { gte: startDate, lte: endDate } }
    });
    
    const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const trend = months.map(m => ({
        month: m,
        taxableValue: new Decimal(0),
        igst: new Decimal(0),
        cgst: new Decimal(0),
        sgst: new Decimal(0)
    }));

    sales.forEach(s => {
        const d = new Date(s.invoiceDate);
        let m = d.getMonth() - 3;
        if (m < 0) m += 12; // Apr = 0, Mar = 11
        if (m >= 0 && m < 12) {
            trend[m].taxableValue = trend[m].taxableValue.plus(new Decimal(s.totalTaxable));
            trend[m].igst = trend[m].igst.plus(new Decimal(s.igstAmount));
            trend[m].cgst = trend[m].cgst.plus(new Decimal(s.cgstAmount));
            trend[m].sgst = trend[m].sgst.plus(new Decimal(s.sgstAmount));
        }
    });

    return trend;
}
