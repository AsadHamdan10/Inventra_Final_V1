

routes_content = """import { Router } from 'express';
import { requireSuperAdmin } from '../middlewares/auth';
import { 
  getAdminDashboard, 
  listApplications, 
  getApplicationDetail, 
  approveApplication, 
  rejectApplication, 
  resendActivation,
  listCompanies,
  getCompanyDetail,
  suspendCompany,
  reactivateCompany,
  sendPasswordReset,
  getAdminSecurity,
  getSubscriptions,
  getAuditLogs
} from '../controllers/adminController';

const router = Router();
router.use(requireSuperAdmin);

router.get('/dashboard', getAdminDashboard);

// Applications
router.get('/applications', listApplications);
router.get('/applications/:id', getApplicationDetail);
router.post('/users/:id/approve', approveApplication); // kept for backward compat with frontend mostly, though id is userId
router.post('/users/:id/reject', rejectApplication);
router.post('/users/:id/resend-activation', resendActivation);

// Companies (Tenants)
router.get('/companies', listCompanies);
router.get('/companies/:id', getCompanyDetail);
router.post('/users/:id/suspend', suspendCompany);
router.post('/users/:id/reactivate', reactivateCompany);
router.post('/users/:id/send-password-reset', sendPasswordReset);

// Subscriptions
router.get('/subscriptions', getSubscriptions);

// Security & Audit
router.get('/security', getAdminSecurity);
router.get('/audit-logs', getAuditLogs);

export default router;
"""

with open("backend/src/routes/admin.ts", "w", encoding="utf-8") as f:
    f.write(routes_content)

controller_content = """import crypto from "crypto";
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { auditLog } from '../services/auditService';

// Safely exclude sensitive fields from User object
function exclude<User, Key extends keyof User>(user: User, keys: Key[]): Omit<User, Key> {
  const result = { ...user };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

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

    res.json({ 
      tenants: { totalActive, pending, activationPending, suspended, rejected },
      recentLogs 
    });
  } catch (err) { next(err); }
}

export async function listApplications(req: Request, res: Response, next: NextFunction) {
  try {
    const apps = await prisma.applicationSnapshot.findMany({
      include: {
        user: { select: { status: true, id: true } }
      },
      where: {
        user: { status: { in: ['pending', 'activation_pending', 'rejected'] } }
      },
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

export async function listCompanies(req: Request, res: Response, next: NextFunction) {
  try {
    const companies = await prisma.user.findMany({
      where: { role: { not: 'super_admin' }, status: { in: ['active', 'suspended'] } },
      select: { 
        id: true, companyName: true, tradingName: true, email: true, mobile: true, status: true, plan: true, createdAt: true 
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(companies);
  } catch (err) { next(err); }
}

export async function getCompanyDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id, role: { not: 'super_admin' } },
      include: {
        applicationSnapshot: true,
        tenantConfig: true
      }
    });

    if (!user) return res.status(404).json({ message: 'Tenant not found' });

    // Aggregate ERP info safely
    const [sales, purchases, items, warehouses, journals] = await Promise.all([
      prisma.sale.count({ where: { userId: id } }).catch(() => 0),
      prisma.purchase.count({ where: { userId: id } }).catch(() => 0),
      prisma.item.count({ where: { userId: id } }).catch(() => 0),
      prisma.warehouse.count({ where: { userId: id } }).catch(() => 0),
      prisma.journalEntry.count({ where: { userId: id } }).catch(() => 0),
    ]);

    const erpOverview = { sales, purchases, items, warehouses, journals };
    const safeUser = exclude(user, ['password', 'mobileHash', 'gstinHash', 'panNumberHash']);

    res.json({ company: safeUser, erpOverview });
  } catch (err) { next(err); }
}

export async function approveApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id); // userId
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.status !== "pending") {
      return res.status(400).json({ success: false, message: "User is not pending." });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await prisma.activationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() } 
    });

    await prisma.activationToken.create({
      data: { userId: user.id, tokenHash, expiresAt }
    });

    await prisma.user.update({ where: { id }, data: { status: "activation_pending" } });
    
    // Update snapshot reviewedAt
    await prisma.applicationSnapshot.update({ 
      where: { userId: id }, 
      data: { reviewedAt: new Date(), reviewedBy: req.user!.userId } 
    });

    await auditLog(req.user!.userId, "ADMIN_APPLICATION_APPROVED", `Application for User #${id} approved`, req);

    const { sendApprovalNotification } = require("../services/emailService");
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const activationLink = `${frontendUrl}/activate?token=${rawToken}`;
    await sendApprovalNotification(user.email, user.companyName, user.applicationRef, activationLink);

    res.json({ success: true, message: "Application approved and activation email sent." });
  } catch (err) { next(err); }
}

export async function rejectApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;
    
    if (!reason || reason.trim() === '') return res.status(400).json({ success: false, message: "Reason is required." });

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.status !== "pending") {
      return res.status(400).json({ success: false, message: "User is not pending." });
    }

    await prisma.user.update({ where: { id }, data: { status: "rejected", rejectionReason: reason } });
    await prisma.applicationSnapshot.update({ 
      where: { userId: id }, 
      data: { rejectionReason: reason, originalStatus: 'rejected', reviewedAt: new Date(), reviewedBy: req.user!.userId } 
    });

    await auditLog(req.user!.userId, "ADMIN_APPLICATION_REJECTED", `Application #${id} rejected: ${reason}`, req);
    
    const { sendRejectionNotification } = require("../services/emailService");
    await sendRejectionNotification(user.email, user.companyName, reason);

    res.json({ success: true, message: "Application rejected and email sent." });
  } catch (err) { next(err); }
}

export async function resendActivation(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.status !== "activation_pending") {
      return res.status(400).json({ success: false, message: "User is not pending activation." });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await prisma.activationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() }
    });

    await prisma.activationToken.create({
      data: { userId: user.id, tokenHash, expiresAt }
    });

    await auditLog(req.user!.userId, "ADMIN_ACTIVATION_RESENT", `Activation resent for User #${id}`, req);

    const { sendApprovalNotification } = require("../services/emailService");
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const activationLink = `${frontendUrl}/activate?token=${rawToken}`;
    await sendApprovalNotification(user.email, user.companyName, user.applicationRef, activationLink);

    res.json({ success: true, message: "Activation email resent." });
  } catch (err) { next(err); }
}

export async function suspendCompany(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;
    if (!reason || reason.trim() === '') return res.status(400).json({ success: false, message: "Suspension reason is required." });

    await prisma.user.update({ where: { id }, data: { status: 'suspended' } });
    // Invalidate all active sessions for this user so they are immediately kicked out
    await prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() }
    });

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

export async function sendPasswordReset(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    // Invalidate old tokens
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() }
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt }
    });

    const { sendPasswordResetEmail } = require('../services/emailService');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;
    await sendPasswordResetEmail(user.email, user.fullName || user.username, resetLink);

    await auditLog(req.user!.userId, 'ADMIN_PASSWORD_RESET_REQUESTED', `Admin requested password reset for User #${id}`, req);

    res.json({ success: true, message: 'Password reset email sent securely.' });
  } catch (err) { next(err); }
}

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
      orderBy: { createdAt: 'desc' }, take: limit, skip: (page-1)*limit,
      include: { user: { select: { companyName: true, username: true } } },
    });
    const total = await prisma.auditLog.count();
    res.json({ logs, total, page, limit });
  } catch (err) { next(err); }
}
"""

with open("backend/src/controllers/adminController.ts", "w", encoding="utf-8") as f:
    f.write(controller_content)
