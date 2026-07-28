import { Router } from 'express'
import {
  checkInPatientProfile,
  createPatientProfile,
  getOfflineAvailability,
  searchPatientProfiles,
} from '../../controllers/receptionist/patient-intake.controller.js'

const router = Router()

router.get('/search', searchPatientProfiles)
router.get('/availability', getOfflineAvailability)
router.post('/profiles', createPatientProfile)
router.post('/check-in', checkInPatientProfile)

export default router
