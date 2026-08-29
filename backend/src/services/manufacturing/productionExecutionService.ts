import prisma from '../../utils/prisma';
import { generateDocumentNumber } from '../../utils/tenantId';
import { safeDecrypt, encryptData } from '../../utils/crypto';
import { postProductionMaterialIssueAccounting, postProductionOutputAccounting } from '../accounting/accountingIntegrationService';

export const startExecution = async (userId: number, productionOrderId: number, reqUserId: number) => {
    return prisma.$transaction(async (tx) => {
        const order = await tx.productionOrder.findUnique({ where: { id: productionOrderId, userId }});
        if (!order) throw new Error("Production Order not found");
        if (order.status !== 'RELEASED' && order.status !== 'PARTIALLY_COMPLETED') throw new Error("Production Order must be RELEASED or PARTIALLY_COMPLETED");
        
        const executionNo = await generateDocumentNumber('PEX', userId, new Date(), tx);

        const execution = await tx.productionExecution.create({
            data: {
                userId,
                productionOrderId,
                executionNo,
                executionDate: new Date(),
                warehouseId: order.warehouseId,
                status: 'IN_PROGRESS'
            }
        });

        await tx.productionOrder.update({
            where: { id: productionOrderId },
            data: { status: 'IN_PROGRESS' }
        });

        return execution;
    });
};

export const postMaterialIssue = async (userId: number, executionId: number, componentItemId: number, warehouseId: number, quantity: number, reqUserId: number) => {
    return prisma.$transaction(async (tx) => {
        const execution = await tx.productionExecution.findUnique({
            where: { id: executionId, userId },
            include: { productionOrder: true }
        });
        if (!execution || execution.status !== 'IN_PROGRESS') throw new Error("Execution is not IN_PROGRESS");

        // Lock material
        await tx.$executeRaw`SELECT id FROM materials WHERE id = ${componentItemId} FOR UPDATE`;
        const material = await tx.material.findUnique({ where: { id: componentItemId } });
        if (!material || Number(material.currentStock) < quantity) throw new Error("Insufficient stock");

        // Validate requirement
        const poComp = await tx.productionOrderComponent.findFirst({
            where: { productionOrderId: execution.productionOrderId, componentItemId }
        });
        if (!poComp) throw new Error("Component not required for this Production Order");
        const remainingToIssue = Number(poComp.requiredQuantity) - Number(poComp.issuedQuantity);
        if (quantity > remainingToIssue) throw new Error(`Over-consumption blocked. Can only issue up to ${remainingToIssue}`);

        // FIFO Engine Logic
        let remainingToConsume = quantity;
        const layers = await tx.inventoryLayer.findMany({
            where: { materialId: componentItemId, remainingQty: { gt: 0 } },
            orderBy: { receivedDate: 'asc' }
        });

        let totalActualCost = 0;
        const layerConsumptions = [];

        for (const layer of layers) {
            if (remainingToConsume <= 0) break;
            const consumeQty = Math.min(Number(layer.remainingQty), remainingToConsume);
            const costPerUnit = Number(safeDecrypt(layer.unitCostEnc));
            totalActualCost += consumeQty * costPerUnit;

            layerConsumptions.push({
                layerId: layer.id,
                quantityConsumed: consumeQty,
                unitCostEnc: layer.unitCostEnc
            });

            await tx.inventoryLayer.update({
                where: { id: layer.id },
                data: { remainingQty: Number(layer.remainingQty) - consumeQty }
            });

            remainingToConsume -= consumeQty;
        }

        if (remainingToConsume > 0) throw new Error("FIFO layers insufficient to cover stock");

        // Record execution material issue
        const materialIssue = await tx.productionMaterialIssue.create({
            data: {
                executionId,
                componentItemId,
                warehouseId,
                quantity,
                actualCost: totalActualCost
            }
        });

        // Create Inventory Ledger OUT
        const ledgerOut = await tx.inventoryLedger.create({
            data: {
                userId,
                materialId: componentItemId,
                warehouseId,
                txnDate: new Date(),
                movementType: 'OUT',
                quantity,
                referenceType: 'PRODUCTION_EXECUTION',
                referenceId: executionId,
                notes: `Material Issue for ${execution.executionNo}`
            }
        });

        await tx.productionMaterialIssue.update({
            where: { id: materialIssue.id },
            data: { inventoryLedgerOutId: ledgerOut.id }
        });

        // Layer consumptions
        for (const lc of layerConsumptions) {
            await tx.layerConsumption.create({
                data: {
                    userId,
                    layerId: lc.layerId,
                    productionMaterialIssueId: materialIssue.id,
                    quantityConsumed: lc.quantityConsumed,
                    unitCostEnc: lc.unitCostEnc
                }
            });
        }

        // Update Material Stock
        await tx.material.update({
            where: { id: componentItemId },
            data: { currentStock: Number(material.currentStock) - quantity }
        });

        // Update PO Component
        await tx.productionOrderComponent.update({
            where: { id: poComp.id },
            data: { issuedQuantity: Number(poComp.issuedQuantity) + quantity }
        });

        // Update execution total cost
        await tx.productionExecution.update({
            where: { id: executionId },
            data: { totalMaterialCost: Number(execution.totalMaterialCost) + totalActualCost }
        });

        // Accounting
        await postProductionMaterialIssueAccounting(userId, execution.id, execution.executionNo, new Date(), totalActualCost, reqUserId, tx);

        return materialIssue;
    });
};

