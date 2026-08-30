import { Router } from "express";
import { ProductionOrderController } from "../controllers/productionOrderController";
import { requireAuth } from "../middlewares/auth";
import { requireManufacturingEntitlement } from "../middlewares/entitlement";

const router = Router();
router.use(requireAuth);
router.use(requireManufacturingEntitlement);

router.get("/", ProductionOrderController.list);
router.get("/:id", ProductionOrderController.get);
router.post("/", ProductionOrderController.create);
router.post("/:id/release", ProductionOrderController.release);

router.post("/:id/start-execution", ProductionOrderController.startExecution);
router.post("/:id/issue-material", ProductionOrderController.issueMaterial);
router.post("/:id/record-output", ProductionOrderController.recordOutput);

export default router;
