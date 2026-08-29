import { Router } from "express";
import { PurchaseQuotationController } from "../controllers/purchaseQuotationController";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/", PurchaseQuotationController.list);
router.get("/:id", PurchaseQuotationController.get);
router.post("/", PurchaseQuotationController.create);
router.patch("/:id/status", PurchaseQuotationController.updateStatus);

export default router;
