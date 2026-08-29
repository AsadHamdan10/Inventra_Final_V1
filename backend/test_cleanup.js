const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupTestUsers() {
    const emails = ['tenant_a@test.com', 'tenant_b@test.com', 'test_auth@example.com', 'a@test.com', 'b@test.com', 'reg@test.com', 'reg2@test.com', 'super@system.local', 'admin_app_test@example.com', 'admin_app_test_b@example.com', 'admin_app_test_c@example.com', 'p1@test.com', 'p2@test.com', 'a1@test.com', 'r1@test.com', 'admin@system.local'];
    
    for (const email of emails) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) continue;

        const userId = user.id;

        // Cleanup in reverse dependency order
        
        // 1. LayerConsumptions
        await prisma.$executeRawUnsafe(`DELETE FROM layer_consumptions WHERE layer_id IN (SELECT id FROM inventory_layers WHERE user_id = ${userId})`);
        
        // 2. InventoryLayers
        await prisma.inventoryLayer.deleteMany({ where: { userId } });
        
        // 3. InventoryLedger
        await prisma.inventoryLedger.deleteMany({ where: { userId } });

        // 4. SaleItems and PurchaseItems
        await prisma.salesReturnItem.deleteMany({ where: { salesReturn: { userId } } });
        await prisma.salesReturn.deleteMany({ where: { userId } });
        await prisma.purchaseReturnItem.deleteMany({ where: { purchaseReturn: { userId } } });
        await prisma.purchaseReturn.deleteMany({ where: { userId } });
        await prisma.saleItem.deleteMany({ where: { sale: { userId } } });
        await prisma.purchaseItem.deleteMany({ where: { purchase: { userId } } });
        
        // 5. ReceivablePayments and PayablePayments
        await prisma.receivablePayment.deleteMany({ where: { sale: { userId } } });
        await prisma.payablePayment.deleteMany({ where: { purchase: { userId } } });

        // 6. Sales and Purchases
        await prisma.sale.deleteMany({ where: { userId } });
        await prisma.purchase.deleteMany({ where: { userId } });

        // 7. Customers and Vendors
        await prisma.customer.deleteMany({ where: { userId } });
        await prisma.vendor.deleteMany({ where: { userId } });

        // 8. Materials
        await prisma.material.deleteMany({ where: { userId } });
        
        // 9. Categories and other User relations
        // await prisma.category.deleteMany({ where: { userId } });
        await prisma.auditLog.deleteMany({ where: { userId } });
        // await prisma.session.deleteMany({ where: { userId } });

        // 10. Finally, the User itself
        await prisma.user.delete({ where: { id: userId } });
    }
}

module.exports = { cleanupTestUsers };
