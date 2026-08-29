const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

function addIndex(modelName, indexStr) {
    const regex = new RegExp(`(model ${modelName} \\{[^}]*)(\\})`, 's');
    if (schema.match(regex)) {
        if (!schema.includes(indexStr)) {
            schema = schema.replace(regex, `$1  ${indexStr}\n$2`);
        }
    } else {
        console.warn(`Model ${modelName} not found`);
    }
}

addIndex('InventoryLedger', '@@index([userId, materialId, txnDate])');
addIndex('InventoryLedger', '@@index([userId, warehouseId, txnDate])');
addIndex('InventoryLayer', '@@index([userId, materialId, warehouseId])');
addIndex('InventoryLayer', '@@index([userId, receivedDate])');
addIndex('JournalLine', '@@index([userId, accountId])');
addIndex('Sale', '@@index([userId, invoiceDate, status])');
addIndex('Purchase', '@@index([userId, invoiceDate, status])');
addIndex('ProductionOrder', '@@index([userId, status])');
addIndex('ProductionExecution', '@@index([userId, status])');

fs.writeFileSync('prisma/schema.prisma', schema);
console.log('Added performance indexes');
