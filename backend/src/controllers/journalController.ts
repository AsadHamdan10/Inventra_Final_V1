import { Request, Response, NextFunction } from 'express';
import {
  createDraftJournal,
  updateDraftJournal,
  getJournal,
  listJournals,
  postJournal,
  cancelJournal
} from '../services/accounting/journalService';

export async function createJournalApi(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const entry = await createDraftJournal(userId, req.body, userId);
    res.status(201).json(entry);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
}

export async function updateJournalApi(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);
    const entry = await updateDraftJournal(userId, id, req.body, userId);
    res.json(entry);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
}

export async function getJournalApi(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);
    const entry = await getJournal(userId, id);
    if (!entry) return res.status(404).json({ error: 'Journal not found' });
    res.json(entry);
  } catch (error: any) {
    next(error);
  }
}

export async function listJournalsApi(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const fyContext = req.financialYearContext; 
    const entries = await listJournals(userId, fyContext);
    res.json(entries);
  } catch (error: any) {
    next(error);
  }
}

export async function postJournalApi(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);
    const entry = await postJournal(userId, id, userId);
    res.json(entry);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
}

export async function cancelJournalApi(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);
    const entry = await cancelJournal(userId, id, userId);
    res.json(entry);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
}
