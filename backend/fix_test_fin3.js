const fs = require('fs');

// --- 1. Fix test_financial_authority.js ---
let finPath = 'test_financial_authority.js';
let finContent = fs.readFileSync(finPath, 'utf8');

finContent = finContent.replace(
/await prisma\.purchase\.create\(\{[\s\S]*?items: \{[\s\S]*?create: \[[\s\S]*?\{[\s\S]*?materialName: "Auth Item"[\s\S]*?\}[\s\S]*?\][\s\S]*?\}[\s\S]*?\}[\s\S]*?\}\)/m,
`await prisma.purchase.create({
      data: {
        userId: user.id,
        billNo: 'INIT-BILL-' + Date.now(),
        billDate: new Date(),
        vendorName: 'Auth Vendor LLC',
        vendorId: vendor.id,
        grandTotal: 200,
        totalTaxable: 200,
        items: {
          create: [
            {
              materialId: material.id,
              materialName: 'Auth Item',
              quantity: 1,
              purchaseRateEnc: encrypt('50')
            }
          ]
        }
      }
    })`
);

finContent = finContent.replace(
/await prisma\.sale\.create\(\{[\s\S]*?items: \{[\s\S]*?create: \[[\s\S]*?\{[\s\S]*?materialName: "Auth Item Sold"[\s\S]*?\}[\s\S]*?\][\s\S]*?\}[\s\S]*?\}[\s\S]*?\}\)/m,
`await prisma.sale.create({
      data: {
        userId: user.id,
        invoiceNo: 'INIT-SALE-' + Date.now(),
        invoiceDate: new Date(),
        companyName: 'Auth Customer LLC',
        customerId: customer.id,
        grandTotal: 200,
        totalTaxable: 200,
        totalPurchaseCostEnc: encrypt('50'),
        grossProfitEnc: encrypt('150'),
        items: {
          create: [
            {
              materialId: material.id,
              materialName: 'Auth Item',
              quantity: 1,
              unitPrice: 200,
              purchasePriceEnc: encrypt('50'),
              avgPurchaseCostEnc: encrypt('50'),
              itemProfitEnc: encrypt('150')
            }
          ]
        }
      }
    })`
);
fs.writeFileSync(finPath, finContent, 'utf8');

// --- 2. Fix test_tenant_isolation.js ---
let isoPath = 'test_tenant_isolation.js';
let isoContent = fs.readFileSync(isoPath, 'utf8');

isoContent = isoContent.replace(
`await prisma.purchase.deleteMany({ where: { userId: { in: [tenantA.id, tenantB.id] } } });
 await prisma.sale.deleteMany({ where: { userId: { in: [tenantA.id, tenantB.id] } } });
 await prisma.material.deleteMany({ where: { userId: { in: [tenantA.id, tenantB.id] } } });
 await prisma.user.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });`,
`await prisma.user.deleteMany({ where: { username: { in: ['tenant_a_test', 'tenant_b_test'] } } });`
);

isoContent = isoContent.replace(
`await prisma.auditLog.deleteMany({ where: { userId: { in: [tenantA.id, tenantB.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });`,
`await prisma.auditLog.deleteMany({ where: { userId: { in: [tenantA.id, tenantB.id] } } });
  await prisma.purchase.deleteMany({ where: { userId: { in: [tenantA.id, tenantB.id] } } });
  await prisma.sale.deleteMany({ where: { userId: { in: [tenantA.id, tenantB.id] } } });
  await prisma.material.deleteMany({ where: { userId: { in: [tenantA.id, tenantB.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });`
);

fs.writeFileSync(isoPath, isoContent, 'utf8');
console.log('Fixed both tests');
