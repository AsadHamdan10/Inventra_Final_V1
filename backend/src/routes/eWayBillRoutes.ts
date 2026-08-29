import { Router } from 'express';
import { EWayBillController } from '../controllers/eWayBillController';
import { requireAuth, requireAdminOrSuperAdmin } from '../middlewares/auth';

const router = Router();

router.use(requireAuth);

router.post('/generate', requireAdminOrSuperAdmin, EWayBillController.generate);
router.post('/:id/cancel', requireAdminOrSuperAdmin, EWayBillController.cancel);
router.post('/:id/part-b', requireAdminOrSuperAdmin, EWayBillController.updatePartB);
router.post('/:id/extend', requireAdminOrSuperAdmin, EWayBillController.extendValidity);
router.get('/:id', EWayBillController.getById);
router.get('/', EWayBillController.list);

export default router;
