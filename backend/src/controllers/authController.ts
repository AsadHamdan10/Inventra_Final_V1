import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import prisma from '../utils/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { auditLog } from '../services/auditService';
import { encryptIfPresent, safeDecrypt, blindIndex } from '../utils/crypto';
import { z } from 'zod';

// ── Rate Limiter ───────────────────────────────────────────────
export const loginRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: { success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many login attempts. Please try again in 5 minutes." } },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── GSTIN validator ────────────────────────────────────────────
const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const mobileRegex = /^[6-9]\d{9}$/;

// ── Validation Schemas ─────────────────────────────────────────
const loginSchema = z.object({
  username: z.string().min(1, 'Username or email is required.'),
  password: z.string().min(1, 'Password is required.'),
  // Phase 6.10H Part 3 - the client declares which surface it's logging in
  // from. The web app (including the responsive site in a phone's browser)
  // sends 'DESKTOP' or omits this entirely; the installed Android app (a TWA
  // wrapping this same frontend - see docs/PLAY_STORE_DEPLOYMENT_GUIDE.md)
  // detects that via isMobileAppSession() and sends 'MOBILE'. This is a
  // self-reported client signal, not a security boundary - the boundary is
  // the platformAccess entitlement check below, which only ever restricts
  // MOBILE logins. DESKTOP/web access is never gated by this field.
  platform: z.enum(['DESKTOP', 'MOBILE']).optional().default('DESKTOP'),
});

const registerSchema = z.object({
  fullName: z.string().optional(),
    companyName: z.string().min(3, "Company Name must be at least 3 characters.").max(200),
  username: z.string().min(3, "Username must be at least 3 characters.").max(50).regex(/^[a-zA-Z0-9_]+$/, "Username must contain only letters, numbers, and underscores."),
  email: z.string().email("Invalid email address.").max(150),
  mobile: z.string().regex(mobileRegex, "Mobile must be a valid 10-digit Indian mobile number."),
  businessType: z.enum(["TRADING", "MANUFACTURING", "BOTH"]).optional(),
  industry: z.string().optional().default(""),
  plan: z.string().optional().default("V1_BASIC"),
  billingCycle: z.string().optional().default("YEARLY"),
  // Phase 6.10H: the frontend may suggest which catalog plan the visitor picked in
  // step 3 of registration, but this is ONLY a lookup key - see register() below,
  // which re-validates it against the live, Super-Admin-configured catalog and
  // never trusts any price/duration/user-count/platform field from the client.
  planId: z.number().int().positive().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword:     z.string().min(8, 'New password must be at least 8 characters.'),
});

const profileSchema = z.object({
  fullName:  z.string().optional(),
  companyName:  z.string().min(3).max(200),
  gstin:        z.string().regex(gstinRegex, 'Invalid GSTIN format.'),
  addressLine1: z.string().min(3).max(255),
  addressLine2: z.string().optional().default(''),
  city:         z.string().min(2).max(100),
  district:     z.string().min(2).max(100),
  state:        z.string().min(2).max(100),
  pincode:      z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits.'),
  country:      z.string().default('India'),
  email:        z.string().email().max(150),
  mobile:        z.string().regex(mobileRegex, 'Invalid mobile number.'),
  panNumber:    z.string().optional().default(''),
});

// ── Helper: build user profile response ───────────────────────
// All sensitive fields are stored encrypted (see prisma/schema.prisma);
// this is the one place they get decrypted before going to the frontend.
function buildUserResponse(user: any) {
  return {
    id:                  user.id,
    companyName:         user.companyName,
    username:            user.username,
    email:               user.email,
    mobile:              safeDecrypt(user.mobile) || '',
    role:                user.role,
    status:              user.status,
    forcePasswordChange: user.forcePasswordChange,
    profileComplete:     user.profileComplete,
    gstin:               safeDecrypt(user.gstin) || '',
    addressLine1:        safeDecrypt(user.addressLine1) || '',
    addressLine2:        safeDecrypt(user.addressLine2) || '',
    city:                safeDecrypt(user.city) || '',
    district:            safeDecrypt(user.district) || '',
    state:               safeDecrypt(user.state) || '',
    pincode:             safeDecrypt(user.pincode) || '',
    country:             user.country || 'India',
    panNumber:           safeDecrypt(user.panNumber) || '',
    // Bug fix: this was never populated, so the sidebar's Manufacturing section
    // (AppLayout.tsx: user?.businessType === 'BOTH' || 'MANUFACTURING') could
    // never show for ANY tenant, even ones legitimately entitled to it.
    businessType:        user.tenantConfig?.businessType || 'TRADING',
  };
}

// Phase 6.10H Part 2 - a staff (TenantUser) session reuses the tenant's own
// profile/company data (billing, GSTIN, address, etc. all belong to the
// tenant, not the staff member) but overrides identity fields with the
// staff member's own login/name and forces role to 'staff'.
function buildStaffUserResponse(staff: any, tenant: any) {
  const base = buildUserResponse(tenant);
  return {
    ...base,
    role:                'staff',
    username:            staff.username,
    email:               staff.email,
    staffId:             staff.id,
    staffName:           staff.fullName,
    forcePasswordChange: staff.forcePasswordChange,
  };
}

// ── Platform Access Entitlement (Phase 6.10H Part 3) ─────────────
// Mobile app access (the installed Android TWA) is a paid add-on tier on top
// of the base desktop/web product - see SaaSPlan.platformAccess. Desktop/web
// login is NEVER gated here (it's the baseline every tenant already has);
// only a login that self-declares platform: 'MOBILE' is checked against the
// tenant's current subscription. Returns true and does nothing if allowed;
// on rejection it writes the 403 response itself and returns false, so
// callers just need `if (!(await assertPlatformEntitlement(...))) return;`.
async function assertPlatformEntitlement(
  tenantId: number,
  platform: 'DESKTOP' | 'MOBILE',
  req: Request,
  res: Response
): Promise<boolean> {
  if (platform !== 'MOBILE') return true;

  // Phase 6.10I fix: SaaSSubscription.status is a payment-progress marker
  // (UNPAID -> PARTIALLY_PAID -> PAID), never the literal string 'ACTIVE' -
  // no code path ever writes that value (see adminController.ts's own
  // comment on this). The old { in: ['ACTIVE','UNPAID'] } filter silently
  // dropped every fully-paid subscription from this query, degrading a
  // paying tenant back to fail-closed defaults. "Current subscription"
  // means the newest one that hasn't been explicitly cancelled.
  const sub = await prisma.saaSSubscription.findFirst({
    where: { userId: tenantId, status: { not: 'CANCELLED' } },
    orderBy: { createdAt: 'desc' },
  });
  // Fail closed: no subscription on record means no mobile entitlement, same
  // convention used for seat limits and the manufacturing entitlement gate.
  const access = sub?.platformAccess || 'DESKTOP';
  if (access === 'MOBILE' || access === 'DESKTOP_MOBILE') return true;

  await auditLog(tenantId, 'login_blocked', 'Mobile app login blocked - plan does not include mobile access', req);
  res.status(403).json({
    success: false,
    error: 'Your current plan does not include mobile app access. Upgrade your plan to use the Inventra mobile app.',
  });
  return false;
}

// ── Staff Login (Phase 6.10H Part 2) ────────────────────────────
// A staff member has their own row in TenantUser with their own username
// and password, but their JWT's userId claim is always set to the TENANT's
// own id - never their own TenantUser.id. This means every existing
// `where: { userId: req.user.userId }` query across the app (24+
// controllers) continues to scope correctly to the tenant's data with zero
// changes. Their real identity travels via the additive staffId/staffName
// claims, and role is forced to 'staff'.
async function handleStaffLogin(staff: any, password: string, platform: 'DESKTOP' | 'MOBILE', req: Request, res: Response) {
  if (staff.status !== 'active') {
    await auditLog(0, 'login_blocked', `Staff account disabled: ${staff.username}`, req);
    return res.status(403).json({ success: false, error: 'Your staff access has been disabled. Please contact your company administrator.' });
  }

  const isValid = await bcrypt.compare(password, staff.password);
  if (!isValid) {
    await auditLog(0, 'failed_login', `Incorrect password for staff: ${staff.username}`, req);
    return res.status(401).json({ success: false, error: 'Invalid username or password.' });
  }

  const tenant = await prisma.user.findUnique({ where: { id: staff.tenantId }, include: { tenantConfig: true } });
  if (!tenant || (tenant.role !== 'super_admin' && tenant.status !== 'active')) {
    await auditLog(0, 'login_blocked', `Staff login blocked: tenant account not active (${staff.username})`, req);
    return res.status(403).json({ success: false, error: 'Your company account is not currently active. Please contact your administrator.' });
  }

  if (!(await assertPlatformEntitlement(tenant.id, platform, req, res))) return;

  const payload = { userId: tenant.id, role: 'staff', companyName: tenant.companyName, staffId: staff.id, staffName: staff.fullName };
  const accessToken = signAccessToken(payload);
  const refreshTok = signRefreshToken(payload);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await prisma.refreshToken.create({ data: { userId: tenant.id, token: refreshTok, expiresAt } });

  await auditLog(tenant.id, 'login', `Staff login: ${staff.username}`, req);

  res.cookie('refreshToken', refreshTok, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000,
    path:     '/api/v1/auth/refresh',
  });

  res.json({ success: true, accessToken, user: buildStaffUserResponse(staff, tenant) });
}

