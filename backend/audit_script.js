const prisma = require('./dist/utils/prisma').default;

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

async function runAudit() {
  console.log("====================================");
  console.log("PHASE 4.4C ACCEPTANCE AUDIT SCRIPT");
  console.log("====================================");

  // 1. Schema Checks
  const journalEntriesCount = await prisma.journalEntry.count();
  const journalLinesCount = await prisma.journalLine.count();
  const coaCount = await prisma.chartOfAccount.count();
  
  console.log(`\nCounts:\nJournal Entries: ${journalEntriesCount}\nJournal Lines: ${journalLinesCount}\nCOA: ${coaCount}`);

  // 3. Posted Journal Balance Invariant
  console.log(`\n[3] Posted Journal Balance Invariant`);
  const postedJournals = await prisma.journalEntry.findMany({ where: { status: 'POSTED' }, include: { lines: true } });
  let unbalanced = 0;
  for (const jrn of postedJournals) {
    let sumDebit = 0;
    let sumCredit = 0;
    for (const line of jrn.lines) {
      sumDebit += Number(line.debit);
      sumCredit += Number(line.credit);
    }
    if (sumDebit !== sumCredit || sumDebit !== Number(jrn.totalDebit) || sumCredit !== Number(jrn.totalCredit)) {
      unbalanced++;
      console.log(`Unbalanced Journal: ${jrn.journalNo} | SumDebit: ${sumDebit} | SumCredit: ${sumCredit}`);
    }
  }
  console.log(`Total Posted Journals: ${postedJournals.length}`);
  console.log(`Balanced: ${postedJournals.length - unbalanced}`);
  console.log(`Unbalanced: ${unbalanced}`);

  // 4. Orphan Journal Audit
  console.log(`\n[4] Orphan Journal Audit`);
  let orphans = 0;
  const references = [
    { type: 'SALE', model: prisma.sale },
    { type: 'PURCHASE', model: prisma.purchase },
    { type: 'CUSTOMER_PAYMENT', model: prisma.customerPayment },
    { type: 'VENDOR_PAYMENT', model: prisma.vendorPayment },
    { type: 'EXPENSE', model: prisma.expense },
    { type: 'SALES_RETURN', model: prisma.salesReturn },
    { type: 'PURCHASE_RETURN', model: prisma.purchaseReturn }
  ];
  
  for (const ref of references) {
    const jrns = await prisma.journalEntry.findMany({ where: { referenceType: ref.type } });
    for (const jrn of jrns) {
      if (jrn.referenceId) {
        const source = await ref.model.findUnique({ where: { id: jrn.referenceId } });
        if (!source) {
          orphans++;
          console.log(`Orphan found: Type: ${ref.type}, RefID: ${jrn.referenceId}, JournalID: ${jrn.id}`);
        }
      }
    }
    // Check Reversals
    const revs = await prisma.journalEntry.findMany({ where: { referenceType: ref.type + '_REVERSAL' } });
    for (const rev of revs) {
      if (rev.referenceId) {
        const source = await ref.model.findUnique({ where: { id: rev.referenceId } });
        if (!source) {
          orphans++;
          console.log(`Orphan Reversal found: Type: ${ref.type}_REVERSAL, RefID: ${rev.referenceId}, JournalID: ${rev.id}`);
        }
      }
    }
  }
  console.log(`Total Orphans: ${orphans}`);

  // 5. Duplicate Accounting Audit
  console.log(`\n[5] Duplicate Accounting Audit`);
  const duplicates = await prisma.journalEntry.groupBy({
    by: ['referenceType', 'referenceId'],
    where: { status: 'POSTED' },
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } }
  });
  console.log(`Duplicate Groupings: ${duplicates.length}`);
  if (duplicates.length > 0) console.log(duplicates);

  // 36. Source-to-Journal Coverage (Prospective vs Historical)
  console.log(`\n[36] Source-to-Journal Coverage`);
  for (const ref of references) {
    // Only count finalized or non-draft stuff
    let totalSource = 0;
    if (ref.type === 'SALE' || ref.type === 'PURCHASE') {
      totalSource = await ref.model.count({ where: { status: { not: 'DRAFT' } } });
    } else if (ref.type === 'CUSTOMER_PAYMENT' || ref.type === 'VENDOR_PAYMENT') {
      totalSource = await ref.model.count({ where: { status: { not: 'CANCELLED' } } });
    } else if (ref.type === 'EXPENSE') {
      totalSource = await ref.model.count({ where: { status: { not: 'CANCELLED' } } });
    } else if (ref.type === 'SALES_RETURN' || ref.type === 'PURCHASE_RETURN') {
      totalSource = await ref.model.count({ where: { status: 'FINALIZED' } });
    }
    
    const uniqueRefsWithJournals = await prisma.journalEntry.groupBy({
        by: ['referenceId'],
        where: { referenceType: ref.type }
    });
    
    console.log(`${ref.type.padEnd(20)} | Total Active Source: ${String(totalSource).padEnd(5)} | Accounted: ${uniqueRefsWithJournals.length}`);
  }
}

runAudit().catch(console.error).finally(() => prisma.$disconnect());
