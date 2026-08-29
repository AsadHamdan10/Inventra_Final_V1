import * as fs from 'fs';
import * as path from 'path';

const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
let content = fs.readFileSync(schemaPath, 'utf8');

// Fix ReceivablePayment
content = content.replace(
    /model ReceivablePayment {[\s\S]*?layerConsumptions LayerConsumption\[\][\s\S]*?}/,
    (match) => match.replace('  layerConsumptions LayerConsumption[]', '')
);

// Add missing opposite relation fields:
if (!content.includes('inventoryLayers InventoryLayer[]')) {
    content = content.replace(
        /model User {[\s\S]*?}/,
        (match) => match.replace('}', '  inventoryLayers InventoryLayer[]\n  layerConsumptions LayerConsumption[]\n}')
    );
}

if (!content.includes('inventoryLayers   InventoryLayer[]')) {
    content = content.replace(
        /model Material {[\s\S]*?}/,
        (match) => match.replace('}', '  inventoryLayers   InventoryLayer[]\n}')
    );
}

fs.writeFileSync(schemaPath, content, 'utf8');
console.log('Fixed schema');
