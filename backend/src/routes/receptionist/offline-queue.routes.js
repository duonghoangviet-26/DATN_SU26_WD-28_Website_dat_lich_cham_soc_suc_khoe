import { Router } from 'express'
import offlineQueueController from '../../controllers/receptionist/offline-queue.controller.js'

const router = Router()

router.get('/', offlineQueueController.list)
router.get('/sessions-today', offlineQueueController.listToday)
router.get('/capacity', offlineQueueController.getCapacity)
router.post('/intake', offlineQueueController.intake)
router.get('/dispatch-suggestions', offlineQueueController.dispatchSuggestions)
router.get('/doctors', offlineQueueController.getDoctors)
router.post('/:id/assign', offlineQueueController.assign)
router.post('/:id/return-central', offlineQueueController.returnCentral)
router.patch('/:id/cancel', offlineQueueController.cancelCentral)

export default router
