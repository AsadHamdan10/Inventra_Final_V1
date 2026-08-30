import { Router } from 'express';
import { requireAuth, requireTenantOwner } from '../middlewares/auth';
import {
  getMe,
  updateProfile,
} from '../controllers/authController';

const router = Router();

// Current logged-in user
router.get('/me', requireAuth, getMe);

// Update company profile
// Phase 6.10I fix: this duplicate endpoint (the canonical one is
// PUT /auth/profile) was still guarded by requireAuth only, which lets a
// staff (TenantUser) session reach it even though the owner-only intent
// is enforced everywhere else via requireTenantOwner. No frontend caller
// targets this route (verified via repo-wide grep), but it must not be
// left as an unauthenticated-for-staff backdoor.
router.put('/profile', requireTenantOwner, updateProfile);

export default router;