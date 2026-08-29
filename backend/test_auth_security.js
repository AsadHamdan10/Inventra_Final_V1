const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5000/api/v1';

async function reqAuth(method, path, token, body = null) {
  const options = {
    method,
    headers: { 'Authorization': `Bearer ${token}` }
  };
  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${BASE_URL}${path}`, options);
  const text = await response.text();
  let resBody;
  try { resBody = text ? JSON.parse(text) : {}; } catch { resBody = text; }
  return { status: response.status, body: resBody };
}

async function fetchApi(method, path, body = null) {
  const options = { method, headers: {} };
  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${BASE_URL}${path}`, options);
  const text = await response.text();
  let resBody;
  try { resBody = text ? JSON.parse(text) : {}; } catch { resBody = text; }
  return { status: response.status, body: resBody };
}

async function setupTenants() {
  await prisma.auditLog.deleteMany({ where: { user: { username: { in: ['auth_user_test'] } } } });
  await prisma.passwordResetToken.deleteMany({ where: { user: { username: { in: ['auth_user_test'] } } } });
  await prisma.refreshToken.deleteMany({ where: { user: { username: { in: ['auth_user_test'] } } } });
  await prisma.user.deleteMany({ where: { username: { in: ['auth_user_test'] } } });

  const hash = await bcrypt.hash('password123', 12);
  const user = await prisma.user.create({
    data: { companyName: 'Auth Test Co', username: 'auth_user_test', email: 'auth@test.com', password: hash, role: 'admin', status: 'approved' }
  });
  return user;
}

async function runTests() {
  console.log('=== PHASE 1B.4 AUTH SECURITY TESTS ===');
  let user = await setupTenants();
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.log(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Valid login
  let res = await fetchApi('POST', '/auth/login', { username: 'auth_user_test', password: 'password123' });
  assert(res.status === 200 && res.body.accessToken, 'Valid login');
  let token = res.body.accessToken;

  // 2. Invalid password
  res = await fetchApi('POST', '/auth/login', { username: 'auth_user_test', password: 'wrong' });
  assert(res.status === 401 && res.body.error === 'Invalid username or password.', 'Invalid password returns generic error');

  // 3. Nonexistent account
  res = await fetchApi('POST', '/auth/login', { username: 'nonexistent', password: 'password123' });
  assert(res.status === 401 && res.body.error === 'Invalid username or password.', 'Nonexistent account returns generic error');

  // 4. Missing token
  res = await reqAuth('GET', '/dashboard', '');
  assert(res.status === 401, 'Missing token rejected');

  // 5. Invalid token
  res = await reqAuth('GET', '/dashboard', 'invalid.token.here');
  assert(res.status === 401, 'Invalid token rejected');

  // 10. forcePasswordChange enforcement
  await prisma.user.update({ where: { id: user.id }, data: { forcePasswordChange: true } });
  res = await reqAuth('GET', '/dashboard', token);
  assert(res.status === 403 && res.body.forcePasswordChange === true, 'forcePasswordChange enforcement blocks API');
  
  // 11. Successful change password
  res = await reqAuth('PUT', '/auth/change-password', token, { currentPassword: 'password123', newPassword: 'newpassword123' });
  assert(res.status === 200, 'Successful change password');

  // Verify forcePasswordChange is cleared
  res = await reqAuth('GET', '/dashboard', token);
  assert(res.status === 200, 'Dashboard accessible after password change');

  // 13. Forgot password existing account
  res = await fetchApi('POST', '/auth/forgot-password', { email: 'auth@test.com' });
  assert(res.status === 200 && res.body.message.includes('If an account'), 'Forgot password existing account');

  // 14. Forgot password nonexistent account
  res = await fetchApi('POST', '/auth/forgot-password', { email: 'nobody@test.com' });
  assert(res.status === 200 && res.body.message.includes('If an account'), 'Forgot password nonexistent account matches exactly');

  // 18. Successful password reset
  const resetTokenHashEntry = await prisma.passwordResetToken.findFirst({ where: { userId: user.id }, orderBy: { id: 'desc' } });
  // Since we don't have the plaintext token from the email, we'll forge one and hash it, directly updating the DB for test
  const testToken = crypto.randomBytes(32).toString('hex');
  const testTokenHash = crypto.createHash('sha256').update(testToken).digest('hex');
  await prisma.passwordResetToken.update({ where: { id: resetTokenHashEntry.id }, data: { tokenHash: testTokenHash } });

  res = await fetchApi('POST', '/auth/reset-password', { token: testToken, newPassword: 'resetpassword123' });
  assert(res.status === 200, 'Successful password reset');

  // 17. Used reset token
  res = await fetchApi('POST', '/auth/reset-password', { token: testToken, newPassword: 'anotherpassword' });
  assert(res.status === 400, 'Used reset token rejected');

  // Old password no longer works
  res = await fetchApi('POST', '/auth/login', { username: 'auth_user_test', password: 'newpassword123' });
  assert(res.status === 401, 'Old password fails');

  // New password works
  res = await fetchApi('POST', '/auth/login', { username: 'auth_user_test', password: 'resetpassword123' });
  assert(res.status === 200, 'New password works');
  token = res.body.accessToken;

  // 20. Refresh denied for suspended user
  await prisma.user.update({ where: { id: user.id }, data: { status: 'suspended' } });
  // Force a refresh via our test framework (cookies normally)
  // Let's just create a refresh token in DB and use it in body for test
  const refreshResponse = await fetchApi('POST', '/auth/login', { username: 'auth_user_test', password: 'resetpassword123' });
  // Wait, login is denied for suspended users! 
  assert(refreshResponse.status === 403 && refreshResponse.body.status === 'suspended', 'Suspended user cannot login');

  // Let's set it to approved, login, get refresh token, then suspend, then refresh
  await prisma.user.update({ where: { id: user.id }, data: { status: 'approved' } });
  let loginRes = await fetchApi('POST', '/auth/login', { username: 'auth_user_test', password: 'resetpassword123' });
  
  // We need to extract the refresh token from the cookie
  let cookies = '';
  // Node fetch doesn't expose raw cookies easily.
  // Instead, since our API supports refreshToken in body as a fallback:
  let rawRefreshToken = await prisma.refreshToken.findFirst({ where: { userId: user.id }, orderBy: { id: 'desc' } });
  
  await prisma.user.update({ where: { id: user.id }, data: { status: 'suspended' } });
  res = await fetchApi('POST', '/auth/refresh', { refreshToken: rawRefreshToken.token });
  assert(res.status === 401 && res.body.message.includes('suspended'), 'Refresh denied for suspended user');

  console.log(`\n=================================\n${failed === 0 ? '✅ ALL' : `❌ ${failed}`} AUTHENTICATION TESTS PASSED.`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
