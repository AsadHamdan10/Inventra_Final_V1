import { Request, Response } from 'express';
import { 
    getOutwardSupplyRegister, getCreditNoteRegister, getHSNSummary, getGSTSummary,
    getGSTR1Dataset, getGSTR3BSummary, reconcileGSTWithGL, getWarnings, getMonthlyTrend
} from '../services/gst/gstComplianceService';

export const getOutwardSupply = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const fyId = req.financialYearContext?.id;
        const result = await getOutwardSupplyRegister(userId, fyId);
        res.json(result);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
};

export const getCreditNotes = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const fyId = req.financialYearContext?.id;
        const result = await getCreditNoteRegister(userId, fyId);
        res.json(result);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
};

export const getHSN = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const fyId = req.financialYearContext?.id;
        const result = await getHSNSummary(userId, fyId);
        res.json(result);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
};

export const getSummary = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const fyId = req.financialYearContext?.id;
        const result = await getGSTSummary(userId, fyId);
        res.json(result);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
};

export const getGSTR1 = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const fyId = req.financialYearContext?.id;
        const result = await getGSTR1Dataset(userId, fyId);
        res.json(result);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
};

export const getGSTR3B = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const fyId = req.financialYearContext?.id;
        const result = await getGSTR3BSummary(userId, fyId);
        res.json(result);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
};

export const getReconciliation = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const fyId = req.financialYearContext?.id;
        const result = await reconcileGSTWithGL(userId, fyId);
        res.json(result);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
};

export const getComplianceWarnings = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const fyId = req.financialYearContext?.id;
        const result = await getWarnings(userId, fyId);
        res.json(result);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
};

export const getTrend = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const fyId = req.financialYearContext?.id;
        const result = await getMonthlyTrend(userId, fyId);
        res.json(result);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
};
