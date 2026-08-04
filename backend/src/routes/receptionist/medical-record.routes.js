import { Router } from 'express'
import { denyDirectMedicalRecordPatch } from '../../controllers/receptionist/medical-record.controller.js'

const router = Router()

router.patch('/:id', denyDirectMedicalRecordPatch)

export default router
