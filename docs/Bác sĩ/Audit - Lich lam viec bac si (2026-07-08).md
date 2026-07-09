# Audit — Lịch làm việc Bác sĩ

> Ngày kiểm tra: 2026-07-08
> Phạm vi: chỉ trang bác sĩ (`/doctor/schedule`). Không kiểm tra trang admin quản lý lịch.
> Đây là **báo cáo hiện trạng — chưa sửa gì**.

---

## 1. File hiển thị lịch làm việc bác sĩ

| Vai trò | File |
|---|---|
| Page | `frontend/src/pages/doctor/DoctorSchedule.tsx` |
| Service | `frontend/src/services/schedule.service.ts` |
| Mock data | `frontend/src/mock/doctor-schedule.ts` (slot), `frontend/src/mock/rooms.ts` (danh sách phòng cho modal chọn phòng) |
| Type | `DoctorSlot` trong `frontend/src/types/index.ts` |
| Backend route | `backend/src/routes/doctor/schedule.routes.js` |
| Backend controller | `backend/src/controllers/doctor/schedule.controller.js` |
| Model | `backend/src/models/LichLamViec.js` |

## 2. Lọc theo bác sĩ đăng nhập — Đúng chuẩn

`getSchedules`: `BacSi.findOne({ user_id: req.user.id })` → `LichLamViec.find({ doctor_id: doc._id, ...dateFilter })`. `doctorId` luôn suy từ JWT, không nhận từ query/body/URL. `updateSlot` và `requestCancelSlot` cũng tìm `LichLamViec.findOne({ _id: scheduleId, doctor_id: bacSi._id })` trước khi cho thao tác — dù biết `scheduleId` của bác sĩ khác cũng không sửa được vì điều kiện `doctor_id` không khớp. Không có lỗ hổng xem/sửa chéo dữ liệu.

## 3. Lẫn logic admin — Có, 2 chỗ cụ thể

- **`updateSlot`** (`PATCH /api/doctor/schedule/:scheduleId/slots/:slotId`) cho phép bác sĩ set `phong_kham` trực tiếp — chức năng gán phòng vốn thuộc admin.
- Cùng endpoint đó cho phép đổi `status` giữa `active` ↔ `locked` **ngay lập tức**, không qua `NghiPhepBacSi`, không cần admin duyệt — thực chất là bác sĩ tự đóng/mở ca, khác hẳn "gửi yêu cầu xin nghỉ" đúng nghĩa (phải ở trạng thái chờ duyệt).

Đáng chú ý: file `schedule.routes.js` có comment "*Bác sĩ KHÔNG được tự tạo/xóa lịch (spec v3, 'Chống gian lận')*" — cho thấy đội đã nhận thức đúng nguyên tắc này ở phần tạo/xóa lịch, nhưng bỏ sót áp dụng tương tự cho gán phòng và khóa/mở ca.

## 4. Nút thêm/sửa/xóa lịch

| Hành động | Có ở FE? | Có ở BE? | Đánh giá |
|---|---|---|---|
| Thêm lịch (tạo ngày/ca mới) | Không | Không route | ✅ Đúng chuẩn |
| Xóa lịch/xóa ca | Không nút nào trong UI | Không route cho doctor | ✅ Đúng chuẩn (có hàm `deleteSchedule()` viết sẵn trong `schedule.service.ts` nhưng không được gọi ở đâu trong `DoctorSchedule.tsx` — dead code, đã grep xác nhận không có call site) |
| 🚫 "Chọn phòng khám" (icon bút cạnh phòng) | Có | Có (`updateSlot`) | **Không phù hợp** — thuộc quyền admin |
| 🚫 "Tạm nghỉ" / "Mở lại" (đổi status ngay lập tức) | Có | Có (`updateSlot`) | **Không phù hợp** — bỏ qua bước duyệt của admin, không phải "gửi yêu cầu" |
| ✅ "Yêu cầu hủy" (slot đã có bệnh nhân, bắt buộc nhập lý do) | Có | Có (`requestCancelSlot`) | **Đúng chuẩn** — chỉ set `cancel_requested: true`, chờ Admin xử lý, không tự hủy ngay |

## 5. Đề xuất UI đúng cho trang lịch làm việc bác sĩ (chỉ đề xuất — CHƯA áp dụng)

- Danh sách theo ngày, mỗi slot hiển thị **read-only**: giờ bắt đầu–kết thúc, phòng khám (text tĩnh, bỏ nút sửa), y tá hỗ trợ (hiện chưa có dữ liệu — cần backend bổ sung field trước), badge trạng thái ca.
- **Bỏ** nút "Chọn phòng khám" khỏi trang bác sĩ — phòng do admin gán, bác sĩ chỉ xem.
- **Thay** 2 nút "Tạm nghỉ"/"Mở lại" bằng 1 nút duy nhất **"Gửi yêu cầu xin nghỉ"** → mở form (ngày, ca/khung giờ, lý do) → tạo bản ghi `NghiPhepBacSi` với `trang_thai: cho_duyet`, không đổi `status` slot ngay. Badge hiển thị "Chờ duyệt nghỉ" cho tới khi admin xử lý.
- **Giữ nguyên** nút "Yêu cầu hủy" cho slot `booked` — đã đúng chuẩn, không cần đổi.
- Thêm trang/mục riêng **"Yêu cầu nghỉ của tôi"** (danh sách + trạng thái chờ duyệt/đã duyệt/từ chối/đã hủy, cho hủy khi còn PENDING) — hiện chưa tồn tại.
- Dọn `scheduleService.deleteSchedule()` khỏi service khi có dịp sửa — không route nào gọi và cũng không nên tồn tại theo nghiệp vụ.

## 6. Trạng thái thực hiện

Không sửa code nào ở bước này — chỉ kiểm tra và ghi nhận.

---

## Liên quan

- `Audit - Ra soat trang bac si (2026-07-08).md` — audit tổng quát toàn bộ trang bác sĩ.
- `Audit - Route va phan quyen trang bac si (2026-07-08).md` — audit route & phân quyền.
- `Audit - Dashboard bac si (2026-07-08).md` — audit màn Dashboard.
