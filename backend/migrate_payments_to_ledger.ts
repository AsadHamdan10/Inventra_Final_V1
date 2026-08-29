import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Phase 3.3 Payment Ledger Migration ---');
  
  // 1. Snapshot OLD data
  const oldReceivables = await prisma.receivablePayment.findMany({
    include: { sale: true }
  });
  const oldPayables = await prisma.payablePayment.findMany({
    include: { purchase: true }
  });

  const oldRecCount = oldReceivables.length;
  const oldRecTotal = oldReceivables.reduce((sum, p) => sum + Number(p.amount), 0);

  const oldPayCount = oldPayables.length;
  const oldPayTotal = oldPayables.reduce((sum, p) => sum + Number(p.amount), 0);

  console.log(`OLD RECEIVABLE PAYMENT COUNT: ${oldRecCount}`);
  console.log(`OLD RECEIVABLE PAYMENT TOTAL: ${oldRecTotal}`);
  console.log(`OLD PAYABLE PAYMENT COUNT: ${oldPayCount}`);
  console.log(`OLD PAYABLE PAYMENT TOTAL: ${oldPayTotal}`);

  if (oldRecCount === 0 && oldPayCount === 0) {
    console.log('No payments to migrate. Proceeding.');
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Migrate Receivables
      for (const rec of oldReceivables) {
        if (!rec.sale.customerId) {
          throw new Error(`ReceivablePayment ${rec.id} has a Sale without a customerId!`);
        }
        
        const payment = await tx.customerPayment.create({
          data: {
            userId: rec.sale.userId,
            customerId: rec.sale.customerId,
            amount: rec.amount,
            unallocated: 0,
            paymentDate: rec.dateReceived,
            mode: rec.mode,
            reference: rec.reference,
            notes: rec.notes,
            status: 'ACTIVE',
            createdAt: rec.createdAt,
            allocations: {
              create: {
                userId: rec.sale.userId,
                saleId: rec.saleId,
                amountAllocated: rec.amount,
                createdAt: rec.createdAt,
              }
            }
          }
        });
      }

      // Migrate Payables
      for (const pay of oldPayables) {
        if (!pay.purchase.vendorId) {
          throw new Error(`PayablePayment ${pay.id} has a Purchase without a vendorId!`);
        }

        const payment = await tx.vendorPayment.create({
          data: {
            userId: pay.purchase.userId,
            vendorId: pay.purchase.vendorId,
            amount: pay.amount,
            unallocated: 0,
            paymentDate: pay.datePaid,
            mode: pay.mode,
            reference: pay.reference,
            notes: pay.notes,
            status: 'ACTIVE',
            createdAt: pay.createdAt,
            allocations: {
              create: {
                userId: pay.purchase.userId,
                purchaseId: pay.purchaseId,
                amountAllocated: pay.amount,
                createdAt: pay.createdAt,
              }
            }
          }
        });
      }
    });

    // 2. Snapshot NEW data
    const newCustomerPayments = await prisma.customerPayment.findMany({ include: { allocations: true } });
    const newVendorPayments = await prisma.vendorPayment.findMany({ include: { allocations: true } });

    const newCustCount = newCustomerPayments.length;
    const newCustTotal = newCustomerPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const newCustAllocTotal = newCustomerPayments.reduce((sum, p) => {
      return sum + p.allocations.reduce((asum, a) => asum + Number(a.amountAllocated), 0);
    }, 0);

    const newVendCount = newVendorPayments.length;
    const newVendTotal = newVendorPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const newVendAllocTotal = newVendorPayments.reduce((sum, p) => {
      return sum + p.allocations.reduce((asum, a) => asum + Number(a.amountAllocated), 0);
    }, 0);

    console.log(`NEW CUSTOMER PAYMENT COUNT: ${newCustCount}`);
    console.log(`NEW CUSTOMER PAYMENT TOTAL: ${newCustTotal}`);
    console.log(`NEW VENDOR PAYMENT COUNT: ${newVendCount}`);
    console.log(`NEW VENDOR PAYMENT TOTAL: ${newVendTotal}`);
    
    let failed = false;
    
    if (oldRecCount !== newCustCount) { console.error('Mismatch: Customer Count'); failed = true; }
    if (oldRecTotal !== newCustTotal) { console.error('Mismatch: Customer Total'); failed = true; }
    if (newCustTotal !== newCustAllocTotal) { console.error('Mismatch: Customer Allocations != Total'); failed = true; }

    if (oldPayCount !== newVendCount) { console.error('Mismatch: Vendor Count'); failed = true; }
    if (oldPayTotal !== newVendTotal) { console.error('Mismatch: Vendor Total'); failed = true; }
    if (newVendTotal !== newVendAllocTotal) { console.error('Mismatch: Vendor Allocations != Total'); failed = true; }

    if (failed) {
      console.error('--- MIGRATION FAILED RECONCILIATION ---');
      process.exit(1);
    } else {
      console.log('--- MIGRATION RECONCILIATION SUCCESSFUL ---');
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
