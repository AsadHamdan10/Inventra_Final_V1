const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clean() {
  const users = await prisma.user.findMany();
  const userIds = users.map(u => u.id);
  if (userIds.length === 0) return console.log('Clean.');

  console.log('Deleting data for', userIds.length, 'users...');

  const tables = [
    'LayerConsumption',
    'InventoryLayer',
    'InventoryLedger',
    'SaleItem',
    'Sale',
    'PurchaseItem',
    'PayablePayment',
    'Purchase',
    'Material',
    'TenantSequence',
    'AuditLog',
    'RefreshToken'
  ];

  for (const table of tables) {
    if (prisma[table.charAt(0).toLowerCase() + table.slice(1)]) {
      await prisma[table.charAt(0).toLowerCase() + table.slice(1)].deleteMany({});
    }
  }

  await prisma.user.deleteMany({});
  console.log('Database wiped.');
  process.exit(0);
}

clean().catch(console.error);
