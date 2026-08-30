import prisma from '../../utils/prisma';

export const createRouting = async (userId: number, data: any) => {
    if (!data.operations || data.operations.length === 0) throw new Error("Routing must have at least one operation");

    // Validate work centers
    const wcIds = data.operations.map((o: any) => o.workCenterId);
    const wcs = await prisma.workCenter.findMany({ where: { id: { in: wcIds }, userId, isActive: true } });
    if (wcs.length !== new Set(wcIds).size) {
        throw new Error("One or more Work Centers are invalid, inactive, or belong to another tenant.");
    }

    // Check duplicate sequences
    const seqs = data.operations.map((o: any) => o.operationSequence);
    if (new Set(seqs).size !== seqs.length) throw new Error("Operation sequences must be unique");

    for (const op of data.operations) {
        if (Number(op.setupTime) < 0 || Number(op.runTime) < 0 || Number(op.queueTime) < 0 || Number(op.moveTime) < 0 || Number(op.waitTime) < 0) {
            throw new Error("Durations cannot be negative");
        }
    }

    // SECURITY: finishedGoodItemId is client-supplied and must be tenant-scoped.
    if (data.finishedGoodItemId) {
        const fg = await prisma.material.findUnique({ where: { id: data.finishedGoodItemId }, select: { userId: true } });
        if (!fg || fg.userId !== userId) throw new Error("Finished good item not found");
    }

    return prisma.routing.create({
        data: {
            userId,
            code: data.code,
            name: data.name,
            finishedGoodItemId: data.finishedGoodItemId,
            version: data.version || 1,
            status: data.status || 'DRAFT',
            effectiveFrom: new Date(data.effectiveFrom),
            effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
            notes: data.notes,
            operations: {
                create: data.operations.map((op: any) => ({
                    operationSequence: op.operationSequence,
                    operationCode: op.operationCode,
                    operationName: op.operationName,
                    workCenterId: op.workCenterId,
                    setupTime: op.setupTime || 0,
                    runTime: op.runTime || 0,
                    queueTime: op.queueTime || 0,
                    moveTime: op.moveTime || 0,
                    waitTime: op.waitTime || 0,
                    description: op.description
                }))
            }
        },
        include: { operations: true }
    });
};

export const activateRouting = async (userId: number, routingId: number) => {
    const routing = await prisma.routing.findUnique({ where: { id: routingId } });
    if (!routing || routing.userId !== userId) throw new Error("Routing not found");

    return prisma.routing.update({
        where: { id: routingId },
        data: { status: 'ACTIVE' }
    });
};
