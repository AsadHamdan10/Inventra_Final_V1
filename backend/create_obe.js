const prisma = require('./dist/utils/prisma').default;

async function run() {
  const users = await prisma.user.findMany();
  for (const u of users) {
    const p = await prisma.chartOfAccount.findUnique({
      where: { userId_code: { userId: u.id, code: '3000' } }
    });
    
    await prisma.chartOfAccount.upsert({
      where: { userId_code: { userId: u.id, code: '3300' } },
      update: {},
      create: {
        userId: u.id,
        code: '3300',
        name: 'Opening Balance Equity',
        accountType: 'EQUITY',
        accountSubType: 'CAPITAL',
        parentId: p ? p.id : null,
        isSystemAccount: true,
        isActive: true
      }
    });
  }
  console.log('OBE Created');
}
run().catch(console.error).finally(()=>prisma.$disconnect());
