import { Router } from 'express'
import { listRecords, getRecord, updateAppointmentContact } from '../../controllers/patient/records.controller.js'

const router = Router()

router.get('/',    listRecords)
router.get('/:id', getRecord)
router.patch('/:id/contact', updateAppointmentContact)

export default router
