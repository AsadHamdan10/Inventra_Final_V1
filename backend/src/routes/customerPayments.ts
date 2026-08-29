import { requireFinancialYearContext } from '../middlewares/financialYearContext';
import { Router } from 'express';
import { requireTenant } from '../middlewares/auth';
import {
  addCustomerPayment,
  allocateCustomerPayment,
  cancelCustomerPayment,
  getCustomerLedger,
  updateOpeningBalance, getOutstanding,
  listCustomerPayments,
  getCustomerPayment,
} from '../controllers/customerLedgerController';

const router = Router();
router.use(requireTenant);

router.get('/', listCustomerPayments);
router.get('/:id', getCustomerPayment);
router.post('/', addCustomerPayment);
router.post('/:id/allocate', allocateCustomerPayment);
router.post('/:id/cancel', cancelCustomerPayment);
router.get('/customer/:id/ledger', requireFinancialYearContext, getCustomerLedger);
router.post('/customer/:id/opening-balance', updateOpeningBalance);

router.get('/outstanding/summary', getOutstanding);
export default router;
