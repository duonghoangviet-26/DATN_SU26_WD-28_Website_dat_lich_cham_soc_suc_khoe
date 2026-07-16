# Audit — Service/API trang Bác sĩ

> Ngày kiểm tra: 2026-07-08
> Phạm vi: chỉ service/API được import/gọi từ doctor page. Không sửa service chung, không đổi tên API toàn hệ thống, không refactor axios instance/auth chung.
> Đây là **báo cáo hiện trạng — chưa sửa gì**.

---

## 1–2. API trang bác sĩ đang gọi, phân theo nhóm

| Nhóm | Service (frontend) | Hàm | Endpoint backend thật (comment sẵn, chưa bật) |
|---|---|---|---|
| Dashboard | `doctor-profile.service.ts` | `getStats()` | `GET /api/doctor/stats` |
| | `doctor-profile.service.ts` | `getReviews()` | `GET /api/doctor/stats/reviews` |
| Lịch làm việc | `schedule.service.ts` | `getAll(params?)` | `GET /api/doctor/schedule` |
| | `schedule.service.ts` | `lockSlot()` / `unlockSlot()` / `updatePhongKham()` | `PATCH /api/doctor/schedule/:scheduleId/slots/:slotId` |
| | `schedule.service.ts` | `requestCancelSlot()` | `POST /api/doctor/schedule/:scheduleId/slots/:slotId/request-cancel` |
| | `schedule.service.ts` | `create()` | ❌ Comment trỏ `POST /doctor/schedule` — route này không tồn tại ở backend |
| | `schedule.service.ts` | `deleteSchedule()` | ❌ Comment trỏ `DELETE /doctor/schedule/:scheduleId` — không tồn tại, và hàm không được gọi ở đâu (dead code) |
| Lịch hẹn (danh sách) | `doctor-appointment.service.ts` | `getAll({status, date})` | `GET /api/doctor/appointments` (FE hiện gọi không truyền tham số) |
| | `doctor-appointment.service.ts` | `confirm()` | `PATCH /api/doctor/appointments/:id/confirm` |
| | `doctor-appointment.service.ts` | `reject()` / `cancelConfirmed()` | `PATCH /api/doctor/appointments/:id/cancel` (2 hàm FE cùng trỏ 1 endpoint) |
| | `doctor-appointment.service.ts` | `complete()` | `PATCH /api/doctor/appointments/:id/complete` |
| Chi tiết lịch hẹn | `doctor-appointment.service.ts` | `getById(id)` | `GET /api/doctor/appointments/:id` — có định nghĩa trong service nhưng không trang nào gọi tới (chi tiết hiện là expand-row) |
| Hồ sơ khám | `examination.service.ts` | `getByAppointment(id)` | `GET /api/doctor/appointments/:id/result` |
| | `examination.service.ts` | `save()` | `POST` hoặc `PUT /api/doctor/appointments/:id/result` (tự chọn theo có/chưa có bản ghi) |
| Xác nhận hồ sơ | — | — | ❌ Không có API nào |
| Xin nghỉ | — | — | ❌ Không có API nào phía doctor |
| Profile bác sĩ | `doctor-profile.service.ts` | `get()` / `update()` | `GET` / `PUT /api/doctor/profile` |

Toàn bộ đang chạy mock (đúng giai đoạn dự án) — comment "Real API" đã viết sẵn trong từng hàm.

## 3. API dùng chung với admin — Không có

Đã grep toàn bộ import của 4 service riêng cho doctor (`doctor-profile.service`, `doctor-appointment.service`, `schedule.service`, `examination.service`): chỉ có page trong `pages/doctor/*` import, không admin/client page nào dùng chung.

Lưu ý về file dễ nhầm tên (đã cảnh báo từ audit đầu tiên): `frontend/src/services/doctor.service.ts` (khác `doctor-profile.service.ts`/`doctor-appointment.service.ts`) chỉ được admin (`ManageDoctor/*`, `ManageServiceSpecialtyDetail.tsx`) và client (`SpecialtyDoctors.tsx`) dùng, tương ứng API admin `/api/admin/doctors`. Trang bác sĩ không import file này — không có nhầm lẫn thực tế ở tầng code, chỉ dễ gây nhầm khi tìm kiếm theo tên.

