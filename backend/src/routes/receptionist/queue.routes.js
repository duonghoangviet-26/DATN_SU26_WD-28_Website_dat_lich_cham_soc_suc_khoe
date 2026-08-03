import { Router } from 'express'
import queueController from '../../controllers/receptionist/queue.controller.js'

const router = Router()

router.patch('/:id/transfer', queueController.transferQueue)
router.patch('/:id/cancel', queueController.cancelQueue)

export default router
