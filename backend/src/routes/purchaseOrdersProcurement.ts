import { Router } from "express";
import { PurchaseOrderProcurementController } from "../controllers/purchaseOrderProcurementController";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/", PurchaseOrderProcurementController.list);
router.get("/:id", PurchaseOrderProcurementController.get);
router.post("/", PurchaseOrderProcurementController.create);
router.patch("/:id/status", PurchaseOrderProcurementController.updateStatus);

export default router;
