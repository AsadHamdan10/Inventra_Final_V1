import { Request, Response, NextFunction } from "express";
import { postStockTransfer } from "../services/inventory/inventoryOperationService";
import prisma from "../utils/prisma";

export class InventoryOperationController {
    static async listLayers(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const { materialId, warehouseId } = req.query;
            
            const whereClause: any = { userId };
            if (materialId) whereClause.materialId = parseInt(materialId as string);
            if (warehouseId) whereClause.warehouseId = parseInt(warehouseId as string);
            
            const layers = await prisma.inventoryLayer.findMany({
                where: whereClause,
                include: {
                    material: true,
                    warehouse: true
                },
                orderBy: { receivedDate: "asc" }
            });
            
            // Do not expose unitCostEnc, only decode if needed or leave it out
            const result = layers.map(l => {
                const { unitCostEnc, ...safeLayer } = l;
                return safeLayer;
            });
            
            res.json({ success: true, data: result });
        } catch (e) { next(e); }
    }

    static async listTransfers(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const items = await prisma.stockTransfer.findMany({ where: { userId }, orderBy: { transferDate: "desc" }, include: { sourceWarehouse: true, destinationWarehouse: true } });
            res.json(items);
        } catch (e) { next(e); }
    }
    static async getTransfer(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await prisma.stockTransfer.findUnique({ where: { id: parseInt(req.params.id) }, include: { sourceWarehouse: true, destinationWarehouse: true, items: { include: { material: true } } } });
            if (!item || item.userId !== userId) return res.status(404).json({ error: "Not found" });
            res.json(item);
        } catch (e) { next(e); }
    }
    static async createTransfer(req: Request, res: Response, next: NextFunction) {
        try {
            const reqUserId = (req as any).user.userId;
            const { transferNo, transferDate, sourceWarehouseId, destinationWarehouseId, items, description } = req.body;
            const result = await postStockTransfer(reqUserId, transferNo, new Date(transferDate), sourceWarehouseId, destinationWarehouseId, items, reqUserId, description);
            res.status(201).json(result);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    }
}