// ── Login ──────────────────────────────────────────────────────
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Username and password are required.', message: 'Username and password are required.' });
    }

    const { username, password, platform } = parsed.data;

    const user = await prisma.user.findFirst({
      where: { OR: [{ username }, { email: username }] },
      include: { tenantConfig: true },
    });

    if (!user) {
      // Phase 6.10H Part 2 - the username may belong to a staff (TenantUser)
      // login rather than a tenant's own account. Try that before failing.
      const staffCandidate = await prisma.tenantUser.findUnique({ where: { username } });
      if (staffCandidate) {
        return handleStaffLogin(staffCandidate, password, platform, req, res);
      }
      await auditLog(0, 'failed_login', `User not found: ${username}`, req);
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await auditLog(user.id, "login_blocked", "Account locked due to brute-force", req);
      return res.status(401).json({ success: false, error: "Invalid username or password." });
    }


    if (!user.password) {
      await auditLog(user.id, "failed_login", `Password not set for: ${username}`, req);

      const failures = (user.failedLoginAttempts || 0) + 1;
      let lockedUntil: Date | null = null;
      if (failures >= 5) {
        lockedUntil = new Date();
        const lockoutMins = Math.min(15 * Math.pow(2, failures - 5), 1440);
        lockedUntil.setMinutes(lockedUntil.getMinutes() + lockoutMins);
        await auditLog(user.id, "ACCOUNT_LOCKED", `Account locked until ${lockedUntil.toISOString()}`, req);
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: failures, lastFailedLogin: new Date(), lockedUntil }
      });
      return res.status(401).json({ success: false, error: "Invalid username or password." });
    }
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      await auditLog(user.id, 'failed_login', `Incorrect password for: ${username}`, req);

      const failures = (user.failedLoginAttempts || 0) + 1;
      let lockedUntil: Date | null = null;
      if (failures >= 5) {
        lockedUntil = new Date();
        const lockoutMins = Math.min(15 * Math.pow(2, failures - 5), 1440);
        lockedUntil.setMinutes(lockedUntil.getMinutes() + lockoutMins);
        await auditLog(user.id, "ACCOUNT_LOCKED", `Account locked until ${lockedUntil.toISOString()}`, req);
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: failures, lastFailedLogin: new Date(), lockedUntil }
      });
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    if (user.role !== 'super_admin' && user.status !== 'active') {
      await auditLog(user.id, 'login_blocked', `Account ${user.status}`, req);
      const messages: Record<string, string> = {
        pending:   'Your account is pending Super Admin approval.',
        activation_pending: 'Your account is approved. Please check your email to activate it.',
        rejected:  'Your account has been rejected. Please contact administrator.',
        suspended: 'Your account has been disabled.',
      };
      return res.status(403).json({
        success: false,
        error: messages[user.status] || `Account is ${user.status}.`,
        status: user.status,
      });
    }

    if (user.role !== 'super_admin' && !(await assertPlatformEntitlement(user.id, platform, req, res))) return;

    const payload = { userId: user.id, role: user.role, companyName: user.companyName };
    const accessToken  = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({ data: { userId: user.id, token: refreshToken, expiresAt } });

    await auditLog(user.id, 'login', `Login: ${username}`, req);

    if (user.failedLoginAttempts > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lastFailedLogin: null, lockedUntil: null }
      });
      await auditLog(user.id, "ACCOUNT_UNLOCKED", "Account unlocked after successful login", req);
    }


    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   7 * 24 * 60 * 60 * 1000,
      path:     '/api/v1/auth/refresh',
    });

    res.json({ success: true, accessToken, user: buildUserResponse(user) });
  } catch (err) { next(err); }
}

