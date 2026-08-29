import * as fs from 'fs';
import * as path from 'path';

const reportPath = path.join(__dirname, 'src', 'controllers', 'reportController.ts');
let reportContent = fs.readFileSync(reportPath, 'utf8');

const getInventoryReportRegex = /export async function getInventoryReport[\s\S]*?export async function getProfitReport/;
const newGetInventoryReport = `export async function getInventoryReport(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const [purchased, sold, materials, activeLayers] = await Promise.all([
      prisma.purchaseItem.groupBy({ by: ['materialId'], where: { purchase: { userId } }, _sum: { quantity: true, itemTotal: true } }),
      prisma.saleItem.groupBy({ by: ['materialId'], where: { sale: { userId } }, _sum: { quantity: true, itemTotal: true } }),
      prisma.material.findMany({ where: { userId, isActive: true } }),
      prisma.inventoryLayer.findMany({ where: { userId, remainingQty: { gt: 0 } } })
    ]);

    const soldMap  = Object.fromEntries(sold.map(s => [s.materialId, { qty: Number(s._sum.quantity ?? 0), val: Number(s._sum.itemTotal ?? 0) }]));
    const purchMap = Object.fromEntries(purchased.map(p => [p.materialId, { qty: Number(p._sum.quantity ?? 0), val: Number(p._sum.itemTotal ?? 0) }]));

    const inventory = materials.map(m => {
      const p       = purchMap[m.id] ?? { qty: 0, val: 0 };
      const s       = soldMap[m.id]  ?? { qty: 0, val: 0 };
      const stock   = Number(m.currentStock);
      
      const layers = activeLayers.filter(l => l.materialId === m.id);
      let stockValue = 0;
      for (const layer of layers) {
          const remaining = Number(layer.remainingQty);
          const cost = layer.unitCostEnc ? safeDecryptFinancial(layer.unitCostEnc) : 0;
          stockValue += (remaining * cost);
      }

      // Keep avgCost for UI backward compatibility but derive it from true FIFO value
      const avgCost = stock > 0 ? (stockValue / stock) : 0;

      return {
        materialName: m.materialName,
        hsnCode:      m.hsnCode,
        unit:         m.unit,
        purchased:    p.qty,
        sold:         s.qty,
        stock,
        avgCost,
        stockValue,
        isLow:        stock < 10,
      };
    });

    const totalStockValue = inventory.reduce((acc, curr) => acc + curr.stockValue, 0);

    res.json({
      summary: {
        totalMaterials: inventory.length,
        lowStockItems:  inventory.filter(i => i.isLow).length,
        totalStockValue,
      },
      inventory,
    });
  } catch (err) {
    next(err);
  }
}

export async function getProfitReport`;

reportContent = reportContent.replace(getInventoryReportRegex, newGetInventoryReport);
fs.writeFileSync(reportPath, reportContent, 'utf8');

console.log('Patched reportController');
