import { mockPrisma, resetMockPrisma } from './mockPrisma';

jest.mock('../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../services/auditService', () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));

import { listTeam, createTeamMember, setTeamMemberStatus } from '../controllers/teamController';
import { mockReqRes } from './testHelpers';

beforeEach(() => resetMockPrisma());

const ACTIVE_SUB = { id: 1, userId: 10, status: 'ACTIVE', includedUsers: 3 };

describe('listTeam', () => {
  it('reports seat usage against the tenant\'s current subscription', async () => {
    mockPrisma.tenantUser.findMany.mockResolvedValue([
      { id: 1, status: 'active' }, { id: 2, status: 'active' }, { id: 3, status: 'disabled' },
    ]);
    mockPrisma.saaSSubscription.findFirst.mockResolvedValue(ACTIVE_SUB);
    const { req, res } = mockReqRes({ user: { userId: 10 } });

    await listTeam(req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      seatLimit: 3, activeCount: 2, seatsRemaining: 1,
    }));
  });

  it('fails closed to a 1-seat limit when the tenant has no subscription on record', async () => {
    mockPrisma.tenantUser.findMany.mockResolvedValue([]);
    mockPrisma.saaSSubscription.findFirst.mockResolvedValue(null);
    const { req, res } = mockReqRes({ user: { userId: 10 } });

    await listTeam(req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ seatLimit: 1 }));
  });

  it('regression (Phase 6.10I): honors a fully-PAID subscription\'s seat limit instead of treating it as absent', async () => {
    // Same underlying bug as authController.platformAccess.test.ts: the old
    // filter status: { in: ['ACTIVE','UNPAID'] } never matched 'PAID', so a
    // tenant who had fully paid dropped to the 1-seat fail-closed default.
    mockPrisma.tenantUser.findMany.mockResolvedValue([{ id: 1, status: 'active' }]);
    mockPrisma.saaSSubscription.findFirst.mockResolvedValue({ id: 2, userId: 10, status: 'PAID', includedUsers: 5 });
    const { req, res } = mockReqRes({ user: { userId: 10 } });

    await listTeam(req, res, jest.fn());

    expect(mockPrisma.saaSSubscription.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: { not: 'CANCELLED' } }),
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ seatLimit: 5 }));
  });
});

describe('createTeamMember', () => {
  const VALID_BODY = { fullName: 'Priya Sharma', username: 'priya_s', email: 'priya@acme.test', password: 'supersecret1' };

  it('creates a staff login when a seat is available and the username is free', async () => {
    mockPrisma.saaSSubscription.findFirst.mockResolvedValue(ACTIVE_SUB);
    mockPrisma.tenantUser.count.mockResolvedValue(1); // 1 of 3 seats used
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.tenantUser.findUnique.mockResolvedValue(null);
    mockPrisma.tenantUser.findFirst.mockResolvedValue(null);
    mockPrisma.tenantUser.create.mockResolvedValue({ id: 5, ...VALID_BODY, status: 'active' });

    const { req, res } = mockReqRes({ user: { userId: 10 }, body: VALID_BODY });
    await createTeamMember(req, res, jest.fn());

    expect(mockPrisma.tenantUser.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: 10, username: 'priya_s', status: 'active', forcePasswordChange: true }),
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rejects with 400 when every seat is already in use', async () => {
    mockPrisma.saaSSubscription.findFirst.mockResolvedValue(ACTIVE_SUB);
    mockPrisma.tenantUser.count.mockResolvedValue(3); // all 3 seats used

    const { req, res } = mockReqRes({ user: { userId: 10 }, body: VALID_BODY });
    await createTeamMember(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockPrisma.tenantUser.create).not.toHaveBeenCalled();
  });

  it('rejects with 409 when the username is already taken by the tenant\'s own owner login', async () => {
    mockPrisma.saaSSubscription.findFirst.mockResolvedValue(ACTIVE_SUB);
    mockPrisma.tenantUser.count.mockResolvedValue(0);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 99 }); // owner login collision
    mockPrisma.tenantUser.findUnique.mockResolvedValue(null);

    const { req, res } = mockReqRes({ user: { userId: 10 }, body: VALID_BODY });
    await createTeamMember(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockPrisma.tenantUser.create).not.toHaveBeenCalled();
  });

  it('rejects with 409 when the username is already taken by another staff login', async () => {
    mockPrisma.saaSSubscription.findFirst.mockResolvedValue(ACTIVE_SUB);
    mockPrisma.tenantUser.count.mockResolvedValue(0);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.tenantUser.findUnique.mockResolvedValue({ id: 44 }); // staff username collision

    const { req, res } = mockReqRes({ user: { userId: 10 }, body: VALID_BODY });
    await createTeamMember(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('rejects with 400 on invalid input before touching seat counts', async () => {
    const { req, res } = mockReqRes({ user: { userId: 10 }, body: { fullName: 'A', username: 'x', email: 'not-an-email', password: '123' } });
    await createTeamMember(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockPrisma.saaSSubscription.findFirst).not.toHaveBeenCalled();
  });
});

describe('setTeamMemberStatus', () => {
  it('disables an active team member', async () => {
    mockPrisma.tenantUser.findUnique.mockResolvedValue({ id: 5, tenantId: 10, status: 'active' });
    mockPrisma.tenantUser.update.mockResolvedValue({ id: 5, status: 'disabled' });

    const { req, res } = mockReqRes({ user: { userId: 10 }, params: { id: '5' }, body: { status: 'disabled' } });
    await setTeamMemberStatus(req, res, jest.fn());

    expect(mockPrisma.tenantUser.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 5 }, data: { status: 'disabled' },
    }));
  });

  it('returns 404 when the target team member does not belong to the calling tenant', async () => {
    mockPrisma.tenantUser.findUnique.mockResolvedValue({ id: 5, tenantId: 999, status: 'active' });

    const { req, res } = mockReqRes({ user: { userId: 10 }, params: { id: '5' }, body: { status: 'disabled' } });
    await setTeamMemberStatus(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockPrisma.tenantUser.update).not.toHaveBeenCalled();
  });

  it('blocks re-enabling a disabled member if no seat is free', async () => {
    mockPrisma.tenantUser.findUnique.mockResolvedValue({ id: 5, tenantId: 10, status: 'disabled' });
    mockPrisma.saaSSubscription.findFirst.mockResolvedValue(ACTIVE_SUB);
    mockPrisma.tenantUser.count.mockResolvedValue(3); // all 3 seats already in use by others

    const { req, res } = mockReqRes({ user: { userId: 10 }, params: { id: '5' }, body: { status: 'active' } });
    await setTeamMemberStatus(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockPrisma.tenantUser.update).not.toHaveBeenCalled();
  });

  it('rejects an invalid status value', async () => {
    const { req, res } = mockReqRes({ user: { userId: 10 }, params: { id: '5' }, body: { status: 'banned' } });
    await setTeamMemberStatus(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockPrisma.tenantUser.findUnique).not.toHaveBeenCalled();
  });
});
