const { initializeDefaultCOA } = require('./dist/services/accounting/coaService');
const prisma = require('./dist/utils/prisma').default;
async function run() {
  const users = await prisma.user.findMany();
  for (const u of users) {
    await initializeDefaultCOA(u.id);
  }
  console.log('Done');
}
run().catch(console.error).finally(()=>prisma.$disconnect());
