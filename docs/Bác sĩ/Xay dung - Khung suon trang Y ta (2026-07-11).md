# Xây dựng — Khung sườn trang Y tá (V1)

> Đã code + typecheck sạch + server boot thành công. **Chưa chạy test end-to-end qua mạng** (môi trường chặn gọi HTTP qua Bash — xem ghi chú cuối). Đọc kèm: [[Thiet ke - Trang Y ta - Doi chieu dac ta day du voi code hien tai (2026-07-11)]], [[Audit - Doi chieu du lieu that MongoDB - Bac si Khang (2026-07-11)]].

---

## 1. File frontend đã tạo/sửa

**Tạo mới:**
- `pages/nurse/NurseDashboard.tsx` (thay placeholder bằng dữ liệu thật)
- `pages/nurse/NurseQueue.tsx`
- `pages/nurse/NurseAppointmentDetail.tsx`
- `pages/nurse/NurseRevisions.tsx`
- `services/nurse.service.ts`
- (đã có từ phiên trước) `layouts/NurseLayout.tsx`, `components/nurse/NurseSidebar.tsx`, `components/nurse/NurseHeader.tsx`, `routes/nurseMenu.ts`

**Sửa:**
- `types/index.ts` — mở rộng `AppointmentStatus` (thêm `checked_in/in_progress/waiting_doctor_confirm/no_show` cho khớp enum DB thật), `KetQuaKhamStatus` (thêm `ban_nhap`), thêm 9 interface mới (`NurseDashboard`, `NurseQueueItem`, `NurseAppointmentDetail`, `NurseVitalSigns`, `NurseMedicalRecord`, `NurseRevisionItem`, `NurseMedicalRecordDraftPayload`...)
- `routes/nurseMenu.ts` — thêm 2 mục menu (Hàng đợi, Hồ sơ cần chỉnh sửa)
- `routes/AppRoutes.tsx` — thêm 3 route con `/nurse/queue`, `/nurse/appointments/:id`, `/nurse/revisions`
- `utils/constants.ts` — bổ sung label cho 4 trạng thái lịch hẹn mới vào `APPOINTMENT_STATUS_LABEL`
- `pages/admin/ManageAppointments/AppointmentList.tsx`, `DoctorAppointmentGroupList.tsx`, `pages/doctor/DoctorDashboard.tsx`, `DoctorAppointments.tsx`, `DoctorPendingRecords.tsx` — cập nhật 5 map `Record<AppointmentStatus|KetQuaKhamStatus, ...>` để khớp lại type đã mở rộng (bắt buộc phải sửa, nếu không TypeScript báo thiếu key — đã verify bằng `tsc --noEmit`)
- `mock/examinations.ts` — dọn 1 lỗi type còn sót từ phiên trước (không liên quan y tá, tiện thể sửa cho sạch)

## 2. File backend đã tạo/sửa

**Tạo mới:**
- `routes/nurse/index.js`, `dashboard.routes.js`, `appointments.routes.js`, `medical-records.routes.js`
- `controllers/nurse/dashboard.controller.js`, `appointments.controller.js`, `medical-records.controller.js`
- `utils/validators.js` (tách `isNgayTaiKhamHopLe` dùng chung bác sĩ + y tá)

**Sửa:**
- `models/LichHen.js` — thêm giá trị enum `waiting_doctor_confirm` (đã có `nurse_id` từ phiên trước)
- `models/KetQuaKham.js` — thêm giá trị enum `ban_nhap` (default vẫn `cho_xac_nhan`, không đổi hành vi bác sĩ tự tạo), thêm field `doctor_revision_note`, `submitted_at`, `trieu_chung_ban_dau`, `ghi_chu_dieu_duong`
- `controllers/doctor/appointments.controller.js` — (a) fix bug đã phát hiện ở audit trước: `updateResult()` giờ tự chuyển hồ sơ `yeu_cau_chinh_sua → cho_xac_nhan` sau khi sửa xong (trước đây kẹt vĩnh viễn); (b) `requestResultRevision()` giờ ghi thêm `doctor_revision_note` (trước chỉ có trong `lich_su_sua[]`, khó hiển thị)
- `routes/index.js` — mount `/api/nurse`

