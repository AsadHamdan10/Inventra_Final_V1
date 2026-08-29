import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function runTests() {
  console.log("Running Super Admin Auth & Consistency Tests...\n");

  // 1. Idempotent Seed & Uniqueness Test
  console.log("Test: Idempotent Seed");
  execSync('npm run db:seed', { stdio: 'inherit', cwd: process.cwd() });
  execSync('npm run db:seed', { stdio: 'inherit', cwd: process.cwd() });
  
  const superAdmins = await prisma.user.findMany({ where: { role: 'super_admin' } });
  if (superAdmins.length !== 1) {
    throw new Error(`Expected exactly 1 Super Admin, found ${superAdmins.length}`);
  }
  console.log("? Exactly one Super Admin exists after multiple seeds.");

  // 2. Password Security Test
  console.log("Test: Password Security");
  const admin = superAdmins[0];
  if (!admin.password || !admin.password.startsWith('$2')) { // bcrypt hashes start with $2
    throw new Error("Password is not securely hashed using bcrypt!");
  }
  console.log("? Password securely hashed in DB.");

  // 3. Login Simulation Test
  console.log("Test: Login Authentication");
  const testPassword = process.env.SUPER_ADMIN_PASSWORD || 'Inventra@SuperAdmin123';
  const isValid = await bcrypt.compare(testPassword, admin.password);
  if (!isValid) throw new Error("Authentication failed with authoritative password!");
  
  const isInvalid = await bcrypt.compare("wrong_password", admin.password);
  if (isInvalid) throw new Error("Authentication succeeded with WRONG password!");
  console.log("? Login successfully validates correct password and rejects wrong password.");

  console.log("\nAll internal verification tests passed!");
}

runTests().catch(console.error).finally(() => prisma.$disconnect());
