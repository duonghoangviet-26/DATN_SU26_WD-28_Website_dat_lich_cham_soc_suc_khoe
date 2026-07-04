import { DonThuoc, GiaDinh, ThanhVien } from '../../models/index.js'
import { ok, created, fail } from '../../utils/response.js'

// ============================================================
// A4 — Quản lý đơn thuốc tự nhập (Bệnh nhân)
// Routes: /api/patient/prescriptions
// ============================================================
// Chỉ CRUD đơn thuốc nguon='tu_nhap'.
// Bác sĩ kê (nguon='bac_si') được xem nhưng không thể sửa/xóa.

async function getMemberIds(userId) {
  const family = await GiaDinh.findOne({ user_id: userId }).select('_id').lean()
  if (!family) return []
  const members = await ThanhVien.find({ family_id: family._id, ngay_xoa: null })
    .select('_id')
    .lean()
  return members.map((m) => m._id)
}

// ─── GET /api/patient/prescriptions?member_id= ──────────────────────────────
export async function listPrescriptions(req, res) {
  try {
    const { member_id } = req.query

    const memberIds = await getMemberIds(req.user.id)
    if (!memberIds.length) return ok(res, [])

    const filter = { member_id: { $in: memberIds } }
    if (member_id) filter.member_id = member_id

    const prescriptions = await DonThuoc.find(filter)
      .populate('member_id', 'ho_ten')
      .sort({ ngay_tao: -1 })
      .lean()

    return ok(res, prescriptions.map((p) => ({
      id:          p._id,
      nguon:       p.nguon,
      ten_thanh_vien: p.member_id?.ho_ten ?? null,
      member_id:   p.member_id?._id ?? null,
      ghi_chu:     p.ghi_chu,
      so_thuoc:    p.items?.length ?? 0,
      ngay_tao:    p.ngay_tao,
    })))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/patient/prescriptions/:id ─────────────────────────────────────
export async function getPrescription(req, res) {
  try {
    const memberIds = await getMemberIds(req.user.id)
    const p = await DonThuoc.findOne({
      _id: req.params.id,
      member_id: { $in: memberIds },
    })
      .populate('member_id', 'ho_ten ngay_sinh gioi_tinh')
      .lean()

    if (!p) return fail(res, 404, 'Không tìm thấy đơn thuốc')

    return ok(res, {
      id:      p._id,
      nguon:   p.nguon,
      thanh_vien: p.member_id ? {
        id:        p.member_id._id,
        ho_ten:    p.member_id.ho_ten,
        ngay_sinh: p.member_id.ngay_sinh,
        gioi_tinh: p.member_id.gioi_tinh,
      } : null,
      ghi_chu:  p.ghi_chu,
      items:    p.items ?? [],
      ngay_tao: p.ngay_tao,
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── POST /api/patient/prescriptions ────────────────────────────────────────
export async function createPrescription(req, res) {
  try {
    const { member_id, ghi_chu, items } = req.body
    if (!member_id) return fail(res, 400, 'member_id là bắt buộc')
    if (!Array.isArray(items) || !items.length) {
      return fail(res, 400, 'Phải có ít nhất 1 thuốc')
    }

    // Verify member thuộc family
    const memberIds = await getMemberIds(req.user.id)
    const owns = memberIds.some((id) => id.toString() === member_id)
    if (!owns) return fail(res, 403, 'Không có quyền thêm đơn thuốc cho thành viên này')

    const p = await DonThuoc.create({
      member_id,
      nguon:   'tu_nhap',
      ghi_chu: ghi_chu?.trim() || null,
      items,
    })

    return created(res, { id: p._id, nguon: p.nguon, so_thuoc: p.items.length }, 'Đã thêm đơn thuốc')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PUT /api/patient/prescriptions/:id ─────────────────────────────────────
export async function updatePrescription(req, res) {
  try {
    const memberIds = await getMemberIds(req.user.id)
    const p = await DonThuoc.findOne({
      _id: req.params.id,
      member_id: { $in: memberIds },
    })

    if (!p) return fail(res, 404, 'Không tìm thấy đơn thuốc')
    if (p.nguon !== 'tu_nhap') return fail(res, 403, 'Không thể sửa đơn thuốc do bác sĩ kê')

    const { ghi_chu, items } = req.body
    if (ghi_chu !== undefined) p.ghi_chu = ghi_chu?.trim() || null
    if (Array.isArray(items) && items.length) p.items = items

    await p.save()
    return ok(res, { id: p._id, so_thuoc: p.items.length }, 'Đã cập nhật đơn thuốc')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── DELETE /api/patient/prescriptions/:id ──────────────────────────────────
export async function deletePrescription(req, res) {
  try {
    const memberIds = await getMemberIds(req.user.id)
    const p = await DonThuoc.findOne({
      _id: req.params.id,
      member_id: { $in: memberIds },
    })

    if (!p) return fail(res, 404, 'Không tìm thấy đơn thuốc')
    if (p.nguon !== 'tu_nhap') return fail(res, 403, 'Không thể xóa đơn thuốc do bác sĩ kê')

    await p.deleteOne()
    return ok(res, null, 'Đã xóa đơn thuốc')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
