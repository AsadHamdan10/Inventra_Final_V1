const fs = require('fs');
let code = fs.readFileSync('src/controllers/purchaseController.ts', 'utf8');

code = code.replace(/const layers = await tx\.inventoryLayer\.findMany\(\{[\s\S]*?where: \{ sourceType: 'PURCHASE', sourceId: id \}[\s\S]*?\}\);/, `const purchaseItems = await tx.purchaseItem.findMany({ where: { purchaseId: id } });
      const piIds = purchaseItems.map(pi => pi.id);
      const layers = await tx.inventoryLayer.findMany({
        where: { sourceType: 'PURCHASE', sourceId: { in: piIds } }
      });`);

code = code.replace(/await tx\.inventoryLayer\.deleteMany\(\{\s*where: \{\s*sourceType: 'PURCHASE',\s*sourceId: id\s*\}\s*\}\);/, `await tx.inventoryLayer.deleteMany({
        where: { sourceType: 'PURCHASE', sourceId: { in: piIds } }
      });`);

code = code.replace(/const purchaseItems = await tx\.purchaseItem\.findMany\(\{ where: \{ purchaseId: id \} \}\);\s*/, '');

fs.writeFileSync('src/controllers/purchaseController.ts', code);
