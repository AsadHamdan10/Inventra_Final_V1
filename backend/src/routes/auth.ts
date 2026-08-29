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

import { requireAuth } from '../middlewares/auth';

const router = Router();

router.post('/login', loginRateLimiter, login);
router.post('/register', register);
router.post('/refresh', refreshToken);
router.post('/logout', requireAuth, logout);

router.put('/change-password', requireAuth, changePassword);

router.get('/me', requireAuth, getMe);
router.put('/profile', requireAuth, updateProfile);

router.post('/activate', activateAccount);

// Phase 6.2
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/revoke-all-sessions', requireAuth, revokeAllSessions);

export default router;
