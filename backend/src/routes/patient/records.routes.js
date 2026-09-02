import { Router } from 'express'
import {
  listRecords, getRecord, updateAppointmentContact, listMedicalResults,
  deleteCancelledAppointment, deleteBatchCancelledAppointments
} from '../../controllers/patient/records.controller.js'

const router = Router()

router.get('/',    listRecords)
router.get('/medical-results', listMedicalResults)
router.get('/:id', getRecord)
router.patch('/:id/contact', updateAppointmentContact)
router.delete('/batch-cancelled', deleteBatchCancelledAppointments)
router.delete('/:id', deleteCancelledAppointment)

export default router
