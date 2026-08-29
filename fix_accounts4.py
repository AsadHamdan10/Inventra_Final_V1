
import os

with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

config_code = """
  // Create accounts
  await prisma.chartOfAccount.create({ data: { userId: t1.id, code: "RM", name: "Inventory - Raw Material", accountType: "ASSET" } });
  await prisma.chartOfAccount.create({ data: { userId: t1.id, code: "WIP", name: "Work In Progress", accountType: "ASSET" } });
  await prisma.chartOfAccount.create({ data: { userId: t1.id, code: "FG", name: "Inventory - Finished Goods", accountType: "ASSET" } });
  await prisma.chartOfAccount.create({ data: { userId: t1.id, code: "COGS", name: "Cost of Goods Sold", accountType: "EXPENSE" } });
  await prisma.chartOfAccount.create({ data: { userId: t1.id, code: "SALES", name: "Sales Revenue", accountType: "REVENUE" } });
  await prisma.chartOfAccount.create({ data: { userId: t1.id, code: "AR", name: "Accounts Receivable", accountType: "ASSET" } });
  await prisma.chartOfAccount.create({ data: { userId: t1.id, code: "AP", name: "Accounts Payable", accountType: "LIABILITY" } });
  await prisma.chartOfAccount.create({ data: { userId: t1.id, code: "GST_IN", name: "Input GST", accountType: "ASSET" } });
  await prisma.chartOfAccount.create({ data: { userId: t1.id, code: "GST_OUT", name: "Output GST", accountType: "LIABILITY" } });
"""

import re
data = re.sub(r"  // Create accounts.*?igstAccountId: 20\n    }\n  \}\);", config_code, data, flags=re.DOTALL)

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)

