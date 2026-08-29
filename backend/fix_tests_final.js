const fs = require('fs');

// --- Fix test_tenant_isolation.js cascade teardowns ---
let isoPath = 'test_tenant_isolation.js';
let isoContent = fs.readFileSync(isoPath, 'utf8');

const isoTeardown = `await prisma.layerConsumption.deleteMany({ where: { user: { username: { in: ['tenant_a_test', 'tenant_b_test'] } } } });
  await prisma.inventoryLayer.deleteMany({ where: { user: { username: { in: ['tenant_a_test', 'tenant_b_test'] } } } });
  await prisma.inventoryLedger.deleteMany({ where: { user: { username: { in: ['tenant_a_test', 'tenant_b_test'] } } } });
  await prisma.purchaseItem.deleteMany({ where: { purchase: { user: { username: { in: ['tenant_a_test', 'tenant_b_test'] } } } } });
  await prisma.saleItem.deleteMany({ where: { sale: { user: { username: { in: ['tenant_a_test', 'tenant_b_test'] } } } } });
  await prisma.purchase.deleteMany({ where: { user: { username: { in: ['tenant_a_test', 'tenant_b_test'] } } } });
  await prisma.sale.deleteMany({ where: { user: { username: { in: ['tenant_a_test', 'tenant_b_test'] } } } });
  await prisma.material.deleteMany({ where: { user: { username: { in: ['tenant_a_test', 'tenant_b_test'] } } } });
  await prisma.user.deleteMany({ where: { username: { in: ['tenant_a_test', 'tenant_b_test'] } } });`;

isoContent = isoContent.replace(
  /await prisma\.purchase\.deleteMany\(\{ where: \{ user: \{ username: \{ in: \['tenant_a_test', 'tenant_b_test'\] \} \} \} \}\);[\s\S]*?await prisma\.user\.deleteMany\(\{ where: \{ username: \{ in: \['tenant_a_test', 'tenant_b_test'\] \} \} \} \}\);/g,
  isoTeardown
);
fs.writeFileSync(isoPath, isoContent, 'utf8');

// --- Fix test_financial_authority.js stock caching issue ---
let finPath = 'test_financial_authority.js';
let finContent = fs.readFileSync(finPath, 'utf8');
finContent = finContent.replace(
  `let material = await prisma.material.findFirst({ where: { userId: user.id, materialName: 'Auth Item' } });
    if (!material) {
      material = await prisma.material.create({
        data: {
          userId: user.id,
          materialName: 'Auth Item',
          currentStock: 2,
        }
      });
    }`,
  `let material = await prisma.material.findFirst({ where: { userId: user.id, materialName: 'Auth Item' } });
    if (!material) {
      material = await prisma.material.create({
        data: {
          userId: user.id,
          materialName: 'Auth Item',
          currentStock: 2,
        }
      });
    } else {
      await prisma.$executeRaw\`UPDATE materials SET current_stock = 2 WHERE id = \${material.id}\`;
    }
    
    // Make sure layer exists
    await prisma.inventoryLayer.deleteMany({ where: { materialId: material.id } });
    await prisma.inventoryLayer.create({
       data: {
         userId: user.id, materialId: material.id, sourceType: 'OPENING', receivedDate: new Date(),
         originalQty: 2, remainingQty: 2, unitCostEnc: 'mock'
       }
    });
    `
);

fs.writeFileSync(finPath, finContent, 'utf8');
console.log('Fixed teardown and stock bypass issues');
