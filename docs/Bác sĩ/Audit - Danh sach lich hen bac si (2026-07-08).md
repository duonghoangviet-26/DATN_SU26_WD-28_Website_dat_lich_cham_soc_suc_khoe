# Audit — Danh sách lịch hẹn Bác sĩ

> Ngày kiểm tra: 2026-07-08
> Phạm vi: chỉ trang bác sĩ (`/doctor/appointments`). Không sửa appointment admin/patient, không đổi logic đặt lịch của khách hàng.
> Đây là **báo cáo hiện trạng — chưa sửa gì**.

---

## 1. Nguồn dữ liệu

| Vai trò | File |
|---|---|
| Page | `frontend/src/pages/doctor/DoctorAppointments.tsx` |
| Service | `frontend/src/services/doctor-appointment.service.ts` |
| Mock data | `frontend/src/mock/doctor-appointments.ts` |
| Type | `DoctorAppointmentDetail`, `AppointmentStatus` trong `frontend/src/types/index.ts` |
| Backend route | `backend/src/routes/doctor/appointments.routes.js` |
| Backend controller | `backend/src/controllers/doctor/appointments.controller.js` |
| Model | `backend/src/models/LichHen.js` |

Hiện tại 100% chạy mock (`doctorAppointmentService.getAll()` trả thẳng `mockDoctorAppointments`), đoạn gọi `axiosInstance.get('/doctor/appointments')` đã viết sẵn nhưng comment, chưa bật — đúng giai đoạn frontend-first hiện tại của dự án.

## 2. Có bị lấy toàn bộ lịch hẹn không

**Backend: không bị lấy toàn hệ thống.** `list()` luôn filter `{ doctor_id: docId }` với `docId` suy từ JWT — kể cả khi không truyền `status`/`date`, API chỉ trả lịch hẹn của đúng bác sĩ đó.

**Frontend: đang lấy "toàn bộ lịch hẹn của bác sĩ đó" rồi lọc tay.** `DoctorAppointments.tsx` gọi `doctorAppointmentService.getAll()` không truyền tham số nào, dù backend đã hỗ trợ sẵn `status`/`date`. Việc lọc theo tab (hôm nay/sắp tới/đã qua/tất cả), trạng thái, hình thức, tìm kiếm đều làm bằng `useMemo` trên client, trên tập dữ liệu đầy đủ đã tải 1 lần. Không phải lỗi bảo mật (đã scope theo bác sĩ), nhưng đúng kiểu "lấy hết rồi lọc sơ sài trên frontend" mà nghiệp vụ khuyến cáo tránh — vấn đề hiệu năng/thiết kế, mỗi lần vào trang tải toàn bộ lịch sử thay vì để backend lọc theo ngày/trạng thái trước.

## 3. Có lọc theo doctorId/token không

Có, đúng chuẩn. `getDocId(req.user.id)` → `BacSi.findOne({ user_id: req.user.id })` → mọi truy vấn `LichHen` gắn `doctor_id: docId`. Không route nào nhận `doctorId` từ query/body/params để ghi đè.

## 4. Đối chiếu 9 yêu cầu + field thiếu

| # | Yêu cầu | Hiện trạng |
|---|---|---|
| 1 | Danh sách lịch hẹn của chính bác sĩ | ✅ Đúng (backend scope theo JWT) |
| 2 | Lọc theo ngày | ⚠️ Chỉ có tab nhóm (Hôm nay/Sắp tới/Đã qua/Tất cả), không có ô chọn 1 ngày cụ thể; là lọc client-side, không gọi API với `date` |
| 3 | Lọc theo trạng thái | ⚠️ Có dropdown nhưng thiếu option `completed` — dropdown chỉ có `pending/confirmed/cancelled`, type `filterStatus` cũng không có `'completed'` |
| 4 | Giờ khám | ✅ Có (`gio_kham`) |
| 5 | Tên bệnh nhân | ✅ Có (`benh_nhan`) |
| 6 | Dịch vụ khám | ✅ Có (`ten_dich_vu`) |
| 7 | Phòng khám | ✅ Có cho `clinic` (`phong_kham`); loại `home` hiển thị địa chỉ thay vì phòng — đúng nghiệp vụ, không phải thiếu |
| 8 | Y tá hỗ trợ | ❌ Thiếu hoàn toàn — không có field nào trả về y tá, khớp gap đã ghi nhận ở các audit trước |
| 9 | Trạng thái lịch hẹn | ⚠️ Có hiển thị nhưng chỉ hỗ trợ 4/7 trạng thái đề xuất: `AppointmentStatus` (FE type) và `APPOINTMENT_STATUS_LABEL` chỉ có `pending/confirmed/completed/cancelled`. Backend `LichHen.status` enum đã có `checked_in`, `in_progress`, `no_show` nhưng không controller nào set các giá trị này — tồn tại trong schema nhưng chết, không dùng ở luồng thực tế lẫn UI |

Ghi chú: `WAITING_CONFIRM` đề xuất tương đương khái niệm với `pending` hiện tại (chờ bác sĩ xác nhận) — chỉ khác tên gọi, chức năng đã có.

## 5. Đề xuất hướng sửa (chỉ đề xuất — CHƯA áp dụng)

1. **[Cao]** Đổi `DoctorAppointments.tsx` gọi `doctorAppointmentService.getAll({ status, date })` với tham số thật thay vì tải hết rồi lọc client-side — tận dụng filter đã có sẵn ở backend, giảm dữ liệu tải mỗi lần vào trang.
2. **[Cao]** Thêm option `completed` vào dropdown lọc trạng thái (và cập nhật type `filterStatus`).
3. **[Trung bình]** Bổ sung field y tá hỗ trợ — cần làm ở tầng model (`LichHen`/`LichLamViec`) trước, sau đó `formatAppointment()` mới trả về được, rồi mới hiển thị ở UI.
4. **[Trung bình]** Quyết định rõ có dùng `checked_in`/`in_progress`/`no_show` trong luồng thực tế hay không — nếu dùng thì cần: (a) thêm hành động chuyển trạng thái tương ứng ở `appointments.controller.js` (hiện chỉ có confirm/cancel/complete), (b) đồng bộ `AppointmentStatus` type + `APPOINTMENT_STATUS_LABEL` ở frontend cho đủ 7 giá trị, tránh trường hợp `STATUS_COLOR[appt.status]`/label bị `undefined` khi có bản ghi mang trạng thái không nằm trong map.
5. **[Thấp]** Thêm input chọn 1 ngày cụ thể (date picker) bên cạnh 4 tab nhóm hiện có.

## 6. Trạng thái thực hiện

Không sửa code nào ở bước này — chỉ kiểm tra và ghi nhận.

---

## Liên quan

- `Audit - Ra soat trang bac si (2026-07-08).md` — audit tổng quát toàn bộ trang bác sĩ.
- `Audit - Route va phan quyen trang bac si (2026-07-08).md` — audit route & phân quyền.
- `Audit - Dashboard bac si (2026-07-08).md` — audit màn Dashboard.
- `Audit - Lich lam viec bac si (2026-07-08).md` — audit màn Lịch làm việc.
