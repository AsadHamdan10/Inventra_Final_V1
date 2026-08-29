import { Router } from 'express';
import { requireTenant } from '../middlewares/auth';
import {
    listPurchaseReturns,
    getPurchaseReturn,
    createPurchaseReturn,
    updatePurchaseReturn,
    finalizePurchaseReturn,
    cancelPurchaseReturn
} from '../controllers/purchaseReturnController';

const router = Router();

router.use(requireTenant);

router.get('/', listPurchaseReturns);
router.get('/:id', getPurchaseReturn);
router.post('/', createPurchaseReturn);
router.put('/:id', updatePurchaseReturn);
router.post('/:id/finalize', finalizePurchaseReturn);
router.post('/:id/cancel', cancelPurchaseReturn);

export default router;
