import { Router } from "express";
import { ProductionOrderController } from "../controllers/productionOrderController";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/", ProductionOrderController.list);
router.get("/:id", ProductionOrderController.get);
router.post("/", ProductionOrderController.create);
router.post("/:id/release", ProductionOrderController.release);

router.post("/:id/start-execution", ProductionOrderController.startExecution);
router.post("/:id/issue-material", ProductionOrderController.issueMaterial);
router.post("/:id/record-output", ProductionOrderController.recordOutput);

export default router;
