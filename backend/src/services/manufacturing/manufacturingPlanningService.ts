import prisma from '../../utils/prisma';
import { explodeBOM } from './bomService';
import { Decimal } from '@prisma/client/runtime/library';

export const checkMaterialAvailability = async (userId: number, finishedGoodItemId: number, quantity: number, bomId?: number, warehouseId?: number) => {
    const requirements = await explodeBOM(userId, finishedGoodItemId, new Decimal(quantity), bomId);
    
    const results = [];
    
    for (const req of requirements) {
        // Find current stock
        let available = new Decimal(0);
        if (warehouseId) {
            const ledgers = await prisma.inventoryLedger.findMany({
                where: { userId, materialId: req.materialId, warehouseId }
            });
            let inQty = ledgers.filter(l => l.movementType === 'IN').reduce((acc, curr) => acc + Number(curr.quantity), 0);
            let outQty = ledgers.filter(l => l.movementType === 'OUT').reduce((acc, curr) => acc + Number(curr.quantity), 0);
            available = new Decimal(inQty - outQty);
        } else {
            const mat = await prisma.material.findUnique({ where: { id: req.materialId }});
            available = new Decimal(mat?.currentStock || 0);
        }

        const shortage = available.lessThan(req.requiredQuantity) ? req.requiredQuantity.minus(available) : new Decimal(0);

        results.push({
            materialId: req.materialId,
            materialName: req.materialName,
            requiredQuantity: req.requiredQuantity.toNumber(),
            availableQuantity: available.toNumber(),
            shortageQuantity: shortage.toNumber(),
            status: shortage.greaterThan(0) ? 'SHORTAGE' : 'AVAILABLE',
            unit: req.unit
        });
    }

    return results;
};

export const calculateEstimatedCost = async (userId: number, finishedGoodItemId: number, quantity: number, bomId?: number) => {
    const requirements = await explodeBOM(userId, finishedGoodItemId, new Decimal(quantity), bomId);
    
    let totalEstimatedCost = new Decimal(0);
    const componentCosts = [];

    for (const req of requirements) {
        // Try to get standard cost first
        const mat = await prisma.material.findUnique({ where: { id: req.materialId }});
        let unitCost = new Decimal(mat?.standardCost || 0);

        const itemCost = req.requiredQuantity.times(unitCost);
        totalEstimatedCost = totalEstimatedCost.plus(itemCost);

        componentCosts.push({
            materialId: req.materialId,
            materialName: req.materialName,
            requiredQuantity: req.requiredQuantity.toNumber(),
            unitCost: unitCost.toNumber(),
            estimatedCost: itemCost.toNumber(),
            costingMethod: 'STANDARD_COST'
        });
    }

    return {
        finishedGoodItemId,
        requestedQuantity: quantity,
        totalEstimatedCost: totalEstimatedCost.toNumber(),
        componentCosts,
        disclaimer: "ESTIMATED COST ONLY. Not authoritative accounting."
    };
};
