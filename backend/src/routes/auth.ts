import { Router } from 'express';

import {
  login,
  register,
  refreshToken,
  logout,
  changePassword,
  getMe,
  updateProfile, activateAccount, forgotPassword, resetPassword, revokeAllSessions,
  loginRateLimiter,
} from '../controllers/authController';

import { requireAuth, requireTenantOwner, requireNotStaff } from '../middlewares/auth';
import { PlanController } from '../controllers/planController';

const router = Router();

router.post('/login', loginRateLimiter, login);
router.post('/register', register);

// Public commercial catalog (Phase 6.10H) - unauthenticated, read-only.
// This is the single source registration and the public website read
// pricing from; it only ever returns ACTIVE plans and never the
// admin-only cost/status fields the Super Admin catalog exposes.
router.get('/plans', PlanController.listPublic);
router.post('/refresh', refreshToken);
router.post('/logout', requireAuth, logout);

router.put('/change-password', requireAuth, changePassword);

router.get('/me', requireAuth, getMe);
// Phase 6.10H Part 2 - company profile (GSTIN, address, legal name, etc.) belongs
// to the tenant, not any one login - only the tenant's own account may edit it.
router.put('/profile', requireTenantOwner, updateProfile);

router.post('/activate', activateAccount);

// Phase 6.2
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
// A staff session must not be able to log out the tenant owner (and every
// other staff member) by revoking all sessions under the shared tenant id.
router.post('/revoke-all-sessions', requireNotStaff, revokeAllSessions);

export default router;
