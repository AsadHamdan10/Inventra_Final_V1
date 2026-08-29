const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  console.log("Starting ApplicationSnapshot migration...");
  
  const users = await prisma.user.findMany({
    include: { applicationSnapshot: true }
  });

  let created = 0;
  
  for (const user of users) {
    if (!user.applicationSnapshot) {
      // Create snapshot using current data as a fallback for existing users
      await prisma.applicationSnapshot.create({
        data: {
          userId: user.id,
          applicationRef: user.applicationRef || `INV-MIG-${user.id}`,
          fullName: user.fullName,
          companyName: user.companyName,
          username: user.username,
          email: user.email,
          mobile: user.mobile, // keeping encrypted if it was encrypted
          businessType: null,
          industry: null,
          plan: user.plan || "V1_BASIC",
          billingCycle: "YEARLY",
          originalStatus: user.status,
          rejectionReason: user.rejectionReason,
          submittedAt: user.createdAt,
          reviewedAt: user.status !== 'pending' ? user.updatedAt : null,
          reviewedBy: null
        }
      });
      created++;
      console.log(`Created snapshot for user ${user.username}`);
    }
  }
  
  console.log(`Migration complete. Created ${created} snapshots.`);
}

migrate()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
