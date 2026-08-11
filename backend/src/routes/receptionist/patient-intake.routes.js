import { Router } from 'express'
import {
  checkInPatientProfile,
  createPatientProfile,
  getCentralOfflineCapacity,
  getOfflineAvailability,
  intakeCentralOfflineQueue,
  searchPatientProfiles,
  updatePatientProfileAdministrative,
} from '../../controllers/receptionist/patient-intake.controller.js'

const router = Router()

router.get('/search', searchPatientProfiles)
router.get('/availability', getOfflineAvailability)
router.get('/offline-queue/capacity', getCentralOfflineCapacity)
router.post('/profiles', createPatientProfile)
router.patch('/profiles/:id', updatePatientProfileAdministrative)
router.post('/check-in', checkInPatientProfile)
router.post('/offline-queue/intake', intakeCentralOfflineQueue)

export default router
