import { Router } from "express";
import { WorkCenterController } from "../controllers/workCenterController";
import { requireAuth } from "../middlewares/auth";
import { requireManufacturingEntitlement } from "../middlewares/entitlement";

const router = Router();
router.use(requireAuth);
router.use(requireManufacturingEntitlement);

router.get("/", WorkCenterController.list);
router.post("/", WorkCenterController.create);
router.put("/:id", WorkCenterController.update);

export default router;
