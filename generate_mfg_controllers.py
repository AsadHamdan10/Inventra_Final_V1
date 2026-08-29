
import os

controllers = {
    "bomController.ts": """import { Request, Response, NextFunction } from "express";
import { createBOM, activateBOM, explodeBOM } from "../services/manufacturing/bomService";
import prisma from "../utils/prisma";

export class BomController {
    static async list(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const items = await prisma.billOfMaterial.findMany({ where: { userId }, include: { material: true } });
            res.json(items);
        } catch (e) { next(e); }
    }
    static async get(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await prisma.billOfMaterial.findUnique({ where: { id: parseInt(req.params.id) }, include: { material: true, items: { include: { component: true } } } });
            if (!item || item.userId !== userId) return res.status(404).json({ error: "Not found" });
            res.json(item);
        } catch (e) { next(e); }
    }
    static async create(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await createBOM(userId, req.body);
            res.status(201).json(item);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    }
    static async activate(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await activateBOM(userId, parseInt(req.params.id));
            res.json(item);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    }
}
""",
    "workCenterController.ts": """import { Request, Response, NextFunction } from "express";
import { createWorkCenter, updateWorkCenter, getWorkCenters } from "../services/manufacturing/workCenterService";
import prisma from "../utils/prisma";

export class WorkCenterController {
    static async list(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const items = await getWorkCenters(userId);
            res.json(items);
        } catch (e) { next(e); }
    }
    static async create(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await createWorkCenter(userId, req.body);
            res.status(201).json(item);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    }
    static async update(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await updateWorkCenter(userId, parseInt(req.params.id), req.body);
            res.json(item);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    }
}
""",
    "routingController.ts": """import { Request, Response, NextFunction } from "express";
import { createRouting, activateRouting } from "../services/manufacturing/routingService";
import prisma from "../utils/prisma";

export class RoutingController {
    static async list(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const items = await prisma.routing.findMany({ where: { userId }, include: { material: true } });
            res.json(items);
        } catch (e) { next(e); }
    }
    static async get(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await prisma.routing.findUnique({ where: { id: parseInt(req.params.id) }, include: { material: true, operations: { include: { workCenter: true } } } });
            if (!item || item.userId !== userId) return res.status(404).json({ error: "Not found" });
            res.json(item);
        } catch (e) { next(e); }
    }
    static async create(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await createRouting(userId, req.body);
            res.status(201).json(item);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    }
    static async activate(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await activateRouting(userId, parseInt(req.params.id));
            res.json(item);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    }
}
""",
    "productionOrderController.ts": """import { Request, Response, NextFunction } from "express";
import { createProductionOrder, releaseProductionOrder } from "../services/manufacturing/productionOrderService";
import { startExecution, postMaterialIssue, postProductionOutput } from "../services/manufacturing/productionExecutionService";
import prisma from "../utils/prisma";

export class ProductionOrderController {
    static async list(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const items = await prisma.productionOrder.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include: { material: true } });
            res.json(items);
        } catch (e) { next(e); }
    }
    static async get(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await prisma.productionOrder.findUnique({ where: { id: parseInt(req.params.id) }, include: { material: true, components: { include: { component: true } }, operations: { include: { workCenter: true } }, executions: { include: { materialIssues: true, outputs: true } } } });
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
"""
}

for name, content in controllers.items():
    with open(f"backend/src/controllers/{name}", "w", encoding="utf-8") as f:
        f.write(content)


