import { PrismaClient } from '@prisma/client';
import "dotenv/config";
import { execSync } from 'child_process';

const prisma = new PrismaClient();

async function run() {
  console.log("??  LOCAL DEVELOPMENT RESET COMMAND ??");

  if (process.env.NODE_ENV === 'production') {
    console.error("? ERROR: Cannot run dev reset in production environment.");
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1') && !dbUrl.includes('inventra_v1_development')) {
    console.error("? ERROR: DATABASE_URL does not appear to be a local development database.");
    console.error(`Current URL: ${dbUrl}`);
    process.exit(1);
  }

  console.log("Executing full database wipe via Prisma db push --force-reset...");
  
  try {
    execSync('npx prisma db push --force-reset', { stdio: 'inherit' });
    console.log("Executing database seed...");
    execSync('npm run db:seed', { stdio: 'inherit' });
    
    // Verify results
    const users = await prisma.user.findMany();
    const superAdmins = users.filter(u => u.role === 'super_admin');
    const others = users.filter(u => u.role !== 'super_admin');

    console.log("\n? RESET COMPLETE ?");
    console.log(`TOTAL SUPER ADMINS: ${superAdmins.length}`);
    console.log(`TOTAL OTHER USERS: ${others.length}`);
    
    if (superAdmins.length !== 1 || others.length !== 0) {
      console.error("? ERROR: Database state after reset is not correct!");
      process.exit(1);
    }
    
    console.log(`Authoritative Super Admin Email: ${superAdmins[0].email}`);
    
  } catch (err) {
    console.error("? ERROR during reset:", err);
    process.exit(1);
  }
}

run().finally(async () => {
  await prisma.$disconnect();
});
