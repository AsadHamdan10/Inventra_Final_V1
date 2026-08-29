const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clean() {
    const users = await prisma.user.findMany({ where: { username: { in: ['tenant_a_test', 'tenant_b_test', 'test_auth_user'] } } });
    for (const u of users) {
        await prisma.layerConsumption.deleteMany({ where: { userId: u.id } });
        await prisma.inventoryLayer.deleteMany({ where: { userId: u.id } });
        await prisma.inventoryLedger.deleteMany({ where: { userId: u.id } });
        await prisma.purchaseItem.deleteMany({ where: { purchase: { userId: u.id } } });
        await prisma.saleItem.deleteMany({ where: { sale: { userId: u.id } } });
        await prisma.purchase.deleteMany({ where: { userId: u.id } });
        await prisma.sale.deleteMany({ where: { userId: u.id } });
        await prisma.material.deleteMany({ where: { userId: u.id } });
        await prisma.customer.deleteMany({ where: { userId: u.id } });
        await prisma.vendor.deleteMany({ where: { userId: u.id } });
        await prisma.auditLog.deleteMany({ where: { userId: u.id } });
        await prisma.user.delete({ where: { id: u.id } });
    }
    console.log('Cleaned test users perfectly');
}
clean().then(() => prisma.$disconnect());
