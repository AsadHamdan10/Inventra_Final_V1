import { Router } from 'express';
import { requireAuth, requireTenant } from '../middlewares/auth';
import { requireFinancialYearContext } from '../middlewares/financialYearContext';
import { 
    getSummary, getTrialBalanceReport, getGLReport, getProfitLossReport, getBalanceSheetReport,
    getSalesRecon, getPurchasesRecon, getCustomerPaymentsRecon, getVendorPaymentsRecon,
    getExpensesRecon, getSalesReturnsRecon, getPurchaseReturnsRecon, getInventoryRecon,
    getGstRecon, getCustomerSubLedgerRecon, getVendorSubLedgerRecon,
    getOrphans, getMissing, getDuplicates
} from '../controllers/reconciliationController';

const router = Router();

// Apply middleware
router.use(requireAuth);
router.use(requireTenant);
router.use(requireFinancialYearContext);

router.get('/summary', getSummary);
router.get('/trial-balance', getTrialBalanceReport);
router.get('/general-ledger/:accountId', getGLReport);
router.get('/profit-loss', getProfitLossReport);
router.get('/balance-sheet', getBalanceSheetReport);
router.get('/sales', getSalesRecon);
router.get('/purchases', getPurchasesRecon);
router.get('/customer-payments', getCustomerPaymentsRecon);
router.get('/vendor-payments', getVendorPaymentsRecon);
router.get('/expenses', getExpensesRecon);
router.get('/sales-returns', getSalesReturnsRecon);
router.get('/purchase-returns', getPurchaseReturnsRecon);
router.get('/inventory', getInventoryRecon);
router.get('/gst', getGstRecon);
router.get('/customer-subledger', getCustomerSubLedgerRecon);
router.get('/vendor-subledger', getVendorSubLedgerRecon);
router.get('/orphans', getOrphans);
router.get('/missing', getMissing);
router.get('/duplicates', getDuplicates);

export default router;
