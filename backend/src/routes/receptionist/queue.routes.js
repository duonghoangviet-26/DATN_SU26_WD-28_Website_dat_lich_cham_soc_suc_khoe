import { Router } from 'express'
import queueController from '../../controllers/receptionist/queue.controller.js'

const router = Router()

router.patch('/:id/transfer', queueController.transferQueue)

export default router
