import { BacSi, NghiPhepBacSi } from '../../models/index.js'
import { ok, created, fail } from '../../utils/response.js'

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
    ngay_tao: leave.ngay_tao ?? null,
  }
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
    if (startDate < today) return fail(res, 400, 'Không thể xin nghỉ cho ngày đã qua')

    const leave = await NghiPhepBacSi.create({
      bac_si_id: docId,
      tu_ngay: new Date(tu_ngay),
      den_ngay: new Date(den_ngay),
      gio_bat_dau: gio_bat_dau?.trim() || null,
      gio_ket_thuc: gio_ket_thuc?.trim() || null,
      ly_do: ly_do.trim(),
    })

    return created(res, formatLeave(leave), 'Đã gửi yêu cầu nghỉ — chờ Admin duyệt')
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
