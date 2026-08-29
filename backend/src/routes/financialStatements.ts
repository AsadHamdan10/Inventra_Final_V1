import { Router } from "express";
import { FinancialStatementController } from "../controllers/financialStatementController";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/trial-balance", FinancialStatementController.getTrialBalance);
router.get("/profit-loss", FinancialStatementController.getProfitLoss);
router.get("/balance-sheet", FinancialStatementController.getBalanceSheet);

export default router;
