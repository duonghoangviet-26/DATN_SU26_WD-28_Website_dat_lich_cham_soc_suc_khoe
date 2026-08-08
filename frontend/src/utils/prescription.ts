// Tiện ích đơn thuốc — dùng chung cho form nhập/xác nhận kết quả khám.

// Loại bỏ các dòng thuốc rỗng (bác sĩ bấm "Thêm thuốc" nhưng chưa nhập tên) trước khi gửi lên
// backend (H2). Thuốc không có tên là vô nghĩa và sẽ bị schema DonThuoc từ chối (400) — lọc ở
// đây để tránh gửi rác, nhưng backend vẫn là chốt chặn cuối (validate so_ngay/gio_uong...).
export function stripEmptyDrugs<T extends { ten_thuoc: string }>(drugs: T[]): T[] {
  return drugs.filter((d) => d.ten_thuoc.trim() !== '')
}

// Backend chỉ chấp nhận giờ dạng "HH:MM" đủ 2 chữ số (xem DonThuoc.js isHHMM). Ô "Giờ uống" là
// text tự do — bác sĩ gõ "7:00" (thiếu số 0 đầu) là chuyện tự nhiên và bị từ chối 400 dù đã nhập
// đủ, đủ đúng giờ khám. Tự đệm số 0 trước khi gửi thay vì bắt bác sĩ nhớ quy ước 2 chữ số.
export function normalizeGioUong(times: string[]): string[] {
  return times.map((t) => {
    const match = /^(\d{1,2}):(\d{1,2})$/.exec(t.trim())
    if (!match) return t
    const [, h, m] = match
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
  })
}
