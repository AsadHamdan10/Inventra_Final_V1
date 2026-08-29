const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const assert = require('assert');

const { getFinancialYear } = require('./dist/utils/financialYear.js');

async function runTests() {
  console.log('--- Phase 3.2B: Fiscal Year Numbering Tests ---');
  try {

  assert.strictEqual(getFinancialYear(new Date('2027-03-31T12:00:00Z')), '2026-27', 'March 31 should be prev year FY');
  assert.strictEqual(getFinancialYear(new Date('2027-04-01T00:01:00Z')), '2027-28', 'April 1 should be current year FY');
  assert.strictEqual(getFinancialYear(new Date('2026-08-20T12:00:00Z')), '2026-27', 'Mid-year should be current year FY');
  console.log('✓ FY Calculation & Boundaries (Tests 1, 2, 3)');

  const tenantA = await prisma.user.create({ data: { username: `tenantA_${Date.now()}`, email: `tenantA_${Date.now()}@test.com`, password: 'hash', role: 'admin', companyName: 'A Corp' }});
  const tenantB = await prisma.user.create({ data: { username: `tenantB_${Date.now()}`, email: `tenantB_${Date.now()}@test.com`, password: 'hash', role: 'admin', companyName: 'B Corp' }});
  
  const { generateDocumentNumber } = require('./dist/utils/tenantId.js');

  const inv1 = await generateDocumentNumber('INV', tenantA.id, new Date('2026-08-20T12:00:00Z'));
  assert.strictEqual(inv1, 'INV/2026-27/000001');
  console.log('✓ First invoice starts at 000001 (Test 4)');

  const inv2 = await generateDocumentNumber('INV', tenantA.id, new Date('2026-08-21T12:00:00Z'));
  assert.strictEqual(inv2, 'INV/2026-27/000002');
  console.log('✓ Second invoice increments (Test 5)');

  const pur1 = await generateDocumentNumber('PUR', tenantA.id, new Date('2026-08-21T12:00:00Z'));
  assert.strictEqual(pur1, 'PUR/2026-27/000001');
  console.log('✓ Purchase sequence independent (Test 6)');

  const tenantBInv1 = await generateDocumentNumber('INV', tenantB.id, new Date('2026-08-21T12:00:00Z'));
  assert.strictEqual(tenantBInv1, 'INV/2026-27/000001');
  console.log('✓ Tenant isolation (Test 7, 8)');

  const invNextYear = await generateDocumentNumber('INV', tenantA.id, new Date('2027-04-05T12:00:00Z'));
  assert.strictEqual(invNextYear, 'INV/2027-28/000001');
  console.log('✓ New FY resets to 000001 (Test 13)');

  const promises = [];
  for (let i = 0; i < 50; i++) {
    promises.push(generateDocumentNumber('INV', tenantA.id, new Date('2026-08-25T12:00:00Z')));
  }
  const results = await Promise.all(promises);
  const uniqueResults = new Set(results);
  assert.strictEqual(uniqueResults.size, 50, 'All 50 concurrent numbers must be unique');
  console.log('✓ Concurrent invoice creation is safe, no duplicates (Tests 14, 15, 16)');

  console.log('All Fiscal Year Numbering Tests Passed!');
  } finally {
    // Cleanup
    await prisma.tenantSequence.deleteMany({ where: { user: { email: { endsWith: '@test.com' } } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: '@test.com' } } });
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
