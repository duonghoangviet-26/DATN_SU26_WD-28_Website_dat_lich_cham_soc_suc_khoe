# Debug — Lịch đã thanh toán không hiển thị ở trang lịch hẹn bác sĩ

> Điều tra dựa trên schema thật + dữ liệu MongoDB thật (script `backend/src/scripts/inspect-paid-appointments-not-showing.js`, chỉ đọc). Không giả định tên field — toàn bộ field nhắc tới bên dưới đã được xác nhận có thật trong model trước khi query.

---

## 1. Đã kiểm tra những model/schema nào

`LichHen` (lịch hẹn), `ThanhToan` (giao dịch thanh toán), `HoaDon` (hóa đơn), `BacSi` (hồ sơ bác sĩ), `NguoiDung` (tài khoản) — đọc trực tiếp file model trước khi viết bất kỳ query nào.

## 2. Dữ liệu lịch hẹn và thanh toán hiện đang được lưu ở đâu

- **Trạng thái lịch hẹn + trạng thái thanh toán đều lưu trực tiếp trong `LichHen`**: field `status` (enum: `pending/confirmed/checked_in/in_progress/waiting_doctor_confirm/completed/cancelled/no_show`) và `payment_status` (enum: `unpaid/partial/paid/refunded`).
- **Ngoài ra còn có model `ThanhToan` riêng** (giao dịch thanh toán chi tiết — `appointment_id`, `so_tien`, `status: pending/paid/failed/refunded`, `phuong_thuc`, `ngay_thanh_toan`, `gateway_response`...) và `HoaDon` (hóa đơn — `appointment_id`, `trang_thai_hoa_don`, `tong_thanh_toan`...). Đây là 2 collection riêng, liên kết ngược về `LichHen` qua `appointment_id`.
- Không thấy field nào cho "thời điểm xác nhận thanh toán thành công" tách riêng trên `LichHen` ngoài `thoi_diem_thanh_toan` (Date).

## 3. Cách hệ thống liên kết lịch hẹn với bác sĩ

`LichHen.doctor_id` → `ref: 'BacSi'` (không phải trực tiếp tới `NguoiDung`). `BacSi.user_id` → `ref: 'NguoiDung'`. Tức là chuỗi liên kết đúng là **`LichHen.doctor_id` → `BacSi._id` → `BacSi.user_id` → `NguoiDung._id`**, không phải `LichHen.doctor_id` = user_id trực tiếp.

## 4. Cách hệ thống xác định bác sĩ đang đăng nhập

`backend/src/controllers/doctor/appointments.controller.js` hàm `getDocId(userId)`: `BacSi.findOne({ user_id: userId })` — lấy `userId` từ `req.user.id` (JWT, do `verifyToken` middleware gắn vào `req.user`), **không** nhận `doctorId` từ query/body của frontend. Đây đúng chuỗi liên kết ở mục 3 — **khớp nhau, không có lỗi lệch ID ở bước này**.

## 5. Có tìm thấy lịch đã thanh toán trong DB không

**Có.** 9 giao dịch `ThanhToan.status='paid'` tồn tại thật trong DB, tất cả đều trỏ đúng tới 1 `LichHen` tồn tại (không có giao dịch mồ côi), và tất cả appointment tương ứng đều có `payment_status='paid'` (hoặc `'partial'` cho 1 trường hợp cọc) — **đồng bộ đúng giữa `ThanhToan` và `LichHen`**.

## 6. Lịch đó có liên kết đúng với bác sĩ đang đăng nhập không

**Có, không phát hiện sai liên kết nào.** Đối chiếu toàn bộ `doctor_id` đang được dùng trong `LichHen` (`LichHen.distinct('doctor_id')`) với `BacSi` thật: **0 tham chiếu hỏng**, **0 lịch hẹn có `doctor_id = null`**. Mỗi giao dịch đã thanh toán đều resolve đúng ra 1 bác sĩ có tài khoản `role='doctor'`, `status='active'` hợp lệ.

## 7. Lịch đó có đủ điều kiện hiển thị cho bác sĩ không (theo trạng thái)

**Có** — mọi appointment đã thanh toán trong mẫu đều ở `status='confirmed'` hoặc `'completed'` (không có cái nào `cancelled`/`no_show`/`pending`+chưa xác nhận), tức là đủ điều kiện nghiệp vụ để bác sĩ nhìn thấy.

