import { Request, Response } from 'express';
import { 
    getReconciliationSummary, getTrialBalance, getGeneralLedger, getProfitAndLossFromGL, getBalanceSheet, 
    reconcileSales, reconcilePurchases, reconcileCustomerPayments, reconcileVendorPayments, reconcileExpenses, 
    reconcileSalesReturns, reconcilePurchaseReturns, reconcileInventory, reconcileGST, 
    reconcileCustomerSubLedger, reconcileVendorSubLedger, findOrphanJournals, findMissingJournals, findDuplicateJournals 
} from '../services/accounting/reconciliationService';

export const getSummary = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const fyId = req.financialYearContext?.id;
        const result = await getReconciliationSummary(userId, fyId);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getTrialBalanceReport = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const fyId = req.financialYearContext?.id;
        const result = await getTrialBalance(userId, fyId);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getGLReport = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const fyId = req.financialYearContext?.id;
        const accountId = Number(req.params.accountId);
        if (isNaN(accountId)) return res.status(400).json({ error: 'Invalid account ID' });
        
        const skip = Number(req.query.skip) || 0;
        const take = Number(req.query.take) || 100;

        const result = await getGeneralLedger(userId, accountId, fyId, skip, take);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getProfitLossReport = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const fyId = req.financialYearContext?.id;
        const result = await getProfitAndLossFromGL(userId, fyId);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getBalanceSheetReport = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const fyId = req.financialYearContext?.id;
        const result = await getBalanceSheet(userId, fyId);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// Reconciliations
const createReconHandler = (fn: any) => async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const fyId = req.financialYearContext?.id;
        const result = await fn(userId, fyId);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getSalesRecon = createReconHandler(reconcileSales);
export const getPurchasesRecon = createReconHandler(reconcilePurchases);
export const getCustomerPaymentsRecon = createReconHandler(reconcileCustomerPayments);
export const getVendorPaymentsRecon = createReconHandler(reconcileVendorPayments);
export const getExpensesRecon = createReconHandler(reconcileExpenses);
export const getSalesReturnsRecon = createReconHandler(reconcileSalesReturns);
export const getPurchaseReturnsRecon = createReconHandler(reconcilePurchaseReturns);
export const getInventoryRecon = createReconHandler(reconcileInventory);
export const getGstRecon = createReconHandler(reconcileGST);
export const getCustomerSubLedgerRecon = createReconHandler(reconcileCustomerSubLedger);
export const getVendorSubLedgerRecon = createReconHandler(reconcileVendorSubLedger);

export const getOrphans = async (req: Request, res: Response) => {
    try { res.json(await findOrphanJournals(req.user!.userId)); } 
    catch (error: any) { res.status(500).json({ error: error.message }); }
};

export const getMissing = async (req: Request, res: Response) => {
    try { res.json(await findMissingJournals(req.user!.userId, req.financialYearContext?.id)); } 
    catch (error: any) { res.status(500).json({ error: error.message }); }
};

export const getDuplicates = async (req: Request, res: Response) => {
    try { res.json(await findDuplicateJournals(req.user!.userId)); } 
    catch (error: any) { res.status(500).json({ error: error.message }); }
};
