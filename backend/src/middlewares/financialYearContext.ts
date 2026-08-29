import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

declare global {
  namespace Express {
    interface Request {
      financialYearContext?: {
        id: number;
        startDate: Date;
        endDate: Date;
        status: string;
      };
    }
  }
}

export async function requireFinancialYearContext(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { financialYearId } = req.query;

    let fy;

    if (financialYearId) {
      const id = parseInt(financialYearId as string, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid financialYearId.' });
      }
      fy = await prisma.financialYear.findFirst({
        where: { id, userId }
      });
      if (!fy) {
        return res.status(403).json({ error: 'Access denied or Financial Year not found.' });
      }
    } else {
      const today = new Date();
      fy = await prisma.financialYear.findFirst({
        where: {
          userId,
          startDate: { lte: today },
          endDate: { gt: today }
        }
      });
      if (!fy) {
        fy = await prisma.financialYear.findFirst({
          where: { userId },
          orderBy: { startDate: 'desc' }
        });
      }
      
      if (!fy) {
        return res.status(400).json({ error: 'No Financial Year configured for this tenant.' });
      }
    }

    req.financialYearContext = {
      id: fy.id,
      startDate: fy.startDate,
      endDate: fy.endDate,
      status: fy.status
    };

    next();
  } catch (err) {
    next(err);
  }
}
