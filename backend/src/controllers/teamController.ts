import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { auditLog } from '../services/auditService';

// Phase 6.10H Part 2 - manage a tenant's staff (TenantUser) logins ("seats").
// Seat capacity is read live from the tenant's current subscription's
// includedUsers snapshot field, never re-derived from the master plan.

const inviteSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters.').max(150),
  username: z.string().min(3, 'Username must be at least 3 characters.').max(100)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username must contain only letters, numbers, and underscores.'),
  email: z.string().email('Invalid email address.').max(150),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

const TEAM_SELECT = {
  id: true, fullName: true, username: true, email: true,
  status: true, forcePasswordChange: true, createdAt: true,
} as const;

async function currentSeatLimit(tenantId: number): Promise<number> {
  // Phase 6.10I fix: see authController.ts's assertPlatformEntitlement for
  // the full explanation - 'ACTIVE' is never an actual status value here,
  // so filtering for it silently excluded every fully-paid subscription.
  const sub = await prisma.saaSSubscription.findFirst({
    where: { userId: tenantId, status: { not: 'CANCELLED' } },
    orderBy: { createdAt: 'desc' },
  });
  // Fall back to 1 (owner-only) if the tenant somehow has no subscription row
  // on record - fails closed rather than allowing unlimited staff seats.
  return sub?.includedUsers ?? 1;
}

// GET /team - list staff logins for the calling tenant. Both the owner and
// staff themselves may view the roster (read-only), so this is gated by
// requireTenant rather than requireTenantOwner.
export async function listTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.userId;
    const [staff, seatLimit] = await Promise.all([
      prisma.tenantUser.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' }, select: TEAM_SELECT }),
      currentSeatLimit(tenantId),
    ]);
    const activeCount = staff.filter((s: any) => s.status === 'active').length;

    res.json({
      success: true,
      staff,
      seatLimit,
      activeCount,
      seatsRemaining: Math.max(0, seatLimit - activeCount),
    });
  } catch (err) { next(err); }
}

// POST /team - create a new staff login. Owner-only (requireTenantOwner).
export async function createTeamMember(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.userId;
    const parsed = inviteSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      const firstField = Object.keys(errors)[0];
      const firstMsg = (errors as any)[firstField]?.[0] || 'Validation failed.';
      return res.status(400).json({ success: false, field: firstField, message: firstMsg });
    }
    const d = parsed.data;

    const seatLimit = await currentSeatLimit(tenantId);
    const activeCount = await prisma.tenantUser.count({ where: { tenantId, status: 'active' } });
    if (activeCount >= seatLimit) {
      return res.status(400).json({
        success: false,
        message: `Your plan includes ${seatLimit} user seat(s), all currently in use. Upgrade your plan or disable an existing team member to free up a seat.`,
      });
    }

    // Usernames are unique across BOTH tenant-owner logins and staff logins,
    // since the same login form accepts either.
    const [ownerConflict, staffConflict] = await Promise.all([
      prisma.user.findUnique({ where: { username: d.username } }),
      prisma.tenantUser.findUnique({ where: { username: d.username } }),
    ]);
    if (ownerConflict || staffConflict) {
      return res.status(409).json({ success: false, field: 'username', message: 'This username is already taken.' });
    }

    const emailConflict = await prisma.tenantUser.findFirst({ where: { tenantId, email: d.email } });
    if (emailConflict) {
      return res.status(409).json({ success: false, field: 'email', message: 'A team member with this email already exists.' });
    }

    const hashed = await bcrypt.hash(d.password, 12);
    const staff = await prisma.tenantUser.create({
      data: {
        tenantId,
        fullName: d.fullName,
        username: d.username,
        email: d.email,
        password: hashed,
        status: 'active',
        forcePasswordChange: true,
      },
      select: TEAM_SELECT,
    });

    await auditLog(tenantId, 'team_member_added', `Added staff login: ${d.username}`, req);
    res.status(201).json({ success: true, staff });
  } catch (err) { next(err); }
}

// PATCH /team/:id/status - disable or reactivate a staff login. Owner-only.
export async function setTeamMemberStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const tenantId = req.user!.userId;
    const id = Number(req.params.id);
    const { status } = req.body as { status?: string };
    if (!['active', 'disabled'].includes(status || '')) {
      return res.status(400).json({ success: false, message: "Status must be 'active' or 'disabled'." });
    }

    const staff = await prisma.tenantUser.findUnique({ where: { id } });
    if (!staff || staff.tenantId !== tenantId) {
      return res.status(404).json({ success: false, message: 'Team member not found.' });
    }

    if (status === 'active' && staff.status !== 'active') {
      const seatLimit = await currentSeatLimit(tenantId);
      const activeCount = await prisma.tenantUser.count({ where: { tenantId, status: 'active' } });
      if (activeCount >= seatLimit) {
        return res.status(400).json({
          success: false,
          message: `Your plan includes ${seatLimit} user seat(s), all currently in use. Disable another team member first.`,
        });
      }
    }

    const updated = await prisma.tenantUser.update({ where: { id }, data: { status }, select: TEAM_SELECT });

    // Note: no separate token-revocation step is needed here. requireAuth
    // re-fetches this TenantUser row and checks its status on EVERY request,
    // so a disable takes effect immediately on the staff member's very next
    // API call, regardless of any still-unexpired access token they hold.
    await auditLog(tenantId, status === 'active' ? 'team_member_enabled' : 'team_member_disabled', `Staff login: ${updated.username}`, req);

    res.json({ success: true, staff: updated });
  } catch (err) { next(err); }
}
