const fs = require('fs');

const path = 'test_financial_authority.js';
let content = fs.readFileSync(path, 'utf8');

// The test creates a purchase, we need to inject a material
content = content.replace(
`await prisma.purchase.create({`,
`
    const testMat = await prisma.material.create({
        data: { userId: tenant.id, materialName: "Auth Item", unit: "Nos", currentStock: 0 }
    });
    await prisma.purchase.create({
`
);
content = content.replace(
`materialName: "Auth Item",`,
`materialName: "Auth Item", materialId: testMat.id,`
);
content = content.replace(
`materialName: "Auth Item Sold",`,
`materialName: "Auth Item", materialId: testMat.id,`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed test_financial_authority');
