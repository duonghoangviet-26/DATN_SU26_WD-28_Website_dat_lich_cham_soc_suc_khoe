# Audit — Rà soát hiện trạng trang Bác sĩ

> Ngày kiểm tra: 2026-07-08
> Phạm vi: chỉ trang bác sĩ (`/doctor/*`). Không đụng admin, bệnh nhân, dịch vụ, thanh toán.
> Đây là **báo cáo hiện trạng — chưa sửa gì**. Dùng để lên kế hoạch sửa theo từng bước nhỏ.

---

## 1. Bản đồ file trang bác sĩ

**Route backend** (mount `/api/doctor`, đã `verifyToken + requireRole('doctor')`)
- `backend/src/routes/doctor/index.js`, `profile.routes.js`, `schedule.routes.js`, `appointments.routes.js`, `stats.routes.js`

**Controller backend**
- `backend/src/controllers/doctor/profile.controller.js`
- `backend/src/controllers/doctor/schedule.controller.js`
- `backend/src/controllers/doctor/appointments.controller.js`
- `backend/src/controllers/doctor/stats.controller.js`

**Model liên quan**
- `BacSi.js`, `LichLamViec.js`, `LichHen.js`, `KetQuaKham.js`, `NghiPhepBacSi.js`, `HoSoChiTietBacSi.js`, `DonThuoc.js`

**Page frontend**
- `frontend/src/pages/doctor/DoctorDashboard.tsx`
- `frontend/src/pages/doctor/DoctorAppointments.tsx`
- `frontend/src/pages/doctor/DoctorSchedule.tsx`
- `frontend/src/pages/doctor/DoctorProfile.tsx`

**Component / Layout**
- `frontend/src/components/doctor/DoctorSidebar.tsx`
- `frontend/src/components/doctor/DoctorHeader.tsx`
- `frontend/src/layouts/DoctorLayout.tsx`

**Route / menu frontend**
- `frontend/src/routes/AppRoutes.tsx` (khối `/doctor`, có `ProtectedRoute roles={['doctor']}`)
- `frontend/src/routes/doctorMenu.ts`

**Service frontend**
- `frontend/src/services/doctor-appointment.service.ts`
- `frontend/src/services/schedule.service.ts`
- `frontend/src/services/examination.service.ts`
- `frontend/src/services/doctor-profile.service.ts`

**Type**
- `frontend/src/types/index.ts`: `DoctorProfile`, `DoctorSlot`, `DoctorAppointmentDetail`, `ExaminationResult`, `PrescriptionDrug`, `DoctorStats`, `DoctorReview`, `DoctorProfileAPI`

**Mock data**
- `frontend/src/mock/doctor-appointments.ts`, `doctor-schedule.ts`, `doctor-stats.ts`, `examinations.ts`, `rooms.ts` (dùng chung cho modal chọn phòng)

**⚠️ Dễ nhầm — KHÔNG thuộc trang bác sĩ**
- `backend/src/routes/doctor.routes.js` + `backend/src/controllers/doctor.controller.js` là API **admin quản lý bác sĩ** (`/api/admin/doctors`, CRUD/duyệt hồ sơ). Trùng tên "doctor" với route trang bác sĩ (`/api/doctor/*`) nhưng khác hoàn toàn phạm vi — khi tìm code theo từ khóa "doctor" rất dễ sửa nhầm file.
- `pages/admin/ManageDoctor/*`, `pages/admin/ManageAppointments/AppointmentList.tsx`, `DoctorAppointmentGroupList.tsx` — admin, không thuộc phạm vi này.

---

## 2. Chức năng hiện có

Khung layout/menu/route tách riêng cho bác sĩ, **không lẫn menu admin** — đúng chuẩn. `doctorId` luôn lấy từ `req.user.id` (JWT) ở mọi controller, không tin theo `:id` truyền từ client — đúng yêu cầu bảo mật.

