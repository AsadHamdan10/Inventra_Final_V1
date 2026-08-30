import { mockPrisma, resetMockPrisma } from './mockPrisma';

jest.mock('../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../services/auditService', () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../services/emailService', () => ({
  sendApprovalNotification: jest.fn().mockResolvedValue(undefined),
}));

import { approveApplication } from '../controllers/adminController';
import { mockReqRes } from './testHelpers';

function pendingUser(overrides: any = {}) {
  return {
    id: 5,
    status: 'pending',
    plan: 'TRADING_ANNUAL_MOBILE',
    email: 'owner@acme.test',
    companyName: 'Acme',
    applicationRef: 'INV-2026-ABC123',
    applicationSnapshot: { businessType: 'TRADING' },
    ...overrides,
  };
}

const PLAN_MOBILE = {
  id: 3, code: 'TRADING_ANNUAL_MOBILE', status: 'ACTIVE', businessType: 'TRADING',
  listPrice: 999, discountAmount: 0, annualPrice: 999,
  durationMonths: 12, includedUsers: 3, platformAccess: 'MOBILE', name: 'Trading Annually',
};

beforeEach(() => {
  resetMockPrisma();
  mockPrisma.saaSSubscription.findFirst.mockResolvedValue(null); // no existing subscription by default
});

describe('approveApplication - plan resolution (regression: was hardcoded to a legacy default)', () => {
  it('resolves the plan from user.plan (the exact plan chosen at registration), not a hardcoded default', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(pendingUser());
    mockPrisma.saaSPlan.findUnique.mockResolvedValue(PLAN_MOBILE);
    const { req, res } = mockReqRes({ params: { id: '5' } });

    await approveApplication(req, res, jest.fn());

    expect(mockPrisma.saaSPlan.findUnique).toHaveBeenCalledWith({ where: { code: 'TRADING_ANNUAL_MOBILE' } });
    expect(mockPrisma.saaSPlan.findFirst).not.toHaveBeenCalled(); // never falls back when user.plan resolves directly
    expect(mockPrisma.saaSSubscription.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ planId: 3, listPrice: 999, discountAmount: 0, finalAmount: 999 }),
    }));
  });

  it('applies the plan\'s discount when computing finalAmount, not just the list price', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(pendingUser({ plan: 'ENTERPRISE_ANNUAL' }));
    mockPrisma.saaSPlan.findUnique.mockResolvedValue({
      ...PLAN_MOBILE, code: 'ENTERPRISE_ANNUAL', listPrice: 9999, discountAmount: 1000,
    });
    const { req, res } = mockReqRes({ params: { id: '5' } });

    await approveApplication(req, res, jest.fn());

    expect(mockPrisma.saaSSubscription.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ finalAmount: 8999, discountAmount: 1000 }),
    }));
  });

  it('falls back to the legacy default plan when user.plan is missing (pre-6.10H applications)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(pendingUser({ plan: null }));
    mockPrisma.saaSPlan.findFirst.mockResolvedValue(null); // no active plan for the business type either
    mockPrisma.saaSPlan.findUnique.mockResolvedValue({ ...PLAN_MOBILE, code: 'TRADING_ANNUAL' }); // legacy lookup
    const { req, res } = mockReqRes({ params: { id: '5' } });

    await approveApplication(req, res, jest.fn());

    expect(mockPrisma.saaSPlan.findUnique).toHaveBeenLastCalledWith({ where: { code: 'TRADING_ANNUAL' } });
    expect(mockPrisma.saaSSubscription.create).toHaveBeenCalled();
  });

  it('returns 500 when no plan can be resolved at all', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(pendingUser({ plan: null }));
    mockPrisma.saaSPlan.findFirst.mockResolvedValue(null);
    mockPrisma.saaSPlan.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ params: { id: '5' } });

    await approveApplication(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(mockPrisma.saaSSubscription.create).not.toHaveBeenCalled();
  });
});

describe('approveApplication - TenantConfiguration backfill (regression: was never written at all)', () => {
  it('writes the resolved plan\'s business type into TenantConfiguration', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(pendingUser({ applicationSnapshot: { businessType: 'BOTH' } }));
    mockPrisma.saaSPlan.findUnique.mockResolvedValue({ ...PLAN_MOBILE, businessType: 'BOTH' });
    const { req, res } = mockReqRes({ params: { id: '5' } });

    await approveApplication(req, res, jest.fn());

    expect(mockPrisma.tenantConfiguration.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 5 },
      create: expect.objectContaining({ businessType: 'BOTH' }),
      update: { businessType: 'BOTH' },
    }));
  });

  it('sets TenantConfiguration to TRADING for a Trading-only plan', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(pendingUser());
    mockPrisma.saaSPlan.findUnique.mockResolvedValue(PLAN_MOBILE); // businessType: TRADING
    const { req, res } = mockReqRes({ params: { id: '5' } });

    await approveApplication(req, res, jest.fn());

    expect(mockPrisma.tenantConfiguration.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { businessType: 'TRADING' },
    }));
  });
});

describe('approveApplication - idempotency and guard rails', () => {
  it('does not create a duplicate subscription if a non-cancelled one already exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(pendingUser());
    mockPrisma.saaSPlan.findUnique.mockResolvedValue(PLAN_MOBILE);
    mockPrisma.saaSSubscription.findFirst.mockResolvedValue({ id: 200, status: 'UNPAID' });
    const { req, res } = mockReqRes({ params: { id: '5' } });

    await approveApplication(req, res, jest.fn());

    expect(mockPrisma.saaSSubscription.create).not.toHaveBeenCalled();
  });

  it('returns 404 when the user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ params: { id: '999' } });

    await approveApplication(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns an idempotent success response if the application was already approved', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(pendingUser({ status: 'activation_pending' }));
    const { req, res } = mockReqRes({ params: { id: '5' } });

    await approveApplication(req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ alreadyApproved: true }));
    expect(mockPrisma.saaSPlan.findUnique).not.toHaveBeenCalled();
  });

  it('rejects approving a user who is neither pending nor already approved', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(pendingUser({ status: 'rejected' }));
    const { req, res } = mockReqRes({ params: { id: '5' } });

    await approveApplication(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