Điểm lệch quy ước: `DoctorSchedule.tsx` import trực tiếp `mock/rooms.ts` (`import { mockRooms } from '@/mock/rooms'`) để hiển thị danh sách phòng trong modal chọn phòng — không qua lớp service nào (không có `room.service.ts` trong dự án). Vi phạm quy ước "Page → service → mock data" trong `CLAUDE.md`. Tuy nhiên chức năng "chọn phòng" này đã bị đánh dấu nên loại bỏ khỏi trang bác sĩ ở audit "Lịch làm việc" trước đó (thuộc quyền admin) — không đề xuất tạo `room.service.ts` mới cho doctor page, nên xử lý cùng lúc khi bỏ tính năng đó.

## 4. API thiếu

| Nhóm | Thiếu |
|---|---|
| Dashboard | API "tổng quan hôm nay" (ca làm việc, phòng, y tá, đếm lịch hẹn theo trạng thái trong ngày) |
| Chi tiết lịch hẹn | Có API backend (`getById`) nhưng chưa route/trang nào gọi |
| Hồ sơ khám → Xác nhận | Toàn bộ API: xem hồ sơ chờ xác nhận, xác nhận, yêu cầu chỉnh sửa |
| Xin nghỉ | Toàn bộ API: tạo/xem/hủy yêu cầu nghỉ phía doctor |
| Lịch làm việc | 2 hàm `create()`/`deleteSchedule()` trong service trỏ route không tồn tại — nên dọn bỏ (thừa/sai, không phải thiếu, vì bác sĩ vốn không được tạo/xóa lịch) |

## 5. Đề xuất tạo `doctor.service` riêng

Không cần tạo mới — đã có 4 service riêng cho doctor. Đề xuất dọn lại:

1. **[Trung bình]** Đổi tên `schedule.service.ts` → `doctor-schedule.service.ts` và `examination.service.ts` → `doctor-examination.service.ts`, thêm tiền tố `doctor-` nhất quán như 2 file còn lại — hiện 2 file này chỉ doctor dùng nhưng tên không thể hiện điều đó.
2. **[Cao]** Thêm `doctor-leave-request.service.ts` mới khi làm tính năng xin nghỉ.
3. **[Trung bình]** Khi làm luồng xác nhận hồ sơ, tách các hàm confirm/request-revision vào cùng `doctor-examination.service.ts` (không cần file riêng, cùng domain "hồ sơ khám").

## 6. Đề xuất naming API phía frontend

| Đề xuất | Hàm hiện tại | Ghi chú |
|---|---|---|
| `getDoctorDashboard()` | `doctorProfileService.getStats()` + `getReviews()` (2 hàm tách rời) | Có thể gộp thành 1 hàm dashboard mới khi thêm API "hôm nay" |
| `getDoctorSchedules()` | `scheduleService.getAll()` | Tên hiện tại đã ổn |
| `getDoctorAppointments()` | `doctorAppointmentService.getAll()` | Đã đúng tên, chỉ cần truyền tham số `status`/`date` thật |
| `getDoctorAppointmentDetail(id)` | `doctorAppointmentService.getById(id)` | Đã có sẵn, chỉ chưa được trang nào gọi |
| `getPendingMedicalRecords()` | chưa có | Cần thêm mới cùng lúc với API xác nhận hồ sơ |
| `confirmMedicalRecord(id)` | chưa có | Cần thêm mới |
| `requestMedicalRecordRevision(id, note)` | chưa có | Cần thêm mới, `note` bắt buộc |
| `createDoctorLeaveRequest(data)` | chưa có | Cần thêm mới cùng `doctor-leave-request.service.ts` |

## 7. Trạng thái thực hiện

Không sửa code nào ở bước này — chỉ liệt kê và đề xuất.

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
