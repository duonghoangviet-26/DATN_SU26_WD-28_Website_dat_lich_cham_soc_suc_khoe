// Tiện ích đơn thuốc — dùng chung cho form nhập/xác nhận kết quả khám.

// Loại bỏ các dòng thuốc rỗng (bác sĩ bấm "Thêm thuốc" nhưng chưa nhập tên) trước khi gửi lên
// backend (H2). Thuốc không có tên là vô nghĩa và sẽ bị schema DonThuoc từ chối (400) — lọc ở
// đây để tránh gửi rác, nhưng backend vẫn là chốt chặn cuối (validate so_ngay/gio_uong...).
export function stripEmptyDrugs<T extends { ten_thuoc: string }>(drugs: T[]): T[] {
  return drugs.filter((d) => d.ten_thuoc.trim() !== '')
}
