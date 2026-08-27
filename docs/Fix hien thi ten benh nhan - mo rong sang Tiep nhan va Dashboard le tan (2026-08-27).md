# Fix tiếp: tên hiển thị = người đặt hộ thay vì bệnh nhân — mở rộng ra ngoài trang Lịch hẹn

**Ngày:** 2026-08-27
**Liên quan:** nối tiếp `docs/Fix hien thi ten benh nhan - trang Lich hen le tan (2026-08-26).md`
**Yêu cầu gốc:** người dùng báo "danh sách lịch hẹn của trang lễ tân đang hiển thị tên tài khoản
người đặt chứ không hiển thị tên người thật sự khám", đồng thời hỏi Hàng đợi khám của bác sĩ có bị
lỗi tương tự không.

## Vì sao lỗi vẫn còn dù đã sửa 2026-08-26

Fix trước chỉ sửa `Appointments.tsx` (trang `/receptionist/appointments`, sidebar cũ). Nhưng
comment tại `PatientIntake.tsx:1341` xác nhận trang đó **đã bị gỡ khỏi sidebar**, thay bằng
**"Tiếp nhận bệnh nhân" (`PatientIntake.tsx`)** làm màn hình danh sách lịch hẹn chính của lễ tân —
tức người dùng nhiều khả năng đang nhìn đúng trang chưa được vá. Cùng anti-pattern (thiếu ưu tiên
`member_id?.ho_ten`) lặp lại y hệt ở 4 chỗ khác trong file này, và ở 2 trang khác nữa.

## Root cause (giống hệt fix 2026-08-26, khác vị trí)

Thứ tự ưu tiên ĐÚNG (đã dùng nhất quán ở `doctor/stats.controller.js`, `doctor/schedule.controller.js`,
`doctor/appointments.controller.js`, và `Appointments.tsx` sau fix trước):
```
member_id?.ho_ten  →  ten_khach  →  user_id?.ho_ten  →  fallback
```
`member_id` = thành viên gia đình được khám. `user_id` = tài khoản đặt lịch (có thể là phụ huynh đặt
hộ). Nhầm hai cái này là hiển thị nhầm người.

## Các chỗ ĐÃ SỬA lần này

**Frontend — thiếu hẳn `member_id` trong interface lẫn thứ tự ưu tiên:**
1. `frontend/src/pages/receptionist/PatientIntake.tsx` — trang "Tiếp nhận bệnh nhân", màn hình
   danh sách lịch hẹn CHÍNH hiện tại của lễ tân (thay `Appointments.tsx` trong sidebar):
   - Thêm `member_id?: { ho_ten?: string | null } | null` vào interface `ReceptionistTodayAppointment`.
   - 4 chỗ hiển thị tên: modal "Chi tiết lịch hẹn" (dòng ~180), bảng danh sách chính (dòng ~672),
     modal "Hủy lịch" (dòng ~788), modal "Dời lịch" (dòng ~817).
2. `frontend/src/pages/receptionist/DoctorDayView.tsx` (dòng ~363) — popup "ai đã đặt khung này"
   trong trang Lịch bác sĩ trong ngày (`/receptionist/quan-ly-dieu-phoi`). Thêm `member_id` vào
   type `DoctorDayAppointment` (`receptionist-booking.service.ts`).
3. `frontend/src/pages/receptionist/Dashboard.tsx` — khối "Sắp tới (4h)" + tooltip "Liên hệ":
   thêm `member_id` vào interface `Appointment`, sửa 2 chỗ hiển thị tên (dòng ~485, ~504).

**Backend — đúng phần "Phạm vi CHƯA sửa" mà doc 2026-08-26 đã liệt kê trước:**
4. `backend/src/controllers/receptionist/appointment.controller.js`:
   - `getDoctorOperationalStatuses` — query lấy `lich_chua_checkin_bi_anh_huong` (nuôi Dashboard,
     phần cảnh báo quá tải của từng bác sĩ): thêm `.populate('member_id', 'ho_ten')` + sửa map
     `ten_benh_nhan` sang đúng thứ tự ưu tiên.
   - `getOverloadAffectedAppointments` + `buildOverloadAffectedList` — API
     `GET /receptionist/appointments/overload-affected`: cùng 2 sửa như trên.

## Đã KIỂM TRA và xác nhận KHÔNG lỗi (không đụng vào)

- **Hàng đợi khám của bác sĩ (`HangDoi`)** — câu hỏi trực tiếp của người dùng. Đã trace toàn bộ
  đường tạo `HangDoi`:
  - Lễ tân check-in (`checkInLichHen` trong `services/checkIn.service.js`, dòng ~196) đã tính
    `ten_benh_nhan: member?.ho_ten ?? appt.ten_khach ?? chuTaiKhoan?.ho_ten ?? 'Không rõ'` — ĐÚNG
    thứ tự ưu tiên từ trước.
  - Bác sĩ tự check-in đã bị **chặn hẳn** (`doctor/queue.controller.js` hàm `checkin` trả 403 —
    "Bác sĩ không tạo check-in tại quầy"), nên `HangDoi` chỉ được tạo qua đường lễ tân/check-in
    service dùng chung (đúng rule mục 7 "check-in đi qua duy nhất 1 service").
  - `doctor/queue.controller.js` (hàng đợi động bác sĩ nhìn thấy) đọc thẳng `HangDoi.ten_benh_nhan`
    đã tính đúng sẵn — không tự suy ra tên từ `user_id`/`member_id` lần nữa.
  - Kết luận: Hàng đợi khám **không lặp lỗi này**.
- `Appointments.tsx` — đã đúng từ fix 2026-08-26, không sửa lại.
- `doctor/stats.controller.js`, `doctor/schedule.controller.js`, `doctor/appointments.controller.js`
  — đã dùng đúng thứ tự ưu tiên từ trước, dùng làm mẫu đối chiếu cho các chỗ sửa ở trên.

## Kiểm chứng

- `npx tsc --noEmit -p tsconfig.json` (frontend) — lọc theo 4 file đã sửa: không phát sinh lỗi mới.
- `node --check backend/src/controllers/receptionist/appointment.controller.js` — hợp lệ.
- Chưa chạy lại UI thật (cần dữ liệu 1 lịch `booking_for='member'` đang trong hàng chờ tiếp nhận /
  khung ngày / cảnh báo quá tải để xác nhận trực quan cả 3 trang).
