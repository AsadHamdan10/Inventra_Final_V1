import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../utils/prisma';
import { GstClassificationService } from './gstClassificationService';
import { UqcService } from './uqcService';

export class Gstr1PreparationService {
  public static async prepare(userId: number, startDate: Date, endDate: Date) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('Tenant not found');

    const userStateCode = GstClassificationService.extractStateCode(user.gstin);
    
    // Fetch authoritative sales
    const sales = await prisma.sale.findMany({
      where: {
        userId,
        invoiceDate: { gte: startDate, lt: endDate },
        status: { not: 'CANCELLED' }
      },
      include: { items: { include: { material: true } } }
    });

    const b2b: any[] = [];
    const b2cl: any[] = [];
    const b2cs: any[] = [];
    const errors: string[] = [];

    // HSN Map
    const hsnMap = new Map<string, any>();

    for (const sale of sales) {
      const customerStateCode = sale.companyGstin ? GstClassificationService.extractStateCode(sale.companyGstin) : (sale.customerCity ? 'UN' : null); // We should Ideally use state code mappings
      const classification = GstClassificationService.classifySale(
        sale.companyGstin, 
        Number(sale.grandTotal), 
        customerStateCode, 
        userStateCode
      );

      const saleData = {
        invoiceNo: sale.invoiceNo,
        invoiceDate: sale.invoiceDate.toISOString().split('T')[0],
        invoiceValue: Number(sale.grandTotal),
        taxableValue: Number(sale.totalTaxable),
        igst: Number(sale.igstAmount),
        cgst: Number(sale.cgstAmount),
        sgst: Number(sale.sgstAmount),
        pos: customerStateCode || userStateCode || '00', // Place of supply
      };

      if (classification === 'INVALID_GSTIN') {
        errors.push(`Sale ${sale.invoiceNo} has a malformed GSTIN: ${sale.companyGstin}`);
      } else if (classification === 'B2B') {
        b2b.push({ ...saleData, customerGstin: sale.companyGstin });
      } else if (classification === 'B2CL') {
        b2cl.push(saleData);
      } else {
        b2cs.push(saleData);
      }

      // HSN Aggregation
      for (const item of sale.items) {
        if (!item.hsnCode) {
          errors.push(`Sale ${sale.invoiceNo} Item '${item.materialName}' is missing HSN Code`);
          continue;
        }
        const uqc = UqcService.normalizeUqc(item.material?.unit);
        if (!uqc) {
          errors.push(`Sale ${sale.invoiceNo} Item '${item.materialName}' has unknown/missing UQC`);
        }

        const key = `${item.hsnCode}_${uqc || 'OTH'}`;
        if (!hsnMap.has(key)) {
          hsnMap.set(key, {
            hsn: item.hsnCode,
            description: item.materialName,
            uqc: uqc || 'OTH',
            quantity: 0,
            taxableValue: 0,
            igst: 0,
            cgst: 0,
            sgst: 0,
            totalTax: 0
          });
        }
        
        const agg = hsnMap.get(key);
        agg.quantity += Number(item.quantity);
        agg.taxableValue += Number(item.taxableAmount);
        
        // Approximate GST split per item based on header proportion or item specific if available.
        // In our schema, we have gstAmount, we need to split to IGST/CGST/SGST based on the Sale header.
        const itemIgst = sale.igstAmount.gt(0) ? Number(item.gstAmount) : 0;
        const itemCgst = sale.cgstAmount.gt(0) ? Number(item.gstAmount) / 2 : 0;
        const itemSgst = sale.sgstAmount.gt(0) ? Number(item.gstAmount) / 2 : 0;

        agg.igst += itemIgst;
        agg.cgst += itemCgst;
        agg.sgst += itemSgst;
        agg.totalTax += Number(item.gstAmount);
      }
    }

    // Fetch authoritative credit notes
    const returns = await prisma.salesReturn.findMany({
      where: {
        userId,
        returnDate: { gte: startDate, lt: endDate },
        status: { not: 'CANCELLED' } // DRAFT returns might be included if policy dictates, but usually only APPROVED. Assuming all non-cancelled are valid.
      },
      include: { sale: true }
    });

    const cdnr: any[] = [];
    const cdnur: any[] = [];

    for (const sr of returns) {
      const classification = GstClassificationService.classifySale(
        sr.sale.companyGstin, 
        Number(sr.sale.grandTotal), 
        null, // simplification
        userStateCode
      );

      const returnData = {
        creditNoteNo: sr.creditNoteNo || `CRN-${sr.id}`,
        returnDate: sr.returnDate.toISOString().split('T')[0],
        originalInvoiceNo: sr.sale.invoiceNo,
        taxableReduction: Number(sr.totalTaxable),
        igstReduction: Number(sr.igstAmount),
        cgstReduction: Number(sr.cgstAmount),
        sgstReduction: Number(sr.sgstAmount),
        totalValue: Number(sr.grandTotal)
      };

      if (classification === 'B2B') {
        cdnr.push({ ...returnData, customerGstin: sr.sale.companyGstin });
      } else {
        cdnur.push(returnData);
      }
    }

    return {
      b2b,
      b2cl,
      b2cs,
      cdnr,
      cdnur,
      hsnSummary: Array.from(hsnMap.values()),
      errors
    };
  }
}
