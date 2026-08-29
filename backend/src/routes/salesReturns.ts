import { Router } from 'express';
import { requireTenant } from '../middlewares/auth';
import {
    listSalesReturns,
    getSalesReturn,
    createSalesReturn,
    updateSalesReturn,
    finalizeSalesReturn,
    cancelSalesReturn
} from '../controllers/salesReturnController';

const router = Router();

router.use(requireTenant);

router.get('/', listSalesReturns);
router.get('/:id', getSalesReturn);
router.post('/', createSalesReturn);
router.put('/:id', updateSalesReturn);
router.post('/:id/finalize', finalizeSalesReturn);
router.post('/:id/cancel', cancelSalesReturn);

export default router;
