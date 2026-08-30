// Shared Prisma mock used by every test in this suite. Every model/method a
// controller or middleware touches is a jest.fn() here, so tests never hit a
// real database - they assert on exactly what data controllers send to
// Prisma, which is where every Phase 6.10H bug we found actually lived.

export const mockPrisma: any = {
  saaSPlan: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  saaSSubscription: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  tenantConfiguration: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  tenantUser: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
  applicationSnapshot: {
    update: jest.fn(),
  },
  activationToken: {
    updateMany: jest.fn(),
    create: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  // approveApplication runs everything inside prisma.$transaction(async tx => ...).
  // Since every mocked model above is shared, handing the same mockPrisma
  // object back as `tx` means tx.saaSPlan / tx.user / etc. are the exact same
  // jest.fn()s the test asserts against.
  $transaction: jest.fn(async (cb: any) => cb(mockPrisma)),
};

export function resetMockPrisma() {
  for (const key of Object.keys(mockPrisma)) {
    const entry = (mockPrisma as any)[key];
    if (typeof entry === 'function' && typeof entry.mockReset === 'function') {
      entry.mockReset();
      if (key === '$transaction') {
        entry.mockImplementation(async (cb: any) => cb(mockPrisma));
      }
      continue;
    }
    if (entry && typeof entry === 'object') {
      for (const fnName of Object.keys(entry)) {
        const fn = entry[fnName];
        if (fn && typeof fn.mockReset === 'function') fn.mockReset();
      }
    }
  }
}
