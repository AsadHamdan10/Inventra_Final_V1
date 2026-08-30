import { Router } from "express";
import { RoutingController } from "../controllers/routingController";
import { requireAuth } from "../middlewares/auth";
import { requireManufacturingEntitlement } from "../middlewares/entitlement";

const router = Router();
router.use(requireAuth);
router.use(requireManufacturingEntitlement);

router.get("/", RoutingController.list);
router.get("/:id", RoutingController.get);
router.post("/", RoutingController.create);
router.post("/:id/activate", RoutingController.activate);

export default router;
