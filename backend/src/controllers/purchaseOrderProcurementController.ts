import { Request, Response, NextFunction } from "express";
import { createPurchaseOrder, updatePurchaseOrderStatus, getPurchaseOrder } from "../services/procurement/purchaseOrderService";
import prisma from "../utils/prisma";

export class PurchaseOrderProcurementController {
    static async list(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const items = await prisma.purchaseOrder.findMany({ where: { userId }, orderBy: { orderDate: "desc" } });
            res.json(items);
        } catch (e) { next(e); }
    }
    static async get(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await getPurchaseOrder(userId, parseInt(req.params.id));
            if (!item) return res.status(404).json({ error: "Not found" });
            res.json(item);
        } catch (e) { next(e); }
    }
    static async create(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await createPurchaseOrder(userId, req.body);
            res.status(201).json(item);
        } catch (e) { next(e); }
    }
    static async updateStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await updatePurchaseOrderStatus(userId, parseInt(req.params.id), req.body.status);
            res.json(item);
        } catch (e) { next(e); }
    }
}
