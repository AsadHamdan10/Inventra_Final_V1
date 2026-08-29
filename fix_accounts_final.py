import os
import re

with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

data = re.sub(r"  // Create accounts.*?await prisma\.chartOfAccount\.create.*?\"Output GST\".*?\}\);\n", "", data, flags=re.DOTALL)

init_coa = """  const { initializeDefaultCOA } = require("./dist/services/accounting/coaService");
  await initializeDefaultCOA(t1.id);
  await initializeDefaultCOA(t2.id);"""

data = data.replace("  const t1Wh1 = await prisma.warehouse.create({ data: { userId: t1.id, code: 'WH1', name: 'T1 WH1', warehouseType: 'GENERAL' } });", init_coa + "\n  const t1Wh1 = await prisma.warehouse.create({ data: { userId: t1.id, code: 'WH1', name: 'T1 WH1', warehouseType: 'GENERAL' } });")

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)
