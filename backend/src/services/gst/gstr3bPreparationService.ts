import prisma from '../../utils/prisma';

export class Gstr3bPreparationService {
  public static async prepare(userId: number, startDate: Date, endDate: Date) {
    // 1. OUTWARD SUPPLIES
    const sales = await prisma.sale.aggregate({
      _sum: { totalTaxable: true, igstAmount: true, cgstAmount: true, sgstAmount: true },
      where: { userId, invoiceDate: { gte: startDate, lt: endDate }, status: { not: 'CANCELLED' } }
    });

    const salesReturns = await prisma.salesReturn.aggregate({
      _sum: { totalTaxable: true, igstAmount: true, cgstAmount: true, sgstAmount: true },
      where: { userId, returnDate: { gte: startDate, lt: endDate }, status: { not: 'CANCELLED' } }
    });

    const outward = {
      taxableValue: Number(sales._sum.totalTaxable || 0) - Number(salesReturns._sum.totalTaxable || 0),
      igst: Number(sales._sum.igstAmount || 0) - Number(salesReturns._sum.igstAmount || 0),
      cgst: Number(sales._sum.cgstAmount || 0) - Number(salesReturns._sum.cgstAmount || 0),
      sgst: Number(sales._sum.sgstAmount || 0) - Number(salesReturns._sum.sgstAmount || 0),
    };

    // 2. ITC (INPUT TAX CREDIT)
    // Normal eligible purchases
    const eligiblePurchases = await prisma.purchase.aggregate({
      _sum: { totalTaxable: true, igstAmount: true, cgstAmount: true, sgstAmount: true },
      where: { 
        userId, 
        billDate: { gte: startDate, lt: endDate }, 
        status: { not: 'CANCELLED' },
        itcEligibility: 'ELIGIBLE',
        rcm: false
      }
    });

    const purchaseReturns = await prisma.purchaseReturn.aggregate({
        _sum: { totalTaxable: true, igstAmount: true, cgstAmount: true, sgstAmount: true },
        where: { userId, returnDate: { gte: startDate, lt: endDate }, status: { not: 'CANCELLED' } }
    });

    const itc = {
      igst: Number(eligiblePurchases._sum.igstAmount || 0) - Number(purchaseReturns._sum.igstAmount || 0),
      cgst: Number(eligiblePurchases._sum.cgstAmount || 0) - Number(purchaseReturns._sum.cgstAmount || 0),
      sgst: Number(eligiblePurchases._sum.sgstAmount || 0) - Number(purchaseReturns._sum.sgstAmount || 0),
    };

    // 3. RCM (REVERSE CHARGE MECHANISM)
    const rcmPurchases = await prisma.purchase.aggregate({
      _sum: { totalTaxable: true, igstAmount: true, cgstAmount: true, sgstAmount: true },
      where: { 
        userId, 
        billDate: { gte: startDate, lt: endDate }, 
        status: { not: 'CANCELLED' },
        rcm: true
      }
    });

    const rcm = {
      taxableValue: Number(rcmPurchases._sum.totalTaxable || 0),
      igst: Number(rcmPurchases._sum.igstAmount || 0),
      cgst: Number(rcmPurchases._sum.cgstAmount || 0),
      sgst: Number(rcmPurchases._sum.sgstAmount || 0),
    };

    // 4. INELIGIBLE ITC
    const ineligiblePurchases = await prisma.purchase.aggregate({
      _sum: { igstAmount: true, cgstAmount: true, sgstAmount: true },
      where: { 
        userId, 
        billDate: { gte: startDate, lt: endDate }, 
        status: { not: 'CANCELLED' },
        itcEligibility: 'INELIGIBLE',
        rcm: false
      }
    });

    const ineligibleItc = {
      igst: Number(ineligiblePurchases._sum.igstAmount || 0),
      cgst: Number(ineligiblePurchases._sum.cgstAmount || 0),
      sgst: Number(ineligiblePurchases._sum.sgstAmount || 0),
    };

    // 5. NET GST POSITION
    const netGst = {
      igstPayable: Math.max(0, outward.igst + rcm.igst - itc.igst - rcm.igst), // RCM is both payable and ITC generally, simplification
      cgstPayable: Math.max(0, outward.cgst + rcm.cgst - itc.cgst - rcm.cgst),
      sgstPayable: Math.max(0, outward.sgst + rcm.sgst - itc.sgst - rcm.sgst),
    };

    return {
      outward,
      itc,
      rcm,
      ineligibleItc,
      netGst
    };
  }
}
