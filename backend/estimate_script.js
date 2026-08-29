const fs = require('fs');
let code = fs.readFileSync('src/controllers/saleController.ts', 'utf8');

const estimateEndpoint = `
export const estimateFifo: import('express').RequestHandler = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      res.status(400).json({ error: 'Invalid items array' }); return;
    }

    const estimatedItems = [];
    let totalCogs = 0;
    let totalProfit = 0;

    for (const item of items) {
      if (!item.materialId || !item.quantity || item.quantity <= 0) continue;

      const material = await prisma.material.findUnique({ where: { id: item.materialId } });
      if (!material || material.userId !== userId || material.status === 'inactive') {
         res.status(400).json({ error: \`Material not found or inactive\` }); return;
      }
      
      let qtyToConsume = Number(item.quantity);
      let itemCogs = 0;

      const layers = await prisma.inventoryLayer.findMany({
          where: { userId, materialId: material.id, remainingQty: { gt: 0 } },
          orderBy: [ { receivedDate: 'asc' }, { id: 'asc' } ]
      });

      for (const layer of layers) {
          if (qtyToConsume <= 0) break;
          const available = Number(layer.remainingQty);
          const consume = Math.min(available, qtyToConsume);
          const layerCost = layer.unitCostEnc ? safeDecryptFinancial(layer.unitCostEnc) : 0;
          
          itemCogs += (consume * layerCost);
          qtyToConsume -= consume;
      }

      if (qtyToConsume > 0) {
          res.status(400).json({ error: \`Insufficient stock for \${material.materialName}. Remaining needed: \${qtyToConsume}\` }); return;
      }
      
      const sellingPrice = Number(item.unitPrice) || 0;
      const totalRevenue = sellingPrice * Number(item.quantity);
      const estimatedProfit = totalRevenue - itemCogs;
      const estimatedAverageCost = Number(item.quantity) > 0 ? itemCogs / Number(item.quantity) : 0;

      totalCogs += itemCogs;
      totalProfit += estimatedProfit;

      estimatedItems.push({
        materialId: item.materialId,
        quantity: item.quantity,
        estimatedCogs: itemCogs,
        estimatedAverageCost,
        estimatedProfit,
        estimatedProfitPct: totalRevenue > 0 ? (estimatedProfit / totalRevenue) * 100 : 0
      });
    }

    res.json({ success: true, items: estimatedItems, totalCogs, totalProfit }); return;
  } catch (error) {
    next(error);
  }
};
`;

code += '\n' + estimateEndpoint;
fs.writeFileSync('src/controllers/saleController.ts', code);
