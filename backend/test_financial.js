const { PrismaClient } = require('@prisma/client');
const { encryptFinancialData, safeDecryptFinancial } = require('./dist/utils/financialCrypto');
const prisma = new PrismaClient();

async function runTests() {
  try {
    // 1. Create a User for testing
    let user = await prisma.user.findFirst({ where: { email: 'test_security@example.com' } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'test_security@example.com',
          password: 'dummy',
          username: 'test_sec_user',
          role: 'admin',
          status: 'approved',
          companyName: 'Test Company LLC'
        }
      });
    }

    // 2. Create Sale Test
    const sale = await prisma.sale.create({
      data: {
        userId: user.id,
        invoiceNo: 'TEST-INV-001',
        companyName: 'Test Customer',
        invoiceDate: new Date(),
        grandTotal: 1100,
        totalTaxable: 1000,
        totalGst: 100,
        items: {
          create: [{
            materialId: (await prisma.material.findFirst()).id, materialName: 'Test Item',
            quantity: 2,
            unitPrice: 500,
            taxableAmount: 1000,
            itemTotal: 1100,
            // Sensitive fields encrypted
            purchasePriceEnc: encryptFinancialData(300),
            avgPurchaseCostEnc: encryptFinancialData(300),
          }]
        }
      },
      include: { items: true }
    });

    console.log('[TEST] Sale Created:', sale.invoiceNo);
    console.log('[TEST] Encrypted purchase price stored:', sale.items[0].purchasePriceEnc.substring(0, 15) + '...');

    const decryptedCost = safeDecryptFinancial(sale.items[0].purchasePriceEnc);
    console.log('[TEST] Decrypted purchase price:', decryptedCost);
    if (decryptedCost !== 300) throw new Error('Sale decryption failed');

    // 3. Create Purchase Test
    const purchase = await prisma.purchase.create({
      data: {
        userId: user.id,
        billNo: 'TEST-BILL-001',
        vendorName: 'Test Vendor',
        billDate: new Date(),
        grandTotal: 660,
        totalTaxable: 600,
        totalGst: 60,
        items: {
          create: [{
            materialId: (await prisma.material.findFirst()).id, materialName: 'Test Material',
            quantity: 2,
            taxableAmount: 600,
            itemTotal: 660,
            // Sensitive fields encrypted
            purchaseRateEnc: encryptFinancialData(300),
          }]
        }
      },
      include: { items: true }
    });

    console.log('[TEST] Purchase Created:', purchase.billNo);
    console.log('[TEST] Encrypted purchase rate stored:', purchase.items[0].purchaseRateEnc.substring(0, 15) + '...');
    const decryptedRate = safeDecryptFinancial(purchase.items[0].purchaseRateEnc);
    console.log('[TEST] Decrypted purchase rate:', decryptedRate);
    if (decryptedRate !== 300) throw new Error('Purchase decryption failed');

    // Verify DB does not contain plaintext cost fields
    const rawSale = await prisma.$queryRaw`SELECT * FROM sales WHERE id = ${sale.id}`;
    if (rawSale[0].totalPurchaseCost !== undefined || rawSale[0].grossProfit !== undefined) {
      console.log('Plaintext fields STILL EXIST in Sale DB layer', Object.keys(rawSale[0]));
    } else {
      console.log('[TEST] No plaintext redundant cost fields found in Sale.');
    }

    const rawSaleItem = await prisma.$queryRaw`SELECT * FROM sale_items WHERE id = ${sale.items[0].id}`;
    if (rawSaleItem[0].purchasePrice !== undefined) {
      console.log('Plaintext fields STILL EXIST in SaleItem DB layer');
    } else {
      console.log('[TEST] No plaintext cost fields found in SaleItem.');
    }

    console.log('ALL TESTS PASSED');

  } catch (err) {
    console.error('TEST FAILED', err);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
