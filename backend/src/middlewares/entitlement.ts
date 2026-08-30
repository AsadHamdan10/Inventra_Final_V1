import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';

/**
 * requireManufacturingEntitlement — Phase 6.10H.
 *
 * Blocks manufacturing endpoints (BOM, Work Centers, Routings, Production
 * Orders) for tenants whose business type is TRADING only. Previously
 * TenantConfiguration.businessType was stored at registration/approval time
 * but never actually read by any route or middleware — a TRADING tenant
 * could call every manufacturing API directly with no backend check at all.
 * This is the enforcement side of that stored configuration; it must sit on
 * every manufacturing route, not just be relied on for hiding frontend menus.
 */
export async function requireManufacturingEntitlement(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required.' });

    const config = await prisma.tenantConfiguration.findUnique({ where: { userId } });
    const businessType = config?.businessType || 'TRADING';

    if (businessType !== 'BOTH' && businessType !== 'MANUFACTURING') {
      return res.status(403).json({
        error: 'Manufacturing modules are not included in your current plan.',
        detail: 'Your subscription is Trading only. Upgrade to a Trading + Manufacturing plan to access this feature.',
      });
    }
    next();
  } catch (e) { next(e); }
}
