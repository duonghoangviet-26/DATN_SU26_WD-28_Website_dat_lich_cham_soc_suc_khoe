import { Router } from 'express'
import { listRecords, getRecord, updateAppointmentContact, listMedicalResults } from '../../controllers/patient/records.controller.js'

const router = Router()

router.get('/',    listRecords)
router.get('/medical-results', listMedicalResults)
router.get('/:id', getRecord)
router.patch('/:id/contact', updateAppointmentContact)

export default router
