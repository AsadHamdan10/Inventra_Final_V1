import { getAccountByCode, getExpenseAccount } from './accountMappingService';
import { createDraftJournal, postJournal } from './journalService';
import { Decimal } from '@prisma/client/runtime/library';

export async function postSaleAccounting(userId: number, sale: any, reqUserId: number, tx: any, options?: { bypassPeriodCheck?: boolean }) {
  const existing = await tx.journalEntry.findFirst({
    where: { userId, referenceType: 'SALE', referenceId: sale.id, status: 'POSTED' }
  });
  if (existing) return;

  const accReceivable = await getAccountByCode(userId, '1130', tx);
  const accRevenue = await getAccountByCode(userId, '4100', tx);
  const accOutputCgst = await getAccountByCode(userId, '2130', tx);
  const accOutputSgst = await getAccountByCode(userId, '2140', tx);
  const accOutputIgst = await getAccountByCode(userId, '2150', tx);
  const accCogs = await getAccountByCode(userId, '5100', tx);
  const accInventory = await getAccountByCode(userId, '1140', tx);

  const lines = [];

  // Receivable (Debit)
  lines.push({ accountId: accReceivable, debit: sale.grandTotal, credit: 0, description: `Sale Invoice ${sale.invoiceNo}` });

  // Revenue (Credit)
  lines.push({ accountId: accRevenue, debit: 0, credit: sale.totalTaxable, description: `Sale Revenue` });

  // GST (Credit)
  if (Number(sale.igstAmount) > 0) lines.push({ accountId: accOutputIgst, debit: 0, credit: sale.igstAmount, description: `Output IGST` });
  if (Number(sale.cgstAmount) > 0) lines.push({ accountId: accOutputCgst, debit: 0, credit: sale.cgstAmount, description: `Output CGST` });
  if (Number(sale.sgstAmount) > 0) lines.push({ accountId: accOutputSgst, debit: 0, credit: sale.sgstAmount, description: `Output SGST` });

  // COGS (Debit) & Inventory (Credit)
  if (Number(sale.totalPurchaseCost) > 0) {
    lines.push({ accountId: accCogs, debit: sale.totalPurchaseCost, credit: 0, description: `COGS` });
    lines.push({ accountId: accInventory, debit: 0, credit: sale.totalPurchaseCost, description: `Inventory Out` });
  }

  const draft = await createDraftJournal(userId, {
    journalDate: sale.invoiceDate,
    description: `Sale ${sale.invoiceNo}`,
    referenceType: 'SALE',
    referenceId: sale.id,
    lines
  }, reqUserId, tx, options);

  await postJournal(userId, draft.id, reqUserId, tx, options);
  
  await tx.auditLog.create({
    data: { userId: reqUserId, action: 'ACCOUNTING_SALE_POSTED', details: `Sale ${sale.invoiceNo} accounted` }
  });
}

export async function cancelSaleAccounting(userId: number, sale: any, reqUserId: number, tx: any, options?: { bypassPeriodCheck?: boolean }) {
  const original = await tx.journalEntry.findFirst({
    where: { userId, referenceType: 'SALE', referenceId: sale.id, status: 'POSTED' },
    include: { lines: true }
  });
  
  if (!original) return;

  const existingReversal = await tx.journalEntry.findFirst({
    where: { userId, referenceType: 'SALE_REVERSAL', referenceId: sale.id, status: 'POSTED' }
  });
  if (existingReversal) return;

  const lines = original.lines.map((l: any) => ({
    accountId: l.accountId,
    description: l.description + ' (Reversal)',
    debit: l.credit,
    credit: l.debit 
  }));

  const draft = await createDraftJournal(userId, {
    journalDate: sale.invoiceDate, // keep the reversal in the original date's period
    description: `Sale ${sale.invoiceNo} Reversal`,
    referenceType: 'SALE_REVERSAL',
    referenceId: sale.id,
    lines
  }, reqUserId, tx, options);

  await postJournal(userId, draft.id, reqUserId, tx, options);
  
  await tx.auditLog.create({
    data: { userId: reqUserId, action: 'ACCOUNTING_SALE_REVERSED', details: `Sale ${sale.invoiceNo} accounting reversed` }
  });
}

