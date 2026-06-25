import { ok, fail } from '../utils/response.js'
import * as doctorService from '../services/doctor.service.js'


// ============================================================
// DOCTOR CONTROLLER — Quản lý bác sĩ (Admin)
// ============================================================
// Tuân theo pattern auth.controller.js:
//   - Hàm async, bọc try/catch
//   - Lấy dữ liệu từ req.body / req.params / req.query
//   - Gọi doctorService (không có logic nghiệp vụ ở đây)
//   - Trả về qua ok() / fail()
// ============================================================

// GET /api/admin/doctors
// Query params: trang_thai, chuyen_khoa, keyword, page, limit
export async function listDoctors(req, res) {
  try {
    const { trang_thai, chuyen_khoa, keyword, page, limit } = req.query
    const result = await doctorService.getDoctorList({
      trang_thai,
      chuyen_khoa,
      keyword,
      page,
      limit,
    })
    return ok(res, result, 'Lấy danh sách bác sĩ thành công')
  } catch (err) {
    const status = err.message.includes('không hợp lệ') ? 400 : 500
    return fail(res, status, err.message)
  }
}

// GET /api/admin/doctors/:id
export async function getDoctorById(req, res) {
  try {
    const { id } = req.params
    const doctor = await doctorService.getDoctorDetail(id)
    return ok(res, doctor, 'Lấy thông tin bác sĩ thành công')
  } catch (err) {
    if (err.message === 'Không tìm thấy bác sĩ') return fail(res, 404, err.message)
    const status = err.message.includes('không hợp lệ') ? 400 : 500
    return fail(res, status, err.message)
  }
}

// PUT /api/admin/doctors/:id/approve
// Body: { admin_id } — (tạm thời truyền manual, sau này lấy từ req.user khi có JWT)
export async function approveDoctor(req, res) {
  try {
    const { id } = req.params
    const { admin_id } = req.body

    if (!admin_id) return fail(res, 400, 'admin_id là bắt buộc')

    const doctor = await doctorService.approveDoctor(id, admin_id)
    return ok(res, doctor, 'Duyệt bác sĩ thành công')
  } catch (err) {
    if (err.message === 'Không tìm thấy bác sĩ') return fail(res, 404, err.message)
    const status = err.message.includes('không hợp lệ') || err.message.includes('Không thể') || err.message.includes('đã được')
      ? 400 : 500
    return fail(res, status, err.message)
  }
}

// PUT /api/admin/doctors/:id/reject
// Body: { admin_id, ly_do }
export async function rejectDoctor(req, res) {
  try {
    const { id } = req.params
    const { admin_id, ly_do } = req.body

    if (!admin_id) return fail(res, 400, 'admin_id là bắt buộc')
    if (!ly_do || !ly_do.trim()) return fail(res, 400, 'ly_do là bắt buộc khi từ chối')

    const doctor = await doctorService.rejectDoctor(id, admin_id, ly_do)
    return ok(res, doctor, 'Từ chối hồ sơ bác sĩ thành công')
  } catch (err) {
    if (err.message === 'Không tìm thấy bác sĩ') return fail(res, 404, err.message)
    const status = ['không hợp lệ', 'bắt buộc', 'tối đa', 'trạng thái pending'].some(k => err.message.includes(k))
      ? 400 : 500
    return fail(res, status, err.message)
  }
}

// PUT /api/admin/doctors/:id/suspend
// Body: { admin_id, ly_do }
export async function suspendDoctor(req, res) {
  try {
    const { id } = req.params
    const { admin_id, ly_do } = req.body

    if (!admin_id) return fail(res, 400, 'admin_id là bắt buộc')
    if (!ly_do || !ly_do.trim()) return fail(res, 400, 'ly_do là bắt buộc khi đình chỉ')

    const result = await doctorService.suspendDoctor(id, admin_id, ly_do)
    return ok(res, result, 'Đình chỉ bác sĩ thành công')
  } catch (err) {
    if (err.message === 'Không tìm thấy bác sĩ') return fail(res, 404, err.message)
    const status = ['không hợp lệ', 'bắt buộc', 'approved'].some(k => err.message.includes(k))
      ? 400 : 500
    return fail(res, status, err.message)
  }
}

// PUT /api/admin/doctors/:id/restore
// Body: { admin_id }
// GET /api/admin/doctors/:id/logs
export async function getDoctorLogs(req, res) {
  try {
    const { id } = req.params
    const logs = await doctorService.getDoctorAuditLogs(id)
    return ok(res, logs, 'Lấy lịch sử thao tác thành công')
  } catch (err) {
    if (err.message === 'Không tìm thấy bác sĩ') return fail(res, 404, err.message)
    const status = err.message.includes('không hợp lệ') ? 400 : 500
    return fail(res, status, err.message)
  }
}

export async function restoreDoctor(req, res) {
  try {
    const { id } = req.params
    const { admin_id } = req.body

    if (!admin_id) return fail(res, 400, 'admin_id là bắt buộc')

    const doctor = await doctorService.restoreDoctor(id, admin_id)
    return ok(res, doctor, 'Khôi phục bác sĩ thành công')
  } catch (err) {
    if (err.message === 'Không tìm thấy bác sĩ') return fail(res, 404, err.message)
    const status = ['không hợp lệ', 'suspended'].some(k => err.message.includes(k))
      ? 400 : 500
    return fail(res, status, err.message)
  }
}
