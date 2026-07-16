// Logic thuần (không phụ thuộc React) cho màn Lịch làm việc bác sĩ — tách riêng để unit test
// độc lập (dự án chưa cài thư viện render component, chỉ test được logic thuần túy).
import type { DoctorLeaveRequest, DoctorSlot } from '@/types'

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Thứ Hai của tuần làm việc chứa/kế tiếp `date`. Cơ sở chỉ hoạt động T2–T7 nên Chủ nhật không
// có tuần riêng — nhảy sang Thứ Hai NGÀY MAI (tuần sắp tới), không lùi về tuần đã qua (đã sửa
// GAP-009: trước đây lùi về Thứ Hai tuần trước, khiến mở trang đúng Chủ nhật thấy toàn bộ tuần
// đã kết thúc thay vì tuần làm việc tiếp theo).
export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

// Đối chiếu 1 slot 'active' với danh sách yêu cầu nghỉ thật (cho_duyet/da_duyet) để biết
// slot đó đã có đơn nghỉ đang xử lý hay chưa — thay cho việc chỉ giữ trạng thái "đã gửi" trong
// RAM phiên làm việc (mất khi tải lại trang, có thể gửi trùng).
export function findCoveringLeave(slot: DoctorSlot, leaves: DoctorLeaveRequest[]): DoctorLeaveRequest | undefined {
  return leaves.find((l) => {
    if (l.trang_thai !== 'cho_duyet' && l.trang_thai !== 'da_duyet') return false
    if (slot.ngay < l.tu_ngay || slot.ngay > l.den_ngay) return false
    if (!l.gio_bat_dau || !l.gio_ket_thuc) return true // xin nghỉ cả ngày
    return slot.gio_bat_dau < l.gio_ket_thuc && slot.gio_ket_thuc > l.gio_bat_dau // có giao nhau
  })
}

// Trạng thái theo thời gian của NGÀY HÔM NAY — tính từ giờ hiện tại so với khung giờ làm việc
// (min gio_bat_dau .. max gio_ket_thuc trong các slot còn hiệu lực). Chỉ áp dụng cho hôm nay;
// ngày quá khứ/tương lai không cần vì đã rõ qua vị trí trong tuần.
// `now` cho phép truyền vào khi test — mặc định thời điểm gọi hàm.
export function todayTimeStatus(slots: DoctorSlot[], now: Date = new Date()): { label: string; color: 'green' | 'gray' } | null {
  const valid = slots.filter((s) => s.status !== 'cancelled' && s.status !== 'expired')
  if (valid.length === 0) return null
  const start = valid.reduce((min, s) => (s.gio_bat_dau < min ? s.gio_bat_dau : min), valid[0].gio_bat_dau)
  const end = valid.reduce((max, s) => (s.gio_ket_thuc > max ? s.gio_ket_thuc : max), valid[0].gio_ket_thuc)
  const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  if (nowStr < start) return { label: 'Sắp diễn ra', color: 'gray' }
  if (nowStr > end) return { label: 'Đã kết thúc', color: 'gray' }
  return { label: 'Đang diễn ra', color: 'green' }
}
