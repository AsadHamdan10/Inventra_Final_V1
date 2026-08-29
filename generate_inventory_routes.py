
import os

routes = {
    "inventoryOperations.ts": """import { Router } from "express";
import { InventoryOperationController } from "../controllers/inventoryOperationController";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/transfers", InventoryOperationController.listTransfers);
router.get("/transfers/:id", InventoryOperationController.getTransfer);
router.post("/transfers", InventoryOperationController.createTransfer);

export default router;
"""
}

for name, content in routes.items():
    with open(f"backend/src/routes/{name}", "w", encoding="utf-8") as f:
        f.write(content)


