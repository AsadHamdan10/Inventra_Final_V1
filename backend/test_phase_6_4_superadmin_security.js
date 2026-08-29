const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const assert = require('assert');

async function runTests() {
  console.log("--- STARTING PHASE 6.4 SUPER ADMIN SECURITY TESTS ---\n");

  // Helper to simulate endpoint responses structure
  const adminController = require('./src/controllers/adminController');
  
  // 1. Setup Test Data
  await prisma.applicationSnapshot.deleteMany({ where: { username: { startsWith: 'test_sa_64' } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: 'test_sa_64' } } });

  const testApp = await prisma.user.create({
    data: {
      fullName: "Test SA 64 Pending",
      companyName: "SA 64 App",
      username: "test_sa_64_pending",
      email: "testsa64@example.com",
      mobile: "9999999999",
      role: "admin",
      status: "pending",
      applicationRef: "INV-64-PENDING",
      plan: "V1_BASIC",
      applicationSnapshot: {
        create: {
          applicationRef: "INV-64-PENDING",
          fullName: "Test SA 64 Pending",
          companyName: "SA 64 App",
          username: "test_sa_64_pending",
          email: "testsa64@example.com",
          mobile: "9999999999",
          plan: "V1_BASIC",
          originalStatus: "pending"
        }
      }
    }
  });

  const testTenant = await prisma.user.create({
    data: {
      fullName: "Test SA 64 Active",
      companyName: "SA 64 Tenant",
      username: "test_sa_64_active",
      email: "testsa64active@example.com",
      mobile: "8888888888",
      role: "admin",
      status: "active",
      applicationRef: "INV-64-ACTIVE",
      plan: "V1_BASIC",
      password: "some_secure_hash",
      applicationSnapshot: {
        create: {
          applicationRef: "INV-64-ACTIVE",
          fullName: "Test SA 64 Active",
          companyName: "SA 64 Tenant",
          username: "test_sa_64_active",
          email: "testsa64active@example.com",
          mobile: "8888888888",
          plan: "V1_BASIC",
          originalStatus: "pending"
        }
      }
    }
  });

  const superAdmin = await prisma.user.findFirst({ where: { role: 'super_admin' } });
  assert(superAdmin, "Super admin must exist in DB");

  // Mock Request/Response
  let req = { user: { userId: superAdmin.id, role: superAdmin.role }, params: {}, body: {}, query: {} };
  let resData = null;
  let resStatus = 200;
  let res = {
    json: (data) => { resData = data; return res; },
    status: (code) => { resStatus = code; return res; }
  };
  let next = (err) => { if(err) throw err; };

  // Test 1: Super Admin can list applications
  await adminController.listApplications(req, res, next);
  assert(resData.length >= 1, "Super Admin can view applications");
  console.log("✅ Super Admin can view applications");

  // Test 2: Secrets are stripped from getCompanyDetail
  req.params.id = testTenant.id;
  await adminController.getCompanyDetail(req, res, next);
  assert(resData.company, "Company detail returned");
  assert.strictEqual(resData.company.password, undefined, "Password MUST NOT be returned");
  console.log("✅ Tenant 360 safely strips password secrets");

  // Test 3: Application Snapshot is safely readable
  req.params.id = testApp.applicationSnapshot.id;
  // Actually getApplicationDetail uses snapshot ID
  const snap = await prisma.applicationSnapshot.findFirst({ where: { userId: testApp.id } });
  req.params.id = snap.id;
  await adminController.getApplicationDetail(req, res, next);
  assert(resData.companyName === "SA 64 App", "Snapshot readable");
  console.log("✅ Application Snapshot is safely readable");

  // Test 4: Suspend requires reason
  req.params.id = testTenant.id;
  req.body = {}; // No reason
  await adminController.suspendCompany(req, res, next);
  assert.strictEqual(resStatus, 400, "Suspend without reason should fail");
  console.log("✅ Suspend requires reason");

  // Test 5: Suspend works and revokes sessions
  req.body = { reason: "Security violation" };
  // Mock a session
  await prisma.refreshToken.create({
    data: { userId: testTenant.id, tokenHash: 'dummy', expiresAt: new Date(Date.now()+10000) }
  });
  await adminController.suspendCompany(req, res, next);
  assert.strictEqual(resData.message, 'Tenant suspended and active sessions revoked.', "Suspend successful");
  const checkTenant = await prisma.user.findUnique({ where: { id: testTenant.id } });
  assert.strictEqual(checkTenant.status, 'suspended', "Tenant is actually suspended");
  const checkSession = await prisma.refreshToken.findFirst({ where: { userId: testTenant.id } });
  assert(checkSession.revokedAt !== null, "Session revoked immediately");
  console.log("✅ Suspension updates status and instantly revokes active sessions");

  // Test 6: Send Password Reset securely generates token (no direct password mutation)
  req.params.id = testTenant.id;
  await adminController.sendPasswordReset(req, res, next);
  assert(resData.success, "Password reset triggered");
  const checkToken = await prisma.passwordResetToken.findFirst({ where: { userId: testTenant.id, usedAt: null } });
  assert(checkToken, "Secure token was generated");
  const checkTenantPass = await prisma.user.findUnique({ where: { id: testTenant.id } });
  assert.strictEqual(checkTenantPass.password, "some_secure_hash", "Direct password hash was NOT modified by admin");
  console.log("✅ Legacy password reset removed; secure token-based pipeline used successfully");

  // Test 7: Approve application works
  req.params.id = testApp.id;
  await adminController.approveApplication(req, res, next);
  assert(resData.success, "Approval succeeded");
  const checkApp = await prisma.user.findUnique({ where: { id: testApp.id } });
  assert.strictEqual(checkApp.status, "activation_pending", "Status updated");
  const checkActToken = await prisma.activationToken.findFirst({ where: { userId: testApp.id } });
  assert(checkActToken, "Activation token generated securely");
  console.log("✅ Approval transitions state securely and generates token");

  // Test 8: Audit Logs generated
  req.query = { page: '1' };
  await adminController.getAuditLogs(req, res, next);
  const suspendLog = resData.logs.find(l => l.action === "ADMIN_TENANT_SUSPENDED");
  assert(suspendLog, "Suspension was audited");
  console.log("✅ Super Admin actions properly audited");

  // Cleanup
  await prisma.activationToken.deleteMany({ where: { userId: testApp.id } });
  await prisma.passwordResetToken.deleteMany({ where: { userId: testTenant.id } });
  await prisma.refreshToken.deleteMany({ where: { userId: testTenant.id } });
  await prisma.applicationSnapshot.deleteMany({ where: { username: { startsWith: 'test_sa_64' } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: 'test_sa_64' } } });

  console.log("\nALL PHASE 6.4 SECURITY TESTS PASSED!\n");
}

runTests()
  .catch(e => {
    console.error("Test failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
