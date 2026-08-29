import { Request, Response, NextFunction } from 'express';
import {
  initializeDefaultCOA,
  getChartOfAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deactivateAccount
} from '../services/accounting/coaService';

export async function initCOA(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const result = await initializeDefaultCOA(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function listCOA(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const accounts = await getChartOfAccounts(userId);
    res.json(accounts);
  } catch (error) {
    next(error);
  }
}

export async function getCOA(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);
    const account = await getAccount(userId, id);
    if (!account) return res.status(404).json({ error: 'Account not found' });
    res.json(account);
  } catch (error) {
    next(error);
  }
}

export async function createCOA(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const account = await createAccount(userId, req.body, userId);
    res.status(201).json(account);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
}

export async function updateCOA(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);
    const account = await updateAccount(userId, id, req.body, userId);
    res.json(account);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
}

export async function deactivateCOA(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);
    const account = await deactivateAccount(userId, id, userId);
    res.json(account);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
}
