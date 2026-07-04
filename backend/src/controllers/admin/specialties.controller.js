import { ChuyenKhoa } from '../../models/index.js'
import { ok, created, fail } from '../../utils/response.js'

// ============================================================
// C3 — Quản lý chuyên khoa (Admin)
// Routes: /api/admin/specialties
// ============================================================

function fmt(s) {
  return { ...s, id: s._id }
}

// ─── GET /api/admin/specialties?status=&search= ─────────────────────────────
export async function list(req, res) {
  try {
    const { status, search } = req.query
    const filter = {}
    if (status) filter.status = status
    if (search) filter.ten = { $regex: search, $options: 'i' }

    const specialties = await ChuyenKhoa.find(filter)
      .sort({ thu_tu: 1, ten: 1 })
      .lean()
    return ok(res, specialties.map(fmt))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/admin/specialties/:id ─────────────────────────────────────────
export async function getById(req, res) {
  try {
    const s = await ChuyenKhoa.findById(req.params.id).lean()
    if (!s) return fail(res, 404, 'Không tìm thấy chuyên khoa')
    return ok(res, fmt(s))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── POST /api/admin/specialties ────────────────────────────────────────────
export async function create(req, res) {
  try {
    const { ten, mo_ta, icon_url, thu_tu } = req.body
    if (!ten?.trim()) return fail(res, 400, 'Tên chuyên khoa là bắt buộc')

    const s = await ChuyenKhoa.create({
      ten: ten.trim(),
      mo_ta:    mo_ta?.trim()    || null,
      icon_url: icon_url?.trim() || null,
      thu_tu:   thu_tu ?? 0,
    })

    return created(res, fmt(s.toObject()), 'Tạo chuyên khoa thành công')
  } catch (err) {
    if (err.code === 11000) return fail(res, 409, 'Tên hoặc slug đã tồn tại')
    return fail(res, 500, err.message)
  }
}

// ─── PUT /api/admin/specialties/:id ─────────────────────────────────────────
export async function update(req, res) {
  try {
    const s = await ChuyenKhoa.findById(req.params.id)
    if (!s) return fail(res, 404, 'Không tìm thấy chuyên khoa')

    const { ten, mo_ta, icon_url, thu_tu } = req.body
    if (ten !== undefined)      s.ten      = ten.trim()
    if (mo_ta !== undefined)    s.mo_ta    = mo_ta?.trim()    || null
    if (icon_url !== undefined) s.icon_url = icon_url?.trim() || null
    if (thu_tu !== undefined)   s.thu_tu   = thu_tu

    await s.save()
    return ok(res, fmt(s.toObject()), 'Cập nhật chuyên khoa thành công')
  } catch (err) {
    if (err.code === 11000) return fail(res, 409, 'Tên đã tồn tại')
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/admin/specialties/:id/toggle ────────────────────────────────
export async function toggle(req, res) {
  try {
    const s = await ChuyenKhoa.findById(req.params.id)
    if (!s) return fail(res, 404, 'Không tìm thấy chuyên khoa')
    s.status = s.status === 'active' ? 'hidden' : 'active'
    await s.save()
    return ok(res, fmt(s.toObject()),
      `Đã ${s.status === 'hidden' ? 'ẩn' : 'hiện'} chuyên khoa`)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