export async function postPurchaseAccounting(userId: number, purchase: any, reqUserId: number, tx: any, options?: { bypassPeriodCheck?: boolean }) {
  const existing = await tx.journalEntry.findFirst({
    where: { userId, referenceType: 'PURCHASE', referenceId: purchase.id, status: 'POSTED' }
  });
  if (existing) return;

  const accPayable = await getAccountByCode(userId, '2110', tx);
  const accInventory = await getAccountByCode(userId, '1140', tx);
  const accInputCgst = await getAccountByCode(userId, '2160', tx);
  const accInputSgst = await getAccountByCode(userId, '2170', tx);
  const accInputIgst = await getAccountByCode(userId, '2180', tx);

  const lines = [];

  // Inventory (Debit)
  lines.push({ accountId: accInventory, debit: purchase.totalTaxable, credit: 0, description: `Purchase ${purchase.purchaseNo}` });

  // GST (Debit)
  if (Number(purchase.igstAmount) > 0) lines.push({ accountId: accInputIgst, debit: purchase.igstAmount, credit: 0, description: `Input IGST` });
  if (Number(purchase.cgstAmount) > 0) lines.push({ accountId: accInputCgst, debit: purchase.cgstAmount, credit: 0, description: `Input CGST` });
  if (Number(purchase.sgstAmount) > 0) lines.push({ accountId: accInputSgst, debit: purchase.sgstAmount, credit: 0, description: `Input SGST` });

  // Payable (Credit)
  lines.push({ accountId: accPayable, debit: 0, credit: purchase.grandTotal, description: `Accounts Payable` });

  const draft = await createDraftJournal(userId, {
    journalDate: purchase.invoiceDate || purchase.purchaseDate || new Date(),
    description: `Purchase ${purchase.purchaseNo}`,
    referenceType: 'PURCHASE',
    referenceId: purchase.id,
    lines
  }, reqUserId, tx, options);

  await postJournal(userId, draft.id, reqUserId, tx, options);
  
  await tx.auditLog.create({
    data: { userId: reqUserId, action: 'ACCOUNTING_PURCHASE_POSTED', details: `Purchase ${purchase.purchaseNo} accounted` }
  });
}

export async function cancelPurchaseAccounting(userId: number, purchase: any, reqUserId: number, tx: any, options?: { bypassPeriodCheck?: boolean }) {
  const original = await tx.journalEntry.findFirst({
    where: { userId, referenceType: 'PURCHASE', referenceId: purchase.id, status: 'POSTED' },
    include: { lines: true }
  });
  if (!original) return;
  const existingReversal = await tx.journalEntry.findFirst({
    where: { userId, referenceType: 'PURCHASE_REVERSAL', referenceId: purchase.id, status: 'POSTED' }
  });
  if (existingReversal) return;

  const lines = original.lines.map((l: any) => ({
    accountId: l.accountId, description: l.description + ' (Reversal)', debit: l.credit, credit: l.debit 
  }));

  const draft = await createDraftJournal(userId, {
    journalDate: original.journalDate,
    description: `Purchase ${purchase.purchaseNo} Reversal`,
    referenceType: 'PURCHASE_REVERSAL',
    referenceId: purchase.id,
    lines
  }, reqUserId, tx, options);

  await postJournal(userId, draft.id, reqUserId, tx, options);
  await tx.auditLog.create({ data: { userId: reqUserId, action: 'ACCOUNTING_PURCHASE_REVERSED', details: `Purchase ${purchase.purchaseNo} accounting reversed` } });
}

export async function postCustomerPaymentAccounting(userId: number, payment: any, reqUserId: number, tx: any, options?: { bypassPeriodCheck?: boolean }) {
  const existing = await tx.journalEntry.findFirst({
    where: { userId, referenceType: 'CUSTOMER_PAYMENT', referenceId: payment.id, status: 'POSTED' }
  });
  if (existing) return;

  const accCash = await getAccountByCode(userId, '1110', tx);
  const accBank = await getAccountByCode(userId, '1120', tx);
  const accReceivable = await getAccountByCode(userId, '1130', tx);
  
  const debitAccount = payment.paymentMode?.toLowerCase() === 'bank' ? accBank : accCash;

  const lines = [
    { accountId: debitAccount, debit: payment.amount, credit: 0, description: `Receipt ${payment.reference || payment.id}` },
    { accountId: accReceivable, debit: 0, credit: payment.amount, description: `Customer Payment` }
  ];

  const draft = await createDraftJournal(userId, {
    journalDate: payment.paymentDate,
    description: `Customer Payment ${payment.reference || payment.id}`,
    referenceType: 'CUSTOMER_PAYMENT',
    referenceId: payment.id,
    lines
  }, reqUserId, tx, options);

  await postJournal(userId, draft.id, reqUserId, tx, options);
  await tx.auditLog.create({ data: { userId: reqUserId, action: 'ACCOUNTING_CUSTOMER_PAYMENT_POSTED', details: `Customer Payment ${payment.id} accounted` } });
}

