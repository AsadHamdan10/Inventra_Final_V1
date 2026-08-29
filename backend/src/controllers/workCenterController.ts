import { Request, Response, NextFunction } from "express";
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
