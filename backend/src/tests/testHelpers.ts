// Builds a minimal mock Express req/res/next trio for calling controller
// functions directly, without spinning up a real HTTP server.

export function mockReqRes(overrides: any = {}) {
  const req: any = {
    body: {},
    params: {},
    query: {},
    headers: {},
    ip: '127.0.0.1',
    user: { userId: 1 },
    ...overrides,
  };
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  const next = jest.fn();
  return { req, res, next };
}
