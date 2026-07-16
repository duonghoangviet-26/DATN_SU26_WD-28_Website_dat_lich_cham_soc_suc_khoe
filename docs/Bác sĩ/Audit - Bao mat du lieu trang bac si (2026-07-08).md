# Audit — Bảo mật dữ liệu trang Bác sĩ

> Ngày kiểm tra: 2026-07-08
> Phạm vi: chỉ cách doctor page lấy/hiển thị dữ liệu. Không sửa auth hệ thống, không kiểm tra sâu admin/patient.
> Đây là **báo cáo hiện trạng — chưa sửa gì**.

---

## Đối chiếu 7 yêu cầu bảo mật

### 1. Bác sĩ chỉ xem lịch làm việc của chính mình — ✅ An toàn

`backend/src/controllers/doctor/schedule.controller.js: getSchedules` — `doc = await BacSi.findOne({ user_id: req.user.id })` rồi `LichLamViec.find({ doctor_id: doc._id, ...dateFilter })`. Chỉ nhận `from`/`to` từ query, không có tham số `doctorId` nào được chấp nhận từ client. `updateSlot`/`requestCancelSlot` cũng re-check `doctor_id: bacSi._id` trước khi cho thao tác trên `scheduleId`.

### 2. Bác sĩ chỉ xem lịch hẹn của chính mình — ✅ An toàn

`backend/src/controllers/doctor/appointments.controller.js: list/getById` — `docId = await getDocId(req.user.id)` rồi filter `{ doctor_id: docId }`. `getById` dùng `LichHen.findOne({ _id: req.params.id, doctor_id: docId })` — lịch hẹn của bác sĩ khác trả `404`, không lộ dữ liệu.

### 3. Bác sĩ chỉ xem hồ sơ khám thuộc lịch hẹn của mình — ⚠️ An toàn nhưng có rủi ro tiềm ẩn

`getResult`/`createResult`/`updateResult` đều bắt đầu bằng `LichHen.findOne({ _id: req.params.id, doctor_id: docId })` trước khi chạm vào `KetQuaKham` — an toàn ở các endpoint hiện có. Nhưng bản thân `KetQuaKham.js` không lưu `doctor_id` trực tiếp (`bac_si_phu_trach_id` luôn `null` vì `createResult` không set field này — đã xác nhận ở `Audit - Ho so kham bac si`). Rủi ro tiềm ẩn: nếu sau này có endpoint mới kiểu `GET /api/doctor/medical-records` (list hồ sơ khám trực tiếp, không qua join `LichHen`), sẽ không có cách nào filter theo bác sĩ ở tầng `KetQuaKham` vì field đó rỗng — dễ vô tình làm lộ hồ sơ của bác sĩ khác nếu người viết code sau này quên join qua `LichHen`.

### 4. Frontend không tự truyền doctorId — ✅ Đúng

Rà cả 4 service (`doctor-profile.service.ts`, `doctor-appointment.service.ts`, `schedule.service.ts`, `examination.service.ts`): không hàm nào nhận tham số `doctorId`. `axiosInstance.ts` tự gắn JWT vào mọi request qua interceptor (`config.headers.Authorization = Bearer ${token}`) — khi bật API thật, danh tính bác sĩ hoàn toàn dựa vào token, không cần và không có chỗ nào để truyền `doctorId` thủ công.

### 5. doctorId trên URL — Không có, không áp dụng

Route `/doctor`, `/doctor/appointments`, `/doctor/schedule`, `/doctor/profile` không có segment `doctorId`/`:id` nào chứa danh tính bác sĩ. Không có rủi ro loại này ở thời điểm hiện tại.

### 6. Không hiển thị dữ liệu toàn bộ bệnh nhân — ✅ An toàn

Routes doctor (`profile`, `schedule`, `appointments`, `stats`) không có endpoint "danh sách bệnh nhân" nào độc lập. Thông tin bệnh nhân (`benh_nhan`, `so_dien_thoai`, `tuoi`, `gioi_tinh`, `di_ung`, `benh_nen`) trong `formatAppointment()` chỉ được join theo từng lịch hẹn đã lọc theo `doctor_id` — bác sĩ chỉ thấy bệnh nhân đã đặt lịch với chính mình.

### 7. Không cho bác sĩ thao tác ngoài quyền — ❌ Có 2 vị trí vi phạm

| Vị trí | Vấn đề |
|---|---|
| `backend/src/controllers/doctor/schedule.controller.js: updateSlot` + `frontend/src/pages/doctor/DoctorSchedule.tsx` (modal "Chọn phòng khám") | Bác sĩ tự set `phong_kham` — quyền vốn thuộc admin |
| Cùng `updateSlot` + nút "Tạm nghỉ"/"Mở lại" trong `DoctorSchedule.tsx` | Bác sĩ tự đổi `status` slot `active`↔`locked` ngay lập tức, không qua `NghiPhepBacSi`, không cần admin duyệt |
| `backend/src/controllers/doctor/appointments.controller.js: createResult/updateResult` + `ExamModal` trong `DoctorAppointments.tsx` | Bác sĩ tự viết nội dung hồ sơ khám chính — vai trò này thuộc y tá theo nghiệp vụ |

