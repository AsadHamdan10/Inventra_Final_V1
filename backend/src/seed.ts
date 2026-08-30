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

  const revoked = await prisma.refreshToken.updateMany({
    where: { userId: superAdmin.id, revokedAt: null },
    data: { revokedAt: new Date() }
  });

  console.log(`? Super Admin configured: ${superAdmin.email}`);
  if (revoked.count > 0) {
    console.log(`?? Revoked ${revoked.count} previous Super Admin sessions.`);
  }

  console.log('?? Seeding INVENTRA SaaS Plans...');

  // Phase 6.10F: Strict Business Model Plans
  // Trading Annual: ?3,499
  // Trading + Manufacturing Annual: ?4,699
  // (No Free Plans)

  const plan1 = await prisma.saaSPlan.upsert({
    where: { code: 'TRADING_ANNUAL' },
    update: {
      annualPrice: 3499.00,
      businessType: 'TRADING',
      name: 'Trading Annual',
      isActive: true
    },
    create: {
      code: 'TRADING_ANNUAL',
      name: 'Trading Annual',
      description: 'Core Trading & Finance ERP',
      annualPrice: 3499.00,
      businessType: 'TRADING',
      currency: 'INR',
      isActive: true
    }
  });
  console.log(`? SaaS Plan Upserted: ${plan1.code}`);

  const plan2 = await prisma.saaSPlan.upsert({
    where: { code: 'TRADING_MANUFACTURING_ANNUAL' },
    update: {
      annualPrice: 4699.00,
      businessType: 'BOTH',
      name: 'Trading + Manufacturing Annual',
      isActive: true
    },
    create: {
      code: 'TRADING_MANUFACTURING_ANNUAL',
      name: 'Trading + Manufacturing Annual',
      description: 'Full Production & Execution ERP',
      annualPrice: 4699.00,
      businessType: 'BOTH',
      currency: 'INR',
      isActive: true
    }
  });
  console.log(`? SaaS Plan Upserted: ${plan2.code}`);

  // Deactivate any legacy plans that are not part of the active business model
  const legacyPlans = await prisma.saaSPlan.updateMany({
    where: { 
      code: { notIn: ['TRADING_ANNUAL', 'TRADING_MANUFACTURING_ANNUAL'] }
    },
    data: { isActive: false }
  });
  if (legacyPlans.count > 0) {
    console.log(`? Deactivated ${legacyPlans.count} legacy plans.`);
  }

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
