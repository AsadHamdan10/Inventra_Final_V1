import { Request, Response, NextFunction } from "express";
import { createPurchaseQuotation, updatePurchaseQuotationStatus, getPurchaseQuotation } from "../services/procurement/purchaseQuotationService";
import prisma from "../utils/prisma";

export class PurchaseQuotationController {
    static async list(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const items = await prisma.purchaseQuotation.findMany({ where: { userId }, orderBy: { quotationDate: "desc" } });
            res.json(items);
        } catch (e) { next(e); }
    }
    static async get(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await getPurchaseQuotation(userId, parseInt(req.params.id));
            if (!item) return res.status(404).json({ error: "Not found" });
            res.json(item);
        } catch (e) { next(e); }
    }
    static async create(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await createPurchaseQuotation(userId, req.body);
            res.status(201).json(item);
        } catch (e) { next(e); }
    }
    static async updateStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await updatePurchaseQuotationStatus(userId, parseInt(req.params.id), req.body.status);
            res.json(item);
        } catch (e) { next(e); }
    }
}
