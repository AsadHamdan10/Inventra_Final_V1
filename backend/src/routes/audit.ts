import { Router } from 'express';
import { requireTenantOwner, requireSuperAdmin } from '../middlewares/auth';
import { getAuditLogs } from '../services/auditService';
const router = Router();
// Phase 6.10H Part 2 - the audit trail covers every login on the tenant's
// account (owner and staff alike); only the owner should be able to review it.
router.get('/', requireTenantOwner, async (req, res, next) => {
  try {
    const logs = await getAuditLogs(req.user!.userId, 50, 0);
    res.json(logs);
  } catch (err) { next(err); }
});
export default router;
