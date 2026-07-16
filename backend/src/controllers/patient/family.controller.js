import { GiaDinh, ThanhVien } from '../../models/index.js'
import { ok, created, fail } from '../../utils/response.js'

// ============================================================
// A2 — Quản lý hồ sơ gia đình (Bệnh nhân)
// Routes: /api/patient/family
// ============================================================

// ─── GET /api/patient/family ─────────────────────────────────────────────────
export async function getFamily(req, res) {
  try {
    const family = await GiaDinh.findOne({ user_id: req.user.id }).lean()
    if (!family) return ok(res, null)

    const members = await ThanhVien.find({
      family_id:  family._id,
      ngay_xoa:   null,
    }).sort({ la_chu_ho: -1, ho_ten: 1 }).lean()

    return ok(res, {
      id:       family._id,
      ten_nhom: family.ten_nhom,
      members:  members.map((m) => ({ ...m, id: m._id })),
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── POST /api/patient/family ────────────────────────────────────────────────
// Tạo nhóm + thêm chu_ho đầu tiên
export async function createFamily(req, res) {
  try {
    const exists = await GiaDinh.findOne({ user_id: req.user.id })
    if (exists) return fail(res, 409, 'Bạn đã có nhóm gia đình')

    const { ten_nhom, ho_ten, ngay_sinh, gioi_tinh } = req.body
    if (!ten_nhom?.trim()) return fail(res, 400, 'Tên nhóm là bắt buộc')
    if (!ho_ten?.trim())   return fail(res, 400, 'Họ tên thành viên chính là bắt buộc')

    const family = await GiaDinh.create({ user_id: req.user.id, ten_nhom: ten_nhom.trim() })
    const chu_ho = await ThanhVien.create({
      family_id:  family._id,
      ho_ten:     ho_ten.trim(),
      ngay_sinh:  ngay_sinh ? new Date(ngay_sinh) : new Date(),
      gioi_tinh:  gioi_tinh ?? 'khac',
      la_chu_ho:  true,
    })

    return created(res, {
      id:       family._id,
      ten_nhom: family.ten_nhom,
      members:  [{ ...chu_ho.toObject(), id: chu_ho._id }],
    }, 'Tạo nhóm gia đình thành công')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── POST /api/patient/family/members ───────────────────────────────────────
export async function addMember(req, res) {
  try {
    const family = await GiaDinh.findOne({ user_id: req.user.id })
    if (!family) return fail(res, 404, 'Chưa có nhóm gia đình')

    const { ho_ten, ngay_sinh, gioi_tinh, nhom_mau, di_ung, benh_nen } = req.body
    if (!ho_ten?.trim())  return fail(res, 400, 'Họ tên là bắt buộc')
    if (!ngay_sinh)       return fail(res, 400, 'Ngày sinh là bắt buộc')
    if (!gioi_tinh)       return fail(res, 400, 'Giới tính là bắt buộc')

    const member = await ThanhVien.create({
      family_id:  family._id,
      ho_ten:     ho_ten.trim(),
      ngay_sinh:  new Date(ngay_sinh),
      gioi_tinh,
      nhom_mau:   nhom_mau  || null,
      di_ung:     di_ung?.trim()  || null,
      benh_nen:   benh_nen?.trim() || null,
      la_chu_ho:  false,
    })

    return created(res, { ...member.toObject(), id: member._id }, 'Thêm thành viên thành công')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PUT /api/patient/family/members/:id ────────────────────────────────────
export async function updateMember(req, res) {
  try {
    const family = await GiaDinh.findOne({ user_id: req.user.id }).select('_id').lean()
    if (!family) return fail(res, 404, 'Chưa có nhóm gia đình')

    const member = await ThanhVien.findOne({ _id: req.params.id, family_id: family._id })
    if (!member) return fail(res, 404, 'Không tìm thấy thành viên')

    const { ho_ten, ngay_sinh, gioi_tinh, nhom_mau, di_ung, benh_nen } = req.body
    if (ho_ten    !== undefined) member.ho_ten   = ho_ten.trim()
    if (ngay_sinh !== undefined) member.ngay_sinh = new Date(ngay_sinh)
    if (gioi_tinh !== undefined) member.gioi_tinh = gioi_tinh
    if (nhom_mau  !== undefined) member.nhom_mau  = nhom_mau  || null
    if (di_ung    !== undefined) member.di_ung    = di_ung?.trim()  || null
    if (benh_nen  !== undefined) member.benh_nen  = benh_nen?.trim() || null

    await member.save()
    return ok(res, { ...member.toObject(), id: member._id }, 'Cập nhật thành viên thành công')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── DELETE /api/patient/family/members/:id ─────────────────────────────────
export async function removeMember(req, res) {
  try {
    const family = await GiaDinh.findOne({ user_id: req.user.id }).select('_id').lean()
    if (!family) return fail(res, 404, 'Chưa có nhóm gia đình')

    const member = await ThanhVien.findOne({ _id: req.params.id, family_id: family._id })
    if (!member) return fail(res, 404, 'Không tìm thấy thành viên')
    if (member.la_chu_ho) return fail(res, 403, 'Không thể xóa chủ tài khoản')

    // Soft delete
    member.ngay_xoa = new Date()
    await member.save()

    return ok(res, null, 'Đã xóa thành viên')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
