import { BacSi, NghiPhepBacSi, LichHen } from '../../models/index.js'
import { ok, created, fail } from '../../utils/response.js'
import { AFFECTED_BY_LEAVE_STATUSES } from '../../utils/appointmentStatus.js'

// ============================================================
// Bác sĩ gửi yêu cầu nghỉ — Routes: /api/doctor/leaves
// Luôn tạo ở trạng thái 'cho_duyet' — chỉ Admin được duyệt/từ chối
// (backend/src/controllers/admin/doctor-leaves.controller.js). Bác sĩ chỉ được
// tạo, xem danh sách của chính mình, và hủy khi còn 'cho_duyet'.
// ============================================================

async function getDocId(userId) {
  const d = await BacSi.findOne({ user_id: userId }).select('_id').lean()
  return d?._id ?? null
}

function formatLeave(leave) {
  return {
    id: leave._id,
    tu_ngay: leave.tu_ngay.toISOString().slice(0, 10),
    den_ngay: leave.den_ngay.toISOString().slice(0, 10),
    gio_bat_dau: leave.gio_bat_dau ?? null,
    gio_ket_thuc: leave.gio_ket_thuc ?? null,
    ly_do: leave.ly_do ?? null,
    trang_thai: leave.trang_thai,
    // Ghi chú xử lý của Admin (khi duyệt/từ chối) + thời điểm duyệt — dữ liệu đã có trong DB,
    // trước đây API không trả nên bác sĩ không xem được (xem docs/doctor-schedule-*).
    ghi_chu: leave.ghi_chu ?? null,
    thoi_diem_duyet: leave.thoi_diem_duyet ?? null,
    ngay_tao: leave.ngay_tao ?? null,
    ngay_cap_nhat: leave.ngay_cap_nhat ?? null,
  }
}

// Đếm số lịch hẹn CÒN HIỆU LỰC (chưa khám xong, chưa hủy) của bác sĩ trong khoảng ngày nghỉ —
// nếu có khung giờ thì lọc thêm theo giờ khám. Chỉ ĐẾM (đọc), không lưu vào DB.
async function demLichHenAnhHuong(docId, start, end, gio_bat_dau, gio_ket_thuc) {
  const endNextDay = new Date(end)
  endNextDay.setDate(endNextDay.getDate() + 1)

  let list = await LichHen.find({
    doctor_id: docId,
    status: { $in: AFFECTED_BY_LEAVE_STATUSES },
    ngay_kham: { $gte: start, $lt: endNextDay },
  }).select('gio_kham').lean()

  if (gio_bat_dau && gio_ket_thuc) {
    list = list.filter((a) => a.gio_kham >= gio_bat_dau && a.gio_kham < gio_ket_thuc)
  }
  return list.length
}

