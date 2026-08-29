import { Router } from "express";
import { GoodsReceiptController } from "../controllers/goodsReceiptController";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/", GoodsReceiptController.list);
router.get("/:id", GoodsReceiptController.get);
router.post("/", GoodsReceiptController.create);
router.patch("/:id/status", GoodsReceiptController.updateStatus);

export default router;
