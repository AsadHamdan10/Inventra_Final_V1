import { mockPrisma, resetMockPrisma } from './mockPrisma';

jest.mock('../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));

import { requireManufacturingEntitlement } from '../middlewares/entitlement';
import { mockReqRes } from './testHelpers';

beforeEach(() => resetMockPrisma());

describe('requireManufacturingEntitlement', () => {
  it('allows a BOTH business type through', async () => {
    mockPrisma.tenantConfiguration.findUnique.mockResolvedValue({ businessType: 'BOTH' });
    const { req, res, next } = mockReqRes();

    await requireManufacturingEntitlement(req, res, next);

    expect(next).toHaveBeenCalledWith(); // called with no error
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows a MANUFACTURING business type through', async () => {
    mockPrisma.tenantConfiguration.findUnique.mockResolvedValue({ businessType: 'MANUFACTURING' });
    const { req, res, next } = mockReqRes();

    await requireManufacturingEntitlement(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('blocks a TRADING-only tenant with 403', async () => {
    mockPrisma.tenantConfiguration.findUnique.mockResolvedValue({ businessType: 'TRADING' });
    const { req, res, next } = mockReqRes();

    await requireManufacturingEntitlement(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('fails closed (blocks) when no TenantConfiguration row exists for the tenant', async () => {
    mockPrisma.tenantConfiguration.findUnique.mockResolvedValue(null);
    const { req, res, next } = mockReqRes();

    await requireManufacturingEntitlement(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when there is no authenticated user on the request', async () => {
    const { req, res, next } = mockReqRes({ user: undefined });

    await requireManufacturingEntitlement(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockPrisma.tenantConfiguration.findUnique).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
