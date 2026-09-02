import { NguoiDung, ThongBao } from '../models/index.js'

// ============================================================
// Báo lễ tân từ phía bác sĩ — DÙNG CHUNG cho 2 nơi gọi:
//   - Trong phòng khám, gắn 1 bệnh nhân cụ thể (doctor/exam-session.controller.js)
//   - Ngoài "Hồ sơ chờ khám", KHÔNG gắn bệnh nhân nào (doctor/queue.controller.js) — thêm
//     2026-08-21 vì bác sĩ cần báo được bất cứ lúc nào (ca khám quá lâu, khám nhanh có thể
//     đưa bệnh nhân tiếp theo vào...), không chỉ khi đang đứng trong một phiên khám.
// ============================================================

const TIEU_DE_THEO_MUC_DO = {
  urgent: 'Bác sĩ báo khẩn',
  warning: 'Bác sĩ cần lễ tân xử lý',
  info: 'Cập nhật từ phòng khám',
}

export function chuanHoaMucDoBaoLeTan(value) {
  return ['urgent', 'warning', 'info'].includes(value) ? value : 'warning'
}

export function chuanHoaNoiDungBaoLeTan(value) {
  const noiDung = String(value ?? '').trim()
  if (!noiDung) throw Object.assign(new Error('Vui lòng nhập nội dung cần báo lễ tân'), { statusCode: 400 })
  if (noiDung.length > 1000) throw Object.assign(new Error('Nội dung thông báo tối đa 1000 ký tự'), { statusCode: 400 })
  return noiDung
}

/** Gửi 1 thông báo tới TOÀN BỘ lễ tân đang hoạt động. Trả số lượng đã gửi. */
export async function guiThongBaoChoLeTan({ mucDo, noiDung, relatedId = null, extraData = {} }) {
  const receptionists = await NguoiDung.find({ role: 'receptionist', status: 'active' }).select('_id').lean()
  if (receptionists.length === 0) {
    throw Object.assign(new Error('Chưa có tài khoản lễ tân đang hoạt động'), { statusCode: 404 })
  }

  const notifications = await ThongBao.insertMany(receptionists.map((receptionist) => ({
    user_id: receptionist._id,
    tieu_de: TIEU_DE_THEO_MUC_DO[mucDo],
    noi_dung: noiDung,
    loai: 'system',
    related_id: relatedId,
    related_type: 'doctor_reception_message',
    du_lieu_dinh_kem: { priority: mucDo, source: 'doctor_reception_message', url: '/receptionist/quan-ly-dieu-phoi', ...extraData },
    ngay_gui_du_kien: new Date(),
  })))
  return notifications.length
}
