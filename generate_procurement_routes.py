
import os

routes = {
    "purchaseRequisitions.ts": """import { Router } from "express";
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
""",
    "purchaseQuotations.ts": """import { Router } from "express";
import { PurchaseQuotationController } from "../controllers/purchaseQuotationController";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/", PurchaseQuotationController.list);
router.get("/:id", PurchaseQuotationController.get);
router.post("/", PurchaseQuotationController.create);
router.patch("/:id/status", PurchaseQuotationController.updateStatus);

export default router;
""",
    "purchaseOrdersProcurement.ts": """import { Router } from "express";
import { PurchaseOrderProcurementController } from "../controllers/purchaseOrderProcurementController";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/", PurchaseOrderProcurementController.list);
router.get("/:id", PurchaseOrderProcurementController.get);
router.post("/", PurchaseOrderProcurementController.create);
router.patch("/:id/status", PurchaseOrderProcurementController.updateStatus);

export default router;
""",
    "goodsReceipts.ts": """import { Router } from "express";
import { GoodsReceiptController } from "../controllers/goodsReceiptController";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/", GoodsReceiptController.list);
router.get("/:id", GoodsReceiptController.get);
router.post("/", GoodsReceiptController.create);
router.patch("/:id/status", GoodsReceiptController.updateStatus);

export default router;
"""
}

for name, content in routes.items():
    with open(f"backend/src/routes/{name}", "w", encoding="utf-8") as f:
        f.write(content)


