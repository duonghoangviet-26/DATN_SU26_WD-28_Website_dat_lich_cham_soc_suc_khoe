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
// Mô hình walk-in CŨ (claim slot ngay) — UI hiện KHÔNG gọi route này nữa, chỉ còn
// `test:e2e:offline`/`test:e2e:checkin-billing` phụ thuộc. Xem chú thích ở
// `checkInPatientProfile` (controller) / `tiepNhanHoSoVaoHangDoi` (service) trước khi đụng.
router.post('/check-in', checkInPatientProfile)
// Mô hình walk-in MỚI (hàng đợi trung tâm `cho_dieu_phoi`) — luồng UI thật đang dùng.
router.post('/offline-queue/intake', intakeCentralOfflineQueue)

export default router
