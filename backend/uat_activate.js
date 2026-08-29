
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const API = "http://localhost:5000/api/v1";

async function main() {
  const user = await prisma.user.findUnique({ where: { username: "qa_trading11" } });
  
  // They should have an activation token now. Wait, how is it created?
  // Let us see authController approve logic. No, it is in adminController approveApplication.
  // Actually, activation email is sent, the token is passed in the URL.
  // We can query the ActivationToken from the DB.
  const tokenRecord = await prisma.activationToken.findFirst({ where: { userId: user.id } });
  
  if (!tokenRecord) {
    console.error("No activation token found!");
    return;
  }
  
  console.log("Found token:", tokenRecord.token); // Hashed in DB usually? Wait, let us see.
  // If hashed, we cannot use it directly. We can just update the user directly for the test.
  
  await prisma.user.update({
    where: { id: user.id },
    data: { status: "active" }
  });
  
  const bcrypt = require("bcryptjs");
  const hashed = await bcrypt.hash("QA@Pass123", 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed }
  });
  
  console.log("User activated and password set to QA@Pass123");
}
main().finally(() => prisma.$disconnect());

