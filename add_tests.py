
import os

with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

# Replace test name
data = data.replace("=== STARTING PHASE 6.5 E2E INTEGRATION TESTS ===", "=== STARTING PHASE 6.6 ERP OPERATIONS TESTS ===")

new_tests = """
  console.log("\\nRunning Financial Statements Tests...");
  const { FinancialStatementController } = require("./dist/controllers/financialStatementController");
  
  // Mock express req/res
  let tbData = null;
  const mockReq = { user: { userId: t1.id }, query: {} };
  const mockRes = {
      json: (data) => { tbData = data; },
      status: () => mockRes
  };
  
  await FinancialStatementController.getTrialBalance(mockReq, mockRes, console.error);
  assert(tbData.balances.length > 0, "Trial balance should have accounts");
  assert.strictEqual(tbData.totalDebit, tbData.totalCredit, "Trial Balance DR must equal CR");
  
  let plData = null;
  mockRes.json = (data) => { plData = data; };
  await FinancialStatementController.getProfitLoss(mockReq, mockRes, console.error);
  assert(plData.revenueAccounts !== undefined, "P&L should have revenue");
  assert(plData.expenseAccounts !== undefined, "P&L should have expenses");
  
  let bsData = null;
  mockRes.json = (data) => { bsData = data; };
  await FinancialStatementController.getBalanceSheet(mockReq, mockRes, console.error);
  assert(bsData.isBalanced === true, "Balance Sheet must be balanced (Assets = Liab + Equity)");

  console.log("? Financial statements verified correctly\\n");
"""

data = data.replace("console.log(\"? All Phase 6.5 E2E integration tests passed successfully.\\n\");", new_tests + "console.log(\"? All Phase 6.6 ERP Operations tests passed successfully.\\n\");")

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)

