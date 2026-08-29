import { Request, Response, NextFunction } from 'express';
import { EWayBillService } from '../services/ewaybill/eWayBillService';
import { auditLog } from '../services/auditService';
import prisma from '../utils/prisma';

const eWayBillService = new EWayBillService();

export class EWayBillController {
  static async generate(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.userId;
      const { sourceType, sourceId, transportData } = req.body;

      await auditLog(userId, 'EWAYBILL_GENERATION_STARTED', `Generating EWayBill for ${sourceType} ${sourceId}`, req);
      
      const ewb = await eWayBillService.generate(userId, sourceType, sourceId, transportData);
      
      if (ewb.status === 'GENERATED') {
        await auditLog(userId, 'EWAYBILL_GENERATED', `Generated EWayBill ${ewb.ewbNo} for ${sourceType} ${sourceId}`, req);
        res.json(ewb);
      } else {
        await auditLog(userId, 'EWAYBILL_GENERATION_FAILED', `Failed EWayBill for ${sourceType} ${sourceId}`, req);
        res.status(400).json({ error: ewb.errorDetails || 'Generation failed', ewb });
      }
    } catch (error: any) {
      next(error);
    }
  }

  static async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.userId;
      const id = parseInt(req.params.id);
      const { reason } = req.body;

      await auditLog(userId, 'EWAYBILL_CANCELLATION_STARTED', `Cancelling EWayBill ${id}`, req);
      const ewb = await eWayBillService.cancel(userId, id, reason);
      await auditLog(userId, 'EWAYBILL_CANCELLED', `Cancelled EWayBill ${id}`, req);
      
      res.json(ewb);
    } catch (error: any) {
      next(error);
    }
  }

  static async updatePartB(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.userId;
      const id = parseInt(req.params.id);
      const { transportData } = req.body;

      const ewb = await eWayBillService.updatePartB(userId, id, transportData);
      await auditLog(userId, 'EWAYBILL_PART_B_UPDATED', `Updated Part B for EWayBill ${id}`, req);
      
      res.json(ewb);
    } catch (error: any) {
      next(error);
    }
  }

  static async extendValidity(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.userId;
      const id = parseInt(req.params.id);
      const { extensionData } = req.body;

      const ewb = await eWayBillService.extendValidity(userId, id, extensionData);
      await auditLog(userId, 'EWAYBILL_VALIDITY_EXTENDED', `Extended EWayBill ${id}`, req);
      
      res.json(ewb);
    } catch (error: any) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.userId;
      const id = parseInt(req.params.id);
      
      const ewb = await prisma.eWayBill.findUnique({ where: { id } });
      if (!ewb) return res.status(404).json({ error: 'Not found' });
      if (ewb.userId !== userId) return res.status(403).json({ error: 'Tenant mismatch' });
      
      res.json(ewb);
    } catch (error: any) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.userId;
      const ewbs = await prisma.eWayBill.findMany({ where: { userId } });
      res.json(ewbs);
    } catch (error: any) {
      next(error);
    }
  }
}
