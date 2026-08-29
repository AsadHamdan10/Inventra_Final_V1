import prisma from '../../utils/prisma';
import { generateDocumentNumber } from '../../utils/tenantId';

export const createPurchaseQuotation = async (userId: number, data: any) => {
    const quotationNo = await generateDocumentNumber('PURCHASE_QUOTATION', userId, data.quotationDate);
    
    return prisma.purchaseQuotation.create({
        data: {
            userId,
            quotationNo,
            quotationDate: new Date(data.quotationDate),
            validityDate: data.validityDate ? new Date(data.validityDate) : null,
            vendorId: data.vendorId,
            vendorName: data.vendorName,
            warehouseId: data.warehouseId,
            purchaseRequisitionId: data.purchaseRequisitionId,
            paymentTerms: data.paymentTerms,
            deliveryTerms: data.deliveryTerms,
            remarks: data.remarks,
            status: 'DRAFT',
            totalTaxable: data.totalTaxable || 0,
            totalGst: data.totalGst || 0,
            grandTotal: data.grandTotal || 0,
            items: {
                create: data.items.map((item: any) => ({
                    materialId: item.materialId,
                    materialName: item.materialName,
                    quantity: item.quantity,
                    unit: item.unit,
                    rate: item.rate,
                    discount: item.discount || 0,
                    gstPercent: item.gstPercent || 0,
                    taxableAmount: item.taxableAmount || 0,
                    gstAmount: item.gstAmount || 0,
                    itemTotal: item.itemTotal || 0
                }))
            }
        },
        include: { items: true }
    });
};

export const updatePurchaseQuotationStatus = async (userId: number, id: number, status: string) => {
    const existing = await prisma.purchaseQuotation.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new Error('Quotation not found');
    
    return prisma.purchaseQuotation.update({
        where: { id },
        data: { status }
    });
};

export const getPurchaseQuotation = async (userId: number, id: number) => {
    return prisma.purchaseQuotation.findUnique({
        where: { id },
        include: { items: true, vendor: true, warehouse: true }
    });
};
