const fs = require('fs');
let path = 'test_financial_authority.js';
let content = fs.readFileSync(path, 'utf8');

// Revert my bad patch in test_financial_authority
content = content.replace(
/const testMat = await prisma\.material\.create\([\s\S]*?await prisma\.purchase\.create\(\{/m,
`await prisma.purchase.create({`
);

content = content.replace(/materialName: "Auth Item", materialId: testMat\.id,/g, 'materialName: "Auth Item", materialId: material.id,');

fs.writeFileSync(path, content, 'utf8');

// Fix test_tenant_isolation.js teardown
path = 'test_tenant_isolation.js';
content = fs.readFileSync(path, 'utf8');
content = content.replace(
/await prisma\.user\.deleteMany\([\s\S]*?\);/,
`await prisma.purchase.deleteMany({ where: { userId: { in: [tenantA.id, tenantB.id] } } });
 await prisma.sale.deleteMany({ where: { userId: { in: [tenantA.id, tenantB.id] } } });
 await prisma.material.deleteMany({ where: { userId: { in: [tenantA.id, tenantB.id] } } });
 await prisma.user.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });`
);

// And we need to fix the setup error in test_tenant_isolation.js:
// B Material needs stock BEFORE B Sale is created.
// Since it uses API: POST /api/purchases and POST /api/sales.
// Let's check how it creates the purchase.
fs.writeFileSync(path, content, 'utf8');
console.log('Fixed tests');
