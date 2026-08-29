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
    console.log('--- RUNNING test_sale_purchase_concurrency.js ---');
    try {
        let user = await prisma.user.findFirst();
        let customer = await prisma.customer.findFirst({ where: { userId: user.id } });
        
        // Create a new fresh material with EXACTLY 10 stock
        const material = await prisma.material.create({
            data: {
                userId: user.id,
                materialName: 'Concurrency Item ' + Date.now(),
                currentStock: 10
            }
        });
        
        await prisma.inventoryLayer.create({
            data: {
                userId: user.id,
                materialId: material.id,
                sourceType: 'OPENING',
                receivedDate: new Date(),
                originalQty: 10,
                remainingQty: 10,
                unitCostEnc: encrypt('50')
            }
        });

        // We try to make TWO concurrent sales of 6 units each.
        // Total requested = 12. Available = 10.
        // Without Row Locks, both might read stock=10 and succeed, leading to -2 stock.
        // With Row Locks (FOR UPDATE), the second transaction waits, then reads stock=4, and throws "Insufficient stock".

        const makeSale = async () => {
            return await prisma.$transaction(async (tx) => {
                return await createSaleInternal(
                    user.id,
                    customer.id,
                    new Date().toISOString(),
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    [{ materialId: material.id, quantity: 6, unitPrice: 100, gstPercent: 18 }],
                    tx
                );
            });
        };

        console.log("Launching concurrent sale requests...");
        const results = await Promise.allSettled([makeSale(), makeSale()]);
        
        const successes = results.filter(r => r.status === 'fulfilled');
        const failures = results.filter(r => r.status === 'rejected');

        console.log(`Successes: ${successes.length}, Failures: ${failures.length}`);
        
        if (successes.length === 2) {
            console.error("FAILED: Both concurrent sales succeeded! Row locks are missing or broken.");
            process.exit(1);
        }

        if (successes.length === 1 && failures.length === 1) {
            const finalMaterial = await prisma.material.findUnique({ where: { id: material.id } });
            console.log("Final Stock:", finalMaterial.currentStock.toString());
            if (Number(finalMaterial.currentStock) < 0) {
                 console.error("FAILED: Stock is negative!");
                 process.exit(1);
            }
            console.log("SUCCESS: Concurrency test passed! Row locking prevented negative stock.");
            process.exit(0);
        }

        console.error("FAILED: Unexpected result:", results);
        process.exit(1);
    } catch (e) {
        console.error("Test failed with exception:", e);
        process.exit(1);
    }
}
run();
