// Phase 6.10I regression test (BUG-01 / BUG-04 from the QA audit).
//
// BUG-01: PUT /api/v1/users/profile was a forgotten duplicate of the
// canonical PUT /api/v1/auth/profile endpoint, guarded only by requireAuth
// instead of requireTenantOwner - letting a staff (TenantUser) session edit
// the company profile by calling this route directly, even though the
// intended route and the frontend both correctly block staff from doing so.
//
// BUG-04: backend/src/routes/coa.ts and backend/src/routes/journals.ts had
// complete, working controllers but were never imported/mounted in
// index.ts, so the Chart of Accounts and Journal Entries pages 404'd on
// every request.
//
// This test builds a minimal Express app (not the full index.ts, which
// binds a real port and needs real env vars) mounting the real route files
// exactly as index.ts now does, with prisma/jwt mocked the same way the
// rest of this suite does it.

import express from 'express';
import request from 'supertest';
import { mockPrisma, resetMockPrisma } from './mockPrisma';

jest.mock('../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../services/auditService', () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../utils/jwt', () => ({
  verifyAccessToken: (token: string) => JSON.parse(Buffer.from(token, 'base64').toString('utf8')),
}));
// backend/src/middlewares/financialYearContext.ts constructs its own
// standalone `new PrismaClient()` at module scope instead of importing the
// shared client from utils/prisma.ts (a real, separately-noted architectural
// issue - see the Phase 6.10I audit report). Importing routes/journals.ts
// pulls this middleware in transitively, which would otherwise try to load
// a real Prisma query engine during this test. Mock it out so this test
// exercises routing/auth only, not that unrelated module's behavior.
jest.mock('../middlewares/financialYearContext', () => ({
  requireFinancialYearContext: (_req: any, _res: any, next: any) => next(),
}));
// journalService.ts (pulled in transitively by routes/journals.ts) imports
// assertFinancialPeriodOpen from financialPeriodService.ts, which - same
// issue as financialYearContext.ts above - constructs its own standalone,
// unmocked `new PrismaClient()` at module scope. That client starts loading
// its query engine asynchronously the moment the module is imported, before
// any test even runs, producing a floating unhandled rejection in this
// sandbox (no Linux-compatible engine binary here; the real Windows engine
// this app actually ships with is unaffected). Mock the module out so
// merely importing routes/journals.ts can't trigger it.
jest.mock('../services/financialPeriodService', () => ({
  assertFinancialPeriodOpen: jest.fn().mockResolvedValue(undefined),
  getFinancialYear: jest.fn(),
  getFinancialPeriod: jest.fn(),
  getCurrentFinancialYear: jest.fn(),
  FinancialPeriodError: class FinancialPeriodError extends Error {},
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
import userRoutes from '../routes/users';
// eslint-disable-next-line @typescript-eslint/no-var-requires
import coaRoutes from '../routes/coa';
// eslint-disable-next-line @typescript-eslint/no-var-requires
import journalRoutes from '../routes/journals';

function tokenFor(payload: object) {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/coa', coaRoutes);
  app.use('/api/v1/journals', journalRoutes);
  return app;
}

const OWNER_ROW = { id: 10, role: 'admin', status: 'active', companyName: 'Acme Traders', forcePasswordChange: false };
const STAFF_ROW = { id: 5, tenantId: 10, status: 'active', fullName: 'Priya Sharma' };

beforeEach(() => resetMockPrisma());

describe('regression (Phase 6.10I, BUG-01): PUT /users/profile must not be a staff-reachable backdoor', () => {
  it('blocks a staff session with 403 before it can touch updateProfile', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(OWNER_ROW);
    mockPrisma.tenantUser.findUnique.mockResolvedValue(STAFF_ROW);
    const app = buildApp();

    const res = await request(app)
      .put('/api/v1/users/profile')
      .set('Authorization', `Bearer ${tokenFor({ userId: 10, staffId: 5, role: 'staff', companyName: 'Acme Traders' })}`)
      .send({});

    expect(res.status).toBe(403);
    // Must never reach the point of looking up a GSTIN/email conflict for
    // the update - i.e. updateProfile's body must never have executed.
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
  });
});

describe('regression (Phase 6.10I, BUG-04): /coa and /journals must be reachable, not 404', () => {
  // These deliberately never invoke the real controllers (coaService pulls
  // in journalService -> financialPeriodService, which - like
  // financialYearContext.ts above - constructs its own standalone, unmocked
  // `new PrismaClient()` at module scope; exercising that in this sandboxed
  // test environment fails on a missing engine binary that simply doesn't
  // apply on the actual Windows machine this app runs on). What matters for
  // BUG-04 is routing/mounting, which is fully verified without ever
  // reaching business logic: (a) the route tables below are inspected
  // directly, and (b) an unauthenticated request proves the middleware
  // chain - not a 404 catch-all - is what answers these paths.
  it('coaRoutes/journalRoutes each define the endpoints index.ts now mounts', () => {
    const coaPaths = (coaRoutes as any).stack.map((l: any) => l.route?.path).filter(Boolean);
    const journalPaths = (journalRoutes as any).stack.map((l: any) => l.route?.path).filter(Boolean);

    expect(coaPaths).toEqual(expect.arrayContaining(['/', '/:id', '/initialize', '/:id/deactivate']));
    expect(journalPaths).toEqual(expect.arrayContaining(['/', '/:id', '/:id/post', '/:id/cancel']));
  });

  it('index.ts source actually mounts both routers at /coa and /journals', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf8');

    expect(src).toMatch(/app\.use\(`\$\{API\}\/coa`,\s*coaRoutes\)/);
    expect(src).toMatch(/app\.use\(`\$\{API\}\/journals`,\s*journalRoutes\)/);
  });

  it('an unauthenticated request to either route is rejected with 401, never a 404 (proves the router is mounted and guarded, not missing)', async () => {
    const app = buildApp();

    const coaRes = await request(app).get('/api/v1/coa');
    const journalRes = await request(app).get('/api/v1/journals');

    expect(coaRes.status).toBe(401);
    expect(journalRes.status).toBe(401);
  });
});