// ─── GET /api/doctor/leaves ───────────────────────────────────────────────────
// Chỉ danh sách yêu cầu nghỉ của chính bác sĩ đang đăng nhập.
export async function listMyLeaveRequests(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    const leaves = await NghiPhepBacSi.find({ bac_si_id: docId })
      .sort({ ngay_tao: -1 })
      .lean()

    return ok(res, leaves.map(formatLeave))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── POST /api/doctor/leaves ─────────────────────────────────────────────────
// Dùng cho cả form "Xin nghỉ" và nút "Gửi yêu cầu nghỉ cho ca đó" ở trang Lịch
// làm việc — tu_ngay/den_ngay mặc định là cùng 1 ngày (ngày xin nghỉ); gio_bat_dau/
// gio_ket_thuc để trống nghĩa là xin nghỉ cả ngày.
export async function createLeaveRequest(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    const { tu_ngay, den_ngay, ly_do, gio_bat_dau, gio_ket_thuc } = req.body
    if (!tu_ngay || !den_ngay) return fail(res, 400, 'Thiếu ngày xin nghỉ')
    if (!ly_do?.trim()) return fail(res, 400, 'Bắt buộc nhập lý do xin nghỉ')

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const startDate = new Date(tu_ngay)
    const endDate = new Date(den_ngay)
    if (startDate < today) return fail(res, 400, 'Không thể xin nghỉ cho ngày đã qua')

    const gioBatDau = gio_bat_dau?.trim() || null
    const gioKetThuc = gio_ket_thuc?.trim() || null

    // Chống gửi trùng: xét theo KHUNG GIỜ giao nhau, không còn chặn cả ngày như trước —
    // cho phép nhiều đơn nghỉ theo ca khác giờ trong cùng 1 ngày (khớp nút "Gửi yêu cầu nghỉ"
    // theo từng slot ở trang Lịch làm việc). Nếu 1 trong 2 đơn là "cả ngày" (không gio_*) thì
    // luôn coi là trùng vì phạm vi cả ngày bao trùm mọi khung giờ.
    const overlappingCandidates = await NghiPhepBacSi.find({
      bac_si_id: docId,
      trang_thai: { $in: ['cho_duyet', 'da_duyet'] },
      tu_ngay: { $lte: endDate },
      den_ngay: { $gte: startDate },
    }).select('gio_bat_dau gio_ket_thuc').lean()

    const trung = overlappingCandidates.some((existing) => {
      const existingIsFullDay = !existing.gio_bat_dau || !existing.gio_ket_thuc
      const newIsFullDay = !gioBatDau || !gioKetThuc
      if (existingIsFullDay || newIsFullDay) return true
      return gioBatDau < existing.gio_ket_thuc && gioKetThuc > existing.gio_bat_dau
    })
    if (trung) return fail(res, 409, 'Đã có yêu cầu nghỉ đang xử lý trùng khung giờ này')

    // Đếm lịch hẹn bị ảnh hưởng để cảnh báo bác sĩ — không lưu vào DB, tính lại khi cần.
    const so_lich_hen_anh_huong = await demLichHenAnhHuong(docId, startDate, endDate, gioBatDau, gioKetThuc)

    const leave = await NghiPhepBacSi.create({
      bac_si_id: docId,
      tu_ngay: startDate,
      den_ngay: endDate,
      gio_bat_dau: gioBatDau,
      gio_ket_thuc: gioKetThuc,
      ly_do: ly_do.trim(),
    })

    return created(
      res,
      { ...formatLeave(leave), so_lich_hen_anh_huong },
      so_lich_hen_anh_huong > 0
        ? `Đã gửi yêu cầu nghỉ — chờ Admin duyệt. Có ${so_lich_hen_anh_huong} lịch hẹn sẽ bị ảnh hưởng.`
        : 'Đã gửi yêu cầu nghỉ — chờ Admin duyệt',
    )
  } catch (err) {
    return fail(res, 400, err.message)
  }
}

// ─── PATCH /api/doctor/leaves/:id/cancel ─────────────────────────────────────
// Chỉ cho hủy yêu cầu của chính bác sĩ, và chỉ khi còn 'cho_duyet'. Không đụng
// tới LichLamViec/LichHen — hủy yêu cầu không có nghĩa là mở lại ca hay hủy lịch
// hẹn bệnh nhân (những việc đó do Admin xử lý sau khi duyệt, ngoài phạm vi ở đây).
export async function cancelLeaveRequest(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    const leave = await NghiPhepBacSi.findOne({ _id: req.params.id, bac_si_id: docId })
    if (!leave) return fail(res, 404, 'Không tìm thấy yêu cầu nghỉ')
    if (leave.trang_thai !== 'cho_duyet') {
      return fail(res, 409, 'Chỉ hủy được yêu cầu đang chờ duyệt')
    }

    leave.trang_thai = 'da_huy'
    await leave.save()

    return ok(res, formatLeave(leave), 'Đã hủy yêu cầu nghỉ')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
