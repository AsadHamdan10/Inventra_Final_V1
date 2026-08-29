import { Router } from 'express';
import { GstFilingController } from '../controllers/gstFilingController';
import { requireAuth, requireAdminOrSuperAdmin } from '../middlewares/auth';

const router = Router();

router.use(requireAuth);

router.post('/prepare', requireAdminOrSuperAdmin, GstFilingController.prepare);
router.post('/:id/reconcile', requireAdminOrSuperAdmin, GstFilingController.reconcile);
router.post('/:id/ready', requireAdminOrSuperAdmin, GstFilingController.markReady);
router.post('/:id/file', requireAdminOrSuperAdmin, GstFilingController.file);
router.post('/:id/regenerate', requireAdminOrSuperAdmin, GstFilingController.prepare); // Uses prepare logic

router.get('/', GstFilingController.list);
router.get('/:id', GstFilingController.get);

export default router;
