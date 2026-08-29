import prisma from '../../utils/prisma';
import { generateDocumentNumber } from '../../utils/tenantId';

export const createPurchaseRequisition = async (userId: number, data: any) => {
    const requisitionNo = await generateDocumentNumber('PURCHASE_REQUISITION', userId, data.requisitionDate);
    
    return prisma.purchaseRequisition.create({
        data: {
            userId,
            requisitionNo,
            requisitionDate: new Date(data.requisitionDate),
            requestedBy: data.requestedBy,
            department: data.department,
            warehouseId: data.warehouseId,
            requiredDate: data.requiredDate ? new Date(data.requiredDate) : null,
            status: 'DRAFT',
            remarks: data.remarks,
            items: {
                create: data.items.map((item: any) => ({
                    materialId: item.materialId,
                    materialName: item.materialName,
                    quantity: item.quantity,
                    unit: item.unit,
                    requiredDate: item.requiredDate ? new Date(item.requiredDate) : null,
                    remarks: item.remarks
                }))
            }
        },
        include: { items: true }
    });
};

export const updatePurchaseRequisition = async (userId: number, id: number, data: any) => {
    const existing = await prisma.purchaseRequisition.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new Error('Requisition not found');
    if (existing.status !== 'DRAFT') throw new Error('Cannot modify non-draft requisition');

    // Simple replacement of items for draft
    await prisma.purchaseRequisitionItem.deleteMany({ where: { purchaseRequisitionId: id } });

    return prisma.purchaseRequisition.update({
        where: { id },
        data: {
            requisitionDate: new Date(data.requisitionDate),
            requestedBy: data.requestedBy,
            department: data.department,
            warehouseId: data.warehouseId,
            requiredDate: data.requiredDate ? new Date(data.requiredDate) : null,
            remarks: data.remarks,
            items: {
                create: data.items.map((item: any) => ({
                    materialId: item.materialId,
                    materialName: item.materialName,
                    quantity: item.quantity,
                    unit: item.unit,
                    requiredDate: item.requiredDate ? new Date(item.requiredDate) : null,
                    remarks: item.remarks
                }))
            }
        },
        include: { items: true }
    });
};

export const updatePurchaseRequisitionStatus = async (userId: number, id: number, status: string) => {
    const existing = await prisma.purchaseRequisition.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new Error('Requisition not found');
    
    return prisma.purchaseRequisition.update({
        where: { id },
        data: { status }
    });
};

export const getPurchaseRequisition = async (userId: number, id: number) => {
    return prisma.purchaseRequisition.findUnique({
        where: { id },
        include: { items: true, warehouse: true }
    });
};
