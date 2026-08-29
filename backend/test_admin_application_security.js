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
  await prisma.auditLog.deleteMany({ where: { user: { email: { contains: 'system.local' } } } });
  await prisma.user.deleteMany({ where: { email: { contains: 'system.local' } } });
  
  await prisma.auditLog.deleteMany({ where: { user: { username: { startsWith: 'app_test_' } } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: 'app_test_' } } });
  
  await prisma.auditLog.deleteMany({ where: { user: { email: { endsWith: '@adminsectest.com' } } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@adminsectest.com' } } });

  const hash = await bcrypt.hash('superpass123', 12);
  const superAdmin = await prisma.user.create({
    data: { companyName: 'System', username: 'app_test_super', email: 'super@system.local', mobile: '0000000000', password: hash, role: 'super_admin', status: 'approved' }
  });
  const companyAdmin = await prisma.user.create({
    data: { companyName: 'Company Admin', username: 'app_test_admin', email: 'admin@system.local', mobile: '0000000001', password: hash, role: 'admin', status: 'approved' }
  });
  
  // Create some pending, approved, rejected users for test
  await prisma.user.createMany({
    data: [
      { applicationRef: 'INV-TEST-001', companyName: 'Pending Inc', username: 'app_test_pending1', email: 'p1@adminsectest.com', password: hash, status: 'pending', role: 'admin', gstin: '22AAAAA0000A1Z5' },
      { applicationRef: 'INV-TEST-002', companyName: 'Pending Corp', username: 'app_test_pending2', email: 'p2@adminsectest.com', password: hash, status: 'pending', role: 'admin' },
      { applicationRef: 'INV-TEST-003', companyName: 'Approved LLC', username: 'app_test_approved', email: 'a1@adminsectest.com', password: hash, status: 'approved', role: 'admin' },
      { applicationRef: 'INV-TEST-004', companyName: 'Rejected Ltd', username: 'app_test_rejected', email: 'r1@adminsectest.com', password: hash, status: 'rejected', role: 'admin' }
    ]
  });

  return { superAdmin, companyAdmin };
}

async function runTests() {
  console.log('=== PHASE 1C.2 ADMIN APPLICATION SECURITY TESTS ===');
  let { superAdmin, companyAdmin } = await setup();
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

  let superLogin = await fetchApi('POST', '/auth/login', { username: 'app_test_super', password: 'superpass123' });
  let superToken = superLogin.body.accessToken;

  let adminLogin = await fetchApi('POST', '/auth/login', { username: 'app_test_admin', password: 'superpass123' });
  let adminToken = adminLogin.body.accessToken;

  // 1-3. Authorization for list
  let res = await reqAuth('GET', '/admin/users', superToken);
  assert(res.status === 200, '1. Super Admin can list applications');
  
  res = await reqAuth('GET', '/admin/users', adminToken);
  assert(res.status === 403, '2. Company Admin cannot list applications');

  res = await fetchApi('GET', '/admin/users');
  assert(res.status === 401, '3. Unauthenticated user cannot list applications');

  // 4-7. Filters
  res = await reqAuth('GET', '/admin/users?status=pending', superToken);
  assert(res.body.data.every(u => u.status === 'pending'), '4. Pending filter works');

  res = await reqAuth('GET', '/admin/users?status=approved', superToken);
  assert(res.body.data.every(u => u.status === 'approved'), '5. Approved filter works');

  res = await reqAuth('GET', '/admin/users?status=rejected', superToken);
  assert(res.body.data.every(u => u.status === 'rejected'), '6. Rejected filter works');

  // 8-11. Search
  res = await reqAuth('GET', '/admin/users?search=INV-TEST-001', superToken);
  assert(res.body.data.length === 1 && res.body.data[0].companyName === 'Pending Inc', '8. Search by applicationRef');

  res = await reqAuth('GET', '/admin/users?search=Pending Corp', superToken);
  assert(res.body.data.length === 1 && res.body.data[0].applicationRef === 'INV-TEST-002', '9. Search by companyName');

  res = await reqAuth('GET', '/admin/users?search=app_test_pending1', superToken);
  assert(res.body.data.length === 1 && res.body.data[0].applicationRef === 'INV-TEST-001', '10. Search by username');

  res = await reqAuth('GET', '/admin/users?search=p2@adminsectest.com', superToken);
  assert(res.body.data.length === 1 && res.body.data[0].applicationRef === 'INV-TEST-002', '11. Search by email');

  // 12-14. Pagination
  res = await reqAuth('GET', '/admin/users?limit=2', superToken);
  assert(res.body.data.length <= 2 && res.body.pagination.limit === 2, '12. Pagination works');

  res = await reqAuth('GET', '/admin/users?limit=9999', superToken);
  assert(res.body.pagination.limit === 100, '13. Maximum limit enforced');

  res = await reqAuth('GET', '/admin/users?page=-5&limit=abc', superToken);
  assert(res.status === 200 && res.body.pagination.page === 1 && res.body.pagination.limit === 25, '14. Invalid pagination handled safely');

  // 15-16. Details
  res = await reqAuth('GET', '/admin/users?search=INV-TEST-001', superToken);
  const u1 = res.body.data[0];
  assert(u1.gstin === '22AAAAA0000A1Z5' && u1.createdAt, '15. Super Admin can view application details in list');
  // Company admin already checked in test 2.

  // Data exposure
  assert(u1.password === undefined && u1.passwordHash === undefined && u1.hash === undefined, '32/33. Password and hash are absent');
  assert(u1.token === undefined && u1.refreshToken === undefined, '34/35. JWT and refresh token are absent');

  // Approval tests
  const pendingUser = await prisma.user.findUnique({ where: { username: 'app_test_pending1' } });
  
  res = await reqAuth('POST', `/admin/users/${pendingUser.id}/approve`, '');
  assert(res.status === 401, '19. Unauthenticated approval rejected');

  res = await reqAuth('POST', `/admin/users/${pendingUser.id}/approve`, adminToken);
  assert(res.status === 403, '18. Company Admin cannot approve');

  res = await reqAuth('POST', `/admin/users/${pendingUser.id}/approve`, superToken, { plan: 'V1_BASIC', startDate: '2026-08-01', expiryDate: '2027-08-01' });
  if (res.status !== 200) console.log(res);
  assert(res.status === 200, '17. Super Admin can approve pending application');
  
  let audits = await prisma.auditLog.findMany({ where: { entityId: pendingUser.id, action: 'USER_APPROVED' } });
  assert(audits.length === 1, '26. Approval generates USER_APPROVED');

  // Idempotency
  res = await reqAuth('POST', `/admin/users/${pendingUser.id}/approve`, superToken, { plan: 'V1_BASIC', startDate: '2026-08-01', expiryDate: '2027-08-01' });
  assert(res.status === 200 && res.body.message === 'Application is already approved.', '24a. Re-approval returns success early');
  let audits2 = await prisma.auditLog.findMany({ where: { entityId: pendingUser.id, action: 'USER_APPROVED' } });
  assert(audits2.length === 1, '24b. Re-approval does not create duplicate audit');

  const uAfterApprove = await prisma.user.findUnique({ where: { id: pendingUser.id } });
  assert(uAfterApprove !== null && uAfterApprove.status === 'approved', '23. Approved application remains stored');

  // Rejection tests
  const pendingUser2 = await prisma.user.findUnique({ where: { username: 'app_test_pending2' } });

  res = await reqAuth('POST', `/admin/users/${pendingUser2.id}/reject`, adminToken);
  assert(res.status === 403, '21. Company Admin cannot reject');

  res = await reqAuth('POST', `/admin/users/${pendingUser2.id}/reject`, superToken);
  assert(res.status === 200, '20. Super Admin can reject pending application');
  
  audits = await prisma.auditLog.findMany({ where: { entityId: pendingUser2.id, action: 'USER_REJECTED' } });
  assert(audits.length === 1, '27. Rejection generates USER_REJECTED');

  // Idempotency
  res = await reqAuth('POST', `/admin/users/${pendingUser2.id}/reject`, superToken);
  assert(res.status === 200 && res.body.message === 'Application is already rejected.', '25a. Re-rejection returns success early');
  audits2 = await prisma.auditLog.findMany({ where: { entityId: pendingUser2.id, action: 'USER_REJECTED' } });
  assert(audits2.length === 1, '25b. Re-rejection does not create duplicate audit');

  const uAfterReject = await prisma.user.findUnique({ where: { id: pendingUser2.id } });
  assert(uAfterReject !== null && uAfterReject.status === 'rejected', '22. Rejected application remains stored');

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
