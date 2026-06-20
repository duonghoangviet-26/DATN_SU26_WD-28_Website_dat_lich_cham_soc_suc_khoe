import ThongTinPhongKham from '../models/ThongTinPhongKham.js'
import ChuyenKhoa from '../models/ChuyenKhoa.js'
import { ok, created, fail } from '../utils/response.js'

// ============================================================
// CLINIC CONTROLLER — Phòng Khám & Chuyên Khoa (C3)
// ============================================================

// ---- PHÒNG KHÁM (Singleton: chỉ 1 document duy nhất) ----

// GET /api/admin/clinic
// Lấy thông tin phòng khám. Nếu chưa tồn tại thì tạo document mặc định.
export async function getClinic(req, res) {
  try {
    let clinic = await ThongTinPhongKham.findOne({ ma: 'MAIN' }).lean()
    if (!clinic) {
      clinic = await ThongTinPhongKham.create({ ma: 'MAIN', ten: 'VitaFamily Clinic' })
    }
    return ok(res, clinic)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// PUT /api/admin/clinic
// Cập nhật thông tin phòng khám (singleton, luôn update doc MAIN).
export async function updateClinic(req, res) {
  try {
    const { ten, dia_chi, so_dien_thoai, email, gio_lam_viec, mo_ta, logo_url, ban_do_url } = req.body
    if (!ten || !ten.trim()) {
      return fail(res, 400, 'Tên phòng khám là bắt buộc')
    }

    const updated = await ThongTinPhongKham.findOneAndUpdate(
      { ma: 'MAIN' },
      { ten: ten.trim(), dia_chi, so_dien_thoai, email, gio_lam_viec, mo_ta, logo_url, ban_do_url },
      { new: true, upsert: true, runValidators: true }
    ).lean()

    return ok(res, updated, 'Đã cập nhật thông tin phòng khám')
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map((e) => e.message).join(', ')
      return fail(res, 400, msg)
    }
    return fail(res, 500, err.message)
  }
}

// ---- CHUYÊN KHOA ----

// GET /api/admin/clinic/specialties
// Lấy toàn bộ chuyên khoa (sắp xếp theo thu_tu tăng dần).
export async function getSpecialties(req, res) {
  try {
    const specialties = await ChuyenKhoa.find().sort({ thu_tu: 1, ngay_tao: 1 }).lean()
    return ok(res, specialties)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// POST /api/admin/clinic/specialties
// Thêm chuyên khoa mới. slug tự sinh từ tên qua pre-validate hook.
export async function createSpecialty(req, res) {
  try {
    const { ten, mo_ta, icon_url, thu_tu } = req.body
    if (!ten || !ten.trim()) {
      return fail(res, 400, 'Tên chuyên khoa là bắt buộc')
    }
    const specialty = await ChuyenKhoa.create({
      ten: ten.trim(),
      mo_ta: mo_ta || null,
      icon_url: icon_url || null,
      thu_tu: thu_tu ?? 0,
    })
    return created(res, specialty.toObject(), 'Đã thêm chuyên khoa mới')
  } catch (err) {
    if (err.code === 11000) {
      return fail(res, 409, 'Tên chuyên khoa này đã tồn tại (slug trùng)')
    }
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map((e) => e.message).join(', ')
      return fail(res, 400, msg)
    }
    return fail(res, 500, err.message)
  }
}

// PUT /api/admin/clinic/specialties/:id
// Cập nhật thông tin chuyên khoa.
export async function updateSpecialty(req, res) {
  try {
    const { id } = req.params
    const { ten, mo_ta, icon_url, thu_tu } = req.body
    if (!ten || !ten.trim()) {
      return fail(res, 400, 'Tên chuyên khoa là bắt buộc')
    }

    // Cập nhật slug khi tên thay đổi
    function toSlug(str) {
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
    }

    const updated = await ChuyenKhoa.findByIdAndUpdate(
      id,
      { ten: ten.trim(), slug: toSlug(ten.trim()), mo_ta: mo_ta || null, icon_url: icon_url || null, thu_tu: thu_tu ?? 0 },
      { new: true, runValidators: true }
    ).lean()

    if (!updated) return fail(res, 404, 'Không tìm thấy chuyên khoa')
    return ok(res, updated, 'Đã cập nhật chuyên khoa')
  } catch (err) {
    if (err.code === 11000) {
      return fail(res, 409, 'Tên chuyên khoa này đã tồn tại (slug trùng)')
    }
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map((e) => e.message).join(', ')
      return fail(res, 400, msg)
    }
    return fail(res, 500, err.message)
  }
}

// PATCH /api/admin/clinic/specialties/:id/toggle
// Ẩn/Hiện chuyên khoa (toggle status active <-> hidden).
export async function toggleSpecialty(req, res) {
  try {
    const { id } = req.params
    const specialty = await ChuyenKhoa.findById(id)
    if (!specialty) return fail(res, 404, 'Không tìm thấy chuyên khoa')

    specialty.status = specialty.status === 'active' ? 'hidden' : 'active'
    await specialty.save()

    return ok(res, specialty.toObject(), `Đã ${specialty.status === 'active' ? 'hiện' : 'ẩn'} chuyên khoa`)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
