// ============================================================
// Phân loại trạng thái lịch hẹn (LichHen.status) — DÙNG CHUNG
// ============================================================
// Danh sách giá trị lấy đúng theo enum khai báo trong models/LichHen.js:
//   ['pending','confirmed','checked_in','in_progress','waiting_doctor_confirm',
//    'completed','cancelled','no_show']
// KHÔNG tự thêm/đổi trạng thái. Nếu enum model đổi, cập nhật ở ĐÂY (một nơi duy nhất)
// để tránh lặp logic ở nhiều controller.
// ============================================================

// Lịch hẹn CÒN HIỆU LỰC / bị ảnh hưởng khi bác sĩ nghỉ: chưa khám xong và chưa bị loại.
// Không gồm 'completed' (đã khám xong), 'cancelled' (đã hủy), 'no_show' (không đến).
export const AFFECTED_BY_LEAVE_STATUSES = [
  'pending',
  'confirmed',
  'checked_in',
  'in_progress',
  'waiting_doctor_confirm',
]

// Lịch hẹn CHIẾM CHỖ trong ca (gồm cả đã khám xong) — dùng cho thống kê "đã dùng chỗ".
// = còn hiệu lực + completed. Không gồm cancelled/no_show (đã giải phóng/không tính).
export const OCCUPYING_STATUSES = [...AFFECTED_BY_LEAVE_STATUSES, 'completed']

// Lịch hẹn đã ra khỏi ca (không chiếm chỗ, không nằm trong hàng chờ).
export const RELEASED_STATUSES = ['cancelled', 'no_show']

// Đang trong hàng chờ khám thực tế (đã đến / đang khám).
export const QUEUE_STATUSES = ['checked_in', 'in_progress']

export function isAffectedByLeave(status) {
  return AFFECTED_BY_LEAVE_STATUSES.includes(status)
}

export function isOccupying(status) {
  return OCCUPYING_STATUSES.includes(status)
}

// Gom số lượng lịch hẹn theo nhóm nghiệp vụ — trả object đếm, không suy đoán trạng thái lạ.
// Trạng thái không nằm trong bất kỳ nhóm nào sẽ được đếm riêng ở `khac` để không âm thầm bỏ sót.
export function thongKeLichHen(appointments) {
  const counts = {
    tong_lich_hen: 0, // không gồm cancelled & no_show
    cho_kham: 0, // confirmed
    da_den: 0, // checked_in
    dang_kham: 0, // in_progress
    cho_xac_nhan_ho_so: 0, // waiting_doctor_confirm
    cho_tiep_nhan: 0, // pending
    hoan_thanh: 0, // completed
    khong_den: 0, // no_show
    da_huy: 0, // cancelled
    khac: 0, // trạng thái lạ (nếu enum model đổi mà chưa cập nhật helper)
    so_lich_hen_con_hieu_luc: 0, // = AFFECTED_BY_LEAVE
  }
  for (const a of appointments) {
    switch (a.status) {
      case 'pending': counts.cho_tiep_nhan++; break
      case 'confirmed': counts.cho_kham++; break
      case 'checked_in': counts.da_den++; break
      case 'in_progress': counts.dang_kham++; break
      case 'waiting_doctor_confirm': counts.cho_xac_nhan_ho_so++; break
      case 'completed': counts.hoan_thanh++; break
      case 'no_show': counts.khong_den++; break
      case 'cancelled': counts.da_huy++; break
      default: counts.khac++; break
    }
    if (!RELEASED_STATUSES.includes(a.status)) counts.tong_lich_hen++
    if (isAffectedByLeave(a.status)) counts.so_lich_hen_con_hieu_luc++
  }
  return counts
}
