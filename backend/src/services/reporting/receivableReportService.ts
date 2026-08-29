import prisma from '../../utils/prisma';

export async function getReceivablesReport(userId: number, fy: { startDate: Date; endDate: Date }) {
    const { startDate, endDate } = fy;

    const customers = await prisma.customer.findMany({ where: { userId } });
    
    // We fetch sales and unallocated payments up to endDate to know outstanding.
    const sales = await prisma.sale.findMany({
        where: { userId, invoiceDate: { gte: startDate, lt: endDate }, status: 'ACTIVE' },
        include: { customerAllocations: true }
    });

    // Advance/Unallocated from Payments inside FY
    const payments = await prisma.customerPayment.findMany({
        where: { userId, paymentDate: { gte: startDate, lt: endDate }, status: 'ACTIVE' },
        include: { allocations: true }
    });

    const report = customers.map(c => {
        const cSales = sales.filter(s => s.customerId === c.id);
        const cPayments = payments.filter(p => p.customerId === c.id);

        let totalSales = 0;
        let outstanding = 0;
        cSales.forEach(s => {
            totalSales += Number(s.grandTotal);
            const allocated = s.customerAllocations.reduce((acc, a) => acc + Number(a.amountAllocated), 0);
            outstanding += (Number(s.grandTotal) - allocated);
        });

        let advance = 0;
        cPayments.forEach(p => {
            const allocated = p.allocations.reduce((acc, a) => acc + Number(a.amountAllocated), 0);
            advance += (Number(p.amount) - allocated);
        });

        return {
            customerId: c.id,
            companyName: c.companyName,
            openingBalance: Number(c.openingBalance),
            fySales: totalSales,
            outstanding,
            advance
        };
    });

    return {
        customers: report,
        totalOutstanding: report.reduce((s, c) => s + c.outstanding, 0),
        totalAdvance: report.reduce((s, c) => s + c.advance, 0)
    };
}

export async function getPayablesReport(userId: number, fy: { startDate: Date; endDate: Date }) {
    const { startDate, endDate } = fy;

    const vendors = await prisma.vendor.findMany({ where: { userId } });
    
    const purchases = await prisma.purchase.findMany({
        where: { userId, billDate: { gte: startDate, lt: endDate }, status: 'ACTIVE' },
        include: { vendorAllocations: true }
    });

    const payments = await prisma.vendorPayment.findMany({
        where: { userId, paymentDate: { gte: startDate, lt: endDate }, status: 'ACTIVE' },
        include: { allocations: true }
    });

    const report = vendors.map(v => {
        const vPurchases = purchases.filter(p => p.vendorId === v.id);
        const vPayments = payments.filter(p => p.vendorId === v.id);

        let totalPurchases = 0;
        let outstanding = 0;
        vPurchases.forEach(p => {
            totalPurchases += Number(p.grandTotal);
            const allocated = p.vendorAllocations.reduce((acc, a) => acc + Number(a.amountAllocated), 0);
            outstanding += (Number(p.grandTotal) - allocated);
        });

        let advance = 0;
        vPayments.forEach(p => {
            const allocated = p.allocations.reduce((acc, a) => acc + Number(a.amountAllocated), 0);
            advance += (Number(p.amount) - allocated);
        });

        return {
            vendorId: v.id,
            vendorName: v.vendorName,
            openingBalance: Number(v.openingBalance),
            fyPurchases: totalPurchases,
            outstanding,
            advance
        };
    });

    return {
        vendors: report,
        totalOutstanding: report.reduce((s, v) => s + v.outstanding, 0),
        totalAdvance: report.reduce((s, v) => s + v.advance, 0)
    };
}