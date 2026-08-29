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
  const res = await fetch(`${BASE_URL}${path}`, options);
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; } 
  catch { return { status: res.status, data: text }; }
}

async function reqPublic(method, path, body = null) {
  const options = { method, headers: {} };
  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${path}`, options);
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; } 
  catch { return { status: res.status, data: text }; }
}

async function runTests() {
  console.log('--- STARTING INVENTRA 1B.6 AUDIT SECURITY TESTS ---\n');
  
  // Cleanup
  await prisma.auditLog.deleteMany({ where: { user: { username: { in: ['audit_tenant_a', 'audit_tenant_b'] } } } });
  await prisma.customer.deleteMany({ where: { user: { username: { in: ['audit_tenant_a', 'audit_tenant_b'] } } } });
  await prisma.user.deleteMany({ where: { username: { in: ['audit_tenant_a', 'audit_tenant_b'] } } });

  const hash = await bcrypt.hash('password123', 10);
  const tenantA = await prisma.user.create({ data: { companyName: 'Audit Co A', username: 'audit_tenant_a', email: 'audita@test.com', password: hash, role: 'admin', status: 'approved' } });
  const tenantB = await prisma.user.create({ data: { companyName: 'Audit Co B', username: 'audit_tenant_b', email: 'auditb@test.com', password: hash, role: 'admin', status: 'approved' } });

  // Login
  const loginA = await reqPublic('POST', '/auth/login', { username: 'audit_tenant_a', password: 'password123' });
  const tokenA = loginA.data.accessToken;
  const loginB = await reqPublic('POST', '/auth/login', { username: 'audit_tenant_b', password: 'password123' });
  const tokenB = loginB.data.accessToken;

  let passed = 0;
  let failed = 0;

  function assertResult(testName, condition) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // TEST 1: Unauthenticated access to audit API
  const t1 = await reqPublic('GET', '/audit');
  assertResult('Test 1: Unauthenticated access blocked (401)', t1.status === 401);

  // TEST 2: Failed login creates LOGIN_FAILURE
  await reqPublic('POST', '/auth/login', { username: 'audit_tenant_a', password: 'wrongpassword' });
  const t2_db = await prisma.auditLog.findFirst({ where: { userId: tenantA.id, action: 'LOGIN_FAILURE' } });
  assertResult('Test 2: LOGIN_FAILURE audit log generated correctly', t2_db && t2_db.status === 'FAILURE' && t2_db.entityType === 'User');

  // TEST 3: Successful login creates LOGIN_SUCCESS
  const t3_db = await prisma.auditLog.findFirst({ where: { userId: tenantA.id, action: 'LOGIN_SUCCESS' } });
  assertResult('Test 3: LOGIN_SUCCESS audit log generated correctly', t3_db && t3_db.status === 'SUCCESS');

  // TEST 4: Resource Creation generates audit log
  const resCust = await reqAuth('POST', '/customers', tokenA, { companyName: 'Audit Customer', gstin: '', contact: '', phone: '', email: '', address: '', deliveryAddress: '', state: 'Delhi' });
  const custId = resCust.data.id;
  if (!custId) console.error(resCust.data);
  const t4_db = await prisma.auditLog.findFirst({ where: { userId: tenantA.id, action: 'CUSTOMER_CREATE', entityId: custId } });
  assertResult('Test 4: CUSTOMER_CREATE audit log generated with entityType and entityId', t4_db && t4_db.entityType === 'Customer' && t4_db.entityId === custId);

  // TEST 5: Resource Update generates audit log
  await reqAuth('PUT', `/customers/${custId}`, tokenA, { companyName: 'Audit Customer Updated', state: 'Delhi' });
  const t5_db = await prisma.auditLog.findFirst({ where: { userId: tenantA.id, action: 'CUSTOMER_UPDATE', entityId: custId } });
  assertResult('Test 5: CUSTOMER_UPDATE audit log generated correctly', !!t5_db);

  // TEST 6: Resource Deletion generates audit log
  await reqAuth('DELETE', `/customers/${custId}`, tokenA);
  const t6_db = await prisma.auditLog.findFirst({ where: { userId: tenantA.id, action: 'CUSTOMER_DELETE', entityId: custId } });
  assertResult('Test 6: CUSTOMER_DELETE audit log generated correctly', !!t6_db);

  // TEST 7: Tenant Isolation - A cannot see B's logs
  const t7 = await reqAuth('GET', '/audit', tokenB);
  const bLogs = t7.data.logs;
  const hasALog = bLogs.some(l => l.userId === tenantA.id);
  assertResult('Test 7: Tenant B cannot see Tenant A audit logs', !hasALog);

  // TEST 8: Pagination limit
  const t8 = await reqAuth('GET', '/audit?limit=2', tokenA);
  assertResult('Test 8: Pagination limit is respected', t8.data.logs.length <= 2 && t8.data.pagination.limit === 2);

  // TEST 9: Pagination max limit enforcement (cannot fetch 1000)
  const t9 = await reqAuth('GET', '/audit?limit=1000', tokenA);
  assertResult('Test 9: Pagination limit maximum (100) enforced', t9.data.pagination.limit === 100);

  // TEST 10: Pagination offset (page param)
  const t10_1 = await reqAuth('GET', '/audit?limit=1&page=1', tokenA);
  const t10_2 = await reqAuth('GET', '/audit?limit=1&page=2', tokenA);
  assertResult('Test 10: Pagination page offset works correctly', t10_1.data.logs[0].id !== t10_2.data.logs[0].id);

  // TEST 11: Action filter
  const t11 = await reqAuth('GET', '/audit?action=CUSTOMER_CREATE', tokenA);
  const allCustomerCreates = t11.data.logs.every(l => l.action === 'CUSTOMER_CREATE');
  assertResult('Test 11: Action filter works', t11.data.logs.length > 0 && allCustomerCreates);

  // TEST 12: EntityType filter
  const t12 = await reqAuth('GET', '/audit?entityType=Customer', tokenA);
  const allCustomers = t12.data.logs.every(l => l.entityType === 'Customer');
  assertResult('Test 12: EntityType filter works', t12.data.logs.length > 0 && allCustomers);

  // TEST 13: Status filter
  const t13 = await reqAuth('GET', '/audit?status=FAILURE', tokenA);
  const allFailures = t13.data.logs.every(l => l.status === 'FAILURE');
  assertResult('Test 13: Status filter works', t13.data.logs.length > 0 && allFailures);

  // TEST 14: Date filter (startDate)
  const today = new Date().toISOString().split('T')[0];
  const t14 = await reqAuth('GET', `/audit?startDate=${today}`, tokenA);
  assertResult('Test 14: StartDate filter works', t14.data.logs.length > 0);

  // TEST 15: Immutability - Cannot update Audit Logs via API
  const t15 = await reqAuth('PUT', `/audit/${t4_db.id}`, tokenA, { action: 'TAMPERED' });
  assertResult('Test 15: No API route exists to update an audit log', t15.status === 404);

  // TEST 16: Immutability - Cannot delete Audit Logs via API
  const t16 = await reqAuth('DELETE', `/audit/${t4_db.id}`, tokenA);
  assertResult('Test 16: No API route exists to delete an audit log', t16.status === 404);

  // TEST 17: User Agent is captured
  assertResult('Test 17: userAgent is recorded', !!t3_db.userAgent);

  // TEST 18: IP Address is captured
  assertResult('Test 18: ipAddress is recorded', !!t3_db.ipAddress);

  console.log(`\nResults: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch(console.error).finally(() => prisma.$disconnect());