Có sẵn: Dashboard (thống kê), Lịch hẹn (list + confirm/cancel/complete + nhập kết quả khám), Lịch làm việc (xem slot theo ngày), Hồ sơ cá nhân.

---

## 3. Chức năng THIẾU hoàn toàn so với nghiệp vụ chuẩn

| Chức năng | Trạng thái |
|---|---|
| **Xin nghỉ** (tự tạo / xem / hủy yêu cầu nghỉ của chính mình) | Không có API, không có trang. `NghiPhepBacSi` chỉ có route phía **admin** (`admin/doctor-leaves.routes.js` + `doctor-leaves.controller.js`) — admin tự nhập `bac_si_id` để tạo đơn hộ bác sĩ. Bác sĩ không có cách nào tự gửi yêu cầu nghỉ qua `/api/doctor/*`. |
| **Hồ sơ khám do y tá nhập → bác sĩ xác nhận / yêu cầu chỉnh sửa** | Không tồn tại luồng này. Model `KetQuaKham` đã có sẵn field `nguoi_nhap_id`, `nguoi_xac_nhan_id`, `thoi_diem_xac_nhan` (rõ ràng thiết kế cho luồng y tá nhập → bác sĩ duyệt), nhưng `doctor/appointments.controller.js: createResult/updateResult` hiện cho **bác sĩ tự viết `chan_doan` trực tiếp**, không có bước "chờ xác nhận" hay "yêu cầu chỉnh sửa". Role `nurse` tồn tại trong `NguoiDung.role` nhưng chưa có controller nurse nào ghi hồ sơ khám. |
| Trang "Hồ sơ chờ xác nhận" | Không có (`/doctor/medical-records/pending` chưa tồn tại). |
| Trạng thái lịch hẹn `CHECKED_IN`, `IN_PROGRESS`, `NO_SHOW`, `WAITING_RECORD`, `WAITING_DOCTOR_CONFIRM` | Có sẵn trong enum `LichHen.status` (`checked_in`, `in_progress`, `no_show`) nhưng **không dùng ở đâu cả** — luồng thực tế chỉ chạy `pending → confirmed → completed/cancelled`. |
| Hiển thị y tá hỗ trợ trong lịch hẹn/lịch làm việc | Không có field `nurse_id` nào được trả về ở `formatAppointment` / `flattenSchedules`. |

---

## 4. Trang bác sĩ đang LÀM THAY việc admin

1. **Tự gán/đổi phòng khám** — `DoctorSchedule.tsx` có modal "Chọn phòng khám" gọi `scheduleService.updatePhongKham` → backend `PATCH /api/doctor/schedule/:scheduleId/slots/:slotId` (`schedule.controller.js: updateSlot`) cho phép bác sĩ set `slot.phong_kham` trực tiếp. Đây là quyền admin, không nên có ở trang bác sĩ.
2. **Tự khóa/mở ca làm việc** (nút "Tạm nghỉ" / "Mở lại" trên từng slot) — cùng endpoint `updateSlot`, đổi `status` giữa `active`/`locked` **không qua** `NghiPhepBacSi`, **không cần admin duyệt**. Khác hẳn "gửi yêu cầu nghỉ" đúng nghĩa (PENDING → admin duyệt) — đây là tự đóng/mở ca ngay lập tức. Cơ chế này đang chạy song song và giẫm chân lên luồng `NghiPhepBacSi` chính thức.

---

## 5. Bug cụ thể đã xác nhận (chạy `tsc --noEmit`, không phải suy đoán)

`DoctorProfile.tsx` hiện **không biên dịch được**, 3 lỗi TS thật:

```
src/pages/doctor/DoctorProfile.tsx(31,40): error TS2339: Property 'profile' does not exist on type '{ tieu_su: string; ... }'.
src/pages/doctor/DoctorProfile.tsx(62,48): error TS2339: Property 'submitForReview' does not exist on type '{ get(): ...; update(...): ...; getStats(): ...; getReviews(): ... }'.
src/pages/doctor/DoctorProfile.tsx(174,67): error TS2339: Property 'phi_tu_van' does not exist on type 'DoctorProfile'.
```

