import { Request, Response } from 'express';
import { EInvoiceService } from '../services/einvoice/eInvoiceService';
import { auditLog } from '../services/auditService';

const eInvoiceService = new EInvoiceService();

export class EInvoiceController {
  
  static async generateForSale(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const saleId = parseInt(req.params.saleId, 10);
      
      await auditLog(userId, 'EINVOICE_GENERATION_STARTED', `Starting generation for Sale ${saleId}`, req);
      
      const invoice = await eInvoiceService.generateForSale(userId, saleId);
      
      if (invoice.status === 'GENERATED') {
        await auditLog(userId, 'EINVOICE_GENERATED', `Generated IRN ${invoice.irn} for Sale ${saleId}`, req);
      } else if (invoice.status === 'FAILED') {
        await auditLog(userId, 'EINVOICE_GENERATION_FAILED', `Failed to generate for Sale ${saleId}`, req);
      }
      
      return res.status(200).json(invoice);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async generateForReturn(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const returnId = parseInt(req.params.returnId, 10);
      
      await auditLog(userId, 'EINVOICE_GENERATION_STARTED', `Starting generation for Return ${returnId}`, req);
      
      const invoice = await eInvoiceService.generateForSalesReturn(userId, returnId);
      
      if (invoice.status === 'GENERATED') {
        await auditLog(userId, 'EINVOICE_GENERATED', `Generated IRN ${invoice.irn} for Return ${returnId}`, req);
      } else if (invoice.status === 'FAILED') {
        await auditLog(userId, 'EINVOICE_GENERATION_FAILED', `Failed to generate for Return ${returnId}`, req);
      }
      
      return res.status(200).json(invoice);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async retryFailed(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const id = parseInt(req.params.id, 10);
      
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      const existing = await prisma.eInvoice.findUnique({ where: { id } });
      
      if (!existing || existing.userId !== userId) throw new Error('EInvoice not found');
      if (existing.status !== 'FAILED') throw new Error('Can only retry FAILED invoices');
      
      await auditLog(userId, 'EINVOICE_RETRY', `Retrying EInvoice ${id}`, req);
      
      let invoice;
      if (existing.saleId) {
        invoice = await eInvoiceService.generateForSale(userId, existing.saleId);
      } else if (existing.salesReturnId) {
        invoice = await eInvoiceService.generateForSalesReturn(userId, existing.salesReturnId);
      } else {
        throw new Error('Invalid EInvoice record');
      }
      
      if (invoice.status === 'GENERATED') {
        await auditLog(userId, 'EINVOICE_GENERATED', `Generated IRN ${invoice.irn} on retry`, req);
      }
      
      return res.status(200).json(invoice);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async cancel(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const id = parseInt(req.params.id, 10);
      const { reason } = req.body;
      
      if (!reason) throw new Error('Cancellation reason is required');
      
      await auditLog(userId, 'EINVOICE_CANCEL_REQUESTED', `Requesting cancel for ${id}`, req);
      
      const invoice = await eInvoiceService.cancelEInvoice(userId, id, reason);
      
      if (invoice.status === 'CANCELLED') {
        await auditLog(userId, 'EINVOICE_CANCELLED', `Cancelled IRN ${invoice.irn}`, req);
      }
      
      return res.status(200).json(invoice);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async getBySale(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const saleId = parseInt(req.params.saleId, 10);
      const invoice = await eInvoiceService.getEInvoiceBySale(userId, saleId);
      return res.status(200).json(invoice || { status: 'NOT_GENERATED' });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async getByReturn(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const returnId = parseInt(req.params.returnId, 10);
      const invoice = await eInvoiceService.getEInvoiceByReturn(userId, returnId);
      return res.status(200).json(invoice || { status: 'NOT_GENERATED' });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }
}
