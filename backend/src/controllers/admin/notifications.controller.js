import { ThongBaoHeThong, ThongBao, NguoiDung } from '../../models/index.js'
import { ok, created, fail } from '../../utils/response.js'

// ============================================================
// C7 — Thông báo hệ thống (Admin broadcast)
// Routes: /api/admin/notifications
// ============================================================

// ─── GET /api/admin/notifications ───────────────────────────────────────────
export async function list(req, res) {
  try {
    const items = await ThongBaoHeThong.find()
      .sort({ ngay_tao: -1 })
      .lean()

    return ok(res, items.map((n) => ({
      id:            n._id,
      tieu_de:       n.tieu_de,
      noi_dung:      n.noi_dung,
      doi_tuong:     n.doi_tuong,
      so_nguoi_nhan: n.so_nguoi_nhan,
      ngay_gui:      n.ngay_gui ?? n.ngay_tao,
    })))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── POST /api/admin/notifications ──────────────────────────────────────────
// Body: { tieu_de, noi_dung, doi_tuong: 'tat_ca'|'benh_nhan'|'bac_si', url? }
export async function create(req, res) {
  try {
    const { tieu_de, noi_dung, doi_tuong, url } = req.body
    if (!tieu_de?.trim()) return fail(res, 400, 'Tiêu đề là bắt buộc')
    if (!noi_dung?.trim()) return fail(res, 400, 'Nội dung là bắt buộc')
    if (!['tat_ca', 'benh_nhan', 'bac_si'].includes(doi_tuong)) {
      return fail(res, 400, 'Đối tượng không hợp lệ')
    }

    // Xác định danh sách người nhận
    const roleFilter = doi_tuong === 'tat_ca'
      ? { role: { $in: ['user', 'doctor'] } }
      : doi_tuong === 'benh_nhan'
        ? { role: 'user' }
        : { role: 'doctor' }

    const recipients = await NguoiDung.find(roleFilter).select('_id').lean()
    const now = new Date()

    // Tạo bản ghi hệ thống
    const sysNoti = await ThongBaoHeThong.create({
      tieu_de:       tieu_de.trim(),
      noi_dung:      noi_dung.trim(),
      doi_tuong,
      url:           url?.trim() || null,
      tao_boi:       req.user.id,
      ngay_gui:      now,
      so_nguoi_nhan: recipients.length,
    })

    // Batch insert thông báo cá nhân (100 mỗi lần)
    const BATCH = 100
    for (let i = 0; i < recipients.length; i += BATCH) {
      const batch = recipients.slice(i, i + BATCH).map((r) => ({
        user_id:            r._id,
        tieu_de:            tieu_de.trim(),
        noi_dung:           noi_dung.trim(),
        url:                url?.trim() || null,
        he_thong_noti_id:   sysNoti._id,
        ngay_tao:           now,
      }))
      await ThongBao.insertMany(batch, { ordered: false })
    }

    return created(res, {
      id:            sysNoti._id,
      tieu_de:       sysNoti.tieu_de,
      noi_dung:      sysNoti.noi_dung,
      doi_tuong:     sysNoti.doi_tuong,
      so_nguoi_nhan: sysNoti.so_nguoi_nhan,
      ngay_gui:      sysNoti.ngay_gui,
    }, `Đã gửi thông báo đến ${recipients.length} người`)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
