const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const assert = require('assert');
const bcrypt = require('bcryptjs');

// Mock request
const mockReq = { headers: { 'user-agent': 'Test', 'x-forwarded-for': '127.0.0.1' } };

async function runTests() {
  console.log("--- STARTING PHASE 6.2 ACCOUNT SECURITY TESTS ---");
  
  // Create a test user and super admin
  await prisma.passwordResetToken.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany({ where: { OR: [{ username: 'test_user_62' }, { username: 'super_admin_62' }] } });
  
  const testUserPwd = await bcrypt.hash('ValidPass123!', 12);
  const testUser = await prisma.user.create({
    data: {
      username: 'test_user_62',
      email: 'test62@example.com',
      companyName: 'Test 62',
      password: testUserPwd,
      status: 'active',
      role: 'admin',
      failedLoginAttempts: 0
    }
  });

  const superAdminPwd = await bcrypt.hash('SuperAdmin123!', 12);
  const superAdmin = await prisma.user.create({
    data: {
      username: 'super_admin_62',
      email: 'super62@inventra.local',
      companyName: 'INVENTRA',
      password: superAdminPwd,
      status: 'active',
      role: 'super_admin',
      failedLoginAttempts: 0
    }
  });

  const { forgotPassword, resetPassword, login, revokeAllSessions } = require('./dist/controllers/authController');

  // --- FORGOT PASSWORD TESTS ---
  console.log("\n--- Forgot Password ---");
  let mockRes = {
    status: function(c) { this.statusCode = c; return this; },
    json: function(d) { this.body = d; return this; }
  };

  // 1. Generic response for non-existent user
  await forgotPassword({ body: { usernameOrEmail: 'doesnotexist@example.com' }, ...mockReq }, mockRes, () => {});
  assert.strictEqual(mockRes.body.success, true);
  assert.ok(mockRes.body.message.includes('If an account matches'));
  console.log("✅ 1. Generic response returned for non-existent user (No enumeration).");

  // 2. Generic response for existing user
  await forgotPassword({ body: { usernameOrEmail: 'test62@example.com' }, ...mockReq }, mockRes, () => {});
  assert.strictEqual(mockRes.body.success, true);
  console.log("✅ 2. Generic response returned for existing user.");

  // 3. Token stored as hash
  const tokens = await prisma.passwordResetToken.findMany({ where: { userId: testUser.id } });
  assert.strictEqual(tokens.length, 1);
  assert.strictEqual(tokens[0].tokenHash.length, 64); // SHA-256 hex length
  console.log("✅ 3. Reset token securely hashed in database.");

  // --- RESET PASSWORD TESTS ---
  console.log("\n--- Reset Password ---");
  // Re-issue to get the raw token (we mock email service in test, but here we can't intercept it easily, so we will generate one manually for testing)
  const crypto = require('crypto');
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 15);
  
  const resetToken = await prisma.passwordResetToken.create({
    data: { userId: testUser.id, tokenHash, expiresAt }
  });

  // 4. Invalid token rejected
  await resetPassword({ body: { token: 'invalid_token', password: 'NewValidPass123!' }, ...mockReq }, mockRes, () => {});
  assert.strictEqual(mockRes.statusCode, 400);
  assert.strictEqual(mockRes.body.code, 'INVALID_TOKEN');
  console.log("✅ 4. Invalid token rejected.");

  // 5. Password Policy Enforced
  await resetPassword({ body: { token: rawToken, password: 'weak' }, ...mockReq }, mockRes, () => {});
  assert.strictEqual(mockRes.statusCode, 400);
  assert.ok(mockRes.body.message.includes('Password must be at least 8 characters'));
  console.log("✅ 5. Password policy enforced during reset.");

  // Create a refresh token to test revocation
  await prisma.refreshToken.create({
    data: {
      userId: testUser.id,
      token: 'dummy_token',
      expiresAt: new Date(Date.now() + 10000)
    }
  });

  // 6. Successful Reset
  await resetPassword({ body: { token: rawToken, password: 'NewValidPass123!' }, ...mockReq }, mockRes, () => {});
  assert.strictEqual(mockRes.body.success, true);
  console.log("✅ 6. Password reset successfully.");

  // 7. Token marked as used
  const usedToken = await prisma.passwordResetToken.findUnique({ where: { id: resetToken.id } });
  assert.ok(usedToken.usedAt !== null);
  console.log("✅ 7. Reset token marked as used (Single-use).");

  // 8. Sessions Revoked
  const revokedSessions = await prisma.refreshToken.findMany({ where: { userId: testUser.id, revokedAt: null } });
  assert.strictEqual(revokedSessions.length, 0);
  console.log("✅ 8. All existing sessions revoked after password reset.");

  // --- ACCOUNT LOCKOUT TESTS ---
  console.log("\n--- Account Lockout & Brute Force ---");
  
  for (let i = 1; i <= 4; i++) {
    await login({ body: { username: 'test_user_62', password: 'WrongPassword!' }, ...mockReq }, mockRes, () => {});
    assert.strictEqual(mockRes.statusCode, 401);
  }
  
  let u = await prisma.user.findUnique({ where: { id: testUser.id } });
  assert.strictEqual(u.failedLoginAttempts, 4);
  assert.strictEqual(u.lockedUntil, null);
  console.log("✅ 9. Failed attempts tracked, but not locked under threshold.");

  // 5th attempt should lock
  await login({ body: { username: 'test_user_62', password: 'WrongPassword!' }, ...mockReq }, mockRes, () => {});
  u = await prisma.user.findUnique({ where: { id: testUser.id } });
  assert.strictEqual(u.failedLoginAttempts, 5);
  assert.ok(u.lockedUntil !== null);
  console.log("✅ 10. 5th failure triggers temporary lockout.");

  // 6th attempt should be blocked immediately (generic message)
  await login({ body: { username: 'test_user_62', password: 'NewValidPass123!' }, ...mockReq }, mockRes, () => {});
  assert.strictEqual(mockRes.statusCode, 401);
  assert.strictEqual(mockRes.body.error, 'Invalid username or password.');
  console.log("✅ 11. Locked account rejects correct password with generic message.");

  // Manually unlock to test success clears failures
  await prisma.user.update({ where: { id: testUser.id }, data: { lockedUntil: null } });
  
  let successRes = { cookie: () => {}, status: function(c) { this.statusCode = c; return this; }, json: function(d) { this.body = d; return this; } };
  await login({ body: { username: 'test_user_62', password: 'NewValidPass123!' }, ...mockReq }, successRes, () => {});
  if(!successRes.body || !successRes.body.success) { console.error(successRes.body); }
  assert.strictEqual(successRes.body.success, true);
  
  u = await prisma.user.findUnique({ where: { id: testUser.id } });
  assert.strictEqual(u.failedLoginAttempts, 0);
  console.log("✅ 12. Successful login clears failed attempts.");

  // --- SUPER ADMIN TESTS ---
  console.log("\n--- Super Admin Recovery ---");
  await forgotPassword({ body: { usernameOrEmail: 'super_admin_62' }, ...mockReq }, mockRes, () => {});
  
  const saTokens = await prisma.passwordResetToken.findMany({ where: { userId: superAdmin.id } });
  assert.strictEqual(saTokens.length, 1);
  console.log("✅ 13. Super Admin can request password reset securely.");

  // Cleanup
  await prisma.passwordResetToken.deleteMany({ where: { userId: { in: [testUser.id, superAdmin.id] } } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: [testUser.id, superAdmin.id] } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: [testUser.id, superAdmin.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [testUser.id, superAdmin.id] } } });

  console.log("\nALL PHASE 6.2 SECURITY TESTS PASSED!");
}

runTests().catch(e => {
  console.error("❌ Test failed:", e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
