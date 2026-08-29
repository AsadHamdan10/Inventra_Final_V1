import { requireFinancialYearContext } from '../middlewares/financialYearContext';
import { Router } from 'express';
import { requireTenant } from '../middlewares/auth';
import {
  addVendorPayment,
  allocateVendorPayment,
  cancelVendorPayment,
  getVendorLedger,
  updateOpeningBalance, listVendorPayments, getVendorPayment, getOutstanding,
} from '../controllers/vendorLedgerController';

const router = Router();
router.use(requireTenant);

router.get('/', listVendorPayments);
router.get('/:id', getVendorPayment);
router.post('/', addVendorPayment);
router.post('/:id/allocate', allocateVendorPayment);
router.post('/:id/cancel', cancelVendorPayment);
router.get('/vendor/:id/ledger', requireFinancialYearContext, getVendorLedger);
router.post('/vendor/:id/opening-balance', updateOpeningBalance);

router.get('/outstanding/summary', getOutstanding);
export default router;
