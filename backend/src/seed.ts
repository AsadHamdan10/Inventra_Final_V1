import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  console.log('?? Seeding Inventra database…');

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@inventra.local';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Inventra@SuperAdmin123';
  
  if (superAdminPassword.length < 8) {
    throw new Error("SUPER_ADMIN_PASSWORD must be at least 8 characters long.");
  }

  const hash = await bcrypt.hash(superAdminPassword, 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {
      password: hash,
      role: 'super_admin',
      status: 'active'
    },
    create: {
      companyName: 'Inventra Command Center',
      username: 'superadmin',
      email: superAdminEmail,
      password: hash,
      role: 'super_admin',
      status: 'active',
      forcePasswordChange: false,
    },
  });

  // Explicitly revoke any existing sessions for this Super Admin to enforce security
  // when the bootstrap password changes.
  const revoked = await prisma.refreshToken.updateMany({
    where: { userId: superAdmin.id, revokedAt: null },
    data: { revokedAt: new Date() }
  });

  console.log(`? Super Admin configured: ${superAdmin.email}`);
  if (revoked.count > 0) {
    console.log(`?? Revoked ${revoked.count} previous Super Admin sessions.`);
  }
  console.log('??  Store the SUPER_ADMIN_PASSWORD safely in your .env file.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
