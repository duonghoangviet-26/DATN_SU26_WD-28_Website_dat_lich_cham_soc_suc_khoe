import { Router } from 'express'
import * as doctorController from '../controllers/doctor.controller.js'

// ============================================================
// DOCTOR ROUTES — Quản lý bác sĩ (Admin)
// Mount tại: /api/admin/doctors  (khai báo trong routes/index.js)
// ============================================================
// Middleware JWT chưa áp dụng — sẽ thêm vào đây khi hoàn thiện auth.
// Ví dụ thêm sau: router.use(verifyToken, requireRole('admin'))
// ============================================================

const router = Router()

// Danh sách bác sĩ (filter + phân trang)
router.get('/', doctorController.listDoctors)

// Tạo bác sĩ mới từ admin
router.post('/', doctorController.createDoctor)

// Chi tiết một bác sĩ
router.get('/:id', doctorController.getDoctorById)

// Lịch sử thao tác của bác sĩ
router.get('/:id/logs', doctorController.getDoctorLogs)

// Duyệt hồ sơ bác sĩ (pending/rejected → approved)
router.put('/:id/approve', doctorController.approveDoctor)

// Từ chối hồ sơ bác sĩ (pending → rejected)
router.put('/:id/reject', doctorController.rejectDoctor)

// Đình chỉ bác sĩ (approved → suspended)
router.put('/:id/suspend', doctorController.suspendDoctor)

// Khôi phục bác sĩ (suspended → approved)
router.put('/:id/restore', doctorController.restoreDoctor)

// Cập nhật thông tin chuyên môn bác sĩ
router.put('/:id', doctorController.updateDoctor)

// Lịch sử đặt lịch của bác sĩ
router.get('/:id/appointments', doctorController.getDoctorAppointments)

// Xóa vĩnh viễn hồ sơ bác sĩ
router.delete('/:id', doctorController.deleteDoctor)

export default router
