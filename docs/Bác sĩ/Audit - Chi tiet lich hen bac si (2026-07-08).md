# Audit — Chi tiết lịch hẹn Bác sĩ

> Ngày kiểm tra: 2026-07-08
> Phạm vi: chỉ màn chi tiết lịch hẹn trang bác sĩ. Không sửa appointment admin/patient.
> Đây là **báo cáo hiện trạng — chưa sửa gì**.

---

## 1. File màn "chi tiết lịch hẹn"

Không có trang/route riêng — đã xác nhận ở audit route trước, không tồn tại `/doctor/appointments/:id`. "Chi tiết" hiện là **expand-row** trong bảng danh sách, cùng 1 file với list.

| Vai trò | File |
|---|---|
| Page (chứa cả list lẫn "chi tiết") | `frontend/src/pages/doctor/DoctorAppointments.tsx` (khối expand-row: dòng 886–985) |
| Modal hồ sơ khám (tách riêng, mở từ nút hành động, không nằm trong khối "chi tiết") | `ExamModal` — cùng file, dòng 55–264 |
| Service | `doctor-appointment.service.ts` (`getById`), `examination.service.ts` |
| Type | `DoctorAppointmentDetail` trong `frontend/src/types/index.ts` (dòng 372–396) |
| Backend | `GET /api/doctor/appointments/:id` → `appointments.controller.js: getById` |

## 2. Đối chiếu dữ liệu hiển thị — 6 yêu cầu

### 2.1 Thông tin bệnh nhân

| Field | Trạng thái |
|---|---|
| Họ tên | ✅ (`appt.benh_nhan`, ở hàng chính) |
| Giới tính | ⚠️ Có field nhưng bị khóa chung điều kiện với tuổi (dòng 905–909 chỉ render khi `appt.tuoi !== undefined`) — nếu tuổi không tính được nhưng giới tính có, giới tính vẫn bị ẩn. Bug nhỏ. |
| Ngày sinh / tuổi | ⚠️ Chỉ có tuổi (tính từ `ngay_sinh` ở backend) — chấp nhận được vì yêu cầu ghi "ngày sinh hoặc tuổi". |
| Số điện thoại | ✅ (`appt.so_dien_thoai`) |

### 2.2 Thông tin lịch hẹn

| Field | Trạng thái |
|---|---|
| Mã lịch hẹn | ❌ Không hiển thị — `appt.id` chỉ dùng nội bộ (React key, gọi API), đã grep xác nhận không có text "Mã lịch hẹn" trong file. |
| Ngày khám | ✅ |
| Giờ khám | ✅ |
| Chuyên khoa | ❌ Không có field này trong `DoctorAppointmentDetail` type, không hiển thị ở đâu. |
| Dịch vụ | ✅ (`ten_dich_vu`) |
| Phòng khám | ✅ cho `clinic`; `home` hiển thị địa chỉ thay vì phòng — đúng nghiệp vụ |
| Y tá hỗ trợ | ❌ Thiếu hoàn toàn — khớp gap xuyên suốt các audit trước |
| Trạng thái thanh toán | ✅ (badge `payment_status`) |
| Trạng thái lịch hẹn | ✅ (badge `status`, ở hàng chính) |

### 2.3 Lý do khám

✅ Có (`ly_do_kham`), hiển thị khi tồn tại.

### 2.4 Hồ sơ khám nếu y tá đã nhập

❌ Không có trong khối "chi tiết", và về bản chất **không có luồng y tá nhập** trong hệ thống (`createResult` cho bác sĩ tự viết `chan_doan` trực tiếp, không có bước y tá — đã xác nhận nhiều lần ở các audit trước). Ô "hồ sơ khám" chỉ xuất hiện gián tiếp qua nút hành động riêng, không nằm trong phần chi tiết lịch hẹn.

### 2.5 Nút xem hồ sơ khám

⚠️ Có nhưng không nằm trong khối chi tiết — là nút riêng ở cột "Thao tác" của hàng chính ("Xem kết quả" khi `da_co_ket_qua`, "Nhập kết quả" khi chưa có), mở `ExamModal`. Với trạng thái `completed`, nút này cho sửa trực tiếp nội dung (`chan_doan`, đơn thuốc...) trong 24h đầu — không phải chỉ "xem".

