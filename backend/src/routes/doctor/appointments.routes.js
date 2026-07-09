import { Router } from 'express'
import * as appointments from '../../controllers/doctor/appointments.controller.js'

const router = Router()

router.get('/',                  appointments.list)
router.get('/pending-results',   appointments.listPendingResults) // phải đứng trước '/:id'
router.get('/:id',               appointments.getById)
router.patch('/:id/confirm',     appointments.confirm)
router.patch('/:id/cancel',      appointments.cancel)
router.patch('/:id/complete',    appointments.complete)
router.get('/:id/result',        appointments.getResult)
router.post('/:id/result',       appointments.createResult)
router.put('/:id/result',        appointments.updateResult)
router.patch('/:id/result/confirm',          appointments.confirmResult)
router.patch('/:id/result/request-revision', appointments.requestResultRevision)

export default router
