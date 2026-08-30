import prisma from '../../utils/prisma';
import { generateDocumentNumber } from '../../utils/tenantId';

export const createPurchaseOrder = async (userId: number, data: any) => {
    // SECURITY: every foreign key below is client-supplied and must be tenant-scoped,
    // otherwise this PO could be linked to (and, once received, mutate the stock of)
    // another tenant's vendor/warehouse/material/requisition/quotation.
    if (data.vendorId) {
        const vendor = await prisma.vendor.findUnique({ where: { id: data.vendorId }, select: { userId: true } });
        if (!vendor || vendor.userId !== userId) throw new Error('Vendor not found');
    }
    if (data.warehouseId) {
        const wh = await prisma.warehouse.findUnique({ where: { id: data.warehouseId }, select: { userId: true } });
        if (!wh || wh.userId !== userId) throw new Error('Warehouse not found');
    }
    if (data.purchaseRequisitionId) {
        const pr = await prisma.purchaseRequisition.findUnique({ where: { id: data.purchaseRequisitionId }, select: { userId: true } });
        if (!pr || pr.userId !== userId) throw new Error('Purchase Requisition not found');
    }
    if (data.purchaseQuotationId) {
        const pq = await prisma.purchaseQuotation.findUnique({ where: { id: data.purchaseQuotationId }, select: { userId: true } });
        if (!pq || pq.userId !== userId) throw new Error('Purchase Quotation not found');
    }
    for (const item of data.items || []) {
        if (item.materialId) {
            const mat = await prisma.material.findUnique({ where: { id: item.materialId }, select: { userId: true } });
            if (!mat || mat.userId !== userId) throw new Error(`Material ${item.materialId} not found`);
        }
        if (item.warehouseId) {
            const wh = await prisma.warehouse.findUnique({ where: { id: item.warehouseId }, select: { userId: true } });
            if (!wh || wh.userId !== userId) throw new Error(`Warehouse ${item.warehouseId} not found`);
        }
    }

    // CORRECTNESS FIX: previously crashed with an unhelpful "Cannot read
    // properties of undefined (reading 'map')" if `items` was missing (which
    // the current frontend form for this page always omits — see audit notes)
    // and otherwise trusted every client-submitted total with no recalculation.
    if (!Array.isArray(data.items) || data.items.length === 0) {
        throw new Error('At least one line item is required to create a Purchase Order.');
    }

    let totalTaxable = 0, totalGst = 0;
    const recalculatedItems = data.items.map((item: any) => {
        const orderedQty = Number(item.orderedQty);
        const rate = Number(item.rate);
        const discount = Number(item.discount || 0);
        const gstPercent = Number(item.gstPercent || 0);
        const taxableAmount = Number((orderedQty * rate - discount).toFixed(2));
        const gstAmount = Number((taxableAmount * (gstPercent / 100)).toFixed(2));
        const itemTotal = Number((taxableAmount + gstAmount).toFixed(2));
        totalTaxable += taxableAmount;
        totalGst += gstAmount;
        return { ...item, taxableAmount, gstAmount, itemTotal };
    });
    const grandTotal = Number((totalTaxable + totalGst).toFixed(2));

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
            totalTaxable: Number(totalTaxable.toFixed(2)),
            totalGst: Number(totalGst.toFixed(2)),
            grandTotal,
            items: {
                create: recalculatedItems.map((item: any) => ({
                    materialId: item.materialId,
                    materialName: item.materialName,
                    orderedQty: item.orderedQty,
                    receivedQty: 0,
                    pendingQty: item.orderedQty,
                    unit: item.unit,
                    rate: item.rate,
                    discount: item.discount || 0,
                    gstPercent: item.gstPercent || 0,
                    taxableAmount: item.taxableAmount,
                    gstAmount: item.gstAmount,
                    itemTotal: item.itemTotal,
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
    // SECURITY FIX: previously ignored `userId` entirely (IDOR) — any tenant
    // could fetch any other tenant's purchase order by id.
    return prisma.purchaseOrder.findFirst({
        where: { id, userId },
        include: { items: true, vendor: true, warehouse: true }
    });
};
