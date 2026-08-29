const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { createSaleInternal } = require('./dist/controllers/saleController');
const crypto = require('crypto');

function encrypt(text) {
    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

async function run() {
    console.log('--- RUNNING test_financial_reconciliation_v2.js ---');
    try {
        let user = await prisma.user.findFirst();
        let customer = await prisma.customer.findFirst({ where: { userId: user.id } });
        
        const material = await prisma.material.create({
            data: {
                userId: user.id,
                materialName: 'Recon Item ' + Date.now(),
                currentStock: 100
            }
        });
        
        await prisma.inventoryLayer.create({
            data: {
                userId: user.id,
                materialId: material.id,
                sourceType: 'OPENING',
                receivedDate: new Date(),
                originalQty: 100,
                remainingQty: 100,
                unitCostEnc: encrypt('50')
            }
        });

        const sale = await prisma.$transaction(async (tx) => {
            return await createSaleInternal(
                user.id,
                customer.id,
                new Date().toISOString(),
                undefined,
                undefined,
                undefined,
                undefined,
                [{ materialId: material.id, quantity: 1, unitPrice: 10, gstPercent: 18 }],
                tx
            );
        });

        const payment = await prisma.customerPayment.create({
            data: {
                userId: user.id,
                customerId: customer.id,
                paymentDate: new Date(),
                amount: 11.80,
                mode: 'CASH',
                reference: 'CASH-1',
                unallocated: 0
            }
        });
        
        await prisma.customerPaymentAllocation.create({
            data: {
                userId: user.id, paymentId: payment.id,
                saleId: sale.id,
                amountAllocated: 11.80
            }
        });

        // Test referential integrity
        try {
            // we should not be able to delete the sale because of the foreign key constraint
            await prisma.sale.delete({ where: { id: sale.id } });
            console.error("FAILED: Managed to delete sale that has allocations!");
            process.exit(1);
        } catch (e) {
            if (e.message && e.message.includes('violates RESTRICT')) {
                console.log("SUCCESS: Referential integrity blocked deletion of sale.");
            } else {
                console.error("FAILED: Unexpected error during deletion attempt:", e);
                process.exit(1);
            }
        }
        
        process.exit(0);
    } catch (e) {
        console.error("Test failed with exception:", e);
        process.exit(1);
    }
}
run();
