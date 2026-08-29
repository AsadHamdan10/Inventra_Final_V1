const fs = require('fs');
let code = fs.readFileSync('src/controllers/purchaseController.ts', 'utf8');

const regex = /await tx\.inventoryLayer\.deleteMany\(\{[\s\S]*?where: \{ sourceType: 'PURCHASE', sourceId: \{ in: piIds \} \}[\s\S]*?\}\);/;

const replaceCode = `await tx.inventoryLayer.updateMany({
        where: { sourceType: 'PURCHASE', sourceId: { in: piIds } },
        data: { remainingQty: 0, originalQty: 0 }
      });`;

code = code.replace(regex, replaceCode);
fs.writeFileSync('src/controllers/purchaseController.ts', code);