## 8. API lịch hẹn bác sĩ có trả lịch đó không

**Có, nếu gọi đúng tham số.** `GET /api/doctor/appointments` (hàm `list()`) chỉ lọc `doctor_id` (từ token) — **không tự động lọc theo ngày hay trạng thái nếu frontend không truyền `date`/`status`**. Vấn đề nằm ở **frontend truyền gì lên**, không phải backend tự lọc sai.

## 9. Nguyên nhân chính xác — bằng chứng cụ thể

**`frontend/src/pages/doctor/DoctorAppointments.tsx` mặc định `filterDate = todayStr`** (ngày hôm nay), tự động gọi `GET /doctor/appointments?date=<hôm nay>` ngay khi vào trang. Backend áp dụng đúng như được yêu cầu: `filter.ngay_kham = { $gte: <hôm nay 00:00>, $lt: <ngày mai 00:00> }`.

Đã verify bằng dữ liệu thật (không suy đoán):

| Giao dịch | Ngày khám (`ngay_kham`) | Hôm nay (lúc kiểm tra) |
|---|---|---|
| TXN1015 (mới nhất, vừa thanh toán) | 2026-07-12 | 2026-07-11 |
| TXN1014 | 2026-07-13 | 2026-07-11 |
| TXN1013 | 2026-07-16 | 2026-07-11 |
| TXN1012, 1007, 1006, 1005 | 2026-07-15 | 2026-07-11 |
| TXN1001 | 2026-07-07 | 2026-07-11 |
| TXN1003 | 2026-07-10 | 2026-07-11 |

**9/9 giao dịch đã thanh toán đều KHÔNG rơi vào ngày hôm nay.** Truy vấn trực tiếp "có lịch hẹn nào (bất kỳ bác sĩ nào) đúng ngày hôm nay không" chỉ ra đúng **1 lịch, và lịch đó `status=pending`, `payment_status=unpaid`** (chưa xác nhận/chưa thanh toán — đúng nghiệp vụ là không hiển thị như lịch hợp lệ).

→ **Kết luận: không phải bug dữ liệu, không phải bug backend, không phải bug timezone.** Đã verify riêng cả giả thuyết timezone: server chạy giờ Việt Nam (GMT+0700), nhưng `ngay_kham` được lưu **UTC-midnight nhất quán** (vd `2026-07-12T00:00:00.000Z`), và filter `new Date('2026-07-12')` cũng parse ra đúng UTC-midnight đó — **khớp chính xác, không lệch giờ**.

**Nguyên nhân thật sự: trang bác sĩ mặc định chỉ hiển thị lịch của HÔM NAY, còn lịch bệnh nhân vừa đặt + thanh toán lại nằm ở một ngày khác (thường là ngày trong tương lai, vì bệnh nhân đặt lịch trước).** Vì UI không có dấu hiệu nào báo "đang lọc theo hôm nay, còn N lịch ở ngày khác", nên nhìn giống hệt như "lịch đã thanh toán biến mất" dù dữ liệu, API, và phân quyền đều hoàn toàn đúng.

## 10. Nếu API có trả nhưng UI không hiển thị — có đúng là trường hợp này không

Đúng một phần: API **có trả nếu gọi không kèm `date`**, nhưng **mặc định trang tự thêm `date=hôm nay` vào request** — nên với dữ liệu thật hiện có, API luôn trả **danh sách rỗng hoặc thiếu đúng lịch vừa thanh toán** ở lần tải đầu tiên.

## 11. Có lỗi ngày giờ/timezone không

**Không** — đã verify thực nghiệm (mục 9), lưu trữ và truy vấn đều dùng UTC-midnight nhất quán.

## 12. Có lỗi trạng thái sau thanh toán không

**Không.** Đọc `patient/payments.controller.js` (`finalizePendingPayment()`): thanh toán thành công cập nhật **cả `ThanhToan.status='paid'` VÀ `LichHen.payment_status='paid'` + `LichHen.status='confirmed'`** trong cùng 1 MongoDB transaction (`session.startTransaction()`/`commitTransaction()`) — không có khoảng hở giữa 2 bước, không có trường hợp "chỉ payment đổi mà appointment không đổi" trong đoạn code này.

