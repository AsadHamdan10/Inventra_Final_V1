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
    console.log('--- RUNNING test_fiscal_year_numbering_v2.js ---');
    try {
        let user = await prisma.user.findFirst();
        let customer = await prisma.customer.findFirst({ where: { userId: user.id } });
        
        const material = await prisma.material.create({
            data: {
                userId: user.id,
                materialName: 'Fiscal Item ' + Date.now(),
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
                    [{ materialId: material.id, quantity: 1, unitPrice: 10, gstPercent: 18 }],
                    tx
                );
            });
        };

        const sale1 = await makeSale();
        const sale2 = await makeSale();
        
        console.log("Sale 1:", sale1.invoiceNo);
        console.log("Sale 2:", sale2.invoiceNo);
        
        const num1 = parseInt(sale1.invoiceNo.split('/').pop());
        const num2 = parseInt(sale2.invoiceNo.split('/').pop());

        if (num2 !== num1 + 1) {
             console.error(`FAILED: Expected invoice numbers to be sequential. Got ${num1} and ${num2}`);
             process.exit(1);
        }

        console.log("SUCCESS: Fiscal year numbering test passed! Invoices are generated sequentially on backend.");
        process.exit(0);
    } catch (e) {
        console.error("Test failed with exception:", e);
        process.exit(1);
    }
}
run();
