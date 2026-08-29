
import { Request, Response, NextFunction } from "express";
import prisma from "../utils/prisma";

export class WarehouseController {
    static async list(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const items = await prisma.warehouse.findMany({ where: { userId }, orderBy: { id: "asc" } });
            res.json({ success: true, data: items });
        } catch (e) { next(e); }
    }
    static async create(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await prisma.warehouse.create({
                data: {
                    userId,
                    code: req.body.code,
                    name: req.body.name,
                    warehouseType: req.body.warehouseType || 'GENERAL'
                }
            });
            res.status(201).json({ success: true, data: item });
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    }
}

