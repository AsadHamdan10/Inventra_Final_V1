import os

with open("backend/test_phase_6_6_erp_operations.js", "r", encoding="utf-8") as f:
    data = f.read()

config_code = """
  // Create accounts
  const acc1 = await prisma.chartOfAccount.create({ data: { userId: t1.id, accountCode: "RM", accountName: "RM", type: "ASSET" } });
  const acc2 = await prisma.chartOfAccount.create({ data: { userId: t1.id, accountCode: "WIP", accountName: "WIP", type: "ASSET" } });
  const acc3 = await prisma.chartOfAccount.create({ data: { userId: t1.id, accountCode: "FG", accountName: "FG", type: "ASSET" } });
  const acc4 = await prisma.chartOfAccount.create({ data: { userId: t1.id, accountCode: "COGS", accountName: "COGS", type: "EXPENSE" } });
  
  await prisma.tenantConfiguration.create({
    data: {
      userId: t1.id,
      rmInventoryAccountId: acc1.id,
      wipInventoryAccountId: acc2.id,
      fgInventoryAccountId: acc3.id,
      cogsAccountId: acc4.id,
      purchaseAccountId: acc4.id,
      salesAccountId: acc4.id,
      cgstAccountId: acc4.id,
      sgstAccountId: acc4.id,
      igstAccountId: acc4.id
    }
  });
"""

data = data.replace("  const t1Wh1 = await prisma.warehouse.create({ data: { userId: t1.id, code: 'WH1', name: 'T1 WH1', warehouseType: 'GENERAL' } });", config_code + "\n  const t1Wh1 = await prisma.warehouse.create({ data: { userId: t1.id, code: 'WH1', name: 'T1 WH1', warehouseType: 'GENERAL' } });")

with open("backend/test_phase_6_6_erp_operations.js", "w", encoding="utf-8") as f:
    f.write(data)
