import { mockPrisma, resetMockPrisma } from './mockPrisma';

jest.mock('../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../services/auditService', () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../services/emailService', () => ({
  sendRegistrationConfirmation: jest.fn().mockResolvedValue(undefined),
  sendSuperAdminNotification: jest.fn().mockResolvedValue(undefined),
}));

import { register } from '../controllers/authController';
import { mockReqRes } from './testHelpers';

const BASE_BODY = {
  companyName: 'Acme Traders',
  username: 'acme_trader',
  email: 'owner@acme.test',
  mobile: '9876543210',
  businessType: 'TRADING',
};

// Registration always checks username/email/mobile/companyName uniqueness, in
// that order, before ever touching the plan catalog. These three calls all
// hit prisma.user.findFirst - mock them to resolve null (no conflict) unless
// a test says otherwise.
function mockNoConflicts() {
  mockPrisma.user.findUnique.mockResolvedValue(null); // username check
  mockPrisma.user.findFirst
    .mockResolvedValueOnce(null) // email
    .mockResolvedValueOnce(null) // mobile
    .mockResolvedValueOnce(null); // companyName
}

beforeEach(() => resetMockPrisma());

describe('register - plan resolution (Phase 6.10H backend-authoritative pricing)', () => {
  it('resolves the exact plan by planId when it is ACTIVE and matches the submitted business type', async () => {
    mockNoConflicts();
    mockPrisma.saaSPlan.findUnique.mockResolvedValue({
      id: 5, code: 'TRADING_ANNUAL_MOBILE', status: 'ACTIVE', businessType: 'TRADING',
      finalPrice: 999, durationMonths: 12, includedUsers: 3, platformAccess: 'MOBILE',
    });
    mockPrisma.user.create.mockResolvedValue({ id: 42 });
    const { req, res } = mockReqRes({ body: { ...BASE_BODY, planId: 5 } });

    await register(req, res, jest.fn());

    expect(mockPrisma.saaSPlan.findFirst).not.toHaveBeenCalled(); // never falls back when planId is given and valid
    expect(mockPrisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        plan: 'TRADING_ANNUAL_MOBILE',
        applicationSnapshot: expect.objectContaining({
          create: expect.objectContaining({ plan: 'TRADING_ANNUAL_MOBILE', businessType: 'TRADING' }),
        }),
      }),
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('rejects with 400 when the selected plan is not ACTIVE', async () => {
    mockNoConflicts();
    mockPrisma.saaSPlan.findUnique.mockResolvedValue({
      id: 5, code: 'OLD_PLAN', status: 'INACTIVE', businessType: 'TRADING',
    });
    const { req, res } = mockReqRes({ body: { ...BASE_BODY, planId: 5 } });

    await register(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ field: 'planId' }));
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects with 400 when the selected plan\'s business type does not match the submitted one', async () => {
    mockNoConflicts();
    mockPrisma.saaSPlan.findUnique.mockResolvedValue({
      id: 5, code: 'BOTH_PLAN', status: 'ACTIVE', businessType: 'BOTH',
    });
    const { req, res } = mockReqRes({ body: { ...BASE_BODY, businessType: 'TRADING', planId: 5 } });

    await register(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ field: 'planId' }));
  });

  it('falls back to the cheapest ACTIVE plan for the business type when no planId is given', async () => {
    mockNoConflicts();
    mockPrisma.saaSPlan.findFirst.mockResolvedValue({
      id: 9, code: 'TRADING_ANNUAL', status: 'ACTIVE', businessType: 'TRADING',
      finalPrice: 3499, durationMonths: 12, includedUsers: 5, platformAccess: 'DESKTOP',
    });
    mockPrisma.user.create.mockResolvedValue({ id: 43 });
    const { req, res } = mockReqRes({ body: BASE_BODY }); // no planId

    await register(req, res, jest.fn());

    expect(mockPrisma.saaSPlan.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'ACTIVE', businessType: 'TRADING' },
      orderBy: { finalPrice: 'asc' },
    }));
    expect(mockPrisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ plan: 'TRADING_ANNUAL' }),
    }));
  });

  it('rejects with 400 when no active plan exists at all for the business type', async () => {
    mockNoConflicts();
    mockPrisma.saaSPlan.findFirst.mockResolvedValue(null);
    const { req, res } = mockReqRes({ body: BASE_BODY });

    await register(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ field: 'businessType' }));
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it('labels billingCycle as "3_YEAR" for a 36-month plan instead of always "YEARLY"', async () => {
    mockNoConflicts();
    mockPrisma.saaSPlan.findFirst.mockResolvedValue({
      id: 11, code: 'TRADING_3YR', status: 'ACTIVE', businessType: 'TRADING',
      finalPrice: 8000, durationMonths: 36, includedUsers: 5, platformAccess: 'DESKTOP',
    });
    mockPrisma.user.create.mockResolvedValue({ id: 44 });
    const { req, res } = mockReqRes({ body: BASE_BODY });

    await register(req, res, jest.fn());

    expect(mockPrisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        applicationSnapshot: expect.objectContaining({
          create: expect.objectContaining({ billingCycle: '3_YEAR' }),
        }),
      }),
    }));
  });
});

describe('register - uniqueness checks run before any plan lookup', () => {
  it('rejects a taken username with 409 without ever querying the plan catalog', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1 }); // username taken
    const { req, res } = mockReqRes({ body: BASE_BODY });

    await register(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ field: 'username' }));
    expect(mockPrisma.saaSPlan.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.saaSPlan.findFirst).not.toHaveBeenCalled();
  });

  it('rejects a taken email with 409', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 1 }); // email taken
    const { req, res } = mockReqRes({ body: BASE_BODY });

    await register(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ field: 'email' }));
  });
});
