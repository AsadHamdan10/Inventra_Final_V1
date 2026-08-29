import prisma from '../../utils/prisma';

export async function getProfitLossReport(userId: number, fy: { startDate: Date; endDate: Date }) {
    const { startDate, endDate } = fy;

    const sales = await prisma.sale.aggregate({
        where: { userId, invoiceDate: { gte: startDate, lt: endDate }, status: 'ACTIVE' },
        _sum: { grandTotal: true, totalPurchaseCost: true, grossProfit: true }
    });

    const salesReturns = await prisma.salesReturn.aggregate({
        where: { userId, returnDate: { gte: startDate, lt: endDate }, status: 'FINALIZED' },
        _sum: { grandTotal: true }
    });

    const expensesByCategory = await prisma.expense.groupBy({
        by: ['category'],
        where: { userId, expenseDate: { gte: startDate, lt: endDate } },
        _sum: { amount: true }
    });

    const totalExpenses = expensesByCategory.reduce((sum, e) => sum + Number(e._sum?.amount || 0), 0);

    const grossSales = Number(sales._sum.grandTotal || 0);
    const returns = Number(salesReturns._sum.grandTotal || 0);
    const netSales = grossSales - returns;
    
    // Authoritative FIFO COGS
    const fifoCogs = Number(sales._sum.totalPurchaseCost || 0);
    
    // Note: Returns should ideally adjust COGS if items are returned to stock, but we stick to the basic Sales Gross Profit for now
    const grossProfit = Number(sales._sum.grossProfit || 0);
    const grossMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
    
    const netOperatingResult = grossProfit - totalExpenses;

    return {
        revenue: {
            grossSales,
            salesReturns: returns,
            netSales
        },
        cogs: {
            fifoCogs
        },
        grossProfit: {
            amount: grossProfit,
            margin: grossMargin
        },
        operatingExpenses: {
            categories: expensesByCategory.map(e => ({ category: e.category, amount: Number(e._sum?.amount || 0) })),
            total: totalExpenses
        },
        netOperatingResult
    };
}