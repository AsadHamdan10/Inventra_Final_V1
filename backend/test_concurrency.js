const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findFirst();
  if (!user) return;
  const material = await prisma.material.create({
    data: { userId: user.id, materialName: 'Concurrent Test ' + Date.now(), currentStock: 10 }
  });
  const layer = await prisma.inventoryLayer.create({
    data: { userId: user.id, materialId: material.id, sourceType: 'OPENING', originalQty: 10, remainingQty: 10, unitCostEnc: 'abc', receivedDate: new Date() }
  });
  
  console.log('Created material with 10 stock');
  const { createSale } = require('./dist/controllers/saleController');
  
  const req1 = {
      user: { userId: user.id }, ip: '1', headers: {},
      body: { companyName: 'A', customerId: 1, invoiceDate: new Date(), grandTotal: 1, totalTaxable: 1, totalGst: 0, items: [{ materialId: material.id, materialName: material.materialName, quantity: 7, unitPrice: 10, gstPercent: 0, taxableAmount: 70, gstAmount: 0, itemTotal: 70 }] }
  };
  const req2 = {
      user: { userId: user.id }, ip: '1', headers: {},
      body: { companyName: 'B', customerId: 1, invoiceDate: new Date(), grandTotal: 1, totalTaxable: 1, totalGst: 0, items: [{ materialId: material.id, materialName: material.materialName, quantity: 6, unitPrice: 10, gstPercent: 0, taxableAmount: 60, gstAmount: 0, itemTotal: 60 }] }
  };
  
  let res1 = { status: () => res1, json: (d) => { res1.data = d; return res1; } };
  let res2 = { status: () => res2, json: (d) => { res2.data = d; return res2; } };
  
  await Promise.allSettled([
      createSale(req1, res1, console.log),
      createSale(req2, res2, console.log)
  ]);
  
  const finalMat = await prisma.material.findUnique({ where: { id: material.id } });
  console.log('Final stock:', finalMat.currentStock);
}
run().then(() => prisma.$disconnect());
