import { LichLamViec, LichHen } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'

// ============================================================
// Ca làm việc được phân công (Y tá) — Routes: GET /api/nurse/schedule?from=&to=
// CHỈ ĐỌC. Phạm vi = LichLamViec.nurse_id = req.user.id (token) — không tin FE,
// không tạo/sửa/xóa/gán ca (việc đó thuộc admin). Không dùng mock.
// ============================================================

const TRANG_THAI_NGAY_LABEL = { lam_viec: 'Làm việc', nghi: 'Nghỉ', nghi_phep: 'Bác sĩ nghỉ phép' }

// Khoảng [from, to] (bao gồm cả ngày 'to'); mặc định = hôm nay.
function dayRange(from, to) {
  const start = from ? new Date(from) : new Date()
  start.setHours(0, 0, 0, 0)
  const end = to ? new Date(to) : new Date(start)
  end.setHours(0, 0, 0, 0)
  end.setDate(end.getDate() + 1) // '$lt end' -> bao gồm trọn ngày 'to'
  return { start, end }
}

export async function list(req, res) {
  try {
    const { from, to } = req.query
    const { start, end } = dayRange(from, to)

    const schedules = await LichLamViec.find({
      nurse_id: req.user.id,
      ngay: { $gte: start, $lt: end },
    })
      .populate({
        path: 'doctor_id',
        select: 'phong_kham_mac_dinh specialties',
        populate: [
          { path: 'user_id', select: 'ho_ten' },
          { path: 'specialties', select: 'ten' },
        ],
      })
      .sort({ ngay: 1 })
      .lean()

    const data = await Promise.all(schedules.map(async (s) => {
      const dayStart = new Date(s.ngay); dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1)
      const slots = s.slots || []

      // Giờ ca = min giờ bắt đầu -> max giờ kết thúc (chuỗi HH:MM so sánh trực tiếp được).
      const gio_bat_dau = slots.length ? slots.reduce((m, sl) => (sl.gio_bat_dau < m ? sl.gio_bat_dau : m), slots[0].gio_bat_dau) : null
      const gio_ket_thuc = slots.length ? slots.reduce((m, sl) => (sl.gio_ket_thuc > m ? sl.gio_ket_thuc : m), slots[0].gio_ket_thuc) : null

      // Số lịch hẹn trong ca = lịch của bác sĩ đó trong ngày (không tính hủy/không đến).
      const so_lich_hen = s.doctor_id ? await LichHen.countDocuments({
        doctor_id: s.doctor_id._id,
        ngay_kham: { $gte: dayStart, $lt: dayEnd },
        status: { $nin: ['cancelled', 'no_show'] },
      }) : 0

      // Dữ liệu cũ có thể thiếu trang_thai_ngay -> mặc định 'lam_viec' (đúng default schema).
      const ttn = s.trang_thai_ngay || 'lam_viec'

      return {
        id: s._id,
        ngay: s.ngay,
        doctor_id: s.doctor_id?._id ?? null,
        bac_si: s.doctor_id?.user_id?.ho_ten ?? null,
        chuyen_khoa: (s.doctor_id?.specialties || []).map((sp) => sp.ten).join(', ') || null,
        phong_kham: slots[0]?.phong_kham ?? s.doctor_id?.phong_kham_mac_dinh ?? null,
        gio_bat_dau,
        gio_ket_thuc,
        trang_thai_ngay: ttn,
        trang_thai_ngay_label: TRANG_THAI_NGAY_LABEL[ttn] ?? ttn,
        so_lich_hen,
      }
    }))

    return ok(res, data)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
