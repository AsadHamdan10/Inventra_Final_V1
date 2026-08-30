import jwt from 'jsonwebtoken';
import { env } from './env';

export interface JwtPayload {
  userId: number;
  role: string;
  companyName: string;
  // Phase 6.10H Part 2 - present only for a staff (TenantUser) session. userId
  // above is always the TENANT's own id, never the staff row's id - this is
  // what keeps every existing userId-scoped business query working unchanged.
  staffId?: number;
  staffName?: string;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload;
  } catch {
    return null;
  }
}
