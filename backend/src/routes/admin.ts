import { Router } from 'express';
import { SaasController } from '../controllers/saasController';
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

// SaaS Billing (Phase 6.9)
router.get('/plans', SaasController.listPlans);
router.get('/subscriptions', SaasController.listSubscriptions);
router.post('/subscriptions', SaasController.createSubscription);
router.get('/subscriptions/:id', SaasController.getSubscription);
router.post('/subscriptions/:id/cancel', SaasController.cancelSubscription);
router.post('/subscriptions/:id/payments', SaasController.recordPayment);
router.post('/payments/:paymentId/commission', SaasController.recordCommission);
router.get('/revenue', SaasController.getRevenue);

// Security & Audit
router.get('/security', getAdminSecurity);
router.get('/audit-logs', getAuditLogs);

export default router;
