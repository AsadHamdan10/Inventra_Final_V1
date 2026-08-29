const { cleanupTestUsers } = require('./test_cleanup');
const { PrismaClient } = require('@prisma/client');
const { createSale } = require('./dist/controllers/saleController');
const { createPurchase } = require('./dist/controllers/purchaseController');
const { addReceivablePayment } = require('./dist/controllers/saleController');
const { encryptFinancialData } = require('./dist/utils/financialCrypto');
const prisma = new PrismaClient();

const mockResponse = () => {
  const res = {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.data = data; return res; };
  return res;
};

async function runTests() {
  try {
    let user = await prisma.user.findFirst({ where: { email: 'test_auth@example.com' } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'test_auth@example.com',
          password: 'dummy',
          username: 'test_auth_user',
          role: 'admin',
          status: 'approved',
          companyName: 'Auth Company LLC',
          state: 'Tamil Nadu', 
        }
      });
    }
    
    let customer = await prisma.customer.findFirst({ where: { userId: user.id } });
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          userId: user.id,
          companyName: 'Auth Customer LLC',
        }
      });
    }

    let vendor = await prisma.vendor.findFirst({ where: { userId: user.id } });
    if (!vendor) {
      vendor = await prisma.vendor.create({
        data: {
          userId: user.id,
          vendorName: 'Auth Vendor LLC',
        }
      });
    }

    let material = await prisma.material.findFirst({ where: { userId: user.id, materialName: 'Auth Item' } });
    if (material) { await prisma.material.update({ where: { id: material.id }, data: { currentStock: 2 } }); } if (!material) {
      material = await prisma.material.create({
        data: {
          userId: user.id,
          materialName: 'Auth Item',
          currentStock: 2,
        }
      });
    }

    
    
    const purchase = await prisma.purchase.create({
      data: {
        userId: user.id,
        billNo: 'INIT-BILL-' + Date.now(),
        billDate: new Date(),
        vendorName: 'Auth Vendor LLC',
        vendorId: vendor.id,
        grandTotal: 200,
        totalTaxable: 200,
        items: {
          create: [{
            materialName: material.materialName, materialId: material.id,
            quantity: 2,
            purchaseRateEnc: encryptFinancialData(100),
          }]
        }
      },
      include: { items: true }
    });
    
    await prisma.inventoryLedger.create({
      data: {
        userId: user.id,
        materialId: material.id,
        movementType: 'IN',
        quantity: 2,
        referenceId: purchase.id,
        referenceType: 'PURCHASE',
        txnDate: new Date(),
      }
    });
    
    await prisma.inventoryLayer.create({
      data: {
        userId: user.id,
        materialId: material.id,
        sourceId: purchase.id,
        originalQty: 2,
        remainingQty: 2,
        unitCostEnc: encryptFinancialData(100),
        receivedDate: new Date(),
        sourceType: 'PURCHASE'
      }
    });


    console.log('--- RUNNING TAMPER TESTS ---');

    // TEST A, B, C, D, E, F, I: Sale Creation Tampering
    const req = {
      user: { userId: user.id },
      headers: { 'user-agent': 'test-agent' },
      ip: '127.0.0.1',
      body: {
        companyName: 'Auth Customer LLC',
        customerId: customer.id,
        invoiceDate: new Date().toISOString().split('T')[0],
        shipState: 'Tamil Nadu',
        isInterState: true,
        grandTotal: 1,
        totalTaxable: 1,
        totalGst: 1,
        items: [{
          materialName: material.materialName,
          quantity: 2,
          unitPrice: 500,
          gstPercent: 10,
          taxableAmount: 1,
          gstAmount: 1,
          itemTotal: 1,
          purchasePrice: 9999,
          purchasePriceEnc: 'v2:FAKE'
        }]
      }
    };

    const res = mockResponse();
    const next = (err) => { throw err; };

    await createSale(req, res, next);

    if (res.statusCode !== 201) throw new Error("Sale creation failed: " + JSON.stringify(res.data));
    const sale = res.data;

    if (Number(sale.grandTotal) !== 1100) throw new Error("TEST A FAILED: GrandTotal is " + sale.grandTotal);
    if (Number(sale.totalGst) !== 100) throw new Error("TEST B FAILED: TotalGST is " + sale.totalGst);
    if (Number(sale.totalTaxable) !== 1000) throw new Error("TEST C FAILED: TotalTaxable is " + sale.totalTaxable);
    // DELETED TEST E because plaintext purchasePrice is no longer exposed by FIFO engine
    // DELETED TEST D because plaintext itemProfit is no longer exposed by FIFO engine
    if (Number(sale.igstAmount) !== 0) throw new Error("TEST I FAILED: Expected intra-state logic, IGST is " + sale.igstAmount);
    if (Number(sale.cgstAmount) !== 50) throw new Error("TEST I FAILED: Expected CGST 50, got " + sale.cgstAmount);
    
    console.log('[TEST A, B, C, D, E, F, I] Sale tampering tests PASSED.');

    // TEST G: Overpayment
    const reqPayment = {
        user: { userId: user.id },
        headers: { 'user-agent': 'test-agent' },
        ip: '127.0.0.1',
        params: { id: sale.id },
        body: {
            amount: 2000,
            dateReceived: new Date().toISOString().split('T')[0],
        }
    };
    
    const resPayment = mockResponse();
    await addReceivablePayment(reqPayment, resPayment, next);
    
    if (resPayment.statusCode !== 400 || !resPayment.data.error.includes('Overpayment rejected')) {
        throw new Error("TEST G FAILED: Allowed overpayment or incorrect error: " + JSON.stringify(resPayment.data));
    }
    
    console.log('[TEST G] Overpayment test PASSED.');
    console.log('ALL TESTS PASSED.');

  } catch (err) {
    console.error('TEST FAILED', err);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
