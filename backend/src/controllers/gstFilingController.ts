import { Request, Response, NextFunction } from 'express';
import { GstFilingService } from '../services/gst/gstFilingService';
import { auditLog } from '../services/auditService';

const filingService = new GstFilingService();

export class GstFilingController {
  static async prepare(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { returnType, month, year } = req.body;
      const returnData = await filingService.prepareReturn(userId, returnType, Number(month), Number(year));
      await auditLog(userId, 'GST_RETURN_PREPARED', `Prepared ${returnType} for ${month}/${year}`, req);
      res.json(returnData);
    } catch (e) {
      next(e);
    }
  }

  static async reconcile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const id = parseInt(req.params.id);
      const returnData = await filingService.reconcileReturn(userId, id);
      await auditLog(userId, 'GST_RETURN_RECONCILED', `Reconciled Return ${id}`, req);
      res.json(returnData);
    } catch (e) {
      next(e);
    }
  }

  static async markReady(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const id = parseInt(req.params.id);
      const returnData = await filingService.markReadyToFile(userId, id);
      await auditLog(userId, 'GST_RETURN_MARKED_READY', `Return ${id} Ready`, req);
      res.json(returnData);
    } catch (e) {
      next(e);
    }
  }

  static async file(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const id = parseInt(req.params.id);
      const { simulateError } = req.body;
      
      await auditLog(userId, 'GST_RETURN_FILING_STARTED', `Filing Return ${id}`, req);
      const returnData = await filingService.fileReturn(userId, id, simulateError);
      
      if (returnData.status === 'FILED') {
        await auditLog(userId, 'GST_RETURN_FILED', `Successfully FILED Return ${id}`, req);
      } else {
        await auditLog(userId, 'GST_RETURN_FILING_FAILED', `Failed to file Return ${id}`, req);
      }
      
      res.json(returnData);
    } catch (e) {
      next(e);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const data = await filingService.getList(userId);
      res.json(data);
    } catch (e) {
      next(e);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const id = parseInt(req.params.id);
      const data = await filingService.getById(userId, id);
      res.json(data);
    } catch (e) {
      next(e);
    }
  }
}
