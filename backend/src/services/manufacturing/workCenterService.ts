import prisma from '../../utils/prisma';

export const createWorkCenter = async (userId: number, data: any) => {
    // SECURITY: warehouseId is client-supplied and must be tenant-scoped.
    if (data.warehouseId) {
        const wh = await prisma.warehouse.findUnique({ where: { id: data.warehouseId }, select: { userId: true } });
        if (!wh || wh.userId !== userId) throw new Error("Warehouse not found");
    }
    return prisma.workCenter.create({
        data: {
            userId,
            code: data.code,
            name: data.name,
            description: data.description,
            workCenterType: data.workCenterType,
            warehouseId: data.warehouseId,
            capacity: data.capacity || 0,
            capacityUnit: data.capacityUnit,
            efficiencyPercent: data.efficiencyPercent || 100,
            isActive: data.isActive !== undefined ? data.isActive : true
        }
    });
};

export const updateWorkCenter = async (userId: number, id: number, data: any) => {
    const existing = await prisma.workCenter.findUnique({ where: { id }});
    if (!existing || existing.userId !== userId) throw new Error("Work Center not found");
    if (data.warehouseId) {
        const wh = await prisma.warehouse.findUnique({ where: { id: data.warehouseId }, select: { userId: true } });
        if (!wh || wh.userId !== userId) throw new Error("Warehouse not found");
    }

    return prisma.workCenter.update({
        where: { id },
        data: {
            name: data.name,
            description: data.description,
            workCenterType: data.workCenterType,
            warehouseId: data.warehouseId,
            capacity: data.capacity,
            capacityUnit: data.capacityUnit,
            efficiencyPercent: data.efficiencyPercent,
            isActive: data.isActive
        }
    });
};

export const getWorkCenters = async (userId: number) => {
    return prisma.workCenter.findMany({ where: { userId }});
};
