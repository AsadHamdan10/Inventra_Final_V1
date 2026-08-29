
import os

with open("frontend/src/App.tsx", "r", encoding="utf-8") as f:
    data = f.read()

imports = """
import { BomPage } from "./pages/manufacturing/BomPage";
import { ProductionOrderPage } from "./pages/manufacturing/ProductionOrderPage";
import { TrialBalancePage } from "./pages/finance/TrialBalancePage";
import { ProfitLossPage } from "./pages/finance/ProfitLossPage";
import { BalanceSheetPage } from "./pages/finance/BalanceSheetPage";
// Layouts
"""

data = data.replace("// Layouts", imports)

with open("frontend/src/App.tsx", "w", encoding="utf-8") as f:
    f.write(data)