- **Dòng 31**: `doctorProfileService.get().then(({ profile: p, tieu_su: ts }) => ...)` — nhưng `.get()` trả về object **phẳng** (không có key `profile`). `p` luôn `undefined` → `setProfile(undefined)` → trang `/doctor/profile` sẽ **treo trắng màn hình** (vì `if (!profile) return null`).
- **Dòng 62**: gọi `doctorProfileService.submitForReview()` — hàm này **không tồn tại** trong service → bấm nút "Nộp lại hồ sơ" khi hồ sơ bị từ chối sẽ throw runtime error.
- **Dòng 174**: đọc `profile.phi_tu_van` — field này không có trong type `DoctorProfile` (type thật dùng tên `gia_kham`).

**Nguyên nhân gốc**: `DoctorProfile.tsx` viết theo shape API khác với shape hiện tại của `doctor-profile.service.ts` + `mock/doctor-stats.ts` + type `DoctorProfile` — ba phía không được đồng bộ lại sau khi đổi.

**Test lệch theo code thật** (cũng lỗi biên dịch):
- `src/__tests__/services/doctor-appointment.service.test.ts` — truyền tham số `tab` không tồn tại trong `Filters`; đọc field `ly_do_huy`, `payment_deadline` không có trong kiểu trả về của `reject()`/`cancelConfirmed()`.
- `src/__tests__/services/schedule.service.test.ts` — gọi `cancelSlot` (tên cũ) trong khi service thật đã đổi tên thành `requestCancelSlot`; truyền `number` cho tham số cần `DoctorSlot`/`string`.

---

## 6. Mock vs API thật

Cả 4 service trang bác sĩ (`doctor-appointment`, `schedule`, `examination`, `doctor-profile`) đang chạy 100% mock in-memory — đúng giai đoạn hiện tại của dự án (frontend-first, xem `CLAUDE.md`), **không phải lỗi**. Đoạn gọi `axiosInstance` thật đã viết sẵn dạng comment "Real API" trong từng hàm, chỉ cần bật khi nối DB.

Lưu ý khi nối API thật: các vấn đề ở mục 3 và mục 4 (thiếu xin nghỉ, thiếu luồng y tá→bác sĩ xác nhận hồ sơ, bác sĩ tự gán phòng/tự khóa ca) sẽ **theo qua luôn**, vì backend cũng thiếu/sai y hệt — không phải vấn đề chỉ ở frontend.

---

## 7. Kết luận & thứ tự đề xuất xử lý (chưa làm, chỉ để tham khảo)

Khung sườn (route, layout, phân quyền JWT, tách menu) trang bác sĩ **đúng hướng**, không lẫn admin ở tầng routing/layout. Ba điểm cần dọn:

1. **`DoctorProfile.tsx`** — sửa trước vì đang chặn build (3 lỗi TS, trang treo trắng khi vào `/doctor/profile`).
2. **`DoctorSchedule.tsx` + `schedule.controller.js`** — bỏ quyền tự gán phòng khám và tự khóa/mở ca; thay bằng luồng "gửi yêu cầu nghỉ" đúng nghĩa qua `NghiPhepBacSi`.
3. **Luồng hồ sơ khám** — thiết kế lại theo model đã có sẵn field (`nguoi_nhap_id`, `nguoi_xac_nhan_id`): y tá nhập → bác sĩ xác nhận/yêu cầu chỉnh sửa, thay vì bác sĩ viết thẳng như hiện tại; đồng thời bổ sung API xin nghỉ tự phục vụ cho bác sĩ (tạo/xem/hủy khi còn PENDING).

Mọi đề xuất sửa ở trên cần làm **từng bước nhỏ, riêng lẻ**, không gộp nhiều thay đổi trong 1 lần, và không đụng file ngoài phạm vi doctor page.
