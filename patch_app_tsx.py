
import re

with open("frontend/src/App.tsx", "r", encoding="utf-8") as f:
    data = f.read()

imports = """
import { TrialBalancePage } from "./pages/finance/TrialBalancePage";
import { ProfitLossPage } from "./pages/finance/ProfitLossPage";
import { BalanceSheetPage } from "./pages/finance/BalanceSheetPage";
"""

data = data.replace("import { Navigate, Outlet } from 'react-router-dom';", "import { Navigate, Outlet } from 'react-router-dom';\n" + imports)

routes = """
              {/* Financial Statements */}
              <Route path="finance/trial-balance" element={<TrialBalancePage />} />
              <Route path="finance/profit-loss"   element={<ProfitLossPage />} />
              <Route path="finance/balance-sheet" element={<BalanceSheetPage />} />
              <Route path="reports/profit"        element={<ProfitPage />} />
"""

data = data.replace("""<Route path="reports/profit"        element={<ProfitPage />} />""", routes)

with open("frontend/src/App.tsx", "w", encoding="utf-8") as f:
    f.write(data)

