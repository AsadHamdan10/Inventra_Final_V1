import { Router } from 'express';
import { EInvoiceController } from '../controllers/eInvoiceController';
import { requireAuth } from '../middlewares/auth';

const router = Router();

router.use(requireAuth);

router.post('/sale/:saleId/generate', EInvoiceController.generateForSale);
router.post('/return/:returnId/generate', EInvoiceController.generateForReturn);
router.post('/:id/retry', EInvoiceController.retryFailed);
router.post('/:id/cancel', EInvoiceController.cancel);

router.get('/sale/:saleId', EInvoiceController.getBySale);
router.get('/return/:returnId', EInvoiceController.getByReturn);

export default router;
