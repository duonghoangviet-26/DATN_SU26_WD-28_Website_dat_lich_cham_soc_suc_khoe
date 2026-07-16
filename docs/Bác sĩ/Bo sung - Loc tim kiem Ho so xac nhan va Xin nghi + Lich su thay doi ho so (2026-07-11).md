# Bổ sung — Lọc/tìm kiếm "Hồ sơ chờ xác nhận" & "Xin nghỉ" + Lịch sử thay đổi hồ sơ

> Ngày: 2026-07-11. Yêu cầu: (1) 2 trang "Hồ sơ chờ xác nhận" và "Xin nghỉ" cũng cần lọc/tìm kiếm để bác sĩ tra cứu lại sau này; (2) hồ sơ khám khi có thay đổi (xác nhận/yêu cầu chỉnh sửa) phải lưu lịch sử để đối chiếu sau này.

## 1. Đã kiểm tra trước khi sửa

- `doctorLeaveService.list()` / `GET /api/doctor/leaves` (`leaves.controller.js: listMyLeaveRequests`) — **đã trả toàn bộ lịch sử** yêu cầu nghỉ của bác sĩ (không giới hạn trạng thái), sort `ngay_tao: -1`. → Trang Xin nghỉ có sẵn đủ dữ liệu để lọc/tìm kiếm phía client, **không cần sửa backend**.
- `doctorAppointmentService.listPendingResults()` / `GET /api/doctor/appointments/pending-results` (`appointments.controller.js: listPendingResults`) — **trước đây hard-code** `status: 'cho_xac_nhan'`, không có cách nào xem lại hồ sơ đã xử lý (`da_xac_nhan`/`yeu_cau_chinh_sua`). Cần sửa backend để hỗ trợ "check sau này".
- Model `KetQuaKham` đã có sẵn field `lich_su_sua` (mảng `{nguoi_sua_id, thoi_diem_sua, noi_dung}`) và `requestResultRevision()` đã ghi vào đó — nhưng `confirmResult()` (bước xác nhận) **chưa ghi**. `getResult()` (API mà `RecordViewModal` gọi) đã trả nguyên `result` (bao gồm `lich_su_sua`) qua `.lean()` nên **không cần API mới**, chỉ cần populate tên người thực hiện + hiển thị ở frontend.

## 2. Thay đổi backend (đã duyệt ngầm theo yêu cầu trực tiếp của bạn — báo cáo lại để đối chiếu)

`backend/src/controllers/doctor/appointments.controller.js`:
- `listPendingResults`: thêm `req.query.status` tùy chọn.
  - Không truyền → giữ nguyên hành vi cũ (`cho_xac_nhan` only) — **Dashboard vẫn đếm đúng số hồ sơ cần xử lý, không bị ảnh hưởng**.
  - `status=all` → trả cả 3 trạng thái liên quan bác sĩ (`cho_xac_nhan`, `da_xac_nhan`, `yeu_cau_chinh_sua`), sort mới nhất trước (thay vì cũ nhất trước như hàng chờ xử lý).
  - `status=<giá trị cụ thể>` → lọc đúng giá trị đó; giá trị không hợp lệ → trả lỗi 400 rõ ràng thay vì âm thầm bỏ qua.
- `confirmResult`: thêm 1 dòng `result.lich_su_sua.push({...})` ghi lại "Bác sĩ xác nhận hồ sơ khám" kèm người thực hiện + thời điểm — cùng cơ chế đã có sẵn cho yêu cầu chỉnh sửa.
- `getResult`: thêm `.populate('lich_su_sua.nguoi_sua_id', 'ho_ten')` để hiển thị được tên người thực hiện thay vì chỉ ObjectId.

Không đổi route, không đổi response shape của các hàm khác, không đổi enum/tên trạng thái nào.

## 3. Thay đổi frontend

- `types/index.ts`: thêm `ExaminationHistoryEntry` + field `lich_su_sua?: ExaminationHistoryEntry[]` vào `ExaminationResult`.
- `doctor-appointment.service.ts`: `listPendingResults(status?: 'all' | KetQuaKhamStatus)` — tham số tùy chọn, lời gọi cũ (`listPendingResults()` ở Dashboard) không cần sửa, vẫn chạy đúng như trước.
- `DoctorPendingRecords.tsx`:
  - Gọi `listPendingResults('all')` để có đủ dữ liệu lịch sử.
  - Thêm filter card: tìm kiếm (tên bệnh nhân/dịch vụ/y tá nhập), trạng thái, khoảng ngày khám (từ–đến) — lọc `useMemo` client-side, có nút "Xóa lọc", hiển thị số kết quả, empty state phân biệt "chưa có hồ sơ" vs "không khớp bộ lọc", error state có nút "Thử lại".
  - `RecordViewModal`: thêm mục "Lịch sử thay đổi" — danh sách thời điểm + nội dung + người thực hiện (nếu có), chỉ hiện khi `lich_su_sua` có dữ liệu.
- `DoctorLeaveRequests.tsx`: thêm filter card tương tự — tìm theo lý do, trạng thái, khoảng ngày nghỉ (từ–đến) — lọc client-side trên dữ liệu `doctorLeaveService.list()` đã có sẵn đầy đủ, không gọi thêm API. Empty/error state cập nhật tương tự.

## 4. Kiểm tra

- `npx tsc --noEmit`: không lỗi ở bất kỳ file nào vừa sửa (32 lỗi còn lại trong repo đều thuộc `mock/doctor-appointments.ts`, không liên quan).
- `node --check` cho file backend đã sửa: cú pháp hợp lệ.
- Chưa chạy được ứng dụng thật (không có DB/trình duyệt trong môi trường này) — cần bạn tự kiểm tra luồng: xác nhận hồ sơ → mở lại "Xem chi tiết" → thấy mục "Lịch sử thay đổi" xuất hiện đúng entry vừa tạo.

## 5. Rủi ro còn lại

- `getResult()` giờ có thêm 1 `.populate()` — chi phí thêm không đáng kể (chỉ populate mảng con nhỏ `lich_su_sua`, không phải toàn bộ document liên quan).
- Trang "Hồ sơ chờ xác nhận" đổi từ "chỉ hiện hồ sơ đang chờ" sang "mặc định hiện cả lịch sử đã xử lý" — thay đổi hành vi hiển thị mặc định (không phải nghiệp vụ), có bộ lọc trạng thái để bác sĩ tự thu hẹp về "Chờ xác nhận" nếu chỉ muốn xem việc cần làm ngay.
