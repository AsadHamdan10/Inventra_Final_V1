
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, username: true, role: true } });
  console.log("Users:", users);
  
  const apps = await prisma.applicationSnapshot.findMany({ select: { id: true, username: true } });
  console.log("Apps:", apps);
}

main().catch(console.error).finally(() => prisma.$disconnect());

