
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const API = "http://localhost:5000/api/v1";

async function testRecovery() {
  try {
    const user = await prisma.user.findFirst({ where: { email: "qa_master2@example.com" }});
    const tokenRecord = await prisma.passwordResetToken.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" }});
    
    console.log("Token record:", tokenRecord.token);
    // Submit reset
    const resetRes = await fetch(`${API}/auth/reset-password`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: tokenRecord.token, newPassword: "NewQAPassword@123" }) 
    });
    const resetData = await resetRes.json();
    console.log("Reset Response:", resetData);
    
    // Login with new
    const loginRes = await fetch(`${API}/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "qa_master2", password: "NewQAPassword@123" })
    });
    console.log("Login Response:", await loginRes.json());
  } catch(e) { console.error(e); } finally { prisma.$disconnect(); }
}
testRecovery();

