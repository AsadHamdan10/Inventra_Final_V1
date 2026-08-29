import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { 
    listQuotations, 
    getQuotation, 
    createQuotation, 
    updateQuotation, 
    finalizeQuotation, 
    cancelQuotation, 
    convertQuotationToSale,
    createDeliveryChallanFromQuotation
} from '../controllers/quotationController';

const router = Router();

router.use(requireAuth);

router.get('/', listQuotations);
router.get('/:id', getQuotation);
router.post('/', createQuotation);
router.put('/:id', updateQuotation);
router.post('/:id/finalize', finalizeQuotation);
router.post('/:id/cancel', cancelQuotation);
router.post('/:id/convert-to-sale', convertQuotationToSale);
router.post('/:id/create-delivery-challan', createDeliveryChallanFromQuotation);

export default router;
