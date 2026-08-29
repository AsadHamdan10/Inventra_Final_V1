import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';
import prisma from '../utils/prisma';
import { auditLog } from '../services/auditService';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        role: string;
        companyName: string;
      };
    }
  }
}

/**
 * requireAuth — verify JWT, attach user to request.
 * Blocks unapproved tenants automatically.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided.' });
    }

    const token = authHeader.slice(7);
    let payload: JwtPayload;

    try {
      payload = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ error: 'Token expired or invalid.' });
    }

    // Verify user still exists and is approved
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, status: true, companyName: true, forcePasswordChange: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }

    // Super admin always passes; others need to be active
    if (user.role !== 'super_admin' && user.status !== 'active') {
      return res.status(403).json({
        error: 'Account not approved.',
        status: user.status,
      });
    }

    req.user = {
      userId: user.id,
      role: user.role,
      companyName: user.companyName,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * requireTenant — requireAuth + block Super Admin from tenant pages.
 * ZERO-TRUST: Super Admin NEVER accesses business data.
 */
export async function requireTenant(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    if (req.user?.role === 'super_admin') {
      return res.status(403).json({
        error: 'Super Admin cannot access tenant business data.',
      });
    }
    next();
  });
}

/**
 * requireSuperAdmin — only super_admin role allowed.
 */
export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, () => {
    if (req.user?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Super Admin access required.' });
    }
    next();
  });
}

/**
 * requireAdminOrSuperAdmin — admin or super_admin only.
 */
export async function requireAdminOrSuperAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, () => {
    if (!['admin', 'super_admin'].includes(req.user?.role ?? '')) {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
  });
}

/**
 * assertTenantOwnership — verify a record belongs to the current tenant.
 * Call before any view/edit/delete to prevent IDOR attacks.
 */
export async function assertTenantOwnership(
  userId: number,
  table: string,
  recordId: number
): Promise<boolean> {
  const allowedTables: Record<string, string> = {
    vendors: 'vendor',
    customers: 'customer',
    materials: 'material',
    purchases: 'purchase',
    sales: 'sale',
    expenses: 'expense',
    investors: 'investor',
    intermediary: 'intermediary',
    gst_payments: 'gstPayment',
    gst_input_bills: 'gstInputBill',
    gst_adjustments: 'gstAdjustment',
    bank_accounts: 'bankAccount',
    bank_statements: 'bankStatement',
  };

  const model = allowedTables[table];
  if (!model) return false;

  const record = await (prisma as any)[model].findFirst({
    where: { id: recordId, userId },
    select: { id: true },
  });

  return !!record;
}
