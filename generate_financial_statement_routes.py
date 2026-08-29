
import os

routes = {
    "financialStatements.ts": """import { Router } from "express";
import { FinancialStatementController } from "../controllers/financialStatementController";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/trial-balance", FinancialStatementController.getTrialBalance);
router.get("/profit-loss", FinancialStatementController.getProfitLoss);
router.get("/balance-sheet", FinancialStatementController.getBalanceSheet);

export default router;
"""
}

for name, content in routes.items():
    with open(f"backend/src/routes/{name}", "w", encoding="utf-8") as f:
        f.write(content)


