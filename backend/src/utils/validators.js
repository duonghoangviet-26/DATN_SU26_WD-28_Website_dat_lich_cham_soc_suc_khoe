// Ngày tái khám bắt buộc phải sau ngày khám hiện tại (không được trùng ngày khám hoặc quá khứ).
// Dùng chung cho luồng bác sĩ tự nhập (doctor/appointments.controller.js) và luồng y tá nhập
// hộ (nurse/medical-records.controller.js) — cùng 1 quy tắc nghiệp vụ, không lặp lại.
export function isNgayTaiKhamHopLe(ngayTaiKham, ngayKham) {
  const taiKham = new Date(ngayTaiKham)
  taiKham.setHours(0, 0, 0, 0)
  const kham = new Date(ngayKham)
  kham.setHours(0, 0, 0, 0)
  return taiKham > kham
}
