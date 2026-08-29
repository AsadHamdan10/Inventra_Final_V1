const fs = require('fs');

let fa = fs.readFileSync('test_financial_authority.js', 'utf8');

fa = fa.replace(/await prisma\.purchase\.create\(\{[\s\S]*?\}\);/, `
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
      }
    });
    
    await prisma.inventoryLayer.create({
      data: {
        userId: user.id,
        materialId: material.id,
        purchaseId: purchase.id,
        purchaseItemId: purchase.items[0].id,
        receivedQty: 2,
        remainingQty: 2,
        costPerUnitEnc: encryptFinancialData(100),
        receivedDate: new Date()
      }
    });
`);

fs.writeFileSync('test_financial_authority.js', fa);


let ti = fs.readFileSync('test_tenant_isolation.js', 'utf8');

ti = ti.replace(/await prisma\.purchase\.create\(\{[\s\S]*?userId: tenantA\.id[\s\S]*?\}\);/, `
    const purchaseA = await prisma.purchase.create({
      data: {
        userId: tenantA.id,
        billNo: 'INIT-BILL-A-' + Date.now(),
        billDate: new Date(),
        vendorName: 'Vendor A LLC',
        vendorId: vendorA.id,
        grandTotal: 1500,
        totalTaxable: 1500,
        items: {
          create: [{
            materialName: materialA.materialName, materialId: materialA.id,
            quantity: 10,
            purchaseRateEnc: encryptFinancialData(150),
          }]
        }
      },
      include: { items: true }
    });
    
    await prisma.inventoryLedger.create({
      data: {
        userId: tenantA.id,
        materialId: materialA.id,
        movementType: 'IN',
        quantity: 10,
        referenceId: purchaseA.id,
        referenceType: 'PURCHASE',
      }
    });
    
    await prisma.inventoryLayer.create({
      data: {
        userId: tenantA.id,
        materialId: materialA.id,
        purchaseId: purchaseA.id,
        purchaseItemId: purchaseA.items[0].id,
        receivedQty: 10,
        remainingQty: 10,
        costPerUnitEnc: encryptFinancialData(150),
        receivedDate: new Date()
      }
    });
`);

fs.writeFileSync('test_tenant_isolation.js', ti);
