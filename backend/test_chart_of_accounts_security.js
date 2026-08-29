const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {
  initializeDefaultCOA,
  getChartOfAccounts,
  createAccount,
  updateAccount,
  deactivateAccount
} = require('./dist/services/accounting/coaService');

async function run() {
  console.log('--- RUNNING test_chart_of_accounts_security.js ---');
  let passes = 0;
  let fails = 0;
  const user = await prisma.user.findFirst();
  const userId = user.id;

  async function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passes++;
    } else {
      console.error(`[FAIL] ${testName}`);
      fails++;
    }
  }

  try {
    // Clean up if running multiple times
    await prisma.chartOfAccount.deleteMany({ where: { userId } });

    // 21. initialization succeeds
    const init1 = await initializeDefaultCOA(userId);
    await assert(init1.message === 'Initialized successfully', 'Initialization succeeds');

    // 22. second initialization creates zero duplicates
    const init2 = await initializeDefaultCOA(userId);
    await assert(init2.message === 'Already initialized', 'Second initialization idempotent');
    const systemAccounts = await prisma.chartOfAccount.findMany({ where: { userId, isSystemAccount: true } });
    await assert(systemAccounts.length === 31, 'Created exactly 31 system accounts without duplicates');

    // 27. custom account creation succeeds
    const newAccount = await createAccount(userId, {
      code: '1111',
      name: 'Custom Cash',
      accountType: 'ASSET',
      accountSubType: 'CURRENT_ASSET',
      description: 'Test Account'
    }, userId);
    await assert(newAccount.code === '1111', 'Custom account creation succeeds');

    // 20. duplicate code rejected
    try {
      await createAccount(userId, { code: '1111', name: 'Dupe', accountType: 'ASSET' }, userId);
      await assert(false, 'Duplicate code should be rejected');
    } catch(e) {
      await assert(e.message === 'Account code already exists', 'Duplicate code rejected');
    }

    // 14. invalid account type rejected
    try {
      await createAccount(userId, { code: '9999', name: 'Invalid', accountType: 'INVALID' }, userId);
      await assert(false, 'Invalid account type should be rejected');
    } catch(e) {
      await assert(e.message === 'Invalid account type', 'Invalid account type rejected');
    }

    // 17. nonexistent parent rejected
    try {
      await createAccount(userId, { code: '8888', name: 'Fail', accountType: 'ASSET', parentId: 99999 }, userId);
      await assert(false, 'Nonexistent parent should be rejected');
    } catch(e) {
      await assert(e.message === 'Parent account does not exist or belongs to another tenant', 'Nonexistent parent rejected');
    }

    // 23. system account code cannot change
    const sysAcc = systemAccounts[0];
    try {
      await updateAccount(userId, sysAcc.id, { code: '9999' }, userId);
      await assert(false, 'System account code cannot change');
    } catch (e) {
      await assert(e.message === 'Cannot change system account code', 'System account code change rejected');
    }

    // 25. system account cannot deactivate
    try {
      await deactivateAccount(userId, sysAcc.id, userId);
      await assert(false, 'System account cannot deactivate');
    } catch (e) {
      await assert(e.message === 'Cannot deactivate system account', 'System account deactivation rejected');
    }

    // 29. custom account deactivation succeeds
    const deac = await deactivateAccount(userId, newAccount.id, userId);
    await assert(deac.isActive === false, 'Custom account deactivation succeeds');

    // 30. deactivated account remains in DB
    const stillExists = await prisma.chartOfAccount.findUnique({ where: { id: newAccount.id } });
    await assert(stillExists !== null, 'Deactivated account remains in DB (No hard delete)');

    // 18. self-parent rejected
    try {
      await updateAccount(userId, newAccount.id, { parentId: newAccount.id }, userId);
      await assert(false, 'Self-parent should be rejected');
    } catch (e) {
      await assert(e.message === 'Account cannot be its own parent', 'Self-parent rejected');
    }

  } catch (err) {
    console.error('Fatal Error during tests:', err);
  } finally {
    console.log(`\\nTotal Passes: ${passes}`);
    console.log(`Total Fails: ${fails}`);
    process.exit(fails > 0 ? 1 : 0);
  }
}
run();
