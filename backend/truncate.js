const prisma = require('./dist/utils/prisma').default;
async function run() {
  await prisma.$executeRawUnsafe('TRUNCATE journal_entries CASCADE');
  console.log('Truncated');
}
run().catch(console.error).finally(()=>prisma.$disconnect());
