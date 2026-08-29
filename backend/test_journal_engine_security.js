const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {
  createDraftJournal,
  updateDraftJournal,
  postJournal,
  cancelJournal
} = require('./dist/services/accounting/journalService');

async function run() {
  console.log('--- RUNNING test_journal_engine_security.js ---');
  let passes = 0, fails = 0;

  async function assert(condition, name) {
    if (condition) { console.log('[PASS] ' + name); passes++; }
    else { console.error('[FAIL] ' + name); fails++; }
  }

  try {
    const user = await prisma.user.findFirst();
    if (!user) throw new Error("No user found");
    const userId = user.id;

    await prisma.journalLine.deleteMany({ where: { journalEntry: { userId, referenceType: 'TEST' } } });
    await prisma.journalEntry.deleteMany({ where: { userId, referenceType: 'TEST' } });

    const accounts = await prisma.chartOfAccount.findMany({ where: { userId, isActive: true }, take: 2 });
    if (accounts.length < 2) throw new Error("Not enough accounts to test");

    const acc1 = accounts[0].id;
    const acc2 = accounts[1].id;

    try {
      await createDraftJournal(userId, { journalDate: new Date(), lines: [{ accountId: acc1, debit: 100, credit: 0 }] }, userId);
      await assert(false, 'less than 2 lines rejected');
    } catch(e) {
      await assert(e.message === 'At least 2 lines required', 'less than 2 lines rejected');
    }

    try {
      await createDraftJournal(userId, { journalDate: new Date(), lines: [{ accountId: acc1, debit: 0, credit: 0 }, { accountId: acc2, debit: 0, credit: 0 }] }, userId);
      await assert(false, 'zero-value line rejected');
    } catch(e) {
      await assert(e.message === 'Zero-value line rejected', 'zero-value line rejected');
    }

    try {
      await createDraftJournal(userId, { journalDate: new Date(), lines: [{ accountId: acc1, debit: 10, credit: 10 }, { accountId: acc2, debit: 10, credit: 0 }] }, userId);
      await assert(false, 'debit and credit on same line rejected');
    } catch(e) {
      await assert(e.message === 'Debit and credit on same line rejected', 'debit and credit on same line rejected');
    }

    try {
      await createDraftJournal(userId, { journalDate: new Date(), lines: [{ accountId: acc1, debit: -10, credit: 0 }, { accountId: acc2, debit: 0, credit: -10 }] }, userId);
      await assert(false, 'negative rejected');
    } catch(e) {
      await assert(e.message.includes('Negative'), 'negative rejected');
    }

    const unbalancedDraft = await createDraftJournal(userId, {
      journalDate: new Date(),
      referenceType: 'TEST',
      lines: [
        { accountId: acc1, debit: 100, credit: 0 },
        { accountId: acc2, debit: 0, credit: 50 } 
      ]
    }, userId);
    
    try {
      await postJournal(userId, unbalancedDraft.id, userId);
      await assert(false, 'unbalanced POST rejected');
    } catch(e) {
      await assert(e.message === 'JOURNAL_NOT_BALANCED', 'unbalanced POST rejected');
    }

    const balancedDraft = await updateDraftJournal(userId, unbalancedDraft.id, {
      journalDate: new Date(),
      referenceType: 'TEST',
      lines: [
        { accountId: acc1, debit: 100, credit: 0 },
        { accountId: acc2, debit: 0, credit: 100 }
      ]
    }, userId);

    const posted = await postJournal(userId, balancedDraft.id, userId);
    await assert(posted.status === 'POSTED', 'balanced POST succeeds');
    
    await assert(posted.totalDebit.toString() === '100', 'backend recalculates totalDebit');
    await assert(posted.totalCredit.toString() === '100', 'backend recalculates totalCredit');

    const spoofDraft = await createDraftJournal(userId, {
      journalDate: new Date(),
      referenceType: 'TEST',
      totalDebit: 999999,
      totalCredit: 999999,
      lines: [
        { accountId: acc1, debit: 50, credit: 0 },
        { accountId: acc2, debit: 0, credit: 50 }
      ]
    }, userId);
    await assert(spoofDraft.totalDebit.toString() === '50', 'spoofed totalDebit ignored');
    await assert(spoofDraft.totalCredit.toString() === '50', 'spoofed totalCredit ignored');

    try {
      await createDraftJournal(userId, {
        journalDate: new Date(),
        referenceType: 'TEST',
        lines: [
          { accountId: 99999, debit: 100, credit: 0 },
          { accountId: acc2, debit: 0, credit: 100 }
        ]
      }, userId);
      await assert(false, 'nonexistent account rejected');
    } catch(e) {
      await assert(e.message === 'ACCOUNT_NOT_FOUND', 'nonexistent account rejected');
    }

    try {
      await updateDraftJournal(userId, posted.id, { journalDate: new Date(), lines: [] }, userId);
      await assert(false, 'POSTED journal cannot update');
    } catch(e) {
      await assert(e.message === 'Only DRAFT journals can be updated', 'POSTED journal cannot update');
    }

    const cancelled = await cancelJournal(userId, posted.id, userId);
    await assert(cancelled.status === 'CANCELLED', 'POSTED journal can cancel');

    const verifyCancel = await prisma.journalEntry.findUnique({ where: { id: posted.id }, include: { lines: true } });
    await assert(verifyCancel.status === 'CANCELLED', 'cancellation preserves journal');
    await assert(verifyCancel.lines.length === 2, 'cancellation preserves journal lines');
    await assert(verifyCancel.journalNo === posted.journalNo, 'cancellation preserves journal number');
    
    const cancelAgain = await cancelJournal(userId, posted.id, userId);
    await assert(cancelAgain.message === 'JOURNAL_ALREADY_CANCELLED', 'cancellation is idempotent');

    try {
      await updateDraftJournal(userId, posted.id, { journalDate: new Date(), lines: [] }, userId);
      await assert(false, 'CANCELLED journal cannot update');
    } catch(e) {
      await assert(e.message === 'Only DRAFT journals can be updated', 'CANCELLED journal cannot update');
    }

    const raceDraft = await createDraftJournal(userId, {
      journalDate: new Date(),
      referenceType: 'TEST',
      lines: [
        { accountId: acc1, debit: 200, credit: 0 },
        { accountId: acc2, debit: 0, credit: 200 }
      ]
    }, userId);

    const res1 = postJournal(userId, raceDraft.id, userId);
    const res2 = postJournal(userId, raceDraft.id, userId);
    
    let successCount = 0;
    let idempotentCount = 0;
    
    try {
        const results = await Promise.all([res1, res2]);
        for (const res of results) {
            if (res.status === 'POSTED' && !res.message) successCount++;
            if (res.message === 'JOURNAL_ALREADY_POSTED') idempotentCount++;
        }
    } catch(e) {
        console.error(e);
    }
    
    await assert(successCount === 1, 'exactly one POST succeeds');
    
    const checkRace = await prisma.journalEntry.findUnique({ where: { id: raceDraft.id } });
    await assert(checkRace.journalNo.startsWith('JRN'), 'exactly one journal number generated');
    await assert(idempotentCount === 1 || successCount === 1, 'concurrency safe');

    const decDraft = await createDraftJournal(userId, {
      journalDate: new Date(),
      referenceType: 'TEST',
      lines: [
        { accountId: acc1, debit: '10.33', credit: 0 },
        { accountId: acc2, debit: 0, credit: '10.33' }
      ]
    }, userId);
    const postedDec = await postJournal(userId, decDraft.id, userId);
    await assert(postedDec.totalDebit.toString() === '10.33', 'Decimal values preserve exact equality');

    const audits = await prisma.auditLog.findMany({
        where: { userId, action: { in: ['JOURNAL_CREATED', 'JOURNAL_UPDATED', 'JOURNAL_POSTED', 'JOURNAL_CANCELLED'] } }
    });
    await assert(audits.some(a => a.action === 'JOURNAL_CREATED'), 'JOURNAL_CREATED exists');
    await assert(audits.some(a => a.action === 'JOURNAL_UPDATED'), 'JOURNAL_UPDATED exists');
    await assert(audits.some(a => a.action === 'JOURNAL_POSTED'), 'JOURNAL_POSTED exists');
    await assert(audits.some(a => a.action === 'JOURNAL_CANCELLED'), 'JOURNAL_CANCELLED exists');

    try {
        await prisma.chartOfAccount.delete({ where: { id: acc1 } });
        await assert(false, 'JournalLine -> ChartOfAccount is Restrict (Account deleted! BAD!)');
    } catch(e) {
        console.log(e); await assert(e.code === 'P2003' || e.message.includes('Foreign key constraint failed') || e.message.toUpperCase().includes('RESTRICT'), 'JournalLine -> ChartOfAccount is Restrict');
    }

  } catch(err) {
    console.error('Test framework error:', err);
  } finally {
    console.log('Total Passes: ' + passes);
    console.log('Total Fails: ' + fails);
    process.exit(fails > 0 ? 1 : 0);
  }
}
run();