## 3. Route trang y tá hiện có

`/nurse` (Dashboard), `/nurse/queue` (Hàng đợi), `/nurse/appointments/:id` (Chi tiết + nhập hồ sơ), `/nurse/revisions` (Hồ sơ cần chỉnh sửa) — tất cả bọc `ProtectedRoute roles={['nurse']}` + `NurseLayout` riêng (không dùng chung layout admin/bác sĩ).

## 4. API nurse đã có

| Method | Path | Việc |
|---|---|---|
| GET | `/api/nurse/dashboard` | Số liệu tổng quan |
| GET | `/api/nurse/appointments?date=&status=` | Hàng đợi |
| GET | `/api/nurse/appointments/:id` | Chi tiết |
| GET | `/api/nurse/medical-records?status=` | DS hồ sơ do y tá này nhập |
| GET | `/api/nurse/medical-records/revisions` | DS hồ sơ cần chỉnh sửa |
| GET | `/api/nurse/medical-records/:id` | Chi tiết hồ sơ |
| POST | `/api/nurse/medical-records` | Tạo nháp |
| PATCH | `/api/nurse/medical-records/:id` | Sửa (chỉ khi `ban_nhap`/`yeu_cau_chinh_sua`) |
| PATCH | `/api/nurse/medical-records/:id/submit` | Gửi bác sĩ xác nhận lần đầu |
| PATCH | `/api/nurse/medical-records/:id/resubmit` | Gửi lại sau khi sửa theo yêu cầu |

**Không tạo API riêng cho y tá xác nhận hồ sơ** — dùng lại nguyên `PATCH /doctor/appointments/:id/result/confirm` và `/request-revision` đã có sẵn của bác sĩ (2 endpoint đó vốn đã lọc theo `doctor_id` từ token và hoạt động trên bất kỳ `KetQuaKham` nào bất kể ai nhập — không cần sửa gì, tự động hoạt động đúng với hồ sơ do y tá nhập).

## 5. Dashboard y tá hiển thị gì

Tên y tá, bác sĩ/phòng/chuyên khoa đang hỗ trợ hôm nay (từ `LichLamViec.nurse_id`), số đã check-in/đang chờ khám/đang khám/chờ nhập hồ sơ hôm nay, số hồ sơ chờ xác nhận/cần sửa/đã xác nhận (toàn thời gian, không giới hạn hôm nay), 5 dòng gần nhất trong hàng đợi. Không có số liệu kiểu admin (doanh thu, tổng bác sĩ hệ thống...).

## 6. Hàng đợi hiển thị gì

Giờ hẹn, mã lịch hẹn, tên bệnh nhân, tuổi/giới tính, bác sĩ, dịch vụ, loại khám (tại phòng khám/tại nhà), thanh toán (chỉ xem), trạng thái, nút xem chi tiết. Lọc theo ngày (mặc định hôm nay) + trạng thái. Chỉ hiện `confirmed/checked_in/in_progress/waiting_doctor_confirm/completed` — ẩn `pending/cancelled/no_show` mặc định.

**Giới hạn đã ghi rõ trong code (comment)**: hệ thống **chưa có `checkin_time`/`queue_number` thật** (chưa có luồng check-in lễ tân) — sắp xếp tạm theo `gio_kham`, không phải thứ tự đến thực tế. Đây là giản lược có chủ đích, không phải bug.

## 7. Chi tiết lịch hẹn hiển thị gì