## 13. Có lỗi dùng mock không

**Không.** `doctorAppointmentService.getAll()` gọi thẳng `axiosInstance.get('/doctor/appointments', ...)`, không có fallback mock, không có import mock nào trong `DoctorAppointments.tsx`.

## 14. Nguyên nhân chính xác (tóm tắt 1 dòng)

**Frontend mặc định lọc "chỉ hôm nay" khi vào trang lịch hẹn bác sĩ — lịch bệnh nhân vừa thanh toán cho ngày khác (quá khứ hoặc tương lai) bị ẩn khỏi màn hình mặc định, không phải do dữ liệu/API/phân quyền sai.**

## 15. File cần sửa

`frontend/src/pages/doctor/DoctorAppointments.tsx` — **1 dòng**: giá trị khởi tạo `filterDate`.

## 16. Cách sửa đề xuất (đã thực hiện)

Đổi `useState(todayStr)` → `useState('')` cho `filterDate`. Khi rỗng, `doctorAppointmentService.getAll()` không gửi tham số `date` (đã xác nhận trong service: `if (date) params.date = date`) → backend trả **toàn bộ lịch hẹn của bác sĩ, mọi ngày**, sắp theo `ngay_kham, gio_kham` tăng dần (backend đã sort sẵn). Bác sĩ vẫn có thể tự lọc theo ngày cụ thể bằng ô chọn ngày như trước — chỉ đổi **giá trị mặc định lúc vào trang**, không đổi cơ chế lọc.

Đây là thay đổi tối thiểu nhất có thể — không sửa backend (backend đã đúng), không sửa logic thanh toán (đã đúng), không sửa phân quyền (đã đúng).

## 17. Rủi ro ảnh hưởng

- Danh sách mặc định giờ có thể dài hơn (gồm cả lịch quá khứ đã `completed`/`cancelled`) — chấp nhận được vì bảng đã có cột ngày rõ ràng trên từng dòng, và có bộ lọc trạng thái + ngày để bác sĩ tự thu hẹp khi cần.
- Không ảnh hưởng bác sĩ khác, không ảnh hưởng phân quyền (`doctor_id` vẫn luôn lọc theo token ở backend).
- Không ảnh hưởng luồng nghiệp vụ nào khác (thanh toán, xác nhận, hồ sơ khám) — chỉ đổi 1 giá trị khởi tạo state ở frontend.

## 18. Test case cần chạy

| # | Case | Kỳ vọng sau khi sửa |
|---|---|---|
| 1 | Vào trang lịch hẹn bác sĩ lần đầu (không chọn ngày) | Thấy **tất cả** lịch hẹn của bác sĩ, gồm cả lịch vừa thanh toán cho ngày khác hôm nay |
| 2 | Bệnh nhân thanh toán xong, bác sĩ refresh trang (không đổi filter) | Lịch mới xuất hiện ngay trong danh sách mặc định |
| 3 | Bác sĩ tự chọn 1 ngày cụ thể | Chỉ thấy lịch đúng ngày đó (hành vi cũ, không đổi) |
| 4 | Bác sĩ bấm "Xóa lọc" sau khi đã chọn ngày | Quay lại thấy tất cả (hành vi đã có sẵn, không đổi) |
| 5 | Lịch của bác sĩ khác | Vẫn không hiển thị (backend lọc theo token, không đổi) |
| 6 | Lịch chưa thanh toán (`pending`/`unpaid`) | Vẫn hiển thị (đúng vì trang bác sĩ vốn không lọc trạng thái mặc định) — không thuộc phạm vi bug này |

## 19. Kết luận

**Đã xác định đúng 1 nguyên nhân duy nhất, có bằng chứng dữ liệu thật, không suy đoán**: mặc định lọc ngày = hôm nay ở frontend. Database, API backend, logic đồng bộ thanh toán, và phân quyền bác sĩ **đều đúng, không có lỗi**. Sau khi đổi 1 dòng (`filterDate` mặc định rỗng), lịch đã thanh toán/xác nhận sẽ hiển thị ngay trên trang bác sĩ ở lần tải đầu tiên, bất kể ngày khám là hôm nay, quá khứ hay tương lai.
