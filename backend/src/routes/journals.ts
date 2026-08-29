import { Router } from 'express';
import { requireAuth, requireTenant, requireAdminOrSuperAdmin } from '../middlewares/auth';
import {
  createJournalApi,
  updateJournalApi,
  getJournalApi,
  listJournalsApi,
  postJournalApi,
  cancelJournalApi
} from '../controllers/journalController';
import { requireFinancialYearContext } from '../middlewares/financialYearContext';

const router = Router();

router.use(requireAuth);
router.use(requireTenant);

router.get('/', requireFinancialYearContext, listJournalsApi);
router.get('/:id', getJournalApi);
router.post('/', requireAdminOrSuperAdmin, createJournalApi);
router.put('/:id', requireAdminOrSuperAdmin, updateJournalApi);
router.post('/:id/post', requireAdminOrSuperAdmin, postJournalApi);
router.post('/:id/cancel', requireAdminOrSuperAdmin, cancelJournalApi);

export default router;
