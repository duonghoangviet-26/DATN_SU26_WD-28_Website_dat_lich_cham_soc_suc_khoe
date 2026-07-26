// Ngày tái khám bắt buộc phải sau ngày khám hiện tại (không được trùng ngày khám hoặc quá khứ).
// Dùng chung cho toàn bộ luồng nhập/sửa hồ sơ khám (doctor/appointments.controller.js).
export function isNgayTaiKhamHopLe(ngayTaiKham, ngayKham) {
  const taiKham = new Date(ngayTaiKham)
  taiKham.setHours(0, 0, 0, 0)
  const kham = new Date(ngayKham)
  kham.setHours(0, 0, 0, 0)
  return taiKham > kham
}
