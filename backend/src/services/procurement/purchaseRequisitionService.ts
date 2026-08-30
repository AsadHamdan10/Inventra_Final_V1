import prisma from '../../utils/prisma';
import { generateDocumentNumber } from '../../utils/tenantId';

export const createPurchaseRequisition = async (userId: number, data: any) => {
    // SECURITY: warehouseId/materialId are client-supplied and must be tenant-scoped.
    if (data.warehouseId) {
        const wh = await prisma.warehouse.findUnique({ where: { id: data.warehouseId }, select: { userId: true } });
        if (!wh || wh.userId !== userId) throw new Error('Warehouse not found');
    }
    for (const item of data.items || []) {
        if (item.materialId) {
            const mat = await prisma.material.findUnique({ where: { id: item.materialId }, select: { userId: true } });
            if (!mat || mat.userId !== userId) throw new Error(`Material ${item.materialId} not found`);
        }
    }
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
    // SECURITY: warehouseId/materialId are client-supplied and must be tenant-scoped.
    if (data.warehouseId) {
        const wh = await prisma.warehouse.findUnique({ where: { id: data.warehouseId }, select: { userId: true } });
        if (!wh || wh.userId !== userId) throw new Error('Warehouse not found');
    }
    for (const item of data.items || []) {
        if (item.materialId) {
            const mat = await prisma.material.findUnique({ where: { id: item.materialId }, select: { userId: true } });
            if (!mat || mat.userId !== userId) throw new Error(`Material ${item.materialId} not found`);
        }
    }

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
    // SECURITY FIX: this previously accepted `userId` but never used it in the
    // query, so any authenticated tenant could fetch any other tenant's
    // Purchase Requisition by guessing/incrementing the numeric id (IDOR).
    return prisma.purchaseRequisition.findFirst({
        where: { id, userId },
        include: { items: true, warehouse: true }
    });
};
