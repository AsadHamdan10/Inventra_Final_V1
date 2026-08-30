import bcrypt from 'bcryptjs';
import { mockPrisma, resetMockPrisma } from './mockPrisma';

jest.mock('../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../services/auditService', () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));

import { login, refreshToken } from '../controllers/authController';
import { verifyAccessToken } from '../utils/jwt';
import { mockReqRes } from './testHelpers';

beforeEach(() => resetMockPrisma());

const TENANT = {
  id: 10, role: 'admin', status: 'active', companyName: 'Acme Traders',
  username: 'acme_owner', email: 'owner@acme.test', password: 'hashed-owner-pw',
  failedLoginAttempts: 0, lockedUntil: null, tenantConfig: { businessType: 'TRADING' },
};

async function staffRow(overrides: any = {}) {
  return {
    id: 77, tenantId: 10, fullName: 'Priya Sharma', username: 'priya_s',
    email: 'priya@acme.test', password: await bcrypt.hash('staffpass123', 4),
    status: 'active', forcePasswordChange: true,
    ...overrides,
  };
}

describe('login - staff (TenantUser) sign-in (Phase 6.10H Part 2)', () => {
  it('signs a staff member in when no tenant User row matches the username', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null); // no tenant-owner account with this username
    const staff = await staffRow();
    mockPrisma.tenantUser.findUnique.mockResolvedValue(staff);
    mockPrisma.user.findUnique.mockResolvedValue(TENANT); // the parent tenant, looked up by staff.tenantId
    mockPrisma.refreshToken.create.mockResolvedValue({});

    const { req, res } = mockReqRes({ body: { username: 'priya_s', password: 'staffpass123' } });
    await login(req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      user: expect.objectContaining({
        id: 10,               // the TENANT's id, not the staff row's id
        role: 'staff',
        staffId: 77,
        staffName: 'Priya Sharma',
        username: 'priya_s',  // staff's own login identity
        companyName: 'Acme Traders',
      }),
    }));

    // The JWT's userId claim must be the tenant's id (10), never the staff row's id (77) -
    // this is the entire safety property the Part 2 design depends on.
    const jsonArg = res.json.mock.calls[0][0];
    const decoded = verifyAccessToken(jsonArg.accessToken);
    expect(decoded.userId).toBe(10);
    expect(decoded.role).toBe('staff');
    expect(decoded.staffId).toBe(77);
  });

  it('rejects a disabled staff login with 403 before checking the password', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const staff = await staffRow({ status: 'disabled' });
    mockPrisma.tenantUser.findUnique.mockResolvedValue(staff);

    const { req, res } = mockReqRes({ body: { username: 'priya_s', password: 'staffpass123' } });
    await login(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an incorrect staff password with 401', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const staff = await staffRow();
    mockPrisma.tenantUser.findUnique.mockResolvedValue(staff);

    const { req, res } = mockReqRes({ body: { username: 'priya_s', password: 'wrong-password' } });
    await login(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('blocks staff sign-in if the parent tenant account is no longer active', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const staff = await staffRow();
    mockPrisma.tenantUser.findUnique.mockResolvedValue(staff);
    mockPrisma.user.findUnique.mockResolvedValue({ ...TENANT, status: 'suspended' });

    const { req, res } = mockReqRes({ body: { username: 'priya_s', password: 'staffpass123' } });
    await login(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('still rejects with 401 when the username matches neither a tenant nor a staff login', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.tenantUser.findUnique.mockResolvedValue(null);

    const { req, res } = mockReqRes({ body: { username: 'nobody', password: 'whatever123' } });
    await login(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('refreshToken - staff claim re-verification (regression: privilege-escalation guard)', () => {
  function tokenFor(payload: any) {
    // Sign a real refresh token the same way login() does, so refreshToken()
    // exercises its actual verifyRefreshToken() call, not a mock.
    const { signRefreshToken } = jest.requireActual('../utils/jwt');
    return signRefreshToken(payload);
  }

  it('carries staffId/staffName forward into the new access token on refresh', async () => {
    const staffPayload = { userId: 10, role: 'staff', companyName: 'Acme Traders', staffId: 77, staffName: 'Priya Sharma' };
    const token = tokenFor(staffPayload);

    mockPrisma.refreshToken.findFirst.mockResolvedValue({ token });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 10, role: 'admin', companyName: 'Acme Traders' });
    mockPrisma.tenantUser.findUnique.mockResolvedValue(await staffRow());

    const { req, res } = mockReqRes({ cookies: { refreshToken: token } });
    await refreshToken(req, res, jest.fn());

    const jsonArg = res.json.mock.calls[0][0];
    const decoded = verifyAccessToken(jsonArg.accessToken);
    expect(decoded.role).toBe('staff');
    expect(decoded.staffId).toBe(77);
    expect(decoded.staffName).toBe('Priya Sharma');
    expect(decoded.userId).toBe(10); // still the tenant's id
  });

  it('rejects the refresh if the staff account was disabled since the token was issued', async () => {
    const staffPayload = { userId: 10, role: 'staff', companyName: 'Acme Traders', staffId: 77, staffName: 'Priya Sharma' };
    const token = tokenFor(staffPayload);

    mockPrisma.refreshToken.findFirst.mockResolvedValue({ token });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 10, role: 'admin', companyName: 'Acme Traders' });
    mockPrisma.tenantUser.findUnique.mockResolvedValue(await staffRow({ status: 'disabled' }));

    const { req, res } = mockReqRes({ cookies: { refreshToken: token } });
    await refreshToken(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('does NOT escalate to full tenant-owner privileges when the staff row has been deleted', async () => {
    const staffPayload = { userId: 10, role: 'staff', companyName: 'Acme Traders', staffId: 77, staffName: 'Priya Sharma' };
    const token = tokenFor(staffPayload);

    mockPrisma.refreshToken.findFirst.mockResolvedValue({ token });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 10, role: 'admin', companyName: 'Acme Traders' });
    mockPrisma.tenantUser.findUnique.mockResolvedValue(null); // staff row gone

    const { req, res } = mockReqRes({ cookies: { refreshToken: token } });
    await refreshToken(req, res, jest.fn());

    // Must be rejected outright, never fall through to issuing an owner-level token.
    expect(res.status).toHaveBeenCalledWith(401);
    const jsonCalls = res.json.mock.calls;
    for (const [arg] of jsonCalls) {
      if (arg?.accessToken) {
        const decoded = verifyAccessToken(arg.accessToken);
        expect(decoded.role).not.toBe('admin');
      }
    }
  });

  it('issues a normal owner-level token unchanged when the refresh token has no staffId', async () => {
    const ownerPayload = { userId: 10, role: 'admin', companyName: 'Acme Traders' };
    const token = tokenFor(ownerPayload);

    mockPrisma.refreshToken.findFirst.mockResolvedValue({ token });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 10, role: 'admin', companyName: 'Acme Traders' });

    const { req, res } = mockReqRes({ cookies: { refreshToken: token } });
    await refreshToken(req, res, jest.fn());

    expect(mockPrisma.tenantUser.findUnique).not.toHaveBeenCalled();
    const jsonArg = res.json.mock.calls[0][0];
    const decoded = verifyAccessToken(jsonArg.accessToken);
    expect(decoded.role).toBe('admin');
    expect(decoded.staffId).toBeUndefined();
  });
});
