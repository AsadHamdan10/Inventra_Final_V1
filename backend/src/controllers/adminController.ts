import crypto from "crypto";
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { auditLog } from '../services/auditService';
import { safeDecrypt } from '../utils/crypto';

// Safely exclude sensitive fields from User object
function exclude<User, Key extends keyof User>(user: User, keys: Key[]): Omit<User, Key> {
  const result = { ...user } as any;
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

// ─── Helper: calculate days remaining for subscription ───────────────────────
function calcDaysRemaining(endDate: Date | null | undefined): number | null {
  if (!endDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return Math.floor((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Helper: expiry sort priority (lower = more urgent) ──────────────────────
function expiryPriority(days: number | null): number {
  if (days === null) return 99; // NO SUBSCRIPTION / PENDING (lowest priority)
  if (days < 0) return 0; // EXPIRED
  if (days <= 7) return 1; // URGENT
  if (days <= 30) return 2; // EXPIRING SOON
  return 3; // ACTIVE
}

// ─── Admin Dashboard ─────────────────────────────────────────────────────────
export async function getAdminDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const [totalActive, pending, activationPending, suspended, rejected] = await Promise.all([
      prisma.user.count({ where: { role: { not: 'super_admin' }, status: 'active' } }),
      prisma.user.count({ where: { role: { not: 'super_admin' }, status: 'pending' } }),
      prisma.user.count({ where: { role: { not: 'super_admin' }, status: 'activation_pending' } }),
      prisma.user.count({ where: { role: { not: 'super_admin' }, status: 'suspended' } }),
      prisma.user.count({ where: { role: { not: 'super_admin' }, status: 'rejected' } })
    ]);

    const recentLogs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { select: { companyName: true, username: true } } }
    });

    res.json({ tenants: { totalActive, pending, activationPending, suspended, rejected }, recentLogs });
  } catch (err) { next(err); }
}

// ─── Applications ─────────────────────────────────────────────────────────────
export async function listApplications(req: Request, res: Response, next: NextFunction) {
  try {
    const apps = await prisma.applicationSnapshot.findMany({
      include: { user: { select: { status: true, id: true } } },
      where: { user: { status: { in: ['pending', 'activation_pending', 'rejected'] } } },
      orderBy: { submittedAt: 'desc' }
    });
    res.json(apps);
  } catch (err) { next(err); }
}

export async function getApplicationDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const app = await prisma.applicationSnapshot.findUnique({
      where: { id },
      include: { user: { select: { status: true, id: true } } }
    });
    if (!app) return res.status(404).json({ message: 'Application not found' });
    res.json(app);
  } catch (err) { next(err); }
}

