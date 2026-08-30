import prisma from '../../utils/prisma';
import { generateDocumentNumber } from '../../utils/tenantId';
import { explodeBOM } from './bomService';

export const createProductionOrder = async (userId: number, data: any) => {
    // Generate Order No
    const productionOrderNo = await generateDocumentNumber('MO', userId, data.productionDate);

    // Validate warehouse
    const warehouse = await prisma.warehouse.findUnique({ where: { id: data.warehouseId, userId }});
    if (!warehouse) throw new Error("Invalid warehouse");

    // Validate Item
    const item = await prisma.material.findUnique({ where: { id: data.itemId, userId }});
    if (!item) throw new Error("Invalid Item");

    if (Number(data.plannedQuantity) <= 0) throw new Error("Planned quantity must be positive");

    // SECURITY: bomId/routingId are client-supplied and must be tenant-scoped,
    // otherwise a production order could be released against another tenant's
    // BOM/routing, pulling their recipe (component material IDs/quantities)
    // into this tenant's material issue and costing flow.
    if (data.bomId) {
        const bom = await prisma.billOfMaterial.findUnique({ where: { id: data.bomId }, select: { userId: true } });
        if (!bom || bom.userId !== userId) throw new Error("Invalid BOM");
    }
    if (data.routingId) {
        const routing = await prisma.routing.findUnique({ where: { id: data.routingId }, select: { userId: true } });
        if (!routing || routing.userId !== userId) throw new Error("Invalid Routing");
    }

    return prisma.productionOrder.create({
        data: {
            userId,
            productionOrderNo,
            productionDate: new Date(data.productionDate),
            itemId: data.itemId,
            plannedQuantity: data.plannedQuantity,
            warehouseId: data.warehouseId,
            bomId: data.bomId,
            routingId: data.routingId,
            status: 'DRAFT',
            priority: data.priority || 'NORMAL',
            plannedStartDate: data.plannedStartDate ? new Date(data.plannedStartDate) : null,
            plannedEndDate: data.plannedEndDate ? new Date(data.plannedEndDate) : null,
            notes: data.notes
        }
    });
};

export const releaseProductionOrder = async (userId: number, id: number) => {
    // Transaction to snapshot BOM and Routing
    return prisma.$transaction(async (tx) => {
        const order = await tx.productionOrder.findUnique({ where: { id }});
        if (!order || order.userId !== userId) throw new Error("Production Order not found");
        if (order.status !== 'DRAFT' && order.status !== 'PLANNED') {
            throw new Error("Only DRAFT or PLANNED orders can be released");
        }

        if (!order.bomId) throw new Error("BOM is required to release Production Order");

        // 1. Snapshot BOM Requirements
        const requirements = await explodeBOM(userId, order.itemId, order.plannedQuantity, order.bomId);

        const componentsData = requirements.map(req => ({
            componentItemId: req.materialId,
            requiredQuantity: req.requiredQuantity,
            unit: req.unit,
            warehouseId: order.warehouseId // For Phase 5.3, assume same warehouse
        }));

        if (componentsData.length > 0) {
            await tx.productionOrderComponent.createMany({
                data: componentsData.map(c => ({
                    productionOrderId: order.id,
                    ...c
                }))
            });
        }

        // 2. Snapshot Routing Operations
        if (order.routingId) {
            const routing = await tx.routing.findUnique({
                where: { id: order.routingId },
                include: { operations: true }
            });

            if (routing && routing.operations.length > 0) {
                await tx.productionOrderOperation.createMany({
                    data: routing.operations.map(op => ({
                        productionOrderId: order.id,
                        operationSequence: op.operationSequence,
                        operationCode: op.operationCode,
                        operationName: op.operationName,
                        workCenterId: op.workCenterId,
                        setupTime: op.setupTime,
                        runTime: op.runTime,
                        status: 'PENDING'
                    }))
                });
            }
        }

        // 3. Mark as RELEASED
        // No accounting or inventory mutations occur!
        return tx.productionOrder.update({
            where: { id },
            data: { status: 'RELEASED' },
            include: { components: true, operations: true }
        });
    });
};