export async function cancelCustomerPaymentAccounting(userId: number, payment: any, reqUserId: number, tx: any, options?: { bypassPeriodCheck?: boolean }) {
  const original = await tx.journalEntry.findFirst({
    where: { userId, referenceType: 'CUSTOMER_PAYMENT', referenceId: payment.id, status: 'POSTED' },
    include: { lines: true }
  });
  if (!original) return;
  const existingReversal = await tx.journalEntry.findFirst({
    where: { userId, referenceType: 'CUSTOMER_PAYMENT_REVERSAL', referenceId: payment.id, status: 'POSTED' }
  });
  if (existingReversal) return;

  const lines = original.lines.map((l: any) => ({
    accountId: l.accountId, description: l.description + ' (Reversal)', debit: l.credit, credit: l.debit 
  }));

  const draft = await createDraftJournal(userId, {
    journalDate: original.journalDate,
    description: `Customer Payment Reversal`,
    referenceType: 'CUSTOMER_PAYMENT_REVERSAL',
    referenceId: payment.id,
    lines
  }, reqUserId, tx, options);

  await postJournal(userId, draft.id, reqUserId, tx, options);
  await tx.auditLog.create({ data: { userId: reqUserId, action: 'ACCOUNTING_PAYMENT_REVERSED', details: `Customer Payment ${payment.id} reversed` } });
}

export async function postVendorPaymentAccounting(userId: number, payment: any, reqUserId: number, tx: any, options?: { bypassPeriodCheck?: boolean }) {
  const existing = await tx.journalEntry.findFirst({
    where: { userId, referenceType: 'VENDOR_PAYMENT', referenceId: payment.id, status: 'POSTED' }
  });
  if (existing) return;

  const accCash = await getAccountByCode(userId, '1110', tx);
  const accBank = await getAccountByCode(userId, '1120', tx);
  const accPayable = await getAccountByCode(userId, '2110', tx);
  
  const creditAccount = payment.paymentMode?.toLowerCase() === 'bank' ? accBank : accCash;

  const lines = [
    { accountId: accPayable, debit: payment.amount, credit: 0, description: `Vendor Payment` },
    { accountId: creditAccount, debit: 0, credit: payment.amount, description: `Payment ${payment.reference || payment.id}` }
  ];

  const draft = await createDraftJournal(userId, {
    journalDate: payment.paymentDate,
    description: `Vendor Payment ${payment.reference || payment.id}`,
    referenceType: 'VENDOR_PAYMENT',
    referenceId: payment.id,
    lines
  }, reqUserId, tx, options);

  await postJournal(userId, draft.id, reqUserId, tx, options);
  await tx.auditLog.create({ data: { userId: reqUserId, action: 'ACCOUNTING_VENDOR_PAYMENT_POSTED', details: `Vendor Payment ${payment.id} accounted` } });
}

export async function cancelVendorPaymentAccounting(userId: number, payment: any, reqUserId: number, tx: any, options?: { bypassPeriodCheck?: boolean }) {
  const original = await tx.journalEntry.findFirst({
    where: { userId, referenceType: 'VENDOR_PAYMENT', referenceId: payment.id, status: 'POSTED' },
    include: { lines: true }
  });
  if (!original) return;
  const existingReversal = await tx.journalEntry.findFirst({
    where: { userId, referenceType: 'VENDOR_PAYMENT_REVERSAL', referenceId: payment.id, status: 'POSTED' }
  });
  if (existingReversal) return;

  const lines = original.lines.map((l: any) => ({ accountId: l.accountId, description: l.description + ' (Reversal)', debit: l.credit, credit: l.debit }));
  
  const draft = await createDraftJournal(userId, {
    journalDate: original.journalDate,
    description: `Vendor Payment Reversal`,
    referenceType: 'VENDOR_PAYMENT_REVERSAL',
    referenceId: payment.id,
    lines
  }, reqUserId, tx, options);

  await postJournal(userId, draft.id, reqUserId, tx, options);
  await tx.auditLog.create({ data: { userId: reqUserId, action: 'ACCOUNTING_PAYMENT_REVERSED', details: `Vendor Payment ${payment.id} reversed` } });
}

