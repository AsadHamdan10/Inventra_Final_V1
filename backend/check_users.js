const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function count() {
  const users = await prisma.user.count();
  const superAdmins = await prisma.user.count({ where: { role: 'super_admin' } });
  const admins = await prisma.user.count({ where: { role: 'admin' } });
  const staff = await prisma.user.count({ where: { role: 'staff' } });
  console.log('Users:', users);
  console.log('SuperAdmins:', superAdmins);
  console.log('Admins:', admins);
  console.log('Staff:', staff);

  if (superAdmins > 0) {
     const sa = await prisma.user.findFirst({ where: { role: 'super_admin' } });
     console.log('Super Admin found:', sa.email, 'Active:', sa.isActive);
  } else {
     console.log('NO SUPER admin FOUND');
  }
}
count().catch(console.error).finally(() => prisma.$disconnect());
