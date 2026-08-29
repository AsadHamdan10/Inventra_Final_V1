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
    console.log('--- RUNNING test_financial_authority_v2.js ---');
    try {
        let user = await prisma.user.findFirst();
        if (!user) {
            user = await prisma.user.create({
                data: {
                    companyName: 'Test Corp',
                    username: 'test_admin',
                    email: 'test@admin.com',
                    password: 'hash',
                    role: 'admin',
                    gstin: '27AAAAA0000A1Z5'
                }
            });
        }
        
        let customer = await prisma.customer.findFirst({ where: { userId: user.id } });
        if (!customer) {
            customer = await prisma.customer.create({
                data: {
                    userId: user.id,
                    companyName: 'Auth Corp',
                    gstin: '27AAAAA0000A1Z5'
                }
            });
        }
        
        let material = null;
        if (!material) {
            material = await prisma.material.create({
                data: {
                    userId: user.id,
                    materialName: 'Test Item', 
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
        }

        const maliciousItems = [
            { materialId: material.id, quantity: 2, unitPrice: 100, gstPercent: 18 }
        ];

        const result = await prisma.$transaction(async (tx) => {
            return await createSaleInternal(
                user.id,
                customer.id,
                new Date().toISOString(),
                undefined,
                undefined,
                undefined,
                undefined,
                maliciousItems,
                tx
            );
        });

        console.log("Created Sale:", result.invoiceNo);
        
        const trueTaxable = 200;
        const trueGst = 36;
        const trueGrand = 236;
        
        if (Number(result.totalTaxable) !== trueTaxable) {
            console.error(`FAILED: Expected totalTaxable ${trueTaxable}, got ${result.totalTaxable}`);
            process.exit(1);
        }
        if (Number(result.totalGst) !== trueGst) {
            console.error(`FAILED: Expected totalGst ${trueGst}, got ${result.totalGst}`);
            process.exit(1);
        }
        if (Number(result.grandTotal) !== trueGrand) {
            console.error(`FAILED: Expected grandTotal ${trueGrand}, got ${result.grandTotal}`);
            process.exit(1);
        }

        console.log("SUCCESS: Financial Authority test passed! Backend ignored malicious frontend totals.");
        process.exit(0);
    } catch (e) {
        console.error("Test failed with exception:", e);
        process.exit(1);
    }
}
run();
