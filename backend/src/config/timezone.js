// ============================================================
// ÉP MÚI GIỜ TIẾN TRÌNH = UTC (GAP-8)
// ============================================================
// Lý do: LichLamViec.ngay từng bị ghi ở HAI múi giờ khác nhau — cron trên server (UTC) ghi
// 00:00:00Z, còn seed chạy trên máy dev VN (+7) ghi 17:00:00Z (= 00:00 giờ VN). Vì unique index
// {doctor_id, ngay} và các chốt find-before-create đều so khớp theo ĐÚNG mốc thời gian (instant),
// hai bản "cùng ngày lịch" nhưng khác instant lọt qua → sinh document trùng ngày (21 cặp, xem
// docs/doctor-schedule-database-gap-analysis.md).
//
// Đặt TZ cố định = UTC cho MỌI môi trường (server, máy dev, script seed) để mọi phép tính ngày
// (sinh lịch, đọc lịch, filter from/to) đều nhất quán, không phụ thuộc máy đang chạy.
//
// QUAN TRỌNG: module này PHẢI được import ĐẦU TIÊN — trước mọi module khác dùng Date.
process.env.TZ = 'UTC'
