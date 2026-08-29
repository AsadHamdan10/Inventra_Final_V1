import { Router } from 'express';
import { requireAuth, requireAdminOrSuperAdmin } from '../middlewares/auth';
import { listFinancialYears, closePeriodEndpoint, reopenPeriodEndpoint, closeYearEndpoint } from '../controllers/financialPeriodController';

const router = Router();

router.use(requireAuth);

router.get('/', listFinancialYears);
router.post('/periods/:id/close', requireAdminOrSuperAdmin, closePeriodEndpoint);
router.post('/periods/:id/reopen', requireAdminOrSuperAdmin, reopenPeriodEndpoint);
router.post('/years/:id/close', requireAdminOrSuperAdmin, closeYearEndpoint);

export default router;
