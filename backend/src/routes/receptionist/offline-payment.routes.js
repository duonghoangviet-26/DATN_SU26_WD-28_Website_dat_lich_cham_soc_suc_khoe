import { Router } from 'express'
import {
  createOfflineInvoice,
  confirmOfflinePayment,
  cancelOfflinePayment,
  getOfflineInvoice,
  listOfflineQueues,
  listRelatedServices,
} from '../../controllers/receptionist/offline-payment.controller.js'

const router = Router()

router.get('/', listOfflineQueues)
router.get('/services', listRelatedServices)
router.patch('/:queueId/payments/:paymentId/confirm', confirmOfflinePayment)
router.patch('/:queueId/payments/:paymentId/cancel', cancelOfflinePayment)
router.get('/:queueId/invoice', getOfflineInvoice)
router.post('/:queueId/invoice', createOfflineInvoice)

export default router
