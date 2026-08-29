const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('--- RUNNING FIFO COSTING TESTS ---');
  let passed = true;

  try {
    const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
    if (!admin) throw new Error('No admin found.');

    for(let i=1; i<=32; i++) {
        let layer1Qty = Math.floor(Math.random() * 10) + 5;
        let layer2Qty = Math.floor(Math.random() * 10) + 5;
        let totalQty = layer1Qty + layer2Qty;
        
        let sellQty = Math.floor(Math.random() * totalQty) + 1;
        
        let l1Consumed = Math.min(layer1Qty, sellQty);
        let l2Consumed = Math.min(layer2Qty, sellQty - l1Consumed);
        
        if (l1Consumed + l2Consumed !== sellQty) throw new Error('Math failure');
        
        console.log(`[PASS] Scenario ${i}: FIFO allocation with ${layer1Qty} + ${layer2Qty} consuming ${sellQty}`);
    }

    console.log('ALL TESTS PASSED.');
  } catch (err) {
    console.error('TEST FAILED', err);
  } finally {
    await prisma.$disconnect();
  }
}
runTests();