export async function postExpenseAccounting(userId: number, expense: any, reqUserId: number, tx: any, options?: { bypassPeriodCheck?: boolean }) {
  const existing = await tx.journalEntry.findFirst({
    where: { userId, referenceType: 'EXPENSE', referenceId: expense.id, status: 'POSTED' }
  });
  if (existing) return;

  const accCash = await getAccountByCode(userId, '1110', tx);
  const accExpense = await getExpenseAccount(userId, expense.category, tx);

  const lines = [
    { accountId: accExpense, debit: expense.amount, credit: 0, description: expense.expenseName },
    { accountId: accCash, debit: 0, credit: expense.amount, description: `Expense Payment` }
  ];

  const draft = await createDraftJournal(userId, {
    journalDate: expense.expenseDate,
    description: `Expense ${expense.id}`,
    referenceType: 'EXPENSE',
    referenceId: expense.id,
    lines
  }, reqUserId, tx, options);

  await postJournal(userId, draft.id, reqUserId, tx, options);
  await tx.auditLog.create({ data: { userId: reqUserId, action: 'ACCOUNTING_EXPENSE_POSTED', details: `Expense ${expense.id} accounted` } });
}

export async function cancelExpenseAccounting(userId: number, expense: any, reqUserId: number, tx: any, options?: { bypassPeriodCheck?: boolean }) {
  const original = await tx.journalEntry.findFirst({
    where: { userId, referenceType: 'EXPENSE', referenceId: expense.id, status: 'POSTED' },
    include: { lines: true }
  });
  if (!original) return;
  const existingReversal = await tx.journalEntry.findFirst({
    where: { userId, referenceType: 'EXPENSE_REVERSAL', referenceId: expense.id, status: 'POSTED' }
  });
  if (existingReversal) return;

  const lines = original.lines.map((l: any) => ({ accountId: l.accountId, description: l.description + ' (Reversal)', debit: l.credit, credit: l.debit }));

  const draft = await createDraftJournal(userId, {
    journalDate: original.journalDate,
    description: `Expense ${expense.id} Reversal`,
    referenceType: 'EXPENSE_REVERSAL',
    referenceId: expense.id,
    lines
  }, reqUserId, tx, options);

  await postJournal(userId, draft.id, reqUserId, tx, options);
  await tx.auditLog.create({ data: { userId: reqUserId, action: 'ACCOUNTING_EXPENSE_REVERSED', details: `Expense ${expense.id} reversed` } });
}

export async function postSalesReturnAccounting(userId: number, salesReturn: any, reqUserId: number, tx: any, options?: { bypassPeriodCheck?: boolean }) {
  const existing = await tx.journalEntry.findFirst({
    where: { userId, referenceType: 'SALES_RETURN', referenceId: salesReturn.id, status: 'POSTED' }
  });
  if (existing) return;

  const accReceivable = await getAccountByCode(userId, '1130', tx);
  const accSalesReturn = await getAccountByCode(userId, '4300', tx);
  const accOutputCgst = await getAccountByCode(userId, '2130', tx);
  const accOutputSgst = await getAccountByCode(userId, '2140', tx);
  const accOutputIgst = await getAccountByCode(userId, '2150', tx);
  const accCogs = await getAccountByCode(userId, '5100', tx);
  const accInventory = await getAccountByCode(userId, '1140', tx);

  const lines = [];

  // Reversing Revenue -> Sales Returns (Debit)
  lines.push({ accountId: accSalesReturn, debit: salesReturn.totalTaxable, credit: 0, description: `Sales Return` });

  // Reversing GST (Debit)
  if (Number(salesReturn.igstAmount) > 0) lines.push({ accountId: accOutputIgst, debit: salesReturn.igstAmount, credit: 0, description: `Output IGST Reversal` });
  if (Number(salesReturn.cgstAmount) > 0) lines.push({ accountId: accOutputCgst, debit: salesReturn.cgstAmount, credit: 0, description: `Output CGST Reversal` });
  if (Number(salesReturn.sgstAmount) > 0) lines.push({ accountId: accOutputSgst, debit: salesReturn.sgstAmount, credit: 0, description: `Output SGST Reversal` });

  // Reversing Receivable (Credit)
  lines.push({ accountId: accReceivable, debit: 0, credit: salesReturn.grandTotal, description: `Customer Credit` });

  // Reversing COGS & Inventory
  if (Number(salesReturn.totalRefundCost) > 0) {
    lines.push({ accountId: accInventory, debit: salesReturn.totalRefundCost, credit: 0, description: `Inventory In` });
    lines.push({ accountId: accCogs, debit: 0, credit: salesReturn.totalRefundCost, description: `COGS Reversal` });
  }

  const draft = await createDraftJournal(userId, {
    journalDate: salesReturn.returnDate,
    description: `Sales Return ${salesReturn.creditNoteNo}`,
    referenceType: 'SALES_RETURN',
    referenceId: salesReturn.id,
    lines
  }, reqUserId, tx, options);

  await postJournal(userId, draft.id, reqUserId, tx, options);
  await tx.auditLog.create({ data: { userId: reqUserId, action: 'ACCOUNTING_SALES_RETURN_POSTED', details: `Return accounted` } });
}

