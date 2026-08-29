import { PrismaClient } from '@prisma/client';
import { EInvoicePayloadService } from './eInvoicePayloadService';
import { EInvoiceValidationService } from './eInvoiceValidationService';
import { MockIrpProvider } from './providers/mockIrpProvider';
import { IEInvoiceProvider } from './providers/IEInvoiceProvider';

const prisma = new PrismaClient();

export class EInvoiceService {
  private provider: IEInvoiceProvider;

  constructor() {
    this.provider = new MockIrpProvider();
  }

  async generateForSale(userId: number, saleId: number) {
    // 1. Load Sale
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true, user: true }
    });

    if (!sale) throw new Error('Sale not found');
    if (sale.userId !== userId) throw new Error('Tenant mismatch');
    if (sale.status === 'CANCELLED') throw new Error('Cannot generate E-Invoice for cancelled sale');

    // 2. Check existing EInvoice
    let eInvoice = await prisma.eInvoice.findUnique({
      where: { saleId }
    });

    if (eInvoice) {
      if (eInvoice.status === 'GENERATED') return eInvoice;
      if (eInvoice.status === 'GENERATING') throw new Error('Generation already in progress');
      if (eInvoice.status === 'CANCELLED') throw new Error('Cannot regenerate a cancelled E-Invoice');
    }

    // 3. Create or update to GENERATING
    if (!eInvoice) {
      eInvoice = await prisma.eInvoice.create({
        data: {
          userId,
          saleId,
          status: 'GENERATING'
        }
      });
    } else {
      eInvoice = await prisma.eInvoice.update({
        where: { id: eInvoice.id },
        data: { status: 'GENERATING', attemptCount: eInvoice.attemptCount + 1, lastAttemptAt: new Date() }
      });
    }

    // 4. Build Payload
    const payload = EInvoicePayloadService.buildSalePayload(sale, sale.items, sale.user);
    
    // 5. Validate Payload
    const validationErrors = EInvoiceValidationService.validatePayload(payload);
    if (validationErrors.length > 0) {
      const failedInvoice = await prisma.eInvoice.update({
        where: { id: eInvoice.id },
        data: {
          status: 'FAILED',
          errorDetails: JSON.stringify(validationErrors)
        }
      });
      return failedInvoice;
    }

    // 6. Call Provider
    try {
      const response = await this.provider.generateInvoice(payload);

      if (response.success) {
        // Mark GENERATED
        return await prisma.eInvoice.update({
          where: { id: eInvoice.id },
          data: {
            status: 'GENERATED',
            irn: response.irn,
            ackNo: response.ackNo,
            ackDate: response.ackDate,
            qrCode: response.qrCode,
            signedInvoice: response.signedInvoice,
            generatedAt: new Date(),
            governmentResponse: JSON.stringify(response.governmentResponse),
            errorDetails: null
          }
        });
      } else {
        // Mark FAILED
        return await prisma.eInvoice.update({
          where: { id: eInvoice.id },
          data: {
            status: 'FAILED',
            errorDetails: response.errorDetails,
            governmentResponse: JSON.stringify(response.governmentResponse)
          }
        });
      }
    } catch (error: any) {
      // Mark FAILED on throw
      return await prisma.eInvoice.update({
        where: { id: eInvoice.id },
        data: {
          status: 'FAILED',
          errorDetails: error.message || 'Unknown provider error'
        }
      });
    }
  }

  async generateForSalesReturn(userId: number, returnId: number) {
    // 1. Load SalesReturn
    const salesReturn = await prisma.salesReturn.findUnique({
      where: { id: returnId },
      include: { items: true, user: true, sale: true }
    });

    if (!salesReturn) throw new Error('SalesReturn not found');
    if (salesReturn.userId !== userId) throw new Error('Tenant mismatch');
    if (salesReturn.status === 'CANCELLED') throw new Error('Cannot generate E-Invoice for cancelled return');

    // 2. Check existing
    let eInvoice = await prisma.eInvoice.findUnique({
      where: { salesReturnId: returnId }
    });

    if (eInvoice) {
      if (eInvoice.status === 'GENERATED') return eInvoice;
      if (eInvoice.status === 'GENERATING') throw new Error('Generation already in progress');
      if (eInvoice.status === 'CANCELLED') throw new Error('Cannot regenerate a cancelled E-Invoice');
    }

    if (!eInvoice) {
      eInvoice = await prisma.eInvoice.create({
        data: { userId, salesReturnId: returnId, status: 'GENERATING' }
      });
    } else {
      eInvoice = await prisma.eInvoice.update({
        where: { id: eInvoice.id },
        data: { status: 'GENERATING', attemptCount: eInvoice.attemptCount + 1, lastAttemptAt: new Date() }
      });
    }

    const payload = EInvoicePayloadService.buildSalesReturnPayload(salesReturn, salesReturn.items, salesReturn.sale, salesReturn.user);
    const validationErrors = EInvoiceValidationService.validatePayload(payload);
    
    if (validationErrors.length > 0) {
      return await prisma.eInvoice.update({
        where: { id: eInvoice.id },
        data: { status: 'FAILED', errorDetails: JSON.stringify(validationErrors) }
      });
    }

    try {
      const response = await this.provider.generateInvoice(payload);

      if (response.success) {
        return await prisma.eInvoice.update({
          where: { id: eInvoice.id },
          data: {
            status: 'GENERATED',
            irn: response.irn,
            ackNo: response.ackNo,
            ackDate: response.ackDate,
            qrCode: response.qrCode,
            signedInvoice: response.signedInvoice,
            generatedAt: new Date(),
            governmentResponse: JSON.stringify(response.governmentResponse),
            errorDetails: null
          }
        });
      } else {
        return await prisma.eInvoice.update({
          where: { id: eInvoice.id },
          data: {
            status: 'FAILED',
            errorDetails: response.errorDetails,
            governmentResponse: JSON.stringify(response.governmentResponse)
          }
        });
      }
    } catch (error: any) {
      return await prisma.eInvoice.update({
        where: { id: eInvoice.id },
        data: { status: 'FAILED', errorDetails: error.message || 'Unknown provider error' }
      });
    }
  }

  async cancelEInvoice(userId: number, id: number, reason: string) {
    const eInvoice = await prisma.eInvoice.findUnique({ where: { id } });
    if (!eInvoice) throw new Error('EInvoice not found');
    if (eInvoice.userId !== userId) throw new Error('Tenant mismatch');
    
    if (eInvoice.status === 'CANCELLED') return eInvoice; // Idempotent
    if (eInvoice.status !== 'GENERATED') throw new Error('Can only cancel GENERATED E-Invoice');
    if (!eInvoice.irn) throw new Error('No IRN to cancel');

    await prisma.eInvoice.update({
      where: { id },
      data: { status: 'CANCEL_REQUESTED' }
    });

    try {
      const response = await this.provider.cancelInvoice(eInvoice.irn, reason);

      if (response.success) {
        return await prisma.eInvoice.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            cancelDate: response.cancelDate || new Date(),
            cancelReason: reason,
            governmentResponse: JSON.stringify(response.governmentResponse)
          }
        });
      } else {
        // Revert back to GENERATED if cancellation fails? Or stay CANCEL_REQUESTED?
        // Staying in CANCEL_REQUESTED allows manual retry.
        return await prisma.eInvoice.update({
          where: { id },
          data: {
            errorDetails: response.errorDetails
          }
        });
      }
    } catch (error: any) {
      return await prisma.eInvoice.update({
        where: { id },
        data: { errorDetails: error.message }
      });
    }
  }

  async getEInvoiceBySale(userId: number, saleId: number) {
    const inv = await prisma.eInvoice.findUnique({ where: { saleId } });
    if (inv && inv.userId !== userId) throw new Error('Tenant mismatch');
    return inv;
  }

  async getEInvoiceByReturn(userId: number, returnId: number) {
    const inv = await prisma.eInvoice.findUnique({ where: { salesReturnId: returnId } });
    if (inv && inv.userId !== userId) throw new Error('Tenant mismatch');
    return inv;
  }
}