// ── Register ───────────────────────────────────────────────────
export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      const firstField = Object.keys(errors)[0];
      const firstMsg   = (errors as any)[firstField]?.[0] || "Validation failed.";
      return res.status(400).json({ success: false, field: firstField, message: firstMsg });
    }

    const d = parsed.data;

    // Check username uniqueness
    const byUsername = await prisma.user.findUnique({ where: { username: d.username } });
    if (byUsername) {
      return res.status(409).json({ success: false, field: "username", message: "Username is already taken." });
    }

    // Check email uniqueness
    const byEmail = await prisma.user.findFirst({ where: { email: d.email } });
    if (byEmail) {
      return res.status(409).json({ success: false, field: "email", message: "Email is already registered." });
    }

    // Check mobile uniqueness
    const byMobile = await prisma.user.findFirst({ where: { mobileHash: blindIndex(d.mobile) } });
    if (byMobile) {
      return res.status(409).json({ success: false, field: "mobile", message: "Mobile number is already registered." });
    }

    // Check company name uniqueness
    const byCompanyName = await prisma.user.findFirst({ where: { companyName: d.companyName } });
    if (byCompanyName) {
      return res.status(409).json({ success: false, field: "companyName", message: "Company is already registered." });
    }

    // BACKEND-AUTHORITATIVE (Phase 6.10H): resolve the commercial plan from the
    // live Super-Admin-configured catalog. The frontend may pass `planId` as a
    // hint of what the visitor selected, but it is only used as a lookup key -
    // it must be ACTIVE and must match the submitted businessType, or it is
    // rejected outright. Nothing about price, duration, included users, or
    // platform access is ever taken from the request body; all of that is read
    // from the resolved SaaSPlan row. Only TRADING and BOTH are valid business
    // types (no MANUFACTURING-only, no free plans).
    const businessType: string = d.businessType === 'BOTH' ? 'BOTH' : 'TRADING';

    let resolvedPlan;
    if (d.planId) {
      resolvedPlan = await prisma.saaSPlan.findUnique({ where: { id: d.planId } });
      if (!resolvedPlan || resolvedPlan.status !== 'ACTIVE' || resolvedPlan.businessType !== businessType) {
        return res.status(400).json({ success: false, field: 'planId', message: 'Selected plan is no longer available. Please choose a plan again.' });
      }
    } else {
      // No explicit selection (e.g. an older client) - fall back to the
      // lowest-priced ACTIVE plan for the chosen business type.
      resolvedPlan = await prisma.saaSPlan.findFirst({
        where: { status: 'ACTIVE', businessType },
        orderBy: { finalPrice: 'asc' },
      });
      if (!resolvedPlan) {
        return res.status(400).json({ success: false, field: 'businessType', message: 'No active plan is currently available for this business type. Please contact us.' });
      }
    }
    const derivedPlanCode = resolvedPlan.code;

    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    const applicationRef = `INV-2026-${randomStr}`;

    const user = await prisma.user.create({
      data: {
        fullName:        d.fullName,
        companyName:     d.companyName,
        username:        d.username,
        email:           d.email,
        mobile:          encryptIfPresent(d.mobile),
        mobileHash:      blindIndex(d.mobile),
        role:            "admin",
        status:          "pending",
        applicationRef,
        plan:            derivedPlanCode,  // backend-derived only, frontend plan field ignored
        applicationSnapshot: {
          create: {
            applicationRef,
            fullName: d.fullName,
            companyName: d.companyName,
            username: d.username,
            email: d.email,
            mobile: d.mobile,
            businessType: businessType,      // normalised: TRADING or BOTH only
            industry: d.industry || "",
            plan: derivedPlanCode,           // backend-derived authoritative plan code
            billingCycle: resolvedPlan.durationMonths >= 24 ? `${Math.round(resolvedPlan.durationMonths / 12)}_YEAR` : "YEARLY",
            originalStatus: "pending"
          }
        }
      }
    });

    await auditLog(user.id, "USER_REGISTERED", `Application ${applicationRef} submitted. Plan: ${derivedPlanCode} (₹${resolvedPlan.finalPrice}, ${resolvedPlan.durationMonths}mo, ${resolvedPlan.includedUsers} users, ${resolvedPlan.platformAccess})`, req);

    const { sendRegistrationConfirmation, sendSuperAdminNotification } = require("../services/emailService");
    await sendRegistrationConfirmation(d.email, d.companyName, applicationRef);
    await sendSuperAdminNotification(d.companyName, d.username, d.email, d.mobile, applicationRef);

    res.json({ success: true, message: "Registration received.", applicationRef });
  } catch (err: any) {
    if (err.code === "P2002") {
      const rawField = err.meta?.target?.[0] || "field";
      return res.status(409).json({ success: false, field: rawField, message: `${rawField} already exists.` });
    }
    next(err);
  }
}

