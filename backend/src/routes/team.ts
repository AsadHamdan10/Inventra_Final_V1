import { Router } from 'express';
import { requireTenant, requireTenantOwner } from '../middlewares/auth';
import { listTeam, createTeamMember, setTeamMemberStatus } from '../controllers/teamController';

const router = Router();

// Both the tenant owner and staff sessions can view the team roster.
router.get('/', requireTenant, listTeam);

// Only the tenant's own login (never a staff seat) can add or disable team members.
router.post('/', requireTenantOwner, createTeamMember);
router.patch('/:id/status', requireTenantOwner, setTeamMemberStatus);

export default router;
