import { Router } from 'express';
import { requireAuth, requireTenant, requireAdminOrSuperAdmin } from '../middlewares/auth';
import {
  initCOA,
  listCOA,
  getCOA,
  createCOA,
  updateCOA,
  deactivateCOA
} from '../controllers/coaController';

const router = Router();

router.use(requireAuth);
router.use(requireTenant);

router.post('/initialize', requireAdminOrSuperAdmin, initCOA);
router.get('/', listCOA);
router.get('/:id', getCOA);
router.post('/', requireAdminOrSuperAdmin, createCOA);
router.put('/:id', requireAdminOrSuperAdmin, updateCOA);
router.post('/:id/deactivate', requireAdminOrSuperAdmin, deactivateCOA);

export default router;
