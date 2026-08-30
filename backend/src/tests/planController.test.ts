import { mockPrisma, resetMockPrisma } from './mockPrisma';

jest.mock('../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../services/auditService', () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));

import { PlanController } from '../controllers/planController';
import { mockReqRes } from './testHelpers';

beforeEach(() => resetMockPrisma());

describe('PlanController.create', () => {
  it('computes finalPrice as listPrice minus discountAmount', async () => {
    mockPrisma.saaSPlan.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 1, ...data }));
    const { req, res } = mockReqRes({ body: { code: 'X', name: 'X Plan', listPrice: 1000, discountAmount: 200 } });

    await PlanController.create(req, res, jest.fn());

    expect(mockPrisma.saaSPlan.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ finalPrice: 800, annualPrice: 800 }),
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('clamps finalPrice at 0 when the discount exceeds list price (never a negative price)', async () => {
    mockPrisma.saaSPlan.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 1, ...data }));
    const { req, res } = mockReqRes({ body: { code: 'X', name: 'X', listPrice: 500, discountAmount: 900 } });

    await PlanController.create(req, res, jest.fn());

    expect(mockPrisma.saaSPlan.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ finalPrice: 0 }),
    }));
  });

  it('defaults an invalid status to ACTIVE and an invalid platformAccess to DESKTOP', async () => {
    mockPrisma.saaSPlan.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 1, ...data }));
    const { req, res } = mockReqRes({ body: { code: 'X', name: 'X', listPrice: 100, status: 'BOGUS', platformAccess: 'BOGUS' } });

    await PlanController.create(req, res, jest.fn());

    expect(mockPrisma.saaSPlan.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'ACTIVE', platformAccess: 'DESKTOP', isActive: true }),
    }));
  });

  it('rejects when code or name is missing, without ever calling the database', async () => {
    const { req, res } = mockReqRes({ body: { listPrice: 100 } });

    await PlanController.create(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockPrisma.saaSPlan.create).not.toHaveBeenCalled();
  });

  it('returns 409 with a clear message when the plan code already exists', async () => {
    mockPrisma.saaSPlan.create.mockRejectedValue({ code: 'P2002' });
    const { req, res } = mockReqRes({ body: { code: 'DUPLICATE', name: 'X', listPrice: 100 } });

    await PlanController.create(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('already exists') }));
  });
});

describe('PlanController.update', () => {
  it('blocks editing an ARCHIVED plan', async () => {
    mockPrisma.saaSPlan.findUnique.mockResolvedValue({ id: 1, status: 'ARCHIVED', code: 'X' });
    const { req, res } = mockReqRes({ params: { id: '1' }, body: { listPrice: 100 } });

    await PlanController.update(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockPrisma.saaSPlan.update).not.toHaveBeenCalled();
  });

  it('recomputes finalPrice by merging the incoming fields onto the existing row', async () => {
    mockPrisma.saaSPlan.findUnique.mockResolvedValue({
      id: 1, status: 'ACTIVE', code: 'X', name: 'X', listPrice: 1000, discountAmount: 0,
      businessType: 'TRADING', platformAccess: 'DESKTOP', durationMonths: 12, includedUsers: 5,
    });
    mockPrisma.saaSPlan.update.mockImplementation(({ data }: any) => Promise.resolve({ id: 1, ...data }));
    const { req, res } = mockReqRes({ params: { id: '1' }, body: { discountAmount: 300 } });

    await PlanController.update(req, res, jest.fn());

    expect(mockPrisma.saaSPlan.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ finalPrice: 700 }),
    }));
  });

  it('returns 404 when the plan does not exist', async () => {
    mockPrisma.saaSPlan.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ params: { id: '99' }, body: {} });

    await PlanController.update(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('PlanController.setStatus', () => {
  it('rejects an invalid status value', async () => {
    const { req, res } = mockReqRes({ params: { id: '1' }, body: { status: 'BOGUS' } });

    await PlanController.setStatus(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('keeps the legacy isActive column in sync with the new status column', async () => {
    mockPrisma.saaSPlan.findUnique.mockResolvedValue({ id: 1, code: 'X', status: 'INACTIVE' });
    mockPrisma.saaSPlan.update.mockImplementation(({ data }: any) => Promise.resolve({ id: 1, ...data }));
    const { req, res } = mockReqRes({ params: { id: '1' }, body: { status: 'ACTIVE' } });

    await PlanController.setStatus(req, res, jest.fn());

    expect(mockPrisma.saaSPlan.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'ACTIVE', isActive: true },
    });
  });
});

describe('PlanController.duplicate', () => {
  it('always forces the new plan to INACTIVE, even when duplicating an ARCHIVED source', async () => {
    mockPrisma.saaSPlan.findUnique.mockResolvedValue({
      id: 1, code: 'SRC', name: 'Source', status: 'ARCHIVED', listPrice: 1000, discountAmount: 0,
      businessType: 'TRADING', platformAccess: 'DESKTOP', durationMonths: 12, includedUsers: 5,
    });
    mockPrisma.saaSPlan.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 2, ...data }));
    const { req, res } = mockReqRes({ params: { id: '1' }, body: {} });

    await PlanController.duplicate(req, res, jest.fn());

    expect(mockPrisma.saaSPlan.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'INACTIVE' }),
    }));
  });

  it('returns 404 when the source plan does not exist', async () => {
    mockPrisma.saaSPlan.findUnique.mockResolvedValue(null);
    const { req, res } = mockReqRes({ params: { id: '99' }, body: {} });

    await PlanController.duplicate(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('PlanController.listPublic', () => {
  it('only ever queries ACTIVE plans, and filters by businessType when given', async () => {
    mockPrisma.saaSPlan.findMany.mockResolvedValue([]);
    const { req, res } = mockReqRes({ query: { businessType: 'BOTH' } });

    await PlanController.listPublic(req, res, jest.fn());

    expect(mockPrisma.saaSPlan.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'ACTIVE', businessType: 'BOTH' },
    }));
  });

  it('omits the businessType filter when none is provided, returning every active plan', async () => {
    mockPrisma.saaSPlan.findMany.mockResolvedValue([]);
    const { req, res } = mockReqRes({ query: {} });

    await PlanController.listPublic(req, res, jest.fn());

    expect(mockPrisma.saaSPlan.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'ACTIVE' },
    }));
  });
});
