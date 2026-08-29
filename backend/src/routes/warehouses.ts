
import { Router } from "express";
import { WarehouseController } from "../controllers/warehouseController";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/", WarehouseController.list);
router.post("/", WarehouseController.create);

export default router;

