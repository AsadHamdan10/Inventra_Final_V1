import prisma from '../../utils/prisma';
import { Decimal } from '@prisma/client/runtime/library';

export class InventoryReconciliationService {
    public static async reconcileInventory(userId: number) {
        const anomalies: string[] = [];
        
        const materials = await prisma.material.findMany({
            where: { userId },
            include: {
                inventoryLayers: true
            }
        });

        for (const mat of materials) {
            // Reconcile mathematical stock against layers
            let expectedStock = new Decimal(0);
            for (const layer of mat.inventoryLayers) {
                expectedStock = expectedStock.plus(layer.remainingQty);
            }

            if (!expectedStock.equals(mat.currentStock)) {
                anomalies.push(`Material ${mat.id} (${mat.materialName}) stock mismatch. Record: ${mat.currentStock}, Layers: ${expectedStock}`);
            }

            if (mat.currentStock.lessThan(0)) {
                anomalies.push(`Material ${mat.id} (${mat.materialName}) has NEGATIVE current stock: ${mat.currentStock}`);
            }

            // Check layer consumption
            const consumptions = await prisma.layerConsumption.findMany({
                where: { inventoryLayers: { materialId: mat.id } }
            });

            for (const layer of mat.inventoryLayers) {
                const consumedFromLayer = consumptions
                    .filter(c => c.layerId === layer.id)
                    .reduce((acc, c) => acc.plus(c.quantityConsumed), new Decimal(0));

                const expectedRemaining = layer.originalQty.minus(consumedFromLayer);
                
                if (!expectedRemaining.equals(layer.remainingQty)) {
                    anomalies.push(`Layer ${layer.id} for Material ${mat.id} mismatch. Original: ${layer.originalQty}, Consumed: ${consumedFromLayer}, Remaining: ${layer.remainingQty}, ExpectedRemaining: ${expectedRemaining}`);
                }
            }
        }

        return anomalies;
    }
}
