import prisma from '../../utils/prisma';

export async function getGstSummary(userId: number, fy: { startDate: Date; endDate: Date }) {
    const { startDate, endDate } = fy;

    const sales = await prisma.sale.findMany({
        where: { userId, invoiceDate: { gte: startDate, lt: endDate }, status: 'ACTIVE' }
    });

    const purchases = await prisma.purchase.findMany({
        where: { userId, billDate: { gte: startDate, lt: endDate }, status: 'ACTIVE' }
    });

    let salesB2B = { taxable: 0, igst: 0, cgst: 0, sgst: 0, total: 0, count: 0 };
    let salesB2C = { taxable: 0, igst: 0, cgst: 0, sgst: 0, total: 0, count: 0 };

    sales.forEach(s => {
        const target = s.companyGstin ? salesB2B : salesB2C;
        target.taxable += Number(s.totalTaxable);
        target.igst += Number(s.igstAmount);
        target.cgst += Number(s.cgstAmount);
        target.sgst += Number(s.sgstAmount);
        target.total += Number(s.totalGst);
        target.count++;
    });

    let purchaseTaxable = 0;
    let purchaseIgst = 0;
    let purchaseCgst = 0;
    let purchaseSgst = 0;
    let purchaseTotalGst = 0;

    purchases.forEach(p => {
        purchaseTaxable += Number(p.totalTaxable);
        purchaseIgst += Number(p.igstAmount);
        purchaseCgst += Number(p.cgstAmount);
        purchaseSgst += Number(p.sgstAmount);
        purchaseTotalGst += Number(p.totalGst);
    });

    return {
        sales: {
            b2b: salesB2B,
            b2c: salesB2C,
            totalTaxable: salesB2B.taxable + salesB2C.taxable,
            totalGst: salesB2B.total + salesB2C.total
        },
        purchases: {
            taxable: purchaseTaxable,
            igst: purchaseIgst,
            cgst: purchaseCgst,
            sgst: purchaseSgst,
            totalGst: purchaseTotalGst
        },
        liability: (salesB2B.total + salesB2C.total) - purchaseTotalGst
    };
}