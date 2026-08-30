import { Router } from "express";
import { BomController } from "../controllers/bomController";
import { requireAuth } from "../middlewares/auth";
import { requireManufacturingEntitlement } from "../middlewares/entitlement";

const router = Router();
router.use(requireAuth);
router.use(requireManufacturingEntitlement);

router.get("/", BomController.list);
router.get("/:id", BomController.get);
router.post("/", BomController.create);
router.post("/:id/activate", BomController.activate);

export default router;
