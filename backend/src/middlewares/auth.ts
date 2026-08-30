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
        status: string;
        // Phase 6.10H Part 2 - set only for a staff (TenantUser) session.
        // userId above always stays the TENANT's own id.
        staffId?: number;
        staffName?: string;
      };
    }
  }
}

/**
 * requireAuth â€” verify JWT, attach user to request.
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

    // Status check moved to requireTenant to allow login for suspended/pending accounts to see their status page.

    let role = user.role;
    let staffId: number | undefined;
    let staffName: string | undefined;

    // Phase 6.10H Part 2 - a staff session's JWT carries staffId. Re-verify on
    // EVERY request (not just at login) that the staff row still exists and is
    // still active, so disabling a staff member takes effect immediately
    // rather than only the next time they try to log in.
    if (payload.staffId) {
      const staff = await prisma.tenantUser.findUnique({ where: { id: payload.staffId } });
      if (!staff || staff.status !== 'active' || staff.tenantId !== user.id) {
        return res.status(401).json({ error: 'Your staff access has been disabled. Please contact your company administrator.' });
      }
      role = 'staff';
      staffId = staff.id;
      staffName = staff.fullName;
    }

    req.user = {
      userId: user.id,
      role,
      companyName: user.companyName,
      status: user.status,
      staffId,
      staffName,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * requireTenant â€” requireAuth + block Super Admin from tenant pages.
 * ZERO-TRUST: Super Admin NEVER accesses business data.
 */
export async function requireTenant(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    if (req.user?.role === 'super_admin') {
      return res.status(403).json({
        error: 'Super Admin cannot access tenant business data.',
      });
    }
    if (req.user?.status !== 'active') {
      return res.status(403).json({
        error: 'Account is not active.',
        status: req.user?.status
      });
    }
    
    next();
  });
}

/**
 * requireTenantOwner - requireTenant + blocks staff (TenantUser) sessions.
 * Phase 6.10H Part 2: only the tenant's own login (never a staff seat) may
 * manage the team roster, company profile/settings, or billing-adjacent
 * pages. A staff member always has req.user.staffId set; the tenant owner
 * never does.
 */
export async function requireTenantOwner(req: Request, res: Response, next: NextFunction) {
  await requireTenant(req, res, () => {
    if (req.user?.staffId) {
      return res.status(403).json({ error: 'Only the account owner can do this. Ask your company administrator.' });
    }
    next();
  });
}

/**
 * requireNotStaff - a lighter version of requireTenantOwner for endpoints
 * that BOTH a tenant owner and a Super Admin may legitimately call on their
 * own account (e.g. revoking their own sessions). Unlike requireTenantOwner,
 * this does NOT route through requireTenant, so it never blocks Super Admin
 * or checks tenant-active status - it only blocks a staff (TenantUser)
 * session from acting on behalf of the tenant it belongs to.
 */
export async function requireNotStaff(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, () => {
    if (req.user?.staffId) {
      return res.status(403).json({ error: 'Only the account owner can do this. Ask your company administrator.' });
    }
    next();
  });
}

/**
 * requireSuperAdmin â€” only super_admin role allowed.
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
 * requireAdminOrSuperAdmin â€” admin or super_admin only.
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
 * assertTenantOwnership â€” verify a record belongs to the current tenant.
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





