const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

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

async function setup() {
  await prisma.auditLog.deleteMany({ where: { user: { username: { in: ['reg_test', 'reg_dup', 'super_admin_test'] } } } });
  await prisma.user.deleteMany({ where: { OR: [ {username: { in: ['reg_test', 'reg_dup', 'super_admin_test'] }}, {email: 'superadmin_test@test.com'} ] } });

  const hash = await bcrypt.hash('superpass123', 12);
  const superAdmin = await prisma.user.create({
    data: { companyName: 'System', username: 'super_admin_test', email: 'super@system.local', mobile: '0000000000', password: hash, role: 'super_admin', status: 'approved' }
  });
  
  return superAdmin;
}

async function runTests() {
  console.log('=== PHASE 1C.1 REGISTRATION SECURITY TESTS ===');
  let superAdmin = await setup();
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

  // 1. Valid registration
  const regPayload = {
    companyName: 'Reg Test Co',
    username: 'reg_test',
    email: 'reg@test.com',
    mobile: '9999999999',
    password: 'password123',
    // Injections
    role: 'super_admin',
    status: 'approved',
    userId: 9999,
    tenantId: 9999
  };

  let res = await fetchApi('POST', '/auth/register', regPayload);
  
  assert(res.status === 201, '1. Valid registration');
  assert(res.body.applicationRef, '2. Application reference generated');
  
  const createdUser = await prisma.user.findUnique({ where: { username: 'reg_test' } });
  
  assert(createdUser.status === 'pending', '4. Registration creates pending account');
  assert(!res.body.password, '5. Password is not returned');
  assert(!res.body.passwordHash, '6. Password hash is not returned');
  assert(createdUser.role === 'admin', '7. Client role injection (super_admin) ignored');
  assert(createdUser.status === 'pending', '9. Client status injection (approved) ignored');
  assert(createdUser.id !== 9999, '12. Client userId injection ignored');
  assert(!('tenantId' in createdUser), '13. Client tenantId injection ignored');
  assert(!res.body.accessToken && !res.body.refreshToken && !res.body.token, '29. Registration response contains no sensitive data');
  
  const auditLogs = await prisma.auditLog.findMany({ where: { userId: createdUser.id, action: 'USER_REGISTERED' } });
  assert(auditLogs.length === 1 && auditLogs[0].entityType === 'User' && auditLogs[0].entityId === createdUser.id, '22. Registration creates USER_REGISTERED audit');

  // Login behavior (pending)
  let loginRes = await fetchApi('POST', '/auth/login', { username: 'reg_test', password: 'password123' });
  assert(loginRes.status === 403 && loginRes.body.error === 'Your account is pending Super Admin approval.', '14. Pending login blocked');

  // Duplicates
  let dupRes = await fetchApi('POST', '/auth/register', { ...regPayload, username: 'reg_dup', mobile: '9999999998' });
  assert(dupRes.status === 409 && dupRes.body.field === 'email', '25. Duplicate email rejected');
  
  dupRes = await fetchApi('POST', '/auth/register', { ...regPayload, email: 'reg2@test.com', username: 'reg_test' });
  assert(dupRes.status === 409 && dupRes.body.field === 'username', 'Duplicate username rejected');

  dupRes = await fetchApi('POST', '/auth/register', { ...regPayload, email: 'reg2@test.com', username: 'reg_dup' });
  assert(dupRes.status === 409 && dupRes.body.field === 'mobile', '26. Duplicate mobile rejected');

  // Admin Approval/Rejection blocks
  let adminRes = await reqAuth('POST', `/admin/users/${createdUser.id}/approve`, 'fake_token');
  assert(adminRes.status === 401, '18. Company Admin (or unauth) cannot approve');
  
  let superLogin = await fetchApi('POST', '/auth/login', { username: 'super_admin_test', password: 'superpass123' });
  let superToken = superLogin.body.accessToken;

  // Reject
  adminRes = await reqAuth('POST', `/admin/users/${createdUser.id}/reject`, superToken);
  assert(adminRes.status === 200, '21. Super Admin can reject');
  
  const rejectedUser = await prisma.user.findUnique({ where: { id: createdUser.id } });
  assert(rejectedUser.status === 'rejected', 'Rejection sets status to rejected');
  
  let rejectAudit = await prisma.auditLog.findMany({ where: { action: 'USER_REJECTED', entityId: createdUser.id } });
  assert(rejectAudit.length > 0, '24. Rejection creates USER_REJECTED audit');
  
  loginRes = await fetchApi('POST', '/auth/login', { username: 'reg_test', password: 'password123' });
  assert(loginRes.status === 403, '15. Rejected login blocked');

  // Approve
  adminRes = await reqAuth('POST', `/admin/users/${createdUser.id}/approve`, superToken, { plan: 'V1_BASIC', startDate: new Date().toISOString(), expiryDate: new Date(Date.now() + 86400000 * 30).toISOString() });
  assert(adminRes.status === 200, '20. Super Admin can approve. ' + JSON.stringify(adminRes.body));
  
  const approvedUser = await prisma.user.findUnique({ where: { id: createdUser.id } });
  assert(approvedUser.status === 'approved', 'Approval sets status to approved');
  
  let approveAudit = await prisma.auditLog.findMany({ where: { action: 'USER_APPROVED', entityId: createdUser.id } });
  assert(approveAudit.length > 0, '23. Approval creates USER_APPROVED audit');
  
  loginRes = await fetchApi('POST', '/auth/login', { username: 'reg_test', password: 'password123' });
  assert(loginRes.status === 200 && loginRes.body.accessToken, '17. Approved login succeeds');

  // Suspend
  adminRes = await reqAuth('POST', `/admin/users/${createdUser.id}/suspend`, superToken);
  loginRes = await fetchApi('POST', '/auth/login', { username: 'reg_test', password: 'password123' });
  assert(loginRes.status === 403, '16. Suspended login blocked');

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
