import prisma from '../../utils/prisma';
import { safeDecryptFinancial } from '../../utils/financialCrypto';

export async function getInventoryReport(userId: number) {
    const materials = await prisma.material.findMany({
        where: { userId },
        include: {
            inventoryLayers: {
                where: { remainingQty: { gt: 0 } }
            }
        }
    });

    const items = materials.map(m => {
        let valuation = 0;
        m.inventoryLayers.forEach(layer => {
            let cost = 0;
            try { cost = safeDecryptFinancial(layer.unitCostEnc); } catch(e) {}
            valuation += (Number(layer.remainingQty) * cost);
        });

        const currentQty = Number(m.currentStock);
        const lowStockThreshold = 10; // Default Low Stock Threshold
        
        let status = 'ACTIVE';
        if (currentQty <= 0) status = 'OUT OF STOCK';
        else if (currentQty < lowStockThreshold) status = 'LOW STOCK';

        return {
            id: m.id,
            materialName: m.materialName,
            hsnCode: m.hsnCode,
            unit: m.unit,
            currentQuantity: currentQty,
            valuation,
            isActive: m.isActive,
            status
        };
    });

    return {
        items,
        totalValuation: items.reduce((sum, item) => sum + item.valuation, 0),
        outOfStockCount: items.filter(i => i.status === 'OUT OF STOCK').length,
        lowStockCount: items.filter(i => i.status === 'LOW STOCK').length,
        activeCount: materials.filter(m => m.isActive).length
    };
}