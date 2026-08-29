import prisma from '../../utils/prisma';

export class EWayBillPayloadService {
  public static async buildPayload(sourceType: 'SALE' | 'DELIVERY_CHALLAN' | 'SALES_RETURN', sourceId: number, transportData: any) {
    let sourceDoc: any;
    let payload: any = {};

    if (sourceType === 'SALE') {
      sourceDoc = await prisma.sale.findUnique({
        where: { id: sourceId },
        include: { customer: true, user: true, items: { include: { material: true } } }
      });
      if (!sourceDoc) throw new Error('Source document not found');

      payload = {
        supplyType: 'O',
        subSupplyType: '1',
        documentType: 'INV',
        documentNo: sourceDoc.invoiceNo,
        documentDate: sourceDoc.invoiceDate.toISOString().split('T')[0],
        supplierGstin: sourceDoc.user.gstin || '27AAAAA0000A1Z5',
        supplierName: sourceDoc.user.companyName,
        supplierAddress: sourceDoc.user.addressLine1 || 'Default Address',
        supplierState: sourceDoc.user.state || 'Maharashtra',
        supplierPincode: sourceDoc.user.pincode || '400001',
        buyerGstin: sourceDoc.customer?.gstin || 'URP',
        buyerName: sourceDoc.customer?.companyName || 'Cash Customer',
        buyerAddress: sourceDoc.customerAddress || 'Default Address',
        buyerState: sourceDoc.customerCity || 'Maharashtra',
        buyerPincode: sourceDoc.customerPincode || '400001',
        totalTaxable: Number(sourceDoc.totalTaxable),
        cgstAmount: Number(sourceDoc.cgstAmount),
        sgstAmount: Number(sourceDoc.sgstAmount),
        igstAmount: Number(sourceDoc.igstAmount),
        totalInvoiceValue: Number(sourceDoc.grandTotal),
        items: sourceDoc.items.map((item: any) => ({
          productName: item.materialName,
          hsnCode: item.material?.hsnCode || '1234',
          quantity: Number(item.quantity),
          qtyUnit: 'NOS',
          taxableAmount: Number(item.taxableAmount),
          sgstRate: Number(item.gstPercent) / 2,
          cgstRate: Number(item.gstPercent) / 2,
          igstRate: 0,
        }))
      };
    } else if (sourceType === 'DELIVERY_CHALLAN') {
      sourceDoc = await prisma.deliveryChallan.findUnique({
        where: { id: sourceId },
        include: { user: true, items: { include: { material: true } } }
      });
      if (!sourceDoc) throw new Error('Source document not found');
      payload = {
        supplyType: 'O',
        subSupplyType: '8', // Line Sales / Others
        documentType: 'CHL',
        documentNo: sourceDoc.dcNo,
        documentDate: sourceDoc.dcDate.toISOString().split('T')[0],
        supplierGstin: sourceDoc.user.gstin || '27AAAAA0000A1Z5',
        // ... (mock details for DC)
        totalInvoiceValue: 0 // Non-financial
      };
    } else if (sourceType === 'SALES_RETURN') {
        sourceDoc = await prisma.salesReturn.findUnique({
            where: { id: sourceId },
            include: { user: true, customer: true, items: { include: { material: true } } }
        });
        if (!sourceDoc) throw new Error('Source document not found');
        payload = {
            supplyType: 'I',
            subSupplyType: '2', // Sales Return
            documentType: 'CRN',
            documentNo: sourceDoc.creditNoteNo,
            documentDate: sourceDoc.returnDate.toISOString().split('T')[0],
            // ... (mock details for return)
            totalInvoiceValue: Number(sourceDoc.grandTotal)
        };
    }

    // Append transport
    Object.assign(payload, {
      transporterId: transportData.transporterId || '',
      transporterName: transportData.transporterName || '',
      transportMode: transportData.transportMode || '1',
      approxDistance: transportData.approximateDistance || 100,
      vehicleNo: transportData.vehicleNo || '',
      vehicleType: transportData.vehicleType || 'R',
      transportDocNo: transportData.transportDocNo || '',
      transportDocDate: transportData.transportDocDate ? new Date(transportData.transportDocDate).toISOString().split('T')[0] : null
    });

    return payload;
  }
}
