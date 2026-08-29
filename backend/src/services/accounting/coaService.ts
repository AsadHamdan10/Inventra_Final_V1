import prisma from '../../utils/prisma';
import { ACCOUNT_TYPES, AccountType, isValidAccountType, isValidAccountSubType } from '../../constants/accounting';
import { auditLog } from '../auditService';

export async function initializeDefaultCOA(userId: number) {
  const existingSystemAccounts = await prisma.chartOfAccount.count({
    where: { userId, isSystemAccount: true }
  });

  if (existingSystemAccounts > 0) return { message: 'Already initialized' };

  const defaultAccounts = [
    { code: '1000', name: 'Assets', type: 'ASSET', subType: null },
    { code: '1100', name: 'Current Assets', type: 'ASSET', subType: 'CURRENT_ASSET', parentCode: '1000' },
    { code: '1110', name: 'Cash', type: 'ASSET', subType: 'CURRENT_ASSET', parentCode: '1100' },
    { code: '1120', name: 'Bank', type: 'ASSET', subType: 'CURRENT_ASSET', parentCode: '1100' },
    { code: '1130', name: 'Accounts Receivable', type: 'ASSET', subType: 'CURRENT_ASSET', parentCode: '1100' },
    { code: '1140', name: 'Inventory', type: 'ASSET', subType: 'CURRENT_ASSET', parentCode: '1100' },
    { code: '1200', name: 'Fixed Assets', type: 'ASSET', subType: 'FIXED_ASSET', parentCode: '1000' },
    { code: '1210', name: 'Equipment', type: 'ASSET', subType: 'FIXED_ASSET', parentCode: '1200' },
    { code: '1220', name: 'Furniture & Fixtures', type: 'ASSET', subType: 'FIXED_ASSET', parentCode: '1200' },

    { code: '2000', name: 'Liabilities', type: 'LIABILITY', subType: null },
    { code: '2100', name: 'Current Liabilities', type: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentCode: '2000' },
    { code: '2110', name: 'Accounts Payable', type: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentCode: '2100' },
    { code: '2120', name: 'Customer Advances', type: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentCode: '2100' },
    { code: '2130', name: 'Output CGST', type: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentCode: '2100' },
    { code: '2140', name: 'Output SGST', type: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentCode: '2100' },
    { code: '2150', name: 'Output IGST', type: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentCode: '2100' },
    { code: '2160', name: 'Input CGST', type: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentCode: '2100' },
    { code: '2170', name: 'Input SGST', type: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentCode: '2100' },
    { code: '2180', name: 'Input IGST', type: 'LIABILITY', subType: 'CURRENT_LIABILITY', parentCode: '2100' },

    { code: '3000', name: 'Equity', type: 'EQUITY', subType: null },
    { code: '3100', name: 'Owner Capital', type: 'EQUITY', subType: 'CAPITAL', parentCode: '3000' },
    { code: '3200', name: 'Retained Earnings', type: 'EQUITY', subType: 'RETAINED_EARNINGS', parentCode: '3000' },
    { code: '3300', name: 'Opening Balance Equity', type: 'EQUITY', subType: 'CAPITAL', parentCode: '3000' },

    { code: '4000', name: 'Income', type: 'INCOME', subType: null },
    { code: '4100', name: 'Sales Revenue', type: 'INCOME', subType: 'SALES', parentCode: '4000' },
    { code: '4200', name: 'Other Income', type: 'INCOME', subType: 'OTHER_INCOME', parentCode: '4000' },
    { code: '4300', name: 'Sales Returns', type: 'INCOME', subType: 'SALES', parentCode: '4000' },

    { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE', subType: null },
    { code: '5100', name: 'Cost of Goods Sold', type: 'EXPENSE', subType: 'COGS', parentCode: '5000' },

    { code: '6000', name: 'Expenses', type: 'EXPENSE', subType: null },
    { code: '6100', name: 'Operating Expenses', type: 'EXPENSE', subType: 'OPERATING_EXPENSE', parentCode: '6000' },
    { code: '6200', name: 'Other Expenses', type: 'EXPENSE', subType: 'OTHER_EXPENSE', parentCode: '6000' }
  ];

  await prisma.$transaction(async (tx) => {
    const codeIdMap: Record<string, number> = {};

    for (const acc of defaultAccounts) {
      let parentId: number | null = null;
      if (acc.parentCode) {
        if (codeIdMap[acc.parentCode]) {
          parentId = codeIdMap[acc.parentCode];
        } else {
          const parent = await tx.chartOfAccount.findUnique({
            where: { userId_code: { userId, code: acc.parentCode } }
          });
          parentId = parent ? parent.id : null;
        }
      }

      const created = await tx.chartOfAccount.upsert({
        where: { userId_code: { userId, code: acc.code } },
        update: {
            // we do not overwrite active/inactive state in an upsert
        },
        create: {
          userId,
          code: acc.code,
          name: acc.name,
          accountType: acc.type,
          accountSubType: acc.subType,
          parentId,
          isSystemAccount: true,
          isActive: true
        }
      });
      codeIdMap[acc.code] = created.id;
    }
  });

  await auditLog(userId, 'COA_INITIALIZED', 'System accounts initialized');

  return { message: 'Initialized successfully' };
}

export async function getChartOfAccounts(userId: number) {
  return await prisma.chartOfAccount.findMany({
    where: { userId },
    orderBy: { code: 'asc' }
  });
}

export async function getAccount(userId: number, id: number) {
  return await prisma.chartOfAccount.findFirst({
    where: { id, userId }
  });
}

function checkCycle(nodes: any[], accountId: number, proposedParentId: number): boolean {
  let currentId: number | null = proposedParentId;
  const visited = new Set<number>();
  while (currentId !== null) {
    if (currentId === accountId) return true; // cycle detected
    if (visited.has(currentId)) return true; // infinite loop protection
    visited.add(currentId);
    
    const parent = nodes.find(n => n.id === currentId);
    currentId = parent ? parent.parentId : null;
  }
  return false;
}

export async function createAccount(userId: number, data: any, reqUserId: number) {
  const { code, name, accountType, accountSubType, parentId, description } = data;

  if (!code || !name || !accountType) throw new Error('Code, name, and accountType are required');
  if (!isValidAccountType(accountType)) throw new Error('Invalid account type');
  if (accountSubType && !isValidAccountSubType(accountType as AccountType, accountSubType)) {
    throw new Error('Invalid account subtype');
  }

  // Validate duplicate code
  const existingCode = await prisma.chartOfAccount.findUnique({
    where: { userId_code: { userId, code } }
  });
  if (existingCode) throw new Error('Account code already exists');

  let pId = null;
  if (parentId) {
    const parent = await prisma.chartOfAccount.findFirst({
      where: { id: Number(parentId), userId }
    });
    if (!parent) throw new Error('Parent account does not exist or belongs to another tenant');
    if (parent.accountType !== accountType) throw new Error('Child account must have same type as parent');
    pId = parent.id;
  }

  const newAccount = await prisma.chartOfAccount.create({
    data: {
      userId,
      code,
      name,
      accountType,
      accountSubType,
      parentId: pId,
      description,
      isSystemAccount: false,
      isActive: true
    }
  });

  await auditLog(reqUserId, 'ACCOUNT_CREATED', 'Custom account created');

  return newAccount;
}

export async function updateAccount(userId: number, id: number, data: any, reqUserId: number) {
  const acc = await prisma.chartOfAccount.findFirst({ where: { id, userId } });
  if (!acc) throw new Error('Account not found');

  const { code, name, accountType, accountSubType, parentId, description } = data;

  if (acc.isSystemAccount) {
      if (code && code !== acc.code) throw new Error('Cannot change system account code');
      if (accountType && accountType !== acc.accountType) throw new Error('Cannot change system account type');
      if (accountSubType !== undefined && accountSubType !== acc.accountSubType) throw new Error('Cannot change system account subtype');
  }

  let finalType = accountType || acc.accountType;
  let finalSubType = accountSubType !== undefined ? accountSubType : acc.accountSubType;

  if (accountType && !isValidAccountType(accountType)) throw new Error('Invalid account type');
  if (finalSubType && !isValidAccountSubType(finalType as AccountType, finalSubType)) {
    throw new Error('Invalid account subtype');
  }

  if (code && code !== acc.code) {
    const existingCode = await prisma.chartOfAccount.findUnique({
      where: { userId_code: { userId, code } }
    });
    if (existingCode) throw new Error('Account code already exists');
  }

  let pId = acc.parentId;
  if (parentId !== undefined) {
    if (parentId !== null) {
      if (Number(parentId) === id) throw new Error('Account cannot be its own parent');
      const parent = await prisma.chartOfAccount.findFirst({
        where: { id: Number(parentId), userId }
      });
      if (!parent) throw new Error('Parent account does not exist or belongs to another tenant');
      if (parent.accountType !== finalType) throw new Error('Child account must have same type as parent');
      
      const allAccounts = await prisma.chartOfAccount.findMany({ where: { userId } });
      if (checkCycle(allAccounts, id, Number(parentId))) {
        throw new Error('Cyclic hierarchy detected');
      }
      pId = parent.id;
    } else {
        pId = null;
    }
    if (acc.isSystemAccount && pId !== acc.parentId) {
        throw new Error('Cannot change system account hierarchy');
    }
  }

  const updatedAccount = await prisma.chartOfAccount.update({
    where: { id },
    data: {
      code: code || acc.code,
      name: name || acc.name,
      accountType: finalType,
      accountSubType: finalSubType,
      parentId: pId,
      description: description !== undefined ? description : acc.description
    }
  });

  await auditLog(reqUserId, 'ACCOUNT_UPDATED', 'Account updated');

  return updatedAccount;
}

export async function deactivateAccount(userId: number, id: number, reqUserId: number) {
  const acc = await prisma.chartOfAccount.findFirst({ where: { id, userId } });
  if (!acc) throw new Error('Account not found');
  if (acc.isSystemAccount) throw new Error('Cannot deactivate system account');

  // We are not throwing Error for journal relations yet, but we will in the future.
  
  const updatedAccount = await prisma.chartOfAccount.update({
    where: { id },
    data: { isActive: false }
  });

  await auditLog(reqUserId, 'ACCOUNT_DEACTIVATED', 'Account deactivated');

  return updatedAccount;
}
