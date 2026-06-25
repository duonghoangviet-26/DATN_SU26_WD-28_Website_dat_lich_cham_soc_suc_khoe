import mongoose from 'mongoose'
import { BacSi, NguoiDung, ChuyenKhoa, DichVu } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'

// ============================================================
// B1 — Quản lý hồ sơ bác sĩ
// Routes: /api/doctor/profile
// ============================================================

async function formatProfile(doc) {
  const d = await BacSi.findById(doc._id ?? doc.id)
    .populate('user_id',    'ho_ten email so_dien_thoai anh_dai_dien')
    .populate('specialties','ten')
    .populate('services',   'ten loai gia')
    .lean()
  if (!d) throw new Error('Không tìm thấy hồ sơ')
  const u = d.user_id ?? {}
  return {
    id:                  d._id,
    ho_ten:              u.ho_ten,
    email:               u.email,
    so_dien_thoai:       u.so_dien_thoai,
    anh_dai_dien:        u.anh_dai_dien,
    tieu_su:             d.tieu_su,
    bang_cap:            d.bang_cap,
    kinh_nghiem:         d.kinh_nghiem,
    so_nam_kinh_nghiem:  d.so_nam_kinh_nghiem,
    gia_kham:            d.gia_kham,
    tuoi_nhan_kham_tu:   d.tuoi_nhan_kham_tu,
    trang_thai_duyet:    d.trang_thai_duyet,
    ly_do_tu_choi:       d.ly_do_tu_choi,
    so_lan_nop:          d.so_lan_nop,
    phong_kham_mac_dinh: d.phong_kham_mac_dinh,
    diem_danh_gia:       d.diem_danh_gia,
    tong_danh_gia:       d.tong_danh_gia,
    specialties:         (d.specialties ?? []).map((s) => ({ id: s._id, ten: s.ten })),
    services:            (d.services    ?? []).map((s) => ({ id: s._id, ten: s.ten, gia: s.gia })),
    ngay_tao:            d.ngay_tao,
  }
}

// ─── GET /api/doctor/profile ─────────────────────────────────────────────────
export async function getProfile(req, res) {
  try {
    const doc = await BacSi.findOne({ user_id: req.user.id })
    if (!doc) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')
    return ok(res, await formatProfile(doc))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PUT /api/doctor/profile ─────────────────────────────────────────────────
// Cập nhật thông tin chuyên môn (không đổi email/role)
export async function updateProfile(req, res) {
  try {
    const {
      ho_ten, so_dien_thoai, anh_dai_dien,
      tieu_su, bang_cap, kinh_nghiem,
      so_nam_kinh_nghiem, gia_kham, tuoi_nhan_kham_tu,
      specialties, services,
    } = req.body

    // Cập nhật thông tin user
    const userUpdate = {}
    if (ho_ten)         userUpdate.ho_ten        = ho_ten.trim()
    if (so_dien_thoai !== undefined) userUpdate.so_dien_thoai = so_dien_thoai || null
    if (anh_dai_dien  !== undefined) userUpdate.anh_dai_dien  = anh_dai_dien  || null
    if (Object.keys(userUpdate).length) {
      await NguoiDung.findByIdAndUpdate(req.user.id, userUpdate)
    }

    // Cập nhật hồ sơ bác sĩ
    const doc = await BacSi.findOne({ user_id: req.user.id })
    if (!doc) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    if (tieu_su    !== undefined) doc.tieu_su    = tieu_su?.trim()    || null
    if (bang_cap   !== undefined) doc.bang_cap   = bang_cap?.trim()   || null
    if (kinh_nghiem !== undefined) doc.kinh_nghiem = kinh_nghiem?.trim() || null
    if (so_nam_kinh_nghiem !== undefined) doc.so_nam_kinh_nghiem = so_nam_kinh_nghiem
    if (gia_kham           !== undefined) doc.gia_kham           = gia_kham
    if (tuoi_nhan_kham_tu  !== undefined) doc.tuoi_nhan_kham_tu  = tuoi_nhan_kham_tu

    if (Array.isArray(specialties)) {
      doc.specialties = specialties.filter((id) => mongoose.Types.ObjectId.isValid(id))
    }
    if (Array.isArray(services)) {
      doc.services = services.filter((id) => mongoose.Types.ObjectId.isValid(id))
    }

    await doc.save()
    return ok(res, await formatProfile(doc), 'Cập nhật hồ sơ thành công')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
