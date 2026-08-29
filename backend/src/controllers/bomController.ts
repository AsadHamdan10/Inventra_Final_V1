import { Request, Response, NextFunction } from "express";
import { createBOM, activateBOM, explodeBOM } from "../services/manufacturing/bomService";
import prisma from "../utils/prisma";

export class BomController {
    static async list(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const items = await prisma.billOfMaterial.findMany({ where: { userId }, include: { finishedGoodItem: true } });
            res.json(items);
        } catch (e) { next(e); }
    }
    static async get(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await prisma.billOfMaterial.findUnique({ where: { id: parseInt(req.params.id) }, include: { finishedGoodItem: true, items: { include: { componentItem: true } } } });
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
