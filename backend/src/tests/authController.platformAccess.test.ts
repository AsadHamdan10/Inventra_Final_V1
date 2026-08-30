import bcrypt from 'bcryptjs';
import { mockPrisma, resetMockPrisma } from './mockPrisma';

jest.mock('../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../services/auditService', () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));

import { login } from '../controllers/authController';
import { mockReqRes } from './testHelpers';

beforeEach(() => resetMockPrisma());

const OWNER = {
  id: 10, role: 'admin', status: 'active', companyName: 'Acme Traders',
  username: 'acme_owner', email: 'owner@acme.test', failedLoginAttempts: 0, lockedUntil: null,
  tenantConfig: { businessType: 'TRADING' },
};

async function ownerWithPassword() {
  return { ...OWNER, password: await bcrypt.hash('ownerpass123', 4) };
}

describe('login - platform access entitlement (Phase 6.10H Part 3)', () => {
  it('never gates a DESKTOP login, even when the plan has no mobile access', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(await ownerWithPassword());
    mockPrisma.refreshToken.create.mockResolvedValue({});
    // No subscription lookup should even happen for a desktop login.
    const { req, res } = mockReqRes({ body: { username: 'acme_owner', password: 'ownerpass123', platform: 'DESKTOP' } });

    await login(req, res, jest.fn());

    expect(mockPrisma.saaSSubscription.findFirst).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('defaults to DESKTOP (never gated) when the client omits platform entirely', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(await ownerWithPassword());
    mockPrisma.refreshToken.create.mockResolvedValue({});
    const { req, res } = mockReqRes({ body: { username: 'acme_owner', password: 'ownerpass123' } });

    await login(req, res, jest.fn());

    expect(mockPrisma.saaSSubscription.findFirst).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('allows a MOBILE login when the current subscription includes mobile access', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(await ownerWithPassword());
    mockPrisma.saaSSubscription.findFirst.mockResolvedValue({ platformAccess: 'DESKTOP_MOBILE' });
    mockPrisma.refreshToken.create.mockResolvedValue({});
    const { req, res } = mockReqRes({ body: { username: 'acme_owner', password: 'ownerpass123', platform: 'MOBILE' } });

    await login(req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('allows a MOBILE login for a mobile-only plan', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(await ownerWithPassword());
    mockPrisma.saaSSubscription.findFirst.mockResolvedValue({ platformAccess: 'MOBILE' });
    mockPrisma.refreshToken.create.mockResolvedValue({});
    const { req, res } = mockReqRes({ body: { username: 'acme_owner', password: 'ownerpass123', platform: 'MOBILE' } });

    await login(req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('rejects a MOBILE login with 403 when the plan is desktop-only', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(await ownerWithPassword());
    mockPrisma.saaSSubscription.findFirst.mockResolvedValue({ platformAccess: 'DESKTOP' });
    const { req, res } = mockReqRes({ body: { username: 'acme_owner', password: 'ownerpass123', platform: 'MOBILE' } });

    await login(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('fails closed: rejects a MOBILE login when the tenant has no subscription on record', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(await ownerWithPassword());
    mockPrisma.saaSSubscription.findFirst.mockResolvedValue(null);
    const { req, res } = mockReqRes({ body: { username: 'acme_owner', password: 'ownerpass123', platform: 'MOBILE' } });

    await login(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('never gates a Super Admin login regardless of platform or subscription state', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 1, role: 'super_admin', status: 'active', companyName: 'Inventra',
      username: 'superadmin', password: await bcrypt.hash('adminpass123', 4),
      failedLoginAttempts: 0, lockedUntil: null, tenantConfig: null,
    });
    mockPrisma.refreshToken.create.mockResolvedValue({});
    const { req, res } = mockReqRes({ body: { username: 'superadmin', password: 'adminpass123', platform: 'MOBILE' } });

    await login(req, res, jest.fn());

    expect(mockPrisma.saaSSubscription.findFirst).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('applies the same gate to a staff login, checked against the tenant (not the staff row)', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null); // no tenant-owner account with this username
    const staff = {
      id: 77, tenantId: 10, fullName: 'Priya Sharma', username: 'priya_s',
      email: 'priya@acme.test', password: await bcrypt.hash('staffpass123', 4),
      status: 'active', forcePasswordChange: true,
    };
    mockPrisma.tenantUser.findUnique.mockResolvedValue(staff);
    mockPrisma.user.findUnique.mockResolvedValue(OWNER); // the parent tenant
    mockPrisma.saaSSubscription.findFirst.mockResolvedValue({ platformAccess: 'DESKTOP' });

    const { req, res } = mockReqRes({ body: { username: 'priya_s', password: 'staffpass123', platform: 'MOBILE' } });
    await login(req, res, jest.fn());

    expect(mockPrisma.saaSSubscription.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 10 }), // the TENANT's id, not the staff row's id
    }));
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('regression (Phase 6.10I): honors a fully-PAID subscription instead of treating it as absent', async () => {
    // Bug: the entitlement query used to filter status: { in: ['ACTIVE','UNPAID'] },
    // but 'ACTIVE' is never an actual value this app writes (status is a
    // payment-progress marker: UNPAID -> PARTIALLY_PAID -> PAID). A fully
    // paid subscription was silently excluded and treated as "no subscription
    // on record", failing closed to DESKTOP-only even for a paying customer.
    mockPrisma.user.findFirst.mockResolvedValue(await ownerWithPassword());
    mockPrisma.saaSSubscription.findFirst.mockResolvedValue({ status: 'PAID', platformAccess: 'DESKTOP_MOBILE' });
    mockPrisma.refreshToken.create.mockResolvedValue({});
    const { req, res } = mockReqRes({ body: { username: 'acme_owner', password: 'ownerpass123', platform: 'MOBILE' } });

    await login(req, res, jest.fn());

    expect(mockPrisma.saaSSubscription.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: { not: 'CANCELLED' } }),
    }));
    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
