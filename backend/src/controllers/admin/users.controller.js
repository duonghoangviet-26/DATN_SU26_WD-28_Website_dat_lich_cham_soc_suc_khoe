import { NguoiDung } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'

// ============================================================
// C1 — Quản lý người dùng (Admin)
// Routes: /api/admin/users
// ============================================================

// ─── GET /api/admin/users?keyword=&role=&status= ────────────────────────────
export async function list(req, res) {
  try {
    const { keyword, role, status } = req.query
    const filter = {}
    if (role)   filter.role   = role
    if (status) filter.status = status
    if (keyword) {
      filter.$or = [
        { ho_ten: { $regex: keyword, $options: 'i' } },
        { email:  { $regex: keyword, $options: 'i' } },
      ]
    }

    const users = await NguoiDung.find(filter)
      .select('-mat_khau')
      .sort({ ngay_tao: -1 })
      .lean()

    return ok(res, users.map((u) => ({ ...u, id: u._id })))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/admin/users/:id ────────────────────────────────────────────────
export async function getById(req, res) {
  try {
    const u = await NguoiDung.findById(req.params.id).select('-mat_khau').lean()
    if (!u) return fail(res, 404, 'Không tìm thấy người dùng')
    return ok(res, { ...u, id: u._id })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/admin/users/:id/toggle-lock ─────────────────────────────────
export async function toggleLock(req, res) {
  try {
    const u = await NguoiDung.findById(req.params.id)
    if (!u) return fail(res, 404, 'Không tìm thấy người dùng')
    if (u.role === 'admin') return fail(res, 403, 'Không thể khóa tài khoản Admin')

    u.status = u.status === 'active' ? 'locked' : 'active'
    await u.save()

    return ok(res, { ...u.toObject(), id: u._id },
      `Đã ${u.status === 'locked' ? 'khóa' : 'mở khóa'} tài khoản`)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