// ── Refresh Token ──────────────────────────────────────────────
export async function refreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) return res.status(401).json({ success: false, message: 'No refresh token.' });

    let payload;
    try { payload = verifyRefreshToken(token); }
    catch { return res.status(401).json({ success: false, message: 'Token expired. Please log in again.' }); }

    const storedToken = await prisma.refreshToken.findFirst({
      where: { token, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!storedToken) return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return res.status(401).json({ success: false, message: 'User not found.' });

    // Phase 6.10H Part 2 - SECURITY: a refresh token minted for a staff
    // session carries staffId. If we dropped it here, the next access token
    // would silently escalate to full tenant-owner privileges (role would
    // fall back to user.role). Re-verify the staff row is still active on
    // EVERY refresh, exactly like requireAuth does per-request, and carry
    // the staff claims forward unchanged.
    let newPayload: { userId: number; role: string; companyName: string; staffId?: number; staffName?: string };
    if (payload.staffId) {
      const staff = await prisma.tenantUser.findUnique({ where: { id: payload.staffId } });
      if (!staff || staff.status !== 'active' || staff.tenantId !== user.id) {
        return res.status(401).json({ success: false, message: 'Your staff access has been disabled. Please log in again.' });
      }
      newPayload = { userId: user.id, role: 'staff', companyName: user.companyName, staffId: staff.id, staffName: staff.fullName };
    } else {
      newPayload = { userId: user.id, role: user.role, companyName: user.companyName };
    }

    const accessToken = signAccessToken(newPayload);
    res.json({ success: true, accessToken });
  } catch (err) { next(err); }
}

