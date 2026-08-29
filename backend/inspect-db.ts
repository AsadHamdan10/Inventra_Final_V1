import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run() {
  const users = await prisma.user.findMany({ where: { role: 'super_admin' } });
  console.log("Super Admins:");
  users.forEach(u => console.log(`${u.id} | ${u.email} | ${u.username} | ${u.role}`));
}
run().then(() => process.exit(0));
