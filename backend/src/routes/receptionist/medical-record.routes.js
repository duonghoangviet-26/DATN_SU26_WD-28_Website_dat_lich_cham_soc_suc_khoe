import { Router } from 'express'
import {
  createMedicalRecordRevisionRequest,
  denyDirectMedicalRecordPatch,
} from '../../controllers/receptionist/medical-record.controller.js'

const router = Router()

router.post('/:id/revision-requests', createMedicalRecordRevisionRequest)
router.patch('/:id', denyDirectMedicalRecordPatch)

export default router
