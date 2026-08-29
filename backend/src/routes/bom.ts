import { Router } from "express";
import { BomController } from "../controllers/bomController";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/", BomController.list);
router.get("/:id", BomController.get);
router.post("/", BomController.create);
router.post("/:id/activate", BomController.activate);

export default router;
