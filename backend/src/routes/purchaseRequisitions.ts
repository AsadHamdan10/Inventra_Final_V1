import { Router } from "express";
import { PurchaseRequisitionController } from "../controllers/purchaseRequisitionController";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/", PurchaseRequisitionController.list);
router.get("/:id", PurchaseRequisitionController.get);
router.post("/", PurchaseRequisitionController.create);
router.put("/:id", PurchaseRequisitionController.update);
router.patch("/:id/status", PurchaseRequisitionController.updateStatus);

export default router;
