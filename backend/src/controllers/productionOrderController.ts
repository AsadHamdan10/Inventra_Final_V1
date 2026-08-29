import { Request, Response, NextFunction } from "express";
import { createProductionOrder, releaseProductionOrder } from "../services/manufacturing/productionOrderService";
import { startExecution, postMaterialIssue, postProductionOutput } from "../services/manufacturing/productionExecutionService";
import prisma from "../utils/prisma";

export class ProductionOrderController {
    static async list(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const items = await prisma.productionOrder.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include: { item: true } });
            res.json(items);
        } catch (e) { next(e); }
    }
    static async get(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await prisma.productionOrder.findUnique({ where: { id: parseInt(req.params.id) }, include: { item: true, components: { include: { componentItem: true } }, operations: { include: { workCenter: true } }, executions: { include: { materialIssues: true, outputs: true } } } });
            if (!item || item.userId !== userId) return res.status(404).json({ error: "Not found" });
            res.json(item);
        } catch (e) { next(e); }
    }
    static async create(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await createProductionOrder(userId, req.body);
            res.status(201).json(item);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    }
    static async release(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await releaseProductionOrder(userId, parseInt(req.params.id));
            res.json(item);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    }
    
    // Execution endpoints
    static async startExecution(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await startExecution(userId, parseInt(req.params.id), userId);
            res.json(item);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    }
    static async issueMaterial(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const { executionId, componentItemId, warehouseId, quantity } = req.body;
            const item = await postMaterialIssue(userId, executionId, componentItemId, warehouseId, quantity, userId);
            res.json(item);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    }
    static async recordOutput(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const { executionId, fgQuantity } = req.body;
            const item = await postProductionOutput(userId, executionId, fgQuantity, userId);
            res.json(item);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    }
}