// ── Logout ─────────────────────────────────────────────────────
export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (token) {
      await prisma.refreshToken.updateMany({ where: { token }, data: { revokedAt: new Date() } });
    }
    if (req.user) await auditLog(req.user.userId, 'logout', 'User logged out', req);
    res.clearCookie('refreshToken', { path: '/api/v1/auth/refresh' });
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) { next(err); }
}

// ── Change Password ────────────────────────────────────────────
export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0] || 'Validation failed.';
      return res.status(400).json({ success: false, message: msg });
    }

    const { currentPassword, newPassword } = parsed.data;

    // Phase 6.10H Part 2 - a staff session's own credential lives on its
    // TenantUser row, never on the tenant's own User row. req.user.userId
    // always points to the TENANT's id (by design, so business-data queries
    // keep working), so it must never be used to look up or overwrite a
    // password when this is a staff session - that would silently check/
    // change the tenant OWNER's password instead of the staff member's own.
    if (req.user?.staffId) {
      const staff = await prisma.tenantUser.findUnique({ where: { id: req.user.staffId } });
      if (!staff) return res.status(404).json({ success: false, message: 'Staff account not found.' });

      const isValid = await bcrypt.compare(currentPassword, staff.password);
      if (!isValid) return res.status(400).json({ success: false, message: 'Current password is incorrect.' });

      const hashed = await bcrypt.hash(newPassword, 12);
      await prisma.tenantUser.update({ where: { id: staff.id }, data: { password: hashed, forcePasswordChange: false } });
      await auditLog(req.user.userId, 'password_change', `Staff password changed: ${staff.username}`, req);

      return res.json({ success: true, message: 'Password changed successfully.' });
    }

    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { applicationSnapshot: true } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (!user.password) return res.status(400).json({ success: false, message: "Current password is incorrect." });
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) return res.status(400).json({ success: false, message: 'Current password is incorrect.' });

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed, forcePasswordChange: false } });
    await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await auditLog(userId, 'password_change', 'Password changed', req);

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) { next(err); }
}

