import { Router } from 'express'
import {
  checkInPatientProfile,
  createPatientProfile,
  getOfflineAvailability,
  getPatientProfileAuditLogs,
  searchPatientProfiles,
  updatePatientProfileAdministrative,
} from '../../controllers/receptionist/patient-intake.controller.js'

const router = Router()

router.get('/search', searchPatientProfiles)
router.get('/availability', getOfflineAvailability)
router.get('/profiles/:id/audit', getPatientProfileAuditLogs)
router.post('/profiles', createPatientProfile)
router.patch('/profiles/:id', updatePatientProfileAdministrative)
router.post('/check-in', checkInPatientProfile)

export default router
