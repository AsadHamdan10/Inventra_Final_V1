const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log('Users:', await prisma.user.count());
  console.log('Customers:', await prisma.customer.count());
  console.log('Sales:', await prisma.sale.count());
  console.log('AuditLogs:', await prisma.auditLog.count());
}
main().finally(() => prisma.$disconnect());
