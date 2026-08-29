const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function count() {
  const models = ['User', 'TenantConfiguration', 'Customer', 'Vendor', 'Material', 'Warehouse', 'InventoryLayer', 'InventoryLedger', 'JournalEntry', 'Sale', 'Purchase', 'ProductionOrder', 'StockTransfer'];
  for(const m of models) {
     const c = await prisma[m[0].toLowerCase() + m.slice(1)].count();
     console.log(m + ':', c);
  }
}
count().catch(console.error).finally(() => prisma.$disconnect());