export async function postPurchaseReturnAccounting(userId: number, purchaseReturn: any, reqUserId: number, tx: any, options?: { bypassPeriodCheck?: boolean }) {
  const existing = await tx.journalEntry.findFirst({
    where: { userId, referenceType: 'PURCHASE_RETURN', referenceId: purchaseReturn.id, status: 'POSTED' }
  });
  if (existing) return;

  const accPayable = await getAccountByCode(userId, '2110', tx);
  const accInventory = await getAccountByCode(userId, '1140', tx);
  const accInputCgst = await getAccountByCode(userId, '2160', tx);
  const accInputSgst = await getAccountByCode(userId, '2170', tx);
  const accInputIgst = await getAccountByCode(userId, '2180', tx);

  const lines = [];

  // Reversing Payable (Debit)
  lines.push({ accountId: accPayable, debit: purchaseReturn.grandTotal, credit: 0, description: `Vendor Debit` });

  // Reversing Inventory (Credit)
  lines.push({ accountId: accInventory, debit: 0, credit: purchaseReturn.totalTaxable, description: `Purchase Return` });

  // Reversing GST (Credit)
  if (Number(purchaseReturn.igstAmount) > 0) lines.push({ accountId: accInputIgst, debit: 0, credit: purchaseReturn.igstAmount, description: `Input IGST Reversal` });
  if (Number(purchaseReturn.cgstAmount) > 0) lines.push({ accountId: accInputCgst, debit: 0, credit: purchaseReturn.cgstAmount, description: `Input CGST Reversal` });
  if (Number(purchaseReturn.sgstAmount) > 0) lines.push({ accountId: accInputSgst, debit: 0, credit: purchaseReturn.sgstAmount, description: `Input SGST Reversal` });

  const draft = await createDraftJournal(userId, {
    journalDate: purchaseReturn.returnDate,
    description: `Purchase Return ${purchaseReturn.debitNoteNo}`,
    referenceType: 'PURCHASE_RETURN',
    referenceId: purchaseReturn.id,
    lines
  }, reqUserId, tx, options);

  await postJournal(userId, draft.id, reqUserId, tx, options);
  await tx.auditLog.create({ data: { userId: reqUserId, action: 'ACCOUNTING_PURCHASE_RETURN_POSTED', details: `Return accounted` } });
}

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

  const draft = await createDraftJournal(userId, {
    journalDate: date,
    description: 'Material Issue for Production ' + executionNo,
    referenceType: 'PRODUCTION_EXECUTION',
    referenceId: executionId,
    lines
  }, reqUserId, tx);
  await postJournal(userId, draft.id, reqUserId, tx);
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

  const draft = await createDraftJournal(userId, {
    journalDate: date,
    description: 'Finished Goods Output for Production ' + executionNo,
    referenceType: 'PRODUCTION_EXECUTION',
    referenceId: executionId,
    lines
  }, reqUserId, tx);
  await postJournal(userId, draft.id, reqUserId, tx);
}