// ─── Companies ────────────────────────────────────────────────────────────────
export async function listCompanies(req: Request, res: Response, next: NextFunction) {
  try {
    const companies = await prisma.user.findMany({
      where: { role: { not: 'super_admin' } },
      select: {
        id: true, companyName: true, tradingName: true, email: true,
        mobile: true, status: true, plan: true,
        subscriptionStart: true, subscriptionEnd: true, createdAt: true,
        saasSubscriptions: {
          where: { status: { not: 'CANCELLED' } },
          include: { plan: true, payments: true },
          orderBy: { startDate: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const enhanced = companies.map(c => {
      const latestSub = (c as any).saasSubscriptions?.[0];
      const totalPaid = latestSub?.payments?.reduce((s: number, p: any) => s + Number(p.amountReceived), 0) ?? 0;
      const outstanding = latestSub ? Number(latestSub.finalAmount) - totalPaid : 0;
      // Payment status is derived from actual amounts paid, never from the
      // SaaSSubscription.status field (which is a payment-progress marker,
      // not a true subscription lifecycle state) or a stale User column.
      let paymentStatus: string;
      if (!latestSub) paymentStatus = 'NOT_APPLICABLE';
      else if (latestSub.status === 'CANCELLED') paymentStatus = 'CANCELLED';
      else if (totalPaid >= Number(latestSub.finalAmount)) paymentStatus = 'PAID';
      else if (totalPaid > 0) paymentStatus = 'PARTIALLY_PAID';
      else paymentStatus = 'UNPAID';
      // Days remaining must come from the authoritative SaaSSubscription.endDate,
      // never from the legacy/duplicate User.subscriptionEnd column, which can
      // drift out of sync with the real subscription record.
      const daysRemaining = calcDaysRemaining(latestSub?.endDate ?? null);

      return {
        ...c,
        mobile: c.mobile ? (safeDecrypt(c.mobile) || c.mobile) : null,
        saasSubscriptions: undefined,
        currentSubscription: latestSub ? {
          id: latestSub.id,
          planName: latestSub.plan?.name,
          planCode: latestSub.plan?.code,
          finalAmount: latestSub.finalAmount,
          status: latestSub.status,
          startDate: latestSub.startDate,
          endDate: latestSub.endDate,
          totalPaid,
          outstanding,
          paymentStatus,
        } : null,
        daysRemaining,
        expiryPriority: expiryPriority(daysRemaining),
      };
    });

    // Sort: EXPIRED -> URGENT (<= 7d) -> EXPIRING_SOON (<= 30d) -> ACTIVE -> PENDING
    enhanced.sort((a, b) => {
      if (a.expiryPriority !== b.expiryPriority) return a.expiryPriority - b.expiryPriority;
      const daysA = a.daysRemaining !== null ? a.daysRemaining : 9999;
      const daysB = b.daysRemaining !== null ? b.daysRemaining : 9999;
      return daysA - daysB;
    });

    res.json(enhanced);
  } catch (err) { next(err); }
}

export async function getCompanyDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id, role: { not: 'super_admin' } },
      include: {
        applicationSnapshot: true,
        tenantConfig: true,
        saasSubscriptions: {
          include: {
            plan: true,
            payments: {
              include: { commissions: true, recordedByUser: { select: { username: true, companyName: true } } },
              orderBy: { paymentDate: 'asc' }
            }
          },
          orderBy: { startDate: 'asc' }
        }
      }
    });

    if (!user) return res.status(404).json({ message: 'Tenant not found' });

    const [sales, purchases, items, warehouses, journals] = await Promise.all([
      prisma.sale.count({ where: { userId: id } }).catch(() => 0),
      prisma.purchase.count({ where: { userId: id } }).catch(() => 0),
      prisma.material.count({ where: { userId: id } }).catch(() => 0),
      prisma.warehouse.count({ where: { userId: id } }).catch(() => 0),
      prisma.journalEntry.count({ where: { userId: id } }).catch(() => 0),
    ]);

    const erpOverview = { sales, purchases, items, warehouses, journals };
    const safeUser = exclude(user, ['password', 'mobileHash', 'gstinHash', 'panNumberHash']);

    // Decrypt all encrypted PII for Super Admin
    if (safeUser.mobile) safeUser.mobile = safeDecrypt(safeUser.mobile) || safeUser.mobile;
    if (safeUser.gstin) safeUser.gstin = safeDecrypt(safeUser.gstin) || safeUser.gstin;
    if (safeUser.panNumber) safeUser.panNumber = safeDecrypt(safeUser.panNumber) || safeUser.panNumber;
    if (safeUser.addressLine1) safeUser.addressLine1 = safeDecrypt(safeUser.addressLine1) || safeUser.addressLine1;
    if (safeUser.addressLine2) safeUser.addressLine2 = safeDecrypt(safeUser.addressLine2) || safeUser.addressLine2;
    if (safeUser.city) safeUser.city = safeDecrypt(safeUser.city) || safeUser.city;
    if (safeUser.district) safeUser.district = safeDecrypt(safeUser.district) || safeUser.district;
    if (safeUser.state) safeUser.state = safeDecrypt(safeUser.state) || safeUser.state;
    if (safeUser.pincode) safeUser.pincode = safeDecrypt(safeUser.pincode) || safeUser.pincode;

    // Enhance each subscription with calculated financial fields
    const enhancedSubscriptions = (user as any).saasSubscriptions?.map((sub: any) => {
      const totalPaid = sub.payments.reduce((sum: number, p: any) => sum + Number(p.amountReceived), 0);
      const outstanding = Number(sub.finalAmount) - totalPaid;
      const daysRemaining = calcDaysRemaining(sub.endDate);
      let paymentStatus = 'UNPAID';
      if (totalPaid >= Number(sub.finalAmount)) paymentStatus = 'PAID';
      else if (totalPaid > 0) paymentStatus = 'PARTIALLY_PAID';
      return { ...sub, totalPaid, outstanding, paymentStatus, daysRemaining };
    });

    res.json({ company: { ...safeUser, subscriptions: enhancedSubscriptions }, erpOverview });
  } catch (err) { next(err); }
}

