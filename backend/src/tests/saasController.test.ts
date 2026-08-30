import { mockPrisma, resetMockPrisma } from './mockPrisma';

jest.mock('../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../services/auditService', () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));

import { SaasController } from '../controllers/saasController';
import { mockReqRes } from './testHelpers';

beforeEach(() => resetMockPrisma());

describe('SaasController.createSubscription', () => {
  const ACTIVE_PLAN = {
    id: 7, code: 'TRADING_ANNUAL', status: 'ACTIVE', listPrice: 3499, discountAmount: 0,
    durationMonths: 12, includedUsers: 5, platformAccess: 'DESKTOP',
  };

  it('computes finalAmount as listPrice minus the discount passed in the request', async () => {
    mockPrisma.saaSPlan.findUnique.mockResolvedValue(ACTIVE_PLAN);
    mockPrisma.saaSSubscription.create.mockResolvedValue({ id: 1 });
    mockPrisma.user.update.mockResolvedValue({});
    const { req, res } = mockReqRes({ body: { userId: 10, planId: 7, discountAmount: 500 } });

    await SaasController.createSubscription(req, res, jest.fn());

    expect(mockPrisma.saaSSubscription.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ listPrice: 3499, discountAmount: 500, finalAmount: 2999 }),
    }));
  });

  it('defaults the discount to the plan\'s own catalog discount when the request specifies none', async () => {
    mockPrisma.saaSPlan.findUnique.mockResolvedValue({ ...ACTIVE_PLAN, listPrice: 9999, discountAmount: 1000 });
    mockPrisma.saaSSubscription.create.mockResolvedValue({ id: 1 });
    mockPrisma.user.update.mockResolvedValue({});
    const { req, res } = mockReqRes({ body: { userId: 10, planId: 7 } }); // no discountAmount in body

    await SaasController.createSubscription(req, res, jest.fn());

    expect(mockPrisma.saaSSubscription.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ discountAmount: 1000, finalAmount: 8999 }),
    }));
  });

  it('snapshots platformAccess/durationMonths/includedUsers from the plan onto the subscription', async () => {
    mockPrisma.saaSPlan.findUnique.mockResolvedValue({ ...ACTIVE_PLAN, platformAccess: 'DESKTOP_MOBILE', includedUsers: 8 });
    mockPrisma.saaSSubscription.create.mockResolvedValue({ id: 1 });
    mockPrisma.user.update.mockResolvedValue({});
    const { req, res } = mockReqRes({ body: { userId: 10, planId: 7 } });

    await SaasController.createSubscription(req, res, jest.fn());

    expect(mockPrisma.saaSSubscription.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ platformAccess: 'DESKTOP_MOBILE', includedUsers: 8, durationMonths: 12 }),
    }));
  });

  it('rejects a plan that is not ACTIVE', async () => {
    mockPrisma.saaSPlan.findUnique.mockResolvedValue({ ...ACTIVE_PLAN, status: 'ARCHIVED' });
    const { req, res } = mockReqRes({ body: { userId: 10, planId: 7 } });

    await SaasController.createSubscription(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockPrisma.saaSSubscription.create).not.toHaveBeenCalled();
  });

  it('rejects when the plan does not exist', async () => {
    mockPrisma.saaSPlan.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ body: { userId: 10, planId: 999 } });

    await SaasController.createSubscription(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('SaasController.renewSubscription (regression tests for the discount + duration bugs)', () => {
  const EXISTING_SUB = { id: 55, planId: 7, endDate: new Date('2026-08-28'), userId: 10 };

  it('applies the current plan\'s discount instead of hardcoding it to zero', async () => {
    mockPrisma.saaSSubscription.findUnique.mockResolvedValue(EXISTING_SUB);
    mockPrisma.saaSPlan.findUnique.mockResolvedValue({
      id: 7, code: 'ENTERPRISE_ANNUAL', status: 'ACTIVE', listPrice: 9999, discountAmount: 1000,
      durationMonths: 12, includedUsers: 20, platformAccess: 'DESKTOP',
    });
    mockPrisma.saaSSubscription.create.mockResolvedValue({ id: 56 });
    mockPrisma.user.update.mockResolvedValue({});
    const { req, res } = mockReqRes({ params: { id: '55' } });

    await SaasController.renewSubscription(req, res, jest.fn());

    expect(mockPrisma.saaSSubscription.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ listPrice: 9999, discountAmount: 1000, finalAmount: 8999 }),
    }));
  });

  it('uses the current plan\'s own duration instead of a hardcoded one year', async () => {
    mockPrisma.saaSSubscription.findUnique.mockResolvedValue(EXISTING_SUB);
    mockPrisma.saaSPlan.findUnique.mockResolvedValue({
      id: 7, code: 'TRADING_3YR', status: 'ACTIVE', listPrice: 8000, discountAmount: 0,
      durationMonths: 36, includedUsers: 5, platformAccess: 'DESKTOP',
    });
    mockPrisma.saaSSubscription.create.mockResolvedValue({ id: 56 });
    mockPrisma.user.update.mockResolvedValue({});
    const { req, res } = mockReqRes({ params: { id: '55' } });

    await SaasController.renewSubscription(req, res, jest.fn());

    const callArgs = mockPrisma.saaSSubscription.create.mock.calls[0][0];
    const start = new Date(callArgs.data.startDate);
    const end = new Date(callArgs.data.endDate);
    const monthsSpanned = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    expect(monthsSpanned).toBe(36); // start (Aug 29) + 36 months - 1 day (Aug 28) stays in the same month, so the full 36-month span is preserved
    expect(callArgs.data.durationMonths).toBe(36);
  });

  it('rejects when the current plan is no longer ACTIVE', async () => {
    mockPrisma.saaSSubscription.findUnique.mockResolvedValue(EXISTING_SUB);
    mockPrisma.saaSPlan.findUnique.mockResolvedValue({ id: 7, status: 'ARCHIVED', isActive: true });
    const { req, res } = mockReqRes({ params: { id: '55' } });

    await SaasController.renewSubscription(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockPrisma.saaSSubscription.create).not.toHaveBeenCalled();
  });

  it('links the new subscription back to the one it renewed', async () => {
    mockPrisma.saaSSubscription.findUnique.mockResolvedValue(EXISTING_SUB);
    mockPrisma.saaSPlan.findUnique.mockResolvedValue({
      id: 7, code: 'TRADING_ANNUAL', status: 'ACTIVE', listPrice: 3499, discountAmount: 0,
      durationMonths: 12, includedUsers: 5, platformAccess: 'DESKTOP',
    });
    mockPrisma.saaSSubscription.create.mockResolvedValue({ id: 56 });
    mockPrisma.user.update.mockResolvedValue({});
    const { req, res } = mockReqRes({ params: { id: '55' } });

    await SaasController.renewSubscription(req, res, jest.fn());

    expect(mockPrisma.saaSSubscription.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ renewedFromSubscriptionId: 55 }),
    }));
  });

  it('returns 404 when the subscription does not exist', async () => {
    mockPrisma.saaSSubscription.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ params: { id: '999' } });

    await SaasController.renewSubscription(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
