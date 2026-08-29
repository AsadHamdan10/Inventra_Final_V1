
import prisma from '../../utils/prisma';
import { safeDecryptFinancial } from '../../utils/financialCrypto';

export async function getDashboardMetrics(userId: number, fy: { startDate: Date; endDate: Date }) {
    const { startDate, endDate } = fy;

    const sales = await prisma.sale.aggregate({
        where: { userId, invoiceDate: { gte: startDate, lt: endDate }, status: 'ACTIVE' },
        _sum: { grandTotal: true, totalPurchaseCost: true, grossProfit: true },
        _count: true
    });
    
    // Fallback decrypted profit
    const rawSales = await prisma.sale.findMany({
        where: { userId, invoiceDate: { gte: startDate, lt: endDate }, status: 'ACTIVE' },
        select: { grandTotal: true, totalPurchaseCost: true, grossProfit: true }
    });
    
    let totalSales = 0;
    let totalCOGS = 0;
    let totalGrossProfit = 0;
    for (const s of rawSales) {
        totalSales += Number(s.grandTotal || 0);
        totalCOGS += Number(s.totalPurchaseCost || 0);
        totalGrossProfit += Number(s.grossProfit || 0); 
    }

    const purchases = await prisma.purchase.aggregate({
        where: { userId, billDate: { gte: startDate, lt: endDate }, status: 'ACTIVE' },
        _sum: { grandTotal: true },
        _count: true
    });

    const expenses = await prisma.expense.aggregate({
        where: { userId, expenseDate: { gte: startDate, lt: endDate } },
        _sum: { amount: true }
    });

    const salesReturns = await prisma.salesReturn.aggregate({
        where: { userId, returnDate: { gte: startDate, lt: endDate }, status: 'FINALIZED' },
        _sum: { grandTotal: true }
    });

    const purchaseReturns = await prisma.purchaseReturn.aggregate({
        where: { userId, returnDate: { gte: startDate, lt: endDate }, status: 'FINALIZED' },
        _sum: { grandTotal: true }
    });
    
    const salesWithAllocations = await prisma.sale.findMany({
        where: { userId, invoiceDate: { gte: startDate, lt: endDate }, status: 'ACTIVE' },
        include: { customerAllocations: true }
    });
    let customerOutstanding = 0;
    salesWithAllocations.forEach(s => {
        const allocated = s.customerAllocations.reduce((acc, a) => acc + Number(a.amountAllocated), 0);
        customerOutstanding += (Number(s.grandTotal) - allocated);
    });

    const purchasesWithAllocations = await prisma.purchase.findMany({
        where: { userId, billDate: { gte: startDate, lt: endDate }, status: 'ACTIVE' },
        include: { vendorAllocations: true }
    });
    let vendorOutstanding = 0;
    purchasesWithAllocations.forEach(p => {
        const allocated = p.vendorAllocations.reduce((acc, a) => acc + Number(a.amountAllocated), 0);
        vendorOutstanding += (Number(p.grandTotal) - allocated);
    });

    const activeLayers = await prisma.inventoryLayer.findMany({
        where: { userId, remainingQty: { gt: 0 } },
        select: { remainingQty: true, unitCostEnc: true }
    });
    let inventoryValuation = 0;
    for (const layer of activeLayers) {
        let cost = 0;
        try { cost = safeDecryptFinancial(layer.unitCostEnc); } catch(e) {}
        inventoryValuation += (Number(layer.remainingQty) * cost);
    }
    
    const materialsCount = await prisma.material.count({ where: { userId, isActive: true } });
    
    // UI Legacy charts & arrays
    const recentSales = await prisma.sale.findMany({ 
        where: { userId, invoiceDate: { gte: startDate, lt: endDate } }, 
        orderBy: { invoiceDate: 'desc' }, take: 5, 
        select: { id:true, invoiceNo:true, companyName:true, grandTotal:true, invoiceDate:true, grossProfit:true, paymentReceived:true } 
    });
    
    const recentPurchases = await prisma.purchase.findMany({ 
        where: { userId, billDate: { gte: startDate, lt: endDate } }, 
        orderBy: { billDate: 'desc' }, take: 5, 
        select: { id:true, billNo:true, vendorName:true, grandTotal:true, billDate:true, paymentPaid:true } 
    });
    
    const monthlyRevenue = await prisma.$queryRaw<any[]>`SELECT TO_CHAR(invoice_date,'YYYY-MM') as month, SUM(grand_total) as revenue, SUM(gross_profit) as profit, COUNT(*) as count FROM sales WHERE user_id=${userId} AND invoice_date >= ${startDate} AND invoice_date < ${endDate} GROUP BY TO_CHAR(invoice_date,'YYYY-MM') ORDER BY month ASC`;
    const expensesByCategory = await prisma.expense.groupBy({ by:['category'], where:{ userId, expenseDate:{gte:startDate, lt:endDate} }, _sum:{amount:true}, orderBy:{_sum:{amount:'desc'}} });

    return {
        summary: {
            ytd: {
                sales: { total: totalSales, profit: totalGrossProfit, count: sales._count },
                purchases: { total: Number(purchases._sum.grandTotal||0), count: purchases._count },
                expenses: Number(expenses._sum?.amount||0),
            },
            outstanding: { receivables: customerOutstanding, payables: vendorOutstanding },
            counts: { materials: materialsCount }
        },
        recentSales: recentSales.map(s => ({ ...s, grandTotal: Number(s.grandTotal) })),
        recentPurchases: recentPurchases.map(p => ({...p, grandTotal:Number(p.grandTotal)})),
        charts: {
            monthlyRevenue: (monthlyRevenue as any[]).map(r => ({ month:r.month, revenue:Number(r.revenue), profit:Number(r.profit), count:Number(r.count) })),
            expensesByCategory: expensesByCategory.map(e => ({ category:e.category, amount:Number(e._sum?.amount||0) })),
        },
        
        // Professional ERP Fields
        sales: {
            total: totalSales,
            count: sales._count,
            netSales: totalSales - Number(salesReturns._sum.grandTotal || 0)
        },
        purchases: {
            total: Number(purchases._sum.grandTotal || 0),
            count: purchases._count,
            netPurchases: Number(purchases._sum.grandTotal || 0) - Number(purchaseReturns._sum.grandTotal || 0)
        },
        profit: {
            grossSales: totalSales,
            fifoCogs: totalCOGS,
            grossProfit: totalGrossProfit,
            operatingExpenses: Number(expenses._sum?.amount || 0),
            netOperatingResult: totalGrossProfit - Number(expenses._sum?.amount || 0)
        },
        receivables: { outstanding: customerOutstanding },
        payables: { outstanding: vendorOutstanding },
        inventory: {
            valuation: inventoryValuation,
            activeCount: materialsCount
        }
    };
}
