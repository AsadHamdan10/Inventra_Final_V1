import os

with open("frontend/src/App.tsx", "r", encoding="utf-8") as f:
    data = f.read()

imports = """
import { BomPage } from "./pages/manufacturing/BomPage";
import { ProductionOrderPage } from "./pages/manufacturing/ProductionOrderPage";
"""

data = data.replace("import { TrialBalancePage } from \"./pages/finance/TrialBalancePage\";", imports + "\nimport { TrialBalancePage } from \"./pages/finance/TrialBalancePage\";")

routes = """
              {/* Manufacturing */}
              <Route path="manufacturing/bom" element={<BomPage />} />
              <Route path="manufacturing/production-orders" element={<ProductionOrderPage />} />
"""

data = data.replace("{/* Financial Statements */}", routes + "\n              {/* Financial Statements */}")

with open("frontend/src/App.tsx", "w", encoding="utf-8") as f:
    f.write(data)

with open("frontend/src/components/layout/AppLayout.tsx", "r", encoding="utf-8") as f:
    data = f.read()

sidebar = """
    {
      title: 'Manufacturing',
      items: [
        { to: '/manufacturing/bom', icon: Package, label: 'Bill of Materials' },
        { to: '/manufacturing/production-orders', icon: FileText, label: 'Production Orders' },
      ],
    },
    {
      title: 'Finance',
      items: [
        { to: '/finance/trial-balance', icon: BookOpen, label: 'Trial Balance' },
        { to: '/finance/profit-loss', icon: TrendingUp, label: 'Profit and Loss' },
        { to: '/finance/balance-sheet', icon: Landmark, label: 'Balance Sheet' },
"""

data = data.replace("""    {
      title: 'Finance',
      items: [""", sidebar)

with open("frontend/src/components/layout/AppLayout.tsx", "w", encoding="utf-8") as f:
    f.write(data)
