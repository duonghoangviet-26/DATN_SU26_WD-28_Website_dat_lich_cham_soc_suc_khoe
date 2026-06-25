import mongoose from 'mongoose'
import { BacSi, NguoiDung, ChuyenKhoa } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'

// ============================================================
// C2 — Duyệt & quản lý hồ sơ bác sĩ (Admin)
// Routes: /api/admin/doctors
// ============================================================

async function formatDoctor(doc) {
  const d = await BacSi.findById(doc._id ?? doc.id)
    .populate('user_id',    'ho_ten email anh_dai_dien so_dien_thoai status')
    .populate('specialties','ten')
    .lean()
  if (!d) throw new Error('Không tìm thấy bác sĩ')
  const user = d.user_id ?? {}
  return {
    id:                  d._id,
    user_id:             user._id,
    ho_ten:              user.ho_ten,
    email:               user.email,
    anh_dai_dien:        user.anh_dai_dien ?? null,
    so_dien_thoai:       user.so_dien_thoai ?? null,
    user_status:         user.status,
    tieu_su:             d.tieu_su,
    bang_cap:            d.bang_cap,
    kinh_nghiem:         d.kinh_nghiem,
    so_nam_kinh_nghiem:  d.so_nam_kinh_nghiem,
    gia_kham:            d.gia_kham,
    tuoi_nhan_kham_tu:   d.tuoi_nhan_kham_tu,
    trang_thai_duyet:    d.trang_thai_duyet,
    ly_do_tu_choi:       d.ly_do_tu_choi,
    so_lan_nop:          d.so_lan_nop,
    la_hien:             d.la_hien,
    diem_danh_gia:       d.diem_danh_gia,
    tong_danh_gia:       d.tong_danh_gia,
    phong_kham_mac_dinh: d.phong_kham_mac_dinh,
    chuyen_khoa:         (d.specialties ?? []).map((s) => ({ id: s._id, ten: s.ten })),
    ngay_tao:            d.ngay_tao,
  }
}

// ─── GET /api/admin/doctors?trang_thai=&search= ─────────────────────────────
export async function list(req, res) {
  try {
    const { trang_thai, search } = req.query
    const filter = {}
    if (trang_thai) filter.trang_thai_duyet = trang_thai

    let userIds
    if (search) {
      const users = await NguoiDung.find({
        $or: [
          { ho_ten: { $regex: search, $options: 'i' } },
          { email:  { $regex: search, $options: 'i' } },
        ],
      }).select('_id').lean()
      userIds = users.map((u) => u._id)
      filter.user_id = { $in: userIds }
    }

    const docs = await BacSi.find(filter)
      .populate('user_id',    'ho_ten email anh_dai_dien so_dien_thoai status')
      .populate('specialties','ten')
      .sort({ ngay_tao: -1 })
      .lean()

    const result = docs.map((d) => {
      const user = d.user_id ?? {}
      return {
        id:                  d._id,
        user_id:             user._id,
        ho_ten:              user.ho_ten,
        email:               user.email,
        anh_dai_dien:        user.anh_dai_dien ?? null,
        trang_thai_duyet:    d.trang_thai_duyet,
        so_nam_kinh_nghiem:  d.so_nam_kinh_nghiem,
        gia_kham:            d.gia_kham,
        diem_danh_gia:       d.diem_danh_gia,
        so_lan_nop:          d.so_lan_nop,
        chuyen_khoa:         (d.specialties ?? []).map((s) => s.ten).join(', '),
        ngay_tao:            d.ngay_tao,
      }
    })
    return ok(res, result)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/admin/doctors/:id ─────────────────────────────────────────────
export async function getById(req, res) {
  try {
    const d = await BacSi.findById(req.params.id)
    if (!d) return fail(res, 404, 'Không tìm thấy bác sĩ')
    return ok(res, await formatDoctor(d))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/admin/doctors/:id/approve ───────────────────────────────────
export async function approve(req, res) {
  try {
    const { phong_kham_mac_dinh } = req.body
    const doc = await BacSi.findById(req.params.id)
    if (!doc) return fail(res, 404, 'Không tìm thấy bác sĩ')
    if (doc.trang_thai_duyet === 'approved') {
      return fail(res, 409, 'Hồ sơ đã được duyệt trước đó')
    }

    doc.trang_thai_duyet = 'approved'
    doc.ly_do_tu_choi = null
    if (phong_kham_mac_dinh) doc.phong_kham_mac_dinh = phong_kham_mac_dinh
    await doc.save()

    // Cấp role='doctor' cho tài khoản người dùng
    await NguoiDung.findByIdAndUpdate(doc.user_id, { role: 'doctor' })

    return ok(res, await formatDoctor(doc), 'Đã duyệt hồ sơ bác sĩ')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/admin/doctors/:id/reject ────────────────────────────────────
export async function reject(req, res) {
  try {
    const { ly_do } = req.body
    if (!ly_do?.trim()) return fail(res, 400, 'Vui lòng nhập lý do từ chối')

    const doc = await BacSi.findById(req.params.id)
    if (!doc) return fail(res, 404, 'Không tìm thấy bác sĩ')
    if (doc.trang_thai_duyet === 'approved') {
      return fail(res, 409, 'Không thể từ chối hồ sơ đã duyệt')
    }

    doc.trang_thai_duyet = 'rejected'
    doc.ly_do_tu_choi    = ly_do.trim()
    await doc.save()

    return ok(res, await formatDoctor(doc), 'Đã từ chối hồ sơ bác sĩ')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/admin/doctors/:id/suspend ───────────────────────────────────
export async function suspend(req, res) {
  try {
    const doc = await BacSi.findById(req.params.id)
    if (!doc) return fail(res, 404, 'Không tìm thấy bác sĩ')
    if (doc.trang_thai_duyet !== 'approved') {
      return fail(res, 409, 'Chỉ đình chỉ bác sĩ đã được duyệt')
    }

    doc.trang_thai_duyet = 'suspended'
    await doc.save()

    // Thu hồi role về 'user'
    await NguoiDung.findByIdAndUpdate(doc.user_id, { role: 'user' })

    return ok(res, await formatDoctor(doc), 'Đã đình chỉ bác sĩ')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/admin/doctors/:id/assign-room ───────────────────────────────
export async function assignRoom(req, res) {
  try {
    const { phong_kham_mac_dinh } = req.body
    if (!phong_kham_mac_dinh?.trim()) return fail(res, 400, 'Vui lòng nhập tên phòng khám')

    const doc = await BacSi.findByIdAndUpdate(
      req.params.id,
      { phong_kham_mac_dinh: phong_kham_mac_dinh.trim() },
      { new: true },
    )
    if (!doc) return fail(res, 404, 'Không tìm thấy bác sĩ')

    return ok(res, await formatDoctor(doc), 'Đã gán phòng khám mặc định')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
