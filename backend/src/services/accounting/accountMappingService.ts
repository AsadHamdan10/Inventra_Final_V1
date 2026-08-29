import prisma from '../../utils/prisma';

// Memory cache for tenant accounts to avoid N+1 queries.
// Key format: `${userId}_${code}`
const accountCache = new Map<string, number>();

export async function getAccountByCode(userId: number, code: string, tx: any = prisma): Promise<number> {
  const cacheKey = `${userId}_${code}`;
  
  if (accountCache.has(cacheKey)) {
    return accountCache.get(cacheKey)!;
  }

  const account = await tx.chartOfAccount.findUnique({
    where: { userId_code: { userId, code } }
  });

  if (!account) {
    throw new Error(`ACCOUNTING_CONFIGURATION_ERROR: System account with code ${code} is missing for tenant ${userId}.`);
  }

  accountCache.set(cacheKey, account.id);
  return account.id;
}

// Ensure cache is cleared if accounts are structurally changed (useful for tests)
export function clearAccountMappingCache(userId?: number) {
  if (userId) {
    for (const key of Array.from(accountCache.keys())) {
      if (key.startsWith(`${userId}_`)) {
        accountCache.delete(key);
      }
    }
  } else {
    accountCache.clear();
  }
}

export async function getExpenseAccount(userId: number, category: string, tx: any = prisma): Promise<number> {
  const cacheKey = `${userId}_cat_${category}`;
  if (accountCache.has(cacheKey)) return accountCache.get(cacheKey)!;

  let account = await tx.chartOfAccount.findUnique({
    where: { userId_code: { userId, code: category } }
  });

  if (!account) {
    account = await tx.chartOfAccount.findFirst({
      where: { userId, name: category }
    });
  }

  if (!account && category === 'General') {
    account = await tx.chartOfAccount.findUnique({
      where: { userId_code: { userId, code: '6200' } }
    });
  }

  if (!account) {
    throw new Error(`ACCOUNTING_CONFIGURATION_ERROR: Expense category '${category}' does not map to a valid ChartOfAccount.`);
  }

  accountCache.set(cacheKey, account.id);
  return account.id;
}
