import { PrismaClient } from '@prisma/client';

export class GstReturnLockedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GstReturnLockedError';
    }
}

export async function assertGstPeriodOpen(userId: number, targetDate: Date | string, customPrismaClient?: any) {
    const db = customPrismaClient || new PrismaClient();
    const dateObj = new Date(targetDate);
    
    const month = dateObj.getMonth() + 1;
    const year = dateObj.getFullYear();
    
    const filedReturns = await db.gstReturn.findFirst({
        where: {
            userId,
            periodMonth: month,
            periodYear: year,
            status: 'FILED'
        }
    });

    if (filedReturns) {
        throw new GstReturnLockedError('GST_RETURN_LOCKED: Transaction is included in a filed GST return and cannot be modified.');
    }
}
