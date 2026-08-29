const fs = require('fs');

const code = `
export async function postProductionMaterialIssueAccounting(userId: number, executionId: number, executionNo: string, date: Date, totalMaterialCost: number, reqUserId: number, tx: any) {
  const drAccounts = await tx.chartOfAccount.findMany({ where: { userId, accountType: 'ASSET', name: { contains: 'Work In Progress' } } });
  let wipAccount = drAccounts[0];
  if (!wipAccount) wipAccount = await tx.chartOfAccount.findFirst({ where: { userId, name: { contains: 'Inventory' } } });

  const crAccounts = await tx.chartOfAccount.findMany({ where: { userId, accountType: 'ASSET', name: { contains: 'Inventory' } } });
  let rmAccount = crAccounts.find((a: any) => a.name.includes('Raw Material')) || crAccounts[0];

  if (!wipAccount || !rmAccount) throw new Error('ACCOUNTING_CONFIGURATION_ERROR: WIP or RM Inventory account missing.');

  const lines = [
    { accountId: wipAccount.id, debit: totalMaterialCost, credit: 0 },
    { accountId: rmAccount.id, debit: 0, credit: totalMaterialCost }
  ];

  await journalService.createJournal(userId, {
    date,
    reference: 'PEX-' + executionId + '-ISSUE',
    description: 'Material Issue for Production ' + executionNo,
    sourceType: 'PRODUCTION_EXECUTION',
    sourceId: executionId,
    lines
  }, reqUserId, tx);
}

export async function postProductionOutputAccounting(userId: number, executionId: number, executionNo: string, date: Date, fgCost: number, reqUserId: number, tx: any) {
  const fgAccounts = await tx.chartOfAccount.findMany({ where: { userId, accountType: 'ASSET', name: { contains: 'Finished Goods' } } });
  let fgAccount = fgAccounts[0] || await tx.chartOfAccount.findFirst({ where: { userId, name: { contains: 'Inventory' } } });

  const wipAccounts = await tx.chartOfAccount.findMany({ where: { userId, accountType: 'ASSET', name: { contains: 'Work In Progress' } } });
  let wipAccount = wipAccounts[0] || await tx.chartOfAccount.findFirst({ where: { userId, name: { contains: 'Inventory' } } });

  if (!fgAccount || !wipAccount) throw new Error('ACCOUNTING_CONFIGURATION_ERROR: FG Inventory or WIP account missing.');

  const lines = [
    { accountId: fgAccount.id, debit: fgCost, credit: 0 },
    { accountId: wipAccount.id, debit: 0, credit: fgCost }
  ];

  await journalService.createJournal(userId, {
    date,
    reference: 'PEX-' + executionId + '-OUTPUT',
    description: 'Finished Goods Output for Production ' + executionNo,
    sourceType: 'PRODUCTION_EXECUTION',
    sourceId: executionId,
    lines
  }, reqUserId, tx);
}
`;

fs.appendFileSync('src/services/accounting/accountingIntegrationService.ts', code);

