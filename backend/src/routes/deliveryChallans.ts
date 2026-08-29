import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { 
    listDeliveryChallans, 
    getDeliveryChallan, 
    createDeliveryChallan, 
    updateDeliveryChallan, 
    issueDeliveryChallan, 
    cancelDeliveryChallan, 
    invoiceDeliveryChallan 
} from '../controllers/deliveryChallanController';

const router = Router();

router.use(requireAuth);

router.get('/', listDeliveryChallans);
router.get('/:id', getDeliveryChallan);
router.post('/', createDeliveryChallan);
router.put('/:id', updateDeliveryChallan);
router.post('/:id/issue', issueDeliveryChallan);
router.post('/:id/cancel', cancelDeliveryChallan);
router.post('/:id/convert-to-sale', invoiceDeliveryChallan);

export default router;