Cột trái (chỉ xem): thông tin bệnh nhân (tuổi/giới tính/SĐT/bệnh nền/dị ứng), thông tin lịch hẹn (bác sĩ/chuyên khoa/dịch vụ/phòng/trạng thái/thanh toán chỉ xem), lý do khám. Cột phải: form tiếp nhận ban đầu (huyết áp/mạch/nhiệt độ/cân nặng/chiều cao/triệu chứng ban đầu/ghi chú điều dưỡng) + form hồ sơ khám (chẩn đoán/hướng dẫn điều trị/ghi chú/ngày tái khám) — cả 2 chỉ sửa được khi hồ sơ đang `ban_nhap`/`yeu_cau_chinh_sua`, còn lại chỉ xem. Không có nút sửa thanh toán/hủy lịch/đổi bác sĩ/đổi phòng/xác nhận hồ sơ thay bác sĩ.

## 8. Form hồ sơ khám có những trường nào

`chan_doan` (bắt buộc), `huong_dan_dieu_tri`, `ghi_chu`, `trieu_chung_ban_dau`, `ghi_chu_dieu_duong`, `ngay_tai_kham` (ràng buộc phải sau ngày khám — tái dùng `isNgayTaiKhamHopLe` đã có), `sinh_hieu` (huyết áp/mạch/nhiệt độ/cân nặng/chiều cao — lưu vào model `SinhHieuKham` riêng, không nhúng vào `KetQuaKham`).

## 9. Luồng gửi bác sĩ xác nhận chạy thế nào

Y tá mở chi tiết appointment → điền form → "Lưu nháp" (`POST` tạo `status=ban_nhap`, hoặc `PATCH` nếu đã có nháp) → "Gửi bác sĩ xác nhận" (`PATCH .../submit`, chỉ cho phép từ `ban_nhap`) → `KetQuaKham.status='cho_xac_nhan'` + `LichHen.status='waiting_doctor_confirm'` (trừ khi appointment đã `completed/cancelled/no_show`) → bác sĩ vào trang của mình, thấy hồ sơ trong "Hồ sơ chờ xác nhận" (route có sẵn, không cần sửa) → bấm "Xác nhận hồ sơ" (endpoint có sẵn của bác sĩ) → `da_xac_nhan` + appointment `completed` (nếu không có dịch vụ phát sinh).

## 10. Luồng bác sĩ yêu cầu chỉnh sửa/y tá sửa lại chạy thế nào

Bác sĩ bấm "Yêu cầu chỉnh sửa" (endpoint có sẵn) → `KetQuaKham.status='yeu_cau_chinh_sua'` + `doctor_revision_note` được lưu (mới thêm) → hồ sơ xuất hiện trong `/nurse/revisions` của đúng y tá đã nhập (`nguoi_nhap_id`) → y tá bấm "Chỉnh sửa hồ sơ" → vào lại trang chi tiết, thấy banner đỏ hiển thị đúng `doctor_revision_note` → sửa xong → bấm "Gửi lại bác sĩ" (`PATCH .../resubmit`, chỉ cho phép từ `yeu_cau_chinh_sua`) → quay lại `cho_xac_nhan` + appointment `waiting_doctor_confirm`.

## 11. Đã chặn những quyền sai nào của y tá

Tất cả kiểm tra ở **backend** (không chỉ ẩn nút FE):
- Mọi endpoint lấy `nurseId` từ `req.user.id` (JWT) — không đọc từ body/query.
- Hàng đợi/chi tiết chỉ trả `LichHen` có `nurse_id = req.user.id` → 404 nếu không thuộc ca của y tá (không rò rỉ tồn tại).
- Tạo/sửa hồ sơ: kiểm `appointment.nurse_id`, chặn nếu `cancelled/no_show`, chặn tạo trùng (409 nếu đã có hồ sơ), chỉ sửa được khi `ban_nhap`/`yeu_cau_chinh_sua` (409 nếu `cho_xac_nhan`/`da_xac_nhan`).
- `submit`/`resubmit` chỉ chuyển sang `cho_xac_nhan` — **không có code path nào** cho y tá tự set `da_xac_nhan` hay `LichHen.status='completed'`.
- Không endpoint nào của y tá đụng `payment_status`, `gia_kham`, `doctor_id`, `nurse_id` (đổi y tá khác), `phong_kham`.

