
import os

routes = {
    "bom.ts": """import { Router } from "express";
import { BomController } from "../controllers/bomController";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/", BomController.list);
router.get("/:id", BomController.get);
router.post("/", BomController.create);
router.post("/:id/activate", BomController.activate);

export default router;
""",
    "workCenters.ts": """import { Router } from "express";
import { WorkCenterController } from "../controllers/workCenterController";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/", WorkCenterController.list);
router.post("/", WorkCenterController.create);
router.put("/:id", WorkCenterController.update);

export default router;
""",
    "routings.ts": """import { Router } from "express";
import { RoutingController } from "../controllers/routingController";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/", RoutingController.list);
router.get("/:id", RoutingController.get);
router.post("/", RoutingController.create);
router.post("/:id/activate", RoutingController.activate);

export default router;
""",
    "productionOrders.ts": """import { Router } from "express";
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
"""
}

for name, content in routes.items():
    with open(f"backend/src/routes/{name}", "w", encoding="utf-8") as f:
        f.write(content)


