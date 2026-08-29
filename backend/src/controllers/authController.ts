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
  };
}

// ── Login ──────────────────────────────────────────────────────
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Username and password are required.', message: 'Username and password are required.' });
    }

    const { username, password } = parsed.data;

    const user = await prisma.user.findFirst({
      where: { OR: [{ username }, { email: username }] },
    });

    if (!user) {
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
        plan:            d.plan,
        applicationSnapshot: {
          create: {
            applicationRef,
            fullName: d.fullName,
            companyName: d.companyName,
            username: d.username,
            email: d.email,
            mobile: d.mobile,
            businessType: d.businessType || "TRADING",
            industry: d.industry || "",
            plan: d.plan || "PROFESSIONAL",
            billingCycle: d.billingCycle || "YEARLY",
            originalStatus: "pending"
          }
        }
      }
    });

    await auditLog(user.id, "USER_REGISTERED", `Application ${applicationRef} submitted`, req);
    
    // Import dynamically to avoid circular issues or just require
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

    const accessToken = signAccessToken({ userId: user.id, role: user.role, companyName: user.companyName });
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
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json(buildUserResponse(user));
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