// ── Get Me ─────────────────────────────────────────────────────
export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, include: { tenantConfig: true } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (req.user?.staffId) {
      const staff = await prisma.tenantUser.findUnique({ where: { id: req.user.staffId } });
      if (!staff || staff.status !== 'active') {
        return res.status(401).json({ success: false, message: 'Your staff access has been disabled. Please contact your company administrator.' });
      }
      // Bug fix: pages that re-fetch the full profile (e.g. CompanyProfilePage)
      // expect { user: {...} } - the same shape login() already returns - not
      // the bare user object. This was previously unwrapped here, so every
      // authApi.me() caller reading `data.user` silently got undefined and
      // those pages rendered as empty/unavailable.
      return res.json({ success: true, user: buildStaffUserResponse(staff, user) });
    }

    res.json({ success: true, user: buildUserResponse(user) });
  } catch (err) { next(err); }
}

// ── Update Company Profile ─────────────────────────────────────
export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      const firstField = Object.keys(errors)[0];
      const firstMsg   = (errors as any)[firstField]?.[0] || 'Validation failed.';
      return res.status(400).json({ success: false, field: firstField, message: firstMsg });
    }

    const d = parsed.data;

    // Check GSTIN not taken by another user (blind-index lookup — see register()).
    const gstinConflict = await prisma.user.findFirst({
      where: { gstinHash: blindIndex(d.gstin.toUpperCase()), NOT: { id: userId } },
    });
    if (gstinConflict) {
      return res.status(409).json({ success: false, field: 'gstin', message: 'GSTIN is already registered to another account.' });
    }

    // Check email not taken by another user
    const emailConflict = await prisma.user.findFirst({
      where: { email: d.email, NOT: { id: userId } },
    });
    if (emailConflict) {
      return res.status(409).json({ success: false, field: 'email', message: 'Email is already registered to another account.' });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName:        d.fullName,
          companyName:     d.companyName,
        email:           d.email,
        mobile:          encryptIfPresent(d.mobile),
        mobileHash:      blindIndex(d.mobile),
        gstin:           encryptIfPresent(d.gstin.toUpperCase()),
        gstinHash:       blindIndex(d.gstin.toUpperCase()),
        addressLine1:    encryptIfPresent(d.addressLine1),
        addressLine2:    encryptIfPresent(d.addressLine2),
        city:            encryptIfPresent(d.city),
        district:        encryptIfPresent(d.district),
        state:           encryptIfPresent(d.state),
        pincode:         encryptIfPresent(d.pincode),
        country:         d.country || 'India',
        panNumber:       d.panNumber ? encryptIfPresent(d.panNumber.toUpperCase()) : null,
        panNumberHash:   d.panNumber ? blindIndex(d.panNumber.toUpperCase()) : null,
        profileComplete: true,
      },
    });

    await auditLog(userId, 'profile_update', 'Company profile updated', req);
    res.json({ success: true, message: 'Profile updated successfully.', user: buildUserResponse(user) });
  } catch (err: any) {
    if (err.code === 'P2002') {
      const rawField = err.meta?.target?.[0] || 'field';
      const hashFieldMap: Record<string, string> = {
        gstin_hash: 'gstin',
        mobile_hash: 'mobile',
        pan_number_hash: 'panNumber',
      };
      const field = hashFieldMap[rawField] || rawField;
      return res.status(409).json({ success: false, field, message: `${field} already exists.` });
    }
    next(err);
  }
}
function validatePassword(password: string, username: string, email: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must contain at least 1 uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must contain at least 1 lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain at least 1 number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain at least 1 special character.";
  if (/\s/.test(password)) return "Password must not contain spaces.";
  if (password.toLowerCase() === username.toLowerCase()) return "Password cannot equal username.";
  if (password.toLowerCase() === email.toLowerCase()) return "Password cannot equal email.";
  return null;
}

