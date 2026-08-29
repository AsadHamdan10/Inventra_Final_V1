import prisma from '../../utils/prisma';
import { EWayBillPayloadService } from './eWayBillPayloadService';
import { EWayBillValidationService } from './eWayBillValidationService';
import { MockEWayBillProvider } from './mockEWayBillProvider';

export class EWayBillService {
  private provider: MockEWayBillProvider;

  constructor() {
    this.provider = new MockEWayBillProvider();
  }

  async generate(userId: number, sourceType: 'SALE' | 'DELIVERY_CHALLAN' | 'SALES_RETURN', sourceId: number, transportData: any) {
    let ewb = await prisma.eWayBill.findUnique({
      where: sourceType === 'SALE' ? { saleId: sourceId } :
             sourceType === 'DELIVERY_CHALLAN' ? { deliveryChallanId: sourceId } :
             { salesReturnId: sourceId }
    });

    if (ewb) {
      if (ewb.userId !== userId) throw new Error('Tenant mismatch');
      if (ewb.status === 'GENERATED' || ewb.status === 'GENERATING') {
        return ewb; // Idempotency
      }
    }

    // Verify source exists and belongs to tenant
    if (sourceType === 'SALE') {
        const sale = await prisma.sale.findUnique({ where: { id: sourceId } });
        if (!sale || sale.userId !== userId) throw new Error('Invalid Sale or Tenant mismatch');
        if (sale.status === 'CANCELLED') throw new Error('Cannot generate E-Way Bill for cancelled sale');
    } else if (sourceType === 'DELIVERY_CHALLAN') {
        const dc = await prisma.deliveryChallan.findUnique({ where: { id: sourceId } });
        if (!dc || dc.userId !== userId) throw new Error('Invalid DC or Tenant mismatch');
    } else if (sourceType === 'SALES_RETURN') {
        const sr = await prisma.salesReturn.findUnique({ where: { id: sourceId } });
        if (!sr || sr.userId !== userId) throw new Error('Invalid Sales Return or Tenant mismatch');
    }

    if (!ewb) {
      ewb = await prisma.eWayBill.create({
        data: {
          userId,
          saleId: sourceType === 'SALE' ? sourceId : null,
          deliveryChallanId: sourceType === 'DELIVERY_CHALLAN' ? sourceId : null,
          salesReturnId: sourceType === 'SALES_RETURN' ? sourceId : null,
          status: 'GENERATING'
        }
      });
    } else {
      ewb = await prisma.eWayBill.update({
        where: { id: ewb.id },
        data: { status: 'GENERATING' }
      });
    }

    try {
      const payload = await EWayBillPayloadService.buildPayload(sourceType, sourceId, transportData);
      EWayBillValidationService.validatePayload(payload);
      
      const response = await this.provider.generateEWayBill(payload);
      
      if (response.success) {
        return await prisma.eWayBill.update({
          where: { id: ewb.id },
          data: {
            status: 'GENERATED',
            ewbNo: response.ewbNo,
            documentDate: new Date(payload.documentDate),
            validUntil: new Date(response.validUntil),
            responsePayload: JSON.stringify(response)
          }
        });
      } else {
        throw new Error(response.error);
      }
    } catch (error: any) {
      return await prisma.eWayBill.update({
        where: { id: ewb.id },
        data: {
          status: 'FAILED',
          errorDetails: error.message
        }
      });
    }
  }

  async cancel(userId: number, id: number, reason: string) {
    const ewb = await prisma.eWayBill.findUnique({ where: { id } });
    if (!ewb) throw new Error('E-Way Bill not found');
    if (ewb.userId !== userId) throw new Error('Tenant mismatch');
    if (ewb.status === 'CANCELLED') return ewb;
    if (ewb.status !== 'GENERATED') throw new Error('Only GENERATED E-Way Bills can be cancelled');

    const response = await this.provider.cancelEWayBill(ewb.ewbNo!, reason);
    if (!response.success) {
      throw new Error(response.error);
    }

    return await prisma.eWayBill.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(response.cancelDate),
        cancelReason: reason
      }
    });
  }

  async updatePartB(userId: number, id: number, transportData: any) {
    const ewb = await prisma.eWayBill.findUnique({ where: { id } });
    if (!ewb) throw new Error('E-Way Bill not found');
    if (ewb.userId !== userId) throw new Error('Tenant mismatch');
    if (ewb.status !== 'GENERATED') throw new Error('Only GENERATED E-Way Bills can update Part B');

    const response = await this.provider.updatePartB(ewb.ewbNo!, transportData);
    if (!response.success) throw new Error(response.error);

    return await prisma.eWayBill.update({
      where: { id },
      data: {
        vehicleNo: transportData.vehicleNo || ewb.vehicleNo,
        transporterId: transportData.transporterId || ewb.transporterId,
        transportMode: transportData.transportMode || ewb.transportMode,
        updatedAt: new Date()
      }
    });
  }

  async extendValidity(userId: number, id: number, extensionData: any) {
    const ewb = await prisma.eWayBill.findUnique({ where: { id } });
    if (!ewb) throw new Error('E-Way Bill not found');
    if (ewb.userId !== userId) throw new Error('Tenant mismatch');
    if (ewb.status !== 'GENERATED') throw new Error('Only GENERATED E-Way Bills can be extended');

    const response = await this.provider.extendValidity(ewb.ewbNo!, extensionData);
    if (!response.success) throw new Error(response.error);

    return await prisma.eWayBill.update({
      where: { id },
      data: {
        validUntil: new Date(response.validUntil),
        extendedAt: new Date(),
        extensionReason: extensionData.reason
      }
    });
  }
}
