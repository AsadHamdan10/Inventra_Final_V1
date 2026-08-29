import prisma from '../../utils/prisma';
import { generateDocumentNumber } from '../../utils/tenantId';

export const createPurchaseOrder = async (userId: number, data: any) => {
    const orderNo = await generateDocumentNumber('PURCHASE_ORDER', userId, data.orderDate);
    
    return prisma.purchaseOrder.create({
        data: {
            userId,
            orderNo,
            orderDate: new Date(data.orderDate),
            vendorId: data.vendorId,
            vendorName: data.vendorName,
            warehouseId: data.warehouseId,
            purchaseRequisitionId: data.purchaseRequisitionId,
            purchaseQuotationId: data.purchaseQuotationId,
            expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
            paymentTerms: data.paymentTerms,
            deliveryTerms: data.deliveryTerms,
            shippingAddress: data.shippingAddress,
            billingAddress: data.billingAddress,
            remarks: data.remarks,
            status: 'DRAFT',
            totalTaxable: data.totalTaxable || 0,
            totalGst: data.totalGst || 0,
            grandTotal: data.grandTotal || 0,
            items: {
                create: data.items.map((item: any) => ({
                    materialId: item.materialId,
                    materialName: item.materialName,
                    orderedQty: item.orderedQty,
                    receivedQty: 0,
                    pendingQty: item.orderedQty,
                    unit: item.unit,
                    rate: item.rate,
                    discount: item.discount || 0,
                    gstPercent: item.gstPercent || 0,
                    taxableAmount: item.taxableAmount || 0,
                    gstAmount: item.gstAmount || 0,
                    itemTotal: item.itemTotal || 0,
                    warehouseId: item.warehouseId || data.warehouseId
                }))
            }
        },
        include: { items: true }
    });
};

export const updatePurchaseOrderStatus = async (userId: number, id: number, status: string) => {
    const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new Error('Order not found');
    
    return prisma.purchaseOrder.update({
        where: { id },
        data: { status }
    });
};

export const getPurchaseOrder = async (userId: number, id: number) => {
    return prisma.purchaseOrder.findUnique({
        where: { id },
        include: { items: true, vendor: true, warehouse: true }
    });
};
