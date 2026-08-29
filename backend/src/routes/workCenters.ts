import { Router } from "express";
import { WorkCenterController } from "../controllers/workCenterController";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/", WorkCenterController.list);
router.post("/", WorkCenterController.create);
router.put("/:id", WorkCenterController.update);

export default router;
