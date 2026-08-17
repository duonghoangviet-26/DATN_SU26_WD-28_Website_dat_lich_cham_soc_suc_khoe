import { Router } from 'express'
import {
  checkInPatientProfile,
  createPatientProfile,
  getProfileBookingHistory,
  getCentralOfflineCapacity,
  getOfflineAvailability,
  intakeCentralOfflineQueue,
  searchPatientProfileByTempCode,
  searchPatientProfiles,
  updatePatientProfileAdministrative,
} from '../../controllers/receptionist/patient-intake.controller.js'

const router = Router()

router.get('/search', searchPatientProfiles)
// D81 — tra cứu hồ sơ tạm (không SĐT) bằng mã TEMP-YYYYMMDD-xxx. Đứng TRƯỚC '/search' để rõ
// ràng, dù path khác nhau nên thứ tự không ảnh hưởng — giữ cùng chỗ cho dễ đọc.
router.get('/search-temp', searchPatientProfileByTempCode)
router.get('/availability', getOfflineAvailability)
router.get('/offline-queue/capacity', getCentralOfflineCapacity)
router.post('/profiles', createPatientProfile)
router.get('/profiles/:id/booking-history', getProfileBookingHistory)
router.patch('/profiles/:id', updatePatientProfileAdministrative)
// Mô hình walk-in CŨ (claim slot ngay) — UI hiện KHÔNG gọi route này nữa, chỉ còn
// `test:e2e:offline`/`test:e2e:checkin-billing` phụ thuộc. Xem chú thích ở
// `checkInPatientProfile` (controller) / `tiepNhanHoSoVaoHangDoi` (service) trước khi đụng.
router.post('/check-in', checkInPatientProfile)
// Mô hình walk-in MỚI (hàng đợi trung tâm `cho_dieu_phoi`) — luồng UI thật đang dùng.
router.post('/offline-queue/intake', intakeCentralOfflineQueue)

export default router
