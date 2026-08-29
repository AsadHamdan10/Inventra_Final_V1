import { Router } from "express";
import { InventoryOperationController } from "../controllers/inventoryOperationController";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/transfers", InventoryOperationController.listTransfers);
router.get("/transfers/:id", InventoryOperationController.getTransfer);
router.post("/transfers", InventoryOperationController.createTransfer);
router.get("/layers", InventoryOperationController.listLayers);

export default router;
