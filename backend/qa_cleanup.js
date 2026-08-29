
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function cleanupQA() {
  console.log("Cleaning up QA records...");
  
  // Find QA users
  const qaUsers = await prisma.user.findMany({
    where: {
      username: { startsWith: "qa_" }
    }
  });
  
  if (qaUsers.length === 0) {
    console.log("No QA users found.");
    return;
  }
  
  console.log(`Found ${qaUsers.length} QA users.`);
  
  // Safely delete related records using deleteMany since Cascade delete might not be configured everywhere.
  // Actually, wait, our cleanup deletes auditLog first, then the user. Cascade should handle the rest if set up correctly, but let us be thorough.
  
  const userIds = qaUsers.map(u => u.id);
  
  await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  
  // A lot of things cascade from User but not everything. Let us just rely on the existing isolation test cleanup script structure or manual deletion.
  await prisma.user.deleteMany({
    where: { id: { in: userIds } }
  });
  
  await prisma.applicationSnapshot.deleteMany({
    where: { username: { startsWith: "qa_" } }
  });
  
  console.log("QA cleanup complete.");
}

cleanupQA().catch(console.error).finally(() => prisma.$disconnect());

