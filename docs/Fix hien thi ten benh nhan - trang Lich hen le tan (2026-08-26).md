# Fix: Tên hiển thị ở trang Lịch hẹn (lễ tân) là người đặt hộ, không phải bệnh nhân đến khám

**Ngày:** 2026-08-26
**Trang bị ảnh hưởng:** `/receptionist/appointments` (bảng danh sách + modal Xem chi tiết)

## Triệu chứng

Khi một tài khoản đặt lịch **cho thành viên gia đình** (`member_id` được set, `booking_for='member'`),
cột "Bệnh nhân" trong bảng lịch hẹn của lễ tân hiển thị **tên chủ tài khoản (người đặt hộ)** thay vì
tên thành viên (người thực sự đến khám).

## Root cause

`LichHen` có 3 field liên quan tới "tên":
- `member_id` → ref `ThanhVien` — thành viên gia đình được khám (khi đặt hộ cho member).
- `ten_khach` — tên khách khi đặt cho người **không** có `member_id` (khách vãng lai / "other").
- `user_id` → ref `NguoiDung` — **tài khoản đặt lịch** (booker), KHÔNG phải bệnh nhân.

Ở nhánh đặt cho thành viên gia đình, một số luồng tạo lịch (vd. script mẫu
`e2e-luong-tiep-nhan.js:150`) cố tình để `ten_khach = null` khi đã có `member_id` — quy ước đúng là
"tên hiển thị phải tra qua `member_id`", không lưu trùng vào `ten_khach`.

`frontend/src/pages/receptionist/Appointments.tsx` (dòng 646 cũ) lại chỉ ưu tiên:
```
apt.ten_khach || apt.user_id?.ho_ten || 'Khách vãng lai'
```
Thiếu hẳn `member_id?.ho_ten` ở đầu chuỗi ưu tiên — nên khi `ten_khach` rỗng, code rơi thẳng xuống
`user_id?.ho_ten` (tên **người đặt**, tức phụ huynh/chủ tài khoản), không phải tên thành viên.

Backend `GET /receptionist/appointments`
(`backend/src/controllers/receptionist/appointment.controller.js` → `getAppointments`) cũng không
`populate('member_id')`, nên FE dù có sửa thứ tự ưu tiên cũng không có dữ liệu `ho_ten` của member để
dùng.

Đối chứng: `backend/src/controllers/admin/appointment.controller.js` (`formatAppointmentItem`,
dòng 351-355) đã làm ĐÚNG thứ tự này từ trước:
```js
const patientName =
  appointment.member_id?.ho_ten ||
  appointment.ten_khach ||
  appointment.user_id?.ho_ten ||
  'Khach vang lai'
```
và tách riêng `nguoi_dat_ho_ten`/`nguoi_dat_ho_id` cho tên **người đặt hộ** — không trộn vào tên bệnh
nhân. Trang lễ tân thiếu đúng phần này.

## Fix

1. `backend/src/controllers/receptionist/appointment.controller.js` — `getAppointments`: thêm
   `.populate('member_id', 'ho_ten')` vào query danh sách lịch hẹn.
2. `frontend/src/pages/receptionist/Appointments.tsx`:
   - Thêm `member_id: { ho_ten: string } | null` vào interface `Appointment`.
   - Bảng danh sách (cột "Bệnh nhân") và modal "Xem chi tiết" (mục "Người đến khám"): đổi ưu tiên
     hiển thị thành `apt.member_id?.ho_ten || apt.ten_khach || apt.user_id?.ho_ten || 'Khách vãng lai'`.
   - Mục "Tài khoản đặt lịch" trong modal chi tiết (hiển thị `user_id.ho_ten` riêng, kèm badge "Đặt
     hộ") giữ nguyên — đây là nơi đúng để hiện tên người đặt, tách biệt với tên bệnh nhân.

## Phạm vi CHƯA sửa (out of scope, cùng anti-pattern, khác trang)

Cùng thứ tự ưu tiên sai (thiếu `member_id`, hoặc `user_id` đứng trước `ten_khach`) còn xuất hiện ở:
- `getDoctorOperationalStatuses` (dòng ~421) và `buildOverloadAffectedList` (dòng ~516) trong cùng
  file `receptionist/appointment.controller.js` — phục vụ Dashboard lễ tân ("Điều phối ca quá tải"),
  không phải trang Lịch hẹn được báo lỗi lần này. Không đụng tới vì ngoài phạm vi yêu cầu.

## Kiểm chứng

- `npx tsc --noEmit` trên frontend: không phát sinh lỗi mới ở `Appointments.tsx` (3 lỗi tồn tại sẵn
  ở `ManageDoctorLeaves.tsx`/`DoctorProfile.tsx`, không liên quan).
- `node --check` trên file controller backend: hợp lệ.
- Chưa chạy lại UI thật (cần DB có ít nhất 1 lịch hẹn `booking_for='member'` để xác nhận trực quan).
