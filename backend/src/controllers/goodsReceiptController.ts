import { Request, Response, NextFunction } from "express";
import { createGoodsReceipt, postGoodsReceipt } from "../services/procurement/goodsReceiptService";
import prisma from "../utils/prisma";

export class GoodsReceiptController {
    static async list(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const items = await prisma.goodsReceipt.findMany({ where: { userId }, orderBy: { grnDate: "desc" } });
            res.json(items);
        } catch (e) { next(e); }
    }
    static async get(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await prisma.goodsReceipt.findUnique({ where: { id: parseInt(req.params.id), userId }, include: { items: true, warehouse: true, vendor: true } });
            if (!item) return res.status(404).json({ error: "Not found" });
            res.json(item);
        } catch (e) { next(e); }
    }
    static async create(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await createGoodsReceipt(userId, req.body);
            res.status(201).json(item);
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    }
    static async updateStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const status = req.body.status;
            if (status === "POSTED") {
                const item = await postGoodsReceipt(userId, parseInt(req.params.id));
                return res.json(item);
            }
            res.status(400).json({ error: "Only POSTED is supported via status update currently" });
        } catch (e: any) { res.status(400).json({ error: e.message }); }
    }
}