export const postProductionOutput = async (userId: number, executionId: number, fgQuantity: number, reqUserId: number) => {
    return prisma.$transaction(async (tx) => {
        const execution = await tx.productionExecution.findUnique({
            where: { id: executionId, userId },
            include: { productionOrder: true, materialIssues: true, outputs: true }
        });
        if (!execution || execution.status !== 'IN_PROGRESS') throw new Error("Execution is not IN_PROGRESS");

        const po = execution.productionOrder;
        const totalAlreadyProduced = Number(po.completedQuantity);
        if (totalAlreadyProduced + fgQuantity > Number(po.plannedQuantity)) {
            throw new Error(`Over-production blocked. Can only produce up to ${Number(po.plannedQuantity) - totalAlreadyProduced}`);
        }

        // Determine cost: Proportional FG cost from total execution material issues.
        // E.g., if total material issued so far in this execution cost 10,000, 
        // and we are producing the expected quantity corresponding to those materials.
        // Actually, this is an execution. We sum all actualCost of materialIssues in THIS execution.
        const totalMaterialCost = execution.materialIssues.reduce((sum, mi) => sum + Number(mi.actualCost), 0);
        
        // Wait, how much of that cost goes into THIS output if there are multiple outputs in one execution?
        const totalOutputsSoFar = execution.outputs.reduce((sum, po) => sum + Number(po.actualCost), 0);
        
        // Simplest strategy: all remaining unallocated material cost goes to this FG receipt.
        // Or we use proportional if we know planned output of this execution.
        // Let's assume one output per execution for cost simplicity, or proportional by FG qty.
        // For Phase 5.4: Assign entire remaining unallocated execution material cost to this output.
        const fgActualCost = totalMaterialCost - totalOutputsSoFar;

        const output = await tx.productionOutput.create({
            data: {
                executionId,
                warehouseId: execution.warehouseId,
                quantity: fgQuantity,
                actualCost: fgActualCost
            }
        });

        const ledgerIn = await tx.inventoryLedger.create({
            data: {
                userId,
                materialId: po.itemId,
                warehouseId: execution.warehouseId,
                txnDate: new Date(),
                movementType: 'IN',
                quantity: fgQuantity,
                referenceType: 'PRODUCTION_EXECUTION',
                referenceId: executionId,
                notes: `Production Output for ${execution.executionNo}`
            }
        });

        // Need to create InventoryLayer. 
        // We can't import FIFO directly, but we can manually insert the IN layer as `createPurchase` does.
        // wait, I can just create it. `unitCostEnc` = safeEncrypt( (fgActualCost / fgQuantity).toString() );
        // Need `crypto.ts` for safeEncrypt.
        const unitCost = fgQuantity > 0 ? (fgActualCost / fgQuantity) : 0;

        const layer = await tx.inventoryLayer.create({
            data: {
                userId,
                materialId: po.itemId,
                sourceType: 'PRODUCTION_EXECUTION',
                sourceId: executionId,
                warehouseId: execution.warehouseId,
                receivedDate: new Date(),
                originalQty: fgQuantity,
                remainingQty: fgQuantity,
                unitCostEnc: encryptData(unitCost.toString())
            }
        });

        await tx.productionOutput.update({
            where: { id: output.id },
            data: { inventoryLedgerInId: ledgerIn.id, inventoryLayerId: layer.id }
        });

        // Update Material Stock
        const fgMat = await tx.material.findUnique({ where: { id: po.itemId } });
        await tx.material.update({
            where: { id: po.itemId },
            data: { currentStock: Number(fgMat!.currentStock) + fgQuantity }
        });

        // Update PO
        const newCompleted = Number(po.completedQuantity) + fgQuantity;
        const newStatus = newCompleted >= Number(po.plannedQuantity) ? 'COMPLETED' : 'PARTIALLY_COMPLETED';

        await tx.productionOrder.update({
            where: { id: po.id },
            data: { completedQuantity: newCompleted, status: newStatus }
        });

        // Finish execution if completed
        await tx.productionExecution.update({
            where: { id: executionId },
            data: { status: 'COMPLETED', totalFgCost: Number(execution.totalFgCost) + fgActualCost }
        });

        // Accounting
        await postProductionOutputAccounting(userId, execution.id, execution.executionNo, new Date(), fgActualCost, reqUserId, tx);

        return output;
    });
};