### 2.6 Nút xác nhận hồ sơ nếu đang chờ bác sĩ xác nhận

❌ Không tồn tại. Không có trạng thái "hồ sơ chờ xác nhận" nào được model hóa trong luồng thực tế (field `nguoi_xac_nhan_id`/`thoi_diem_xac_nhan` có sẵn trong `KetQuaKham` nhưng không controller nào dùng — đã ghi nhận ở audit tổng quát đầu tiên).

## 3. Có lẫn quyền sửa/xóa của admin không

**Không có quyền admin lẫn vào.** Rà toàn bộ nút hành động khả dụng (Xác nhận/Từ chối cho `pending`, Hoàn thành/Kết quả/Hủy cho `confirmed`, Xem/Nhập kết quả cho `completed`): không có nút sửa giá dịch vụ, đổi bác sĩ, đổi phòng, gán y tá, hay xóa lịch hẹn. "Hủy khẩn cấp" (clinic) / "Hủy" (home) bắt buộc nhập lý do, không phải xóa — hành động bác sĩ được phép, không phải quyền admin.

Tuy nhiên **có lẫn quyền của y tá**: nút "Kết quả"/"Nhập kết quả" cho bác sĩ tự viết hồ sơ khám trực tiếp thay vì xác nhận hồ sơ do y tá nhập — chính là lý do mục 2.4 và 2.6 không thể có, vì kiến trúc hiện tại không tách vai trò y tá ra khỏi việc ghi hồ sơ.

## 4. Bác sĩ có xem được lịch hẹn của bác sĩ khác không

Không. `getById`: `LichHen.findOne({ _id: req.params.id, doctor_id: docId })` với `docId` suy từ JWT — nếu `id` thuộc bác sĩ khác, trả `404`, không lộ dữ liệu. Chưa có route `/doctor/appointments/:id` ở frontend nên endpoint này chưa được UI hiện tại gọi tới, nhưng đã sẵn sàng và an toàn nếu sau này thêm trang chi tiết riêng.

## 5. Kết luận — cần chỉnh gì (chỉ đề xuất — CHƯA áp dụng)

1. **[Cao]** Bổ sung "Mã lịch hẹn" và "Chuyên khoa" vào cả type `DoctorAppointmentDetail` lẫn UI hiển thị.
2. **[Cao]** Sửa bug điều kiện hiển thị giới tính — tách điều kiện riêng khỏi `tuoi !== undefined`.
3. **[Cao]** Bổ sung y tá hỗ trợ — phụ thuộc thêm field ở tầng model trước (gốc rễ chung với các audit khác).
4. **[Cao]** Thiết kế lại luồng hồ sơ khám đúng nghiệp vụ: hồ sơ do y tá nhập → hiển thị trong khối "chi tiết lịch hẹn" → thêm nút "Xác nhận hồ sơ" / "Yêu cầu chỉnh sửa" khi hồ sơ chờ xác nhận, thay cho nút "Kết quả" cho sửa trực tiếp như hiện tại.
5. **[Trung bình]** Khi làm trang `/doctor/appointments/:id` riêng, tái dùng đúng `getById` đã scope theo `doctor_id` — không cần sửa gì thêm ở tầng bảo mật backend.

## 6. Trạng thái thực hiện

Không sửa code nào ở bước này — chỉ kiểm tra và ghi nhận.

---

## Liên quan

- `Audit - Ra soat trang bac si (2026-07-08).md` — audit tổng quát toàn bộ trang bác sĩ.
- `Audit - Route va phan quyen trang bac si (2026-07-08).md` — audit route & phân quyền.
- `Audit - Dashboard bac si (2026-07-08).md` — audit màn Dashboard.
- `Audit - Lich lam viec bac si (2026-07-08).md` — audit màn Lịch làm việc.
- `Audit - Danh sach lich hen bac si (2026-07-08).md` — audit danh sách lịch hẹn.
