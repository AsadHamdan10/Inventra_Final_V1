import prisma from '../../utils/prisma';
import { GstFilingPeriodService } from './gstFilingPeriodService';
import { Gstr1PreparationService } from './gstr1PreparationService';
import { Gstr3bPreparationService } from './gstr3bPreparationService';
import { GstReconciliationService } from './gstReconciliationService';
import { GstSnapshotService } from './gstSnapshotService';
import { MockGstProvider } from './mockGstProvider';

export class GstFilingService {
  private provider = new MockGstProvider();

  public async prepareReturn(userId: number, returnType: string, month: number, year: number) {
    const { startDate, endDate } = GstFilingPeriodService.getPeriodBoundaries(month, year);
    
    let payload;
    let errors: string[] = [];

    if (returnType === 'GSTR1') {
      const data = await Gstr1PreparationService.prepare(userId, startDate, endDate);
      payload = data;
      errors = data.errors;
    } else if (returnType === 'GSTR3B') {
      payload = await Gstr3bPreparationService.prepare(userId, startDate, endDate);
    } else {
      throw new Error('Unsupported return type');
    }

    const snapshotHash = GstSnapshotService.generateHash(payload);

    const gstReturn = await prisma.gstReturn.upsert({
      where: {
        userId_returnType_periodMonth_periodYear: { userId, returnType, periodMonth: month, periodYear: year }
      },
      create: {
        userId,
        returnType,
        periodMonth: month,
        periodYear: year,
        status: 'DRAFT',
        payload: JSON.stringify(payload),
        snapshotHash,
        errorDetails: errors.length > 0 ? JSON.stringify(errors) : null
      },
      update: {
        // Only update if it's not filed
      }
    });

    if (gstReturn.status === 'FILED') {
      throw new Error('Cannot prepare a return that is already FILED.');
    }

    if (gstReturn.status !== 'DRAFT') {
        // If it was already in another state, doing a fresh prepare overrides it to DRAFT.
        return await prisma.gstReturn.update({
            where: { id: gstReturn.id },
            data: {
                status: 'DRAFT',
                payload: JSON.stringify(payload),
                snapshotHash,
                errorDetails: errors.length > 0 ? JSON.stringify(errors) : null
            }
        });
    }

    return gstReturn;
  }

  public async reconcileReturn(userId: number, id: number) {
    const gstReturn = await prisma.gstReturn.findUnique({ where: { id } });
    if (!gstReturn || gstReturn.userId !== userId) throw new Error('Not found');
    if (gstReturn.status === 'FILED') throw new Error('Return already filed');

    const { startDate, endDate } = GstFilingPeriodService.getPeriodBoundaries(gstReturn.periodMonth, gstReturn.periodYear);
    const recResult = await GstReconciliationService.reconcile(userId, startDate, endDate);

    if (recResult.status === 'PASS') {
      return await prisma.gstReturn.update({ where: { id }, data: { status: 'RECONCILED' } });
    } else {
      return await prisma.gstReturn.update({ where: { id }, data: { errorDetails: JSON.stringify(recResult.errors) } });
    }
  }

  public async markReadyToFile(userId: number, id: number) {
    const gstReturn = await prisma.gstReturn.findUnique({ where: { id } });
    if (!gstReturn || gstReturn.userId !== userId) throw new Error('Not found');
    if (gstReturn.status === 'FILED') throw new Error('Return already filed');
    if (gstReturn.errorDetails && JSON.parse(gstReturn.errorDetails).length > 0) throw new Error('Cannot mark ready with unresolved errors');

    return await prisma.gstReturn.update({ where: { id }, data: { status: 'READY_TO_FILE' } });
  }

  public async fileReturn(userId: number, id: number, simulateError?: string) {
    const gstReturn = await prisma.gstReturn.findUnique({ where: { id } });
    if (!gstReturn || gstReturn.userId !== userId) throw new Error('Not found');
    if (gstReturn.status === 'FILED') throw new Error('Return already filed');
    
    // Stale snapshot check
    const { startDate, endDate } = GstFilingPeriodService.getPeriodBoundaries(gstReturn.periodMonth, gstReturn.periodYear);
    let freshPayload;
    if (gstReturn.returnType === 'GSTR1') {
        freshPayload = await Gstr1PreparationService.prepare(userId, startDate, endDate);
    } else {
        freshPayload = await Gstr3bPreparationService.prepare(userId, startDate, endDate);
    }
    const freshHash = GstSnapshotService.generateHash(freshPayload);
    
    if (freshHash !== gstReturn.snapshotHash) {
        await prisma.gstReturn.update({ where: { id }, data: { status: 'DRAFT', errorDetails: JSON.stringify(['Stale snapshot detected. Source records have changed.']) }});
        throw new Error('Stale snapshot detected. Source records have changed. Return moved back to DRAFT.');
    }

    await prisma.gstReturn.update({ where: { id }, data: { status: 'FILING' } });

    const payloadObj = JSON.parse(gstReturn.payload!);
    if (simulateError) payloadObj.simulateError = simulateError;

    let response;
    try {
      if (gstReturn.returnType === 'GSTR1') {
        response = await this.provider.fileGstr1(payloadObj);
      } else {
        response = await this.provider.fileGstr3b(payloadObj);
      }

      if (response.success) {
        return await prisma.gstReturn.update({
          where: { id },
          data: {
            status: 'FILED',
            ackNo: response.ackNo,
            filedAt: new Date(response.filedAt)
          }
        });
      } else {
        return await prisma.gstReturn.update({
          where: { id },
          data: { status: 'FAILED', errorDetails: JSON.stringify([response.error]) }
        });
      }
    } catch (e: any) {
      return await prisma.gstReturn.update({
        where: { id },
        data: { status: 'FAILED', errorDetails: JSON.stringify([e.message]) }
      });
    }
  }

  public async getList(userId: number) {
    return await prisma.gstReturn.findMany({ where: { userId }, orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }] });
  }

  public async getById(userId: number, id: number) {
    return await prisma.gstReturn.findUnique({ where: { id, userId } });
  }
}