// ─── Approve Application (Auto-Creates Subscription) ─────────────────────────
export async function approveApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id); // userId
    const user = await prisma.user.findUnique({
      where: { id },
      include: { applicationSnapshot: true }
    });

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Idempotency: already approved states
    if (user.status === 'activation_pending' || user.status === 'active') {
      return res.json({ success: true, message: 'Application already approved.', alreadyApproved: true });
    }

    if (user.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Cannot approve user with status: ${user.status}` });
    }

    // BACKEND-AUTHORITATIVE plan lookup — ignore any frontend plan/price.
    // Phase 6.10H: the applicant chose a SPECIFIC plan (duration/platform/price)
    // at registration, and its code was snapshotted onto user.plan at that time
    // (see authController.register's derivedPlanCode). Approval must honor that
    // exact plan, not just re-derive "the" default plan for the business type —
    // there can be several active plans per business type (annual, monthly,
    // discounted, mobile-only, etc.) and picking the wrong one is exactly the
    // bug this fixes: an applicant who registered under a ₹999 plan was being
    // silently switched to the legacy ₹3,499 default on approval.
    const snap = user.applicationSnapshot as any;
    const businessType: string = snap?.businessType || 'TRADING';

    let plan = user.plan
      ? await prisma.saaSPlan.findUnique({ where: { code: user.plan } })
      : null;

    // Fallback only for pre-6.10H applications where user.plan was never set,
    // or references a plan code that no longer exists.
    if (!plan) {
      plan = await prisma.saaSPlan.findFirst({
        where: { status: 'ACTIVE', businessType },
        orderBy: { finalPrice: 'asc' },
      });
    }
    if (!plan) {
      const legacyCode = businessType === 'BOTH' ? 'TRADING_MANUFACTURING_ANNUAL' : 'TRADING_ANNUAL';
      plan = await prisma.saaSPlan.findUnique({ where: { code: legacyCode } });
    }
    if (!plan) {
      return res.status(500).json({ success: false, message: `No plan could be resolved for this application (registered plan: ${user.plan || 'none'}, business type: ${businessType}). Contact system administrator.` });
    }

    const listPrice = Number(plan.listPrice || plan.annualPrice);
    const discountAmount = Number(plan.discountAmount || 0);
    const finalAmount = Math.max(0, listPrice - discountAmount);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 24);

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + plan.durationMonths);
    endDate.setDate(endDate.getDate() - 1); // end = start + plan duration - 1 day (e.g. 29 Aug 2026 → 28 Aug 2027 for 12 months)

    await prisma.$transaction(async (tx) => {
      // Expire old activation tokens
      await tx.activationToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() }
      });

      // New activation token
      await tx.activationToken.create({
        data: { userId: user.id, tokenHash, expiresAt: tokenExpiresAt }
      });

      // Update status
      await tx.user.update({ where: { id }, data: { status: 'activation_pending' } });

      // Mark snapshot as reviewed
      await tx.applicationSnapshot.update({
        where: { userId: id },
        data: { reviewedAt: new Date(), reviewedBy: req.user!.userId }
      });

      // Bug fix: nothing was ever writing TenantConfiguration.businessType from
      // the approved plan/application - it only ever got lazily created with
      // its hardcoded TRADING default (see tenantConfigService.getTenantConfiguration),
      // which meant requireManufacturingEntitlement could NEVER pass for ANY
      // tenant, including ones legitimately approved on a Trading + Manufacturing
      // plan. This is the one place that must set it, since it's the one place
      // that knows the authoritative resolved plan.
      const tenantBusinessType = plan.businessType === 'BOTH' ? 'BOTH' : 'TRADING';
      await tx.tenantConfiguration.upsert({
        where: { userId: id },
        create: {
          userId: id,
          businessType: tenantBusinessType,
          enabledModules: JSON.stringify(
            tenantBusinessType === 'BOTH'
              ? ['TRADING', 'MANUFACTURING', 'INVENTORY', 'ACCOUNTING']
              : ['TRADING', 'INVENTORY', 'ACCOUNTING']
          ),
        },
        update: { businessType: tenantBusinessType },
      });

      // Auto-create SaaSSubscription — idempotent (skip if non-cancelled sub already exists)
      const existingSub = await tx.saaSSubscription.findFirst({
        where: { userId: id, status: { not: 'CANCELLED' } }
      });

      if (!existingSub) {
        await tx.saaSSubscription.create({
          data: {
            userId: id,
            planId: plan.id,
            status: 'UNPAID',
            startDate,
            endDate,
            listPrice,
            discountAmount,
            finalAmount,
            platformAccess: plan.platformAccess,
            durationMonths: plan.durationMonths,
            includedUsers: plan.includedUsers,
            notes: `Auto-created on approval. Business type: ${businessType}`
          }
        });
        await tx.user.update({
          where: { id },
          data: { plan: plan.code, subscriptionStart: startDate, subscriptionEnd: endDate }
        });
      }
    });

    await auditLog(req.user!.userId, 'ADMIN_APPLICATION_APPROVED',
      `Application for User #${id} approved. Plan: ${plan.code} @ ₹${finalAmount} (${plan.durationMonths}mo, ${plan.includedUsers} users, ${plan.platformAccess})`, req);

    const { sendApprovalNotification } = require('../services/emailService');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const activationLink = `${frontendUrl}/activate?token=${rawToken}`;
    await sendApprovalNotification(user.email, user.companyName, user.applicationRef, activationLink);

    res.json({
      success: true,
      message: `Application approved. ${plan.name} subscription created (₹${finalAmount}, UNPAID). Activation email sent.`,
      plan: { code: plan.code, name: plan.name, price: finalAmount }
    });
  } catch (err) { next(err); }
}

