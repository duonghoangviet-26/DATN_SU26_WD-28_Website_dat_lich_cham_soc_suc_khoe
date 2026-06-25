import { ThongBao } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'

// ============================================================
// A7 — Thông báo (Bệnh nhân)
// Routes: /api/patient/notifications
// ============================================================

// ─── GET /api/patient/notifications?page=&limit= ────────────────────────────
export async function listNotifications(req, res) {
  try {
    const { page = 1, limit = 20 } = req.query
    const filter = { user_id: req.user.id }

    const skip  = (Number(page) - 1) * Number(limit)
    const total = await ThongBao.countDocuments(filter)
    const unread = await ThongBao.countDocuments({ user_id: req.user.id, da_doc: false })

    const notifications = await ThongBao.find(filter)
      .sort({ ngay_tao: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean()

    return ok(res, {
      total,
      unread,
      page:  Number(page),
      limit: Number(limit),
      data:  notifications.map((n) => ({
        id:           n._id,
        tieu_de:      n.tieu_de,
        noi_dung:     n.noi_dung,
        loai:         n.loai,
        related_id:   n.related_id,
        related_type: n.related_type,
        da_doc:       n.da_doc,
        ngay_tao:     n.ngay_tao,
      })),
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/patient/notifications/unread-count ────────────────────────────
export async function getUnreadCount(req, res) {
  try {
    const count = await ThongBao.countDocuments({ user_id: req.user.id, da_doc: false })
    return ok(res, { unread: count })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/patient/notifications/:id/read ──────────────────────────────
export async function markRead(req, res) {
  try {
    const n = await ThongBao.findOne({ _id: req.params.id, user_id: req.user.id })
    if (!n) return fail(res, 404, 'Không tìm thấy thông báo')

    n.da_doc = true
    await n.save()

    return ok(res, { id: n._id, da_doc: n.da_doc }, 'Đã đánh dấu đã đọc')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/patient/notifications/read-all ──────────────────────────────
export async function markAllRead(req, res) {
  try {
    const result = await ThongBao.updateMany(
      { user_id: req.user.id, da_doc: false },
      { $set: { da_doc: true } },
    )
    return ok(res, { updated: result.modifiedCount }, 'Đã đánh dấu tất cả là đã đọc')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
