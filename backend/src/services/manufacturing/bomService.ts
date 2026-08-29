import prisma from '../../utils/prisma';
import { Decimal } from '@prisma/client/runtime/library';

// Helper to check circular dependencies before creating/updating BOM
export const checkBomCycle = async (userId: number, finishedGoodItemId: number, componentIds: number[], currentBomId?: number) => {
    // A -> B -> A
    // Find all BOMs where the finished good is one of our components
    const componentBoms = await prisma.billOfMaterial.findMany({
        where: {
            userId,
            finishedGoodItemId: { in: componentIds },
            status: 'ACTIVE'
        },
        include: { items: true }
    });

    for (const bom of componentBoms) {
        if (bom.id === currentBomId) continue;
        const subComponentIds = bom.items.map(i => i.componentItemId);
        if (subComponentIds.includes(finishedGoodItemId)) {
            throw new Error(`Circular BOM dependency detected: Adding this component creates a cycle (Item ID: ${finishedGoodItemId})`);
        }
        // Recursively check deeper (for 1 level deep for now, we can do full graph traversal if needed)
        // For rigorous check, we'll traverse a set of visited nodes
        await checkBomCycleDeep(userId, finishedGoodItemId, subComponentIds, new Set([finishedGoodItemId]));
    }
};

const checkBomCycleDeep = async (userId: number, targetItemId: number, componentIds: number[], visited: Set<number>) => {
    if (componentIds.includes(targetItemId)) throw new Error(`Circular BOM dependency detected involving Item ID: ${targetItemId}`);
    
    for (const cid of componentIds) {
        if (visited.has(cid)) continue;
        visited.add(cid);

        const subBoms = await prisma.billOfMaterial.findMany({
            where: { userId, finishedGoodItemId: cid, status: 'ACTIVE' },
            include: { items: true }
        });
        
        for (const subBom of subBoms) {
            const subSubIds = subBom.items.map(i => i.componentItemId);
            await checkBomCycleDeep(userId, targetItemId, subSubIds, visited);
        }
    }
};

export const createBOM = async (userId: number, data: any) => {
    // Validate components
    if (!data.items || data.items.length === 0) throw new Error("BOM must have at least one component");
    if (Number(data.outputQuantity) <= 0) throw new Error("Output quantity must be positive");

    const componentIds = data.items.map((i: any) => i.componentItemId);
    await checkBomCycle(userId, data.finishedGoodItemId, componentIds);

    for (const item of data.items) {
        if (Number(item.quantity) <= 0) throw new Error("Component quantity must be positive");
        if (Number(item.scrapPercent) < 0) throw new Error("Scrap cannot be negative");
    }

    return prisma.billOfMaterial.create({
        data: {
            userId,
            bomCode: data.bomCode,
            name: data.name,
            finishedGoodItemId: data.finishedGoodItemId,
            revision: data.revision || 'V1',
            status: data.status || 'DRAFT',
            effectiveFrom: new Date(data.effectiveFrom),
            effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
            outputQuantity: data.outputQuantity,
            outputUnit: data.outputUnit,
            notes: data.notes,
            isDefault: data.isDefault || false,
            items: {
                create: data.items.map((item: any, index: number) => ({
                    componentItemId: item.componentItemId,
                    quantity: item.quantity,
                    unit: item.unit,
                    scrapPercent: item.scrapPercent || 0,
                    sequence: item.sequence || (index + 1) * 10,
                    warehouseId: item.warehouseId,
                    notes: item.notes
                }))
            }
        },
        include: { items: true }
    });
};

export const activateBOM = async (userId: number, bomId: number) => {
    const bom = await prisma.billOfMaterial.findUnique({ where: { id: bomId } });
    if (!bom || bom.userId !== userId) throw new Error("BOM not found");

    // Check for overlapping active BOMs for the same FG
    const overlapping = await prisma.billOfMaterial.findFirst({
        where: {
            userId,
            finishedGoodItemId: bom.finishedGoodItemId,
            status: 'ACTIVE',
            id: { not: bomId },
            // Date logic: New BOM's effectiveFrom is <= existing effectiveTo (or existing has no effectiveTo)
            // AND New BOM's effectiveTo is >= existing effectiveFrom (or new has no effectiveTo)
            OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: bom.effectiveFrom } }
            ]
        }
    });

    if (overlapping && (!bom.effectiveTo || overlapping.effectiveFrom <= bom.effectiveTo)) {
        throw new Error("Cannot activate BOM: Overlapping effective dates with an existing ACTIVE BOM for this Finished Good.");
    }

    return prisma.billOfMaterial.update({
        where: { id: bomId },
        data: { status: 'ACTIVE' }
    });
};

export const explodeBOM = async (userId: number, finishedGoodItemId: number, requestedQuantity: Decimal, specificBomId?: number) => {
    // Flattened result: Map of materialId -> required details
    const requiredComponents: Map<number, { quantity: Decimal, unit: string }> = new Map();

    await explodeRecursive(userId, finishedGoodItemId, requestedQuantity, requiredComponents, specificBomId);

    // Convert map to array
    const result = [];
    for (const [matId, details] of requiredComponents.entries()) {
        const mat = await prisma.material.findUnique({ where: { id: matId } });
        result.push({
            materialId: matId,
            materialName: mat?.materialName || 'Unknown',
            requiredQuantity: details.quantity,
            unit: details.unit
        });
    }

    return result;
};

const explodeRecursive = async (userId: number, itemId: number, requiredQty: Decimal, result: Map<number, { quantity: Decimal, unit: string }>, specificBomId?: number) => {
    // Find ACTIVE BOM for this item
    let bom;
    if (specificBomId) {
        bom = await prisma.billOfMaterial.findUnique({ where: { id: specificBomId }, include: { items: true } });
    } else {
        bom = await prisma.billOfMaterial.findFirst({
            where: { userId, finishedGoodItemId: itemId, status: 'ACTIVE' },
            orderBy: { isDefault: 'desc' },
            include: { items: true }
        });
    }

    if (!bom || bom.items.length === 0) {
        // It's a leaf node (Raw Material or bought-out Component)
        const current = result.get(itemId);
        if (current) {
            current.quantity = current.quantity.plus(requiredQty);
        } else {
            // Find unit
            const mat = await prisma.material.findUnique({ where: { id: itemId }});
            result.set(itemId, { quantity: requiredQty, unit: mat?.unit || 'Nos' });
        }
        return;
    }

    // It has a BOM. Calculate multiplier based on output quantity.
    const multiplier = requiredQty.dividedBy(bom.outputQuantity);

    for (const item of bom.items) {
        // Base required = (BOM Qty * Multiplier)
        let compReq = new Decimal(item.quantity).times(multiplier);
        
        // Add Scrap: if scrap is 5%, we need compReq / (1 - 0.05) to yield the compReq
        // Or simpler standard ERP scrap additive: compReq * (1 + scrapPercent/100)
        if (Number(item.scrapPercent) > 0) {
            const scrapFactor = new Decimal(1).plus(new Decimal(item.scrapPercent).dividedBy(100));
            compReq = compReq.times(scrapFactor);
        }

        await explodeRecursive(userId, item.componentItemId, compReq, result);
    }
};
