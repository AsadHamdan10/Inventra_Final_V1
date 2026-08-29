export const ACCOUNT_TYPES = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
} as const;

export type AccountType = keyof typeof ACCOUNT_TYPES;

export const ACCOUNT_SUB_TYPES = {
  ASSET: ['CURRENT_ASSET', 'FIXED_ASSET', 'OTHER_ASSET'],
  LIABILITY: ['CURRENT_LIABILITY', 'LONG_TERM_LIABILITY'],
  EQUITY: ['CAPITAL', 'RETAINED_EARNINGS', 'OTHER_EQUITY'],
  INCOME: ['SALES', 'OTHER_INCOME'],
  EXPENSE: ['COGS', 'OPERATING_EXPENSE', 'OTHER_EXPENSE'],
};

export const isValidAccountType = (type: string): type is AccountType => {
  return Object.keys(ACCOUNT_TYPES).includes(type);
};

export const isValidAccountSubType = (type: AccountType, subType: string) => {
  return ACCOUNT_SUB_TYPES[type].includes(subType);
};
