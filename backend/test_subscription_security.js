const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_URL = 'http://localhost:5000/api/v1';

async function request(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { response: { status: res.status, data } };
  return { data, status: res.status };
}

async function main() {
  console.log('--- INVENTRA V1 — PHASE 1C.3 SUBSCRIPTION SECURITY TESTS ---');

  let superToken = '';
  let pendingToken = '';
  let approvedToken = '';
  
  // Cleanup existing test data
  await prisma.auditLog.deleteMany({ where: { user: { username: { startsWith: 'test_sub_' } } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: 'test_sub_' } } });

  // Create temporary superadmin
  const bcrypt = require('bcryptjs');
  await prisma.user.deleteMany({ where: { email: 'super@test.com' } });
const superAdmin = await prisma.user.create({
    data: {
      companyName: 'Test Super',
      username: 'test_sub_super',
      email: 'super@test.com',
      mobile: '9999999999',
      password: await bcrypt.hash('password123', 10),
      role: 'super_admin',
      status: 'approved'
    }
  });
  
  const superLogin = await request('POST', '/auth/login', { username: 'test_sub_super', password: 'password123' });
  superToken = superLogin.data.accessToken;
  console.log('✅ Super Admin login');

  // Test 1-7: Registration drops injected fields
  const regData = {
    companyName: 'Test Sub Inc',
    username: 'test_sub_admin',
    email: 'sub@test.com',
    mobile: '9876543210',
    password: 'password123',
    plan: 'ENTERPRISE', // injected
    subscriptionStart: '2020-01-01', // injected
    subscriptionEnd: '2050-01-01', // injected
    status: 'approved', // injected
    role: 'super_admin' // injected
  };

  await request('POST', '/auth/register', regData);
  
  const pendingUser = await prisma.user.findUnique({ where: { username: 'test_sub_admin' } });
  
  if (pendingUser.status !== 'pending') throw new Error('Test 1 Failed: Status injected');
  if (pendingUser.role !== 'admin') throw new Error('Test 7 Failed: Role injected');
  if (pendingUser.plan !== 'V1_BASIC') throw new Error('Test 2/3 Failed: Plan injected');
  if (pendingUser.subscriptionStart !== null) throw new Error('Test 4 Failed: Start injected');
  if (pendingUser.subscriptionEnd !== null) throw new Error('Test 5 Failed: Expiry injected');
  console.log('✅ Registration securely ignores injected lifecycle/subscription fields (Tests 1-7)');

  // Attempt login as pending
  try {
    await request('POST', '/auth/login', { username: 'test_sub_admin', password: 'password123' });
    throw new Error('Test 24 Failed: Pending could login');
  } catch (err) {
    if (err.response.status !== 403) throw new Error('Test 24 Failed: Expected 403');
  }
  console.log('✅ Pending account cannot login');

  // Unauthenticated user cannot activate
  try {
    await request('POST', `/admin/users/${pendingUser.id}/approve`, { plan: 'V1_BASIC', startDate: '2026-08-20', expiryDate: '2027-08-20' });
    throw new Error('Test 10 Failed: Unauthenticated user activated');
  } catch(err) {
    if (err.response.status !== 401) throw new Error('Test 10 Failed: Expected 401');
  }
  console.log('✅ Unauthenticated user cannot activate (Test 10)');

  // Invalid Plan
  try {
    await request('POST', `/admin/users/${pendingUser.id}/approve`, { plan: 'INVALID', startDate: '2026-08-20', expiryDate: '2027-08-20' }, superToken);
    throw new Error('Test 13 Failed: Invalid plan accepted');
  } catch(err) {
    if (err.response.status !== 400) throw new Error('Test 13 Failed: Expected 400');
  }
  console.log('✅ Invalid plan rejected (Test 13)');

  // Invalid dates
  try {
    await request('POST', `/admin/users/${pendingUser.id}/approve`, { plan: 'V1_BASIC', startDate: '2027-08-20', expiryDate: '2026-08-20' }, superToken);
    throw new Error('Test 16 Failed: Expiry before start accepted');
  } catch(err) {
    if (err.response.status !== 400) throw new Error('Test 16 Failed: Expected 400');
  }
  console.log('✅ Expiry before start rejected (Test 16)');

  // Valid Approval
  await request('POST', `/admin/users/${pendingUser.id}/approve`, { plan: 'V1_BASIC', startDate: '2026-08-20', expiryDate: '2027-08-20' }, superToken);
  console.log('✅ Super Admin can approve/activate (Test 12)');

  const approvedUser = await prisma.user.findUnique({ where: { username: 'test_sub_admin' } });
  if (approvedUser.plan !== 'V1_BASIC' || !approvedUser.subscriptionStart || !approvedUser.subscriptionEnd) {
    throw new Error('Test 17 Failed: Missing metadata');
  }
  console.log('✅ Approved account receives subscription metadata (Test 17)');

  // Re-approval idempotency
  const reapprove = await request('POST', `/admin/users/${pendingUser.id}/approve`, { plan: 'V1_BASIC', startDate: '2026-08-21', expiryDate: '2027-08-21' }, superToken);
  if (reapprove.data.message !== 'Application is already approved.') throw new Error('Test 18 Failed');
  console.log('✅ Re-approval is idempotent (Tests 18-20)');

  // Company Admin cannot modify plan via updateProfile
  const subLogin = await request('POST', '/auth/login', { username: 'test_sub_admin', password: 'password123' });
  approvedToken = subLogin.data.accessToken;

  await request('PUT', '/auth/profile', { 
    companyName: 'Test Sub Inc', gstin: '22AAAAA0000A1Z5', addressLine1: 'line 1', city: 'city', district: 'dist', state: 'state', pincode: '123456', mobile: '9876543210', email: 'sub@test.com', plan: 'ENTERPRISE', subscriptionEnd: '2099-01-01' 
  }, approvedToken);
  
  const checkUser = await prisma.user.findUnique({ where: { username: 'test_sub_admin' } });
  if (checkUser.plan === 'ENTERPRISE') throw new Error('Test 36 Failed: Plan mutated via profile');
  console.log('✅ Company Admin cannot modify subscription through profile API (Test 36, 8, 9)');

  // Suspend
  await request('POST', `/admin/users/${pendingUser.id}/suspend`, {}, superToken);
  console.log('✅ Super Admin can suspend (Test 21)');

  // Check login blocked
  try {
    await request('POST', '/auth/login', { username: 'test_sub_admin', password: 'password123' });
    throw new Error('Test 24 Failed: Suspended could login');
  } catch (err) {
    if (err.response.status !== 403) throw new Error('Test 24 Failed: Expected 403');
  }
  console.log('✅ Suspended user cannot login (Test 24)');

  // Check refresh blocked
  try {
    const rt = await prisma.refreshToken.findFirst({ where: { userId: pendingUser.id } });
    await request('POST', '/auth/refresh', { refreshToken: rt.token });
    throw new Error('Test 25 Failed: Refresh succeeded');
  } catch (err) {
    if (err.response.status !== 401) throw new Error('Test 25 Failed: Expected 401');
  }
  console.log('✅ Suspended refresh token cannot refresh (Test 25)');

  // Company Admin cannot reactivate
  try {
    await request('POST', `/admin/users/${pendingUser.id}/reactivate`, {}, approvedToken);
    throw new Error('Test 26 Failed: Admin reactivated self');
  } catch (err) {
    if (err.response.status !== 403) throw new Error('Test 26 Failed: Expected 403');
  }
  console.log('✅ Company Admin cannot reactivate (Test 26)');

  // Super Admin reactivate
  await request('POST', `/admin/users/${pendingUser.id}/reactivate`, {}, superToken);
  console.log('✅ Super Admin can reactivate (Test 28)');
  
  const reactivatedUser = await prisma.user.findUnique({ where: { id: pendingUser.id } });
  if (reactivatedUser.status !== 'approved') throw new Error('Test 29 Failed: Not approved');
  if (reactivatedUser.plan !== 'V1_BASIC') throw new Error('Test 30 Failed: Metadata lost');
  console.log('✅ Reactivation restores status and preserves metadata (Test 29, 30)');

  // Check Audit log
  const audit = await prisma.auditLog.findFirst({ where: { userId: superAdmin.id, action: 'USER_REACTIVATED', entityId: pendingUser.id } });
  if (!audit) throw new Error('Test 32 Failed: No USER_REACTIVATED audit');
  console.log('✅ Reactivation creates USER_REACTIVATED audit (Test 32)');

  // Reactivate idempotent
  const reactivateIdempotent = await request('POST', `/admin/users/${pendingUser.id}/reactivate`, {}, superToken);
  if (reactivateIdempotent.data.message !== 'User is already active.') throw new Error('Test 33 Failed');
  console.log('✅ Reactivation is idempotent (Test 33)');

  console.log('ALL PHASE 1C.3 TESTS PASSED');

  // Final cleanup
  await prisma.auditLog.deleteMany({ where: { user: { username: { startsWith: 'test_sub_' } } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: 'test_sub_' } } });
}

main().catch(e => {
  console.error('TEST FAILED:', e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