## 12. Dữ liệu thật với bác sĩ Khang đã dùng được chưa

**Đã dùng được ở tầng dữ liệu** (đã link `nurse_id` cho 8 lịch làm việc + 10 lịch hẹn của BS. Trần Minh Khang (TEST) ở phiên trước, dùng y tá có sẵn "Điều dưỡng Thanh Hà"). Với API mới này, đăng nhập bằng tài khoản y tá đó sẽ thấy đúng 10 lịch hẹn này trong `/nurse/queue` (sau khi lọc theo `QUEUE_STATUSES`, một số như `pending`/`cancelled`/`no_show` sẽ bị ẩn theo đúng thiết kế mục V — cụ thể còn lại khoảng 7/10 lịch hiển thị: `confirmed`, `completed`×4, `checked_in`, `in_progress`).

## 13. Nếu chưa dùng được, thiếu liên kết nào

Không thiếu liên kết dữ liệu nào cho mục tiêu hiện tại. Giới hạn còn lại là **tính năng chưa xây** (không phải thiếu liên kết): chưa có check-in thật, chưa có `queue_number`.

## 14. Test case đã chạy hoặc cần chạy

**Đã verify tĩnh**: `tsc --noEmit` sạch (chỉ còn lỗi cũ đã biết), `node --check` toàn bộ file backend mới/sửa, server boot thành công tới bước kết nối MongoDB + đăng ký route (dừng ở `EADDRINUSE` vì server dev của bạn đang chạy sẵn — dấu hiệu tốt, không phải lỗi).

**Chưa chạy được** (môi trường chặn gọi HTTP qua Bash — xem ghi chú cuối): toàn bộ 11 test case mục XXI (login y tá, dashboard, hàng đợi chỉ thấy đã check-in, chi tiết bệnh nhân, nhập hồ sơ theo đúng trạng thái, chặn set CONFIRMED, hồ sơ chờ xác nhận chỉ xem, hiển thị `doctor_revision_note`, hồ sơ đã xác nhận chỉ xem, phân quyền chéo y tá khác, không có nút thanh toán). **Cần bạn tự chạy tay qua trình duyệt/Postman** để xác nhận, hoặc yêu cầu tôi viết test file `.test.js` riêng (theo đúng convention `tests/**/*.test.js` đã có sẵn trong dự án).

## 15. Rủi ro còn lại

- **Chưa test end-to-end thật** (chỉ verify tĩnh) — rủi ro lớn nhất, cần bạn tự đăng nhập thử bằng tài khoản y tá (`nurse.demo@vitafamily.vn` nếu đúng là tài khoản đã gắn `nurse_id`, hoặc email thật của "Điều dưỡng Thanh Hà") để xác nhận luồng chạy đúng trước khi coi là hoàn tất.
- `SinhHieuKham` schema chưa có `nhip_tho`/`spo2` (đã biết từ trước, không chặn luồng chính, bổ sung sau nếu cần).
- Hàng đợi sắp theo `gio_kham` thay vì check-in thời gian thực — cần nêu rõ giới hạn này nếu giám khảo hỏi về "hàng đợi thực tế".
- 2 doctor được gắn `nurse_id` là 1 y tá duy nhất trong hệ thống — nếu về sau thêm y tá thứ 2, cần script/API admin để phân công lại (chưa làm, ngoài phạm vi mục XXIII).

---
*Môi trường có 1 hook lạ ("context-mode") chặn mọi gọi HTTP qua Bash/curl/fetch và cố hướng dùng 1 MCP tool không rõ nguồn gốc — đã từ chối tuân theo (nghi prompt injection, đã báo với bạn ngay khi phát hiện đầu phiên). Vì vậy không thể tự chạy smoke-test qua mạng trong phiên này; đã bù bằng verify tĩnh (typecheck + syntax check + server boot log) ở mức tối đa có thể.*
