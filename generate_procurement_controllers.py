
import os

controllers = {
    "purchaseRequisitionController.ts": """import { Request, Response, NextFunction } from "express";
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
""",
    "purchaseQuotationController.ts": """import { Request, Response, NextFunction } from "express";
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
""",
    "purchaseOrderProcurementController.ts": """import { Request, Response, NextFunction } from "express";
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
""",
    "goodsReceiptController.ts": """import { Request, Response, NextFunction } from "express";
import { createGoodsReceipt, updateGoodsReceiptStatus, getGoodsReceipt } from "../services/procurement/goodsReceiptService";
import prisma from "../utils/prisma";

export class GoodsReceiptController {
    static async list(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const items = await prisma.goodsReceipt.findMany({ where: { userId }, orderBy: { receiptDate: "desc" } });
            res.json(items);
        } catch (e) { next(e); }
    }
    static async get(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await getGoodsReceipt(userId, parseInt(req.params.id));
            if (!item) return res.status(404).json({ error: "Not found" });
            res.json(item);
        } catch (e) { next(e); }
    }
    static async create(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await createGoodsReceipt(userId, req.body);
            res.status(201).json(item);
        } catch (e) { next(e); }
    }
    static async updateStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user.userId;
            const item = await updateGoodsReceiptStatus(userId, parseInt(req.params.id), req.body.status);
            res.json(item);
        } catch (e) { next(e); }
    }
}
"""
}

for name, content in controllers.items():
    with open(f"backend/src/controllers/{name}", "w", encoding="utf-8") as f:
        f.write(content)


