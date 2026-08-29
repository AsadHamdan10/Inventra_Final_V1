import { Router } from "express";
import { RoutingController } from "../controllers/routingController";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/", RoutingController.list);
router.get("/:id", RoutingController.get);
router.post("/", RoutingController.create);
router.post("/:id/activate", RoutingController.activate);

export default router;
