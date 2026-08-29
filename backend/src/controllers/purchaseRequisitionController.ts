import { Request, Response, NextFunction } from "express";
import { createPurchaseRequisition, updatePurchaseRequisition, updatePurchaseRequisitionStatus, getPurchaseRequisition } from "../services/procurement/purchaseRequisitionService";
import prisma from "../utils/prisma";

export class PurchaseRequisitionController {
    static async list(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const items = await prisma.purchaseRequisition.findMany({ where: { userId }, orderBy: { requisitionDate: "desc" } });
            res.json(items);
        } catch (e) { next(e); }
    }
    static async get(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await getPurchaseRequisition(userId, parseInt(req.params.id));
            if (!item) return res.status(404).json({ error: "Not found" });
            res.json(item);
        } catch (e) { next(e); }
    }
    static async create(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await createPurchaseRequisition(userId, req.body);
            res.status(201).json(item);
        } catch (e) { next(e); }
    }
    static async update(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await updatePurchaseRequisition(userId, parseInt(req.params.id), req.body);
            res.json(item);
        } catch (e) { next(e); }
    }
    static async updateStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await updatePurchaseRequisitionStatus(userId, parseInt(req.params.id), req.body.status);
            res.json(item);
        } catch (e) { next(e); }
    }
}
