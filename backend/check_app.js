
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  console.log(await prisma.applicationSnapshot.findMany({
    orderBy: { id: "desc" },
    take: 5
  }));
}
main().finally(() => prisma.$disconnect());

