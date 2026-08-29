const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany();
    for (const user of users) {
        // Find default warehouse
        let defaultWh = await prisma.warehouse.findFirst({ where: { userId: user.id, code: 'MAIN' } });
        if (!defaultWh) {
            defaultWh = await prisma.warehouse.create({
                data: {
                    userId: user.id,
                    code: 'MAIN',
                    name: 'Main Warehouse',
                    warehouseType: 'GENERAL'
                }
            });
        }
        
        // Update InventoryLayer
        const updateLayers = await prisma.inventoryLayer.updateMany({
            where: { userId: user.id, warehouseId: null },
            data: { warehouseId: defaultWh.id }
        });
        console.log(`Updated ${updateLayers.count} layers for user ${user.id}`);

        // Update InventoryLedger
        const updateLedgers = await prisma.inventoryLedger.updateMany({
            where: { userId: user.id, warehouseId: null },
            data: { warehouseId: defaultWh.id }
        });
        console.log(`Updated ${updateLedgers.count} ledgers for user ${user.id}`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