// ─── Reject Application ───────────────────────────────────────────────────────
export async function rejectApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;

    if (!reason || reason.trim() === '') return res.status(400).json({ success: false, message: 'Reason is required.' });

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'User is not pending.' });
    }

    await prisma.user.update({ where: { id }, data: { status: 'rejected', rejectionReason: reason } });
    await prisma.applicationSnapshot.update({
      where: { userId: id },
      data: { rejectionReason: reason, originalStatus: 'rejected', reviewedAt: new Date(), reviewedBy: req.user!.userId }
    });

    await auditLog(req.user!.userId, 'ADMIN_APPLICATION_REJECTED', `Application #${id} rejected: ${reason}`, req);

    const { sendRejectionNotification } = require('../services/emailService');
    await sendRejectionNotification(user.email, user.companyName, reason);

    res.json({ success: true, message: 'Application rejected and email sent.' });
  } catch (err) { next(err); }
}

// ─── Resend Activation ────────────────────────────────────────────────────────
export async function resendActivation(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.status !== 'activation_pending') {
      return res.status(400).json({ success: false, message: 'User is not pending activation.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await prisma.activationToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    await prisma.activationToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

    await auditLog(req.user!.userId, 'ADMIN_ACTIVATION_RESENT', `Activation resent for User #${id}`, req);

    const { sendApprovalNotification } = require('../services/emailService');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const activationLink = `${frontendUrl}/activate?token=${rawToken}`;
    await sendApprovalNotification(user.email, user.companyName, user.applicationRef, activationLink);

    res.json({ success: true, message: 'Activation email resent.' });
  } catch (err) { next(err); }
}

// ─── Suspend / Reactivate ─────────────────────────────────────────────────────
export async function suspendCompany(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;
    if (!reason || reason.trim() === '') return res.status(400).json({ success: false, message: 'Suspension reason is required.' });

    await prisma.user.update({ where: { id }, data: { status: 'suspended' } });
    await prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });

    await auditLog(req.user!.userId, 'ADMIN_TENANT_SUSPENDED', `Tenant #${id} suspended. Reason: ${reason}`, req);
    res.json({ message: 'Tenant suspended and active sessions revoked.' });
  } catch (err) { next(err); }
}

export async function reactivateCompany(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    await prisma.user.update({ where: { id }, data: { status: 'active' } });
    await auditLog(req.user!.userId, 'ADMIN_TENANT_REACTIVATED', `Tenant #${id} reactivated`, req);
    res.json({ message: 'Tenant reactivated successfully.' });
  } catch (err) { next(err); }
}

// ─── Password Reset ───────────────────────────────────────────────────────────
export async function sendPasswordReset(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() }
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

    const { sendPasswordResetEmail } = require('../services/emailService');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;
    await sendPasswordResetEmail(user.email, user.fullName || user.username, resetLink);

    await auditLog(req.user!.userId, 'ADMIN_PASSWORD_RESET_REQUESTED', `Admin requested password reset for User #${id}`, req);
    res.json({ success: true, message: 'Password reset email sent securely.' });
  } catch (err) { next(err); }
}

// ─── Security & Audit ─────────────────────────────────────────────────────────
export async function getAdminSecurity(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.user!.userId;
    const admin = await prisma.user.findUnique({
      where: { id },
      select: { username: true, email: true, failedLoginAttempts: true, lastFailedLogin: true, lockedUntil: true, createdAt: true }
    });
    const recentSecurityEvents = await prisma.auditLog.findMany({
      where: { action: { in: ['admin_login_failed', 'admin_login_success', 'admin_sessions_revoked'] } },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    res.json({ account: admin, recentSecurityEvents });
  } catch (err) { next(err); }
}

export async function getSubscriptions(req: Request, res: Response, next: NextFunction) {
  try {
    const subscriptions = await prisma.user.findMany({
      where: { role: { not: 'super_admin' }, status: 'active' },
      select: { id: true, companyName: true, plan: true, subscriptionStart: true, subscriptionEnd: true },
      orderBy: { subscriptionEnd: 'asc' }
    });
    res.json(subscriptions);
  } catch (err) { next(err); }
}

export async function getAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string || '1');
    const limit = 50;
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' }, take: limit, skip: (page - 1) * limit,
      include: { user: { select: { companyName: true, username: true } } },
    });
    const total = await prisma.auditLog.count();
    res.json({ logs, total, page, limit });
  } catch (err) { next(err); }
}