Cả 3 vị trí này không phải rủi ro rò rỉ dữ liệu (vẫn scope đúng theo bác sĩ đăng nhập, không xem/sửa được dữ liệu của bác sĩ khác) — mà là vượt ranh giới vai trò (role boundary), đã phân tích chi tiết ở `Audit - Lich lam viec bac si` và `Audit - Ho so kham bac si`.

## Tổng kết rủi ro theo file

| File | Dòng/hàm | Loại rủi ro |
|---|---|---|
| `backend/src/models/KetQuaKham.js` + `controllers/doctor/appointments.controller.js: createResult` | `bac_si_phu_trach_id` không được set | Rủi ro tiềm ẩn, chưa gây hại hiện tại — cần set field này để chống lỗi khi mở rộng API sau này |
| `backend/src/controllers/doctor/schedule.controller.js: updateSlot` | Set `phong_kham` + đổi `status` | Vượt quyền (không phải rò dữ liệu) |
| `frontend/src/pages/doctor/DoctorSchedule.tsx` | Modal chọn phòng, nút Tạm nghỉ/Mở lại | UI cho phép 2 hành động vượt quyền trên |
| `backend/src/controllers/doctor/appointments.controller.js: createResult/updateResult` | Bác sĩ tự viết hồ sơ | Vượt quyền (lấn vai trò y tá) |

Không phát hiện lỗ hổng rò rỉ dữ liệu chéo giữa các bác sĩ, không phát hiện đường lộ toàn bộ bệnh nhân, không phát hiện doctorId bị truyền tùy tiện từ frontend. Điểm cần xử lý duy nhất thuộc nhóm "bảo mật" thực sự (không phải role-boundary) là mục 3 — field `bac_si_phu_trach_id` bỏ trống.

## Đề xuất xử lý (chỉ trong phạm vi doctor page — CHƯA áp dụng)

1. **[Cao]** Sửa `createResult` (backend) để set `bac_si_phu_trach_id: docId` khi tạo `KetQuaKham` — đóng rủi ro tiềm ẩn ở mục 3, không đổi hành vi hiện tại, chỉ điền thêm 1 field còn thiếu.
2. **[Cao]** Bỏ khả năng set `phong_kham` khỏi `updateSlot` (hoặc tách route riêng chỉ cho phép sửa `status` giữa `active`/`booked`/`locked` do hệ thống set, không cho client trực tiếp gán qua API doctor).
3. **[Cao]** Thay cơ chế khóa/mở ca tức thời bằng luồng `NghiPhepBacSi` (gửi yêu cầu → chờ duyệt).
4. **[Cao]** Thiết kế lại luồng hồ sơ khám (y tá nhập → bác sĩ xác nhận).
5. **[Thấp]** Khi thêm endpoint mới cho doctor trong tương lai, giữ nguyên pattern hiện có (luôn `BacSi.findOne({ user_id: req.user.id })` trước, không nhận `doctorId` từ query/body/params) — điểm mạnh nhất hiện tại của trang bác sĩ, cần giữ nguyên khi mở rộng.

## Trạng thái thực hiện

Không sửa code/auth nào ở bước này — chỉ kiểm tra và ghi nhận.

---

## Liên quan

- `Audit - Ra soat trang bac si (2026-07-08).md` — audit tổng quát toàn bộ trang bác sĩ.
- `Audit - Route va phan quyen trang bac si (2026-07-08).md` — audit route & phân quyền.
- `Audit - Dashboard bac si (2026-07-08).md` — audit màn Dashboard.
- `Audit - Lich lam viec bac si (2026-07-08).md` — audit màn Lịch làm việc.
- `Audit - Danh sach lich hen bac si (2026-07-08).md` — audit danh sách lịch hẹn.
- `Audit - Chi tiet lich hen bac si (2026-07-08).md` — audit chi tiết lịch hẹn.
- `Audit - Ho so kham bac si (2026-07-08).md` — audit hồ sơ khám.
- `Audit - Xin nghi bac si (2026-07-08).md` — audit chức năng xin nghỉ.
- `Audit - Logic 6 ngay lam viec (2026-07-08).md` — audit logic 6 ngày làm việc.
- `Audit - Service va API trang bac si (2026-07-08).md` — audit service/API.
- `Audit - Type va interface trang bac si (2026-07-08).md` — audit type/interface.
- `Audit - UI trang thai trang bac si (2026-07-08).md` — audit UI trạng thái.
