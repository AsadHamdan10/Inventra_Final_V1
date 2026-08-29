import { Router } from 'express';
import { requireAuth, requireTenant } from '../middlewares/auth';
import { requireFinancialYearContext } from '../middlewares/financialYearContext';
import { 
    getOutwardSupply, getCreditNotes, getHSN, getSummary,
    getGSTR1, getGSTR3B, getReconciliation, getComplianceWarnings, getTrend
} from '../controllers/gstComplianceController';

const router = Router();

router.use(requireAuth);
router.use(requireTenant);
router.use(requireFinancialYearContext);

router.get('/outward', getOutwardSupply);
router.get('/credit-notes', getCreditNotes);
router.get('/hsn-summary', getHSN);
router.get('/summary', getSummary);
router.get('/gstr1', getGSTR1);
router.get('/gstr3b', getGSTR3B);
router.get('/reconciliation', getReconciliation);
router.get('/warnings', getComplianceWarnings);
router.get('/monthly-trend', getTrend);

export default router;