export async function activateAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ success: false, message: 'Token and password required.' });

    // Validate token
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const activationToken = await prisma.activationToken.findUnique({ where: { tokenHash } });

    if (!activationToken) return res.status(400).json({ success: false, message: 'Invalid token.' });
    if (activationToken.usedAt) return res.status(400).json({ success: false, message: 'Token already used.' });
    if (activationToken.expiresAt < new Date()) return res.status(400).json({ success: false, message: 'Token expired.' });

    const user = await prisma.user.findUnique({ where: { id: activationToken.userId } });
    if (!user || user.status !== 'activation_pending') {
      return res.status(400).json({ success: false, message: 'Invalid account state.' });
    }

    // Pass policy check (basic example, frontend does the rest)
    const passError = validatePassword(password, user.username, user.email);
      if (passError) return res.status(400).json({ success: false, message: passError });

    const hashed = await bcrypt.hash(password, 12);
    
    // Perform updates
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { password: hashed, status: 'active' } }),
      prisma.activationToken.update({ where: { id: activationToken.id }, data: { usedAt: new Date() } })
    ]);

    await auditLog(user.id, 'ACCOUNT_ACTIVATED', 'User activated account', req);
    res.json({ success: true, message: 'Account activated successfully.' });
  } catch (err) { next(err); }
}


// --- Phase 6.2 Methods ---

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { usernameOrEmail } = req.body;
    if (!usernameOrEmail) return res.status(400).json({ success: false, message: 'Username or email required.' });

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: usernameOrEmail },
          { email: usernameOrEmail }
        ]
      }
    });

    res.json({ success: true, message: 'If an account matches the information provided, a password reset link has been sent.' });

    if (!user) return;

    const crypto = require('crypto');
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() }
    });

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt }
    });

    await auditLog(user.id, 'PASSWORD_RESET_REQUESTED', 'Password reset requested via API', req);

    const { sendPasswordResetEmail } = require('../services/emailService');
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${rawToken}`;
    await sendPasswordResetEmail(user.email, user.companyName, resetUrl);
  } catch (err) { next(err); }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ success: false, message: 'Token and new password required.' });

    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!resetToken) return res.status(400).json({ success: false, message: 'Invalid or expired token.', code: 'INVALID_TOKEN' });
    if (resetToken.usedAt) return res.status(400).json({ success: false, message: 'Token has already been used.', code: 'USED_TOKEN' });
    if (resetToken.expiresAt < new Date()) return res.status(400).json({ success: false, message: 'Token has expired.', code: 'EXPIRED_TOKEN' });

    const user = resetToken.user;
    
    const passError = validatePassword(password, user.username, user.email);
    if (passError) return res.status(400).json({ success: false, message: passError });

    const hashed = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashed, forcePasswordChange: false, failedLoginAttempts: 0, lockedUntil: null }
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() }
      }),
      prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() }
      })
    ]);

    await auditLog(user.id, 'PASSWORD_RESET_COMPLETED', 'Password reset successfully', req);
    await auditLog(user.id, 'ALL_SESSIONS_REVOKED', 'All sessions revoked due to password reset', req);

    res.json({ success: true, message: 'Password has been reset successfully.' });
  } catch (err) { next(err); }
}

export async function revokeAllSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    await auditLog(userId, 'ALL_SESSIONS_REVOKED', 'User manually revoked all other sessions', req);
    res.json({ success: true, message: 'All sessions have been revoked.' });
  } catch(err) { next(err); }
}
