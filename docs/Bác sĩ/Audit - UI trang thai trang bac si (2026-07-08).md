# Audit — UI trạng thái (Loading/Error/Empty/Confirm/Success) trang Bác sĩ

> Ngày kiểm tra: 2026-07-08
> Phạm vi: chỉ doctor page.
> Đây là **báo cáo hiện trạng — chưa sửa gì**.

---

## Đối chiếu 8 trạng thái theo từng màn

| Trạng thái | Dashboard | Lịch làm việc | Lịch hẹn (+ modal hồ sơ khám) | "Hồ sơ chờ xác nhận" | Profile |
|---|---|---|---|---|---|
| 1. Loading tải dữ liệu | ✅ | ✅ | ✅ (list + modal) | N/A — màn chưa tồn tại | ✅ |
| 2. Error khi API lỗi | ❌ Thiếu | ⚠️ Thiếu ở tải ban đầu | ⚠️ Thiếu ở tải ban đầu + lưu hồ sơ | N/A | ❌ Thiếu |
| 3. Empty state không có lịch hẹn | — | — | ✅ | — | — |
| 4. Empty state không có lịch làm việc | — | ✅ | — | — | — |
| 5. Empty state không có hồ sơ chờ xác nhận | — | — | — | N/A — màn chưa tồn tại | — |
| 6. Confirm dialog trước xác nhận hồ sơ | — | — | N/A — hành động chưa tồn tại | N/A | — |
| 7. Confirm dialog trước yêu cầu chỉnh sửa | — | — | N/A — hành động chưa tồn tại | N/A | — |
| 8. Success message sau thao tác | N/A (không có hành động) | ✅ | ✅ | N/A | ✅ |

## Chi tiết & thiếu sót theo từng màn

### `DoctorDashboard.tsx`
- Loading ✅ có (`if (loading) return <div>Đang tải...</div>`).
- Error ❌ thiếu: `Promise.all([getStats(), getReviews()]).then(...).finally(...)` không có `.catch()`. Nếu API lỗi, `stats` giữ `null`, các thẻ thống kê render rỗng lặng lẽ, bác sĩ không biết dashboard tải thất bại.
- Không có mục #3–7 vì không thuộc phạm vi màn này.

### `DoctorSchedule.tsx`
- Loading ✅ có cho tải ban đầu.
- Error ⚠️ thiếu một phần: các hành động (khóa/mở ca, chọn phòng, gửi yêu cầu hủy) đều có `try/catch` + `showError()` qua `Toast` — tốt. Nhưng tải danh sách lịch ban đầu không có `.catch()` (`scheduleService.getAll().then(setSlots).finally(...)`) — nếu API lỗi, `slots` giữ mảng rỗng, trang hiển thị y hệt empty state ("Chưa có lịch làm việc. Liên hệ Admin để thiết lập.") dù thực ra là lỗi tải dữ liệu — lỗi bị hiểu nhầm thành empty state.
- Empty state không có lịch làm việc ✅ có, đúng yêu cầu #4.
- Success message ✅ có qua `Toast` cho mọi hành động thành công.
- Không áp dụng #3, #5, #6, #7.

### `DoctorAppointments.tsx` (gồm cả `ExamModal`)
- Loading ✅ có cho bảng chính, và riêng cho `ExamModal` khi tải hồ sơ khám hiện có.
- Error ⚠️ thiếu một phần:
  - Tải danh sách lịch hẹn ban đầu: `doctorAppointmentService.getAll().then(setAll).finally(...)` — không có `.catch()`, cùng lỗi "nhầm thành empty state" như trên.
  - Các hành động confirm/reject/complete/cancel/bulk-reject: ✅ đều có `try/catch` + `showToast(..., 'error')`.
  - `ExamModal.handleSave()` không có `.catch()` (chỉ có `try/finally`): nếu `examinationService.save()` lỗi, không có thông báo nào cho bác sĩ biết, chỉ tắt trạng thái "Đang lưu...".
- Empty state không có lịch hẹn ✅ có, thay đổi nội dung theo ngữ cảnh (tìm kiếm/tab).
- Confirm dialog trước khi xác nhận lịch hẹn (khác với "xác nhận hồ sơ"): không có — bấm "Xác nhận" thực thi ngay. Không nằm trong 8 mục yêu cầu nhưng nêu để lưu ý tính nhất quán.
- #5, #6, #7 → N/A: "hồ sơ chờ xác nhận" và hành động xác nhận/yêu cầu chỉnh sửa hồ sơ hoàn toàn chưa tồn tại trong code (đã xác nhận dứt khoát ở `Audit - Ho so kham bac si`) — nút "Lưu kết quả"/"Cập nhật" trong `ExamModal` thực thi ngay, không có confirm dialog, nhưng là hành động khác (tự viết hồ sơ) chứ không phải "xác nhận hồ sơ do y tá nhập".
- Success message ✅ có cho mọi hành động (`showToast`), kể cả sau khi lưu hồ sơ khám.

### Màn "Hồ sơ chờ xác nhận"
Không tồn tại — không có page/route/component nào. Không thể đánh giá bất kỳ trạng thái nào trong 8 mục cho màn này.

### `DoctorProfile.tsx`
- Loading ✅ có.
- Error ❌ thiếu: `.then(...).finally(...)` không có `.catch()` trên `doctorProfileService.get()`.
- Success message ✅ có (`setSaved(true)` → banner "Đã lưu thông tin thành công!" tự ẩn sau 3 giây).
- Lưu ý: trang này hiện đang lỗi biên dịch (3 lỗi TS đã xác nhận ở `Audit - Ra soat trang bac si`), nên trên thực tế trang không chạy được để kiểm tra hành vi runtime — nhận xét trên dựa vào đọc code tĩnh.

## Tổng kết thiếu sót xuyên suốt

- Mẫu lặp lại ở cả 4 màn có dữ liệu (Dashboard, Lịch làm việc, Lịch hẹn, Profile): tải dữ liệu ban đầu (`useEffect` gọi service) đều dùng `.then().finally()` mà không có `.catch()` — mọi lỗi API khi tải trang đều bị nuốt lặng lẽ, hiển thị nhầm thành "không có dữ liệu" thay vì báo lỗi thật.
- `ExamModal.handleSave()` thiếu xử lý lỗi khi lưu hồ sơ khám.
- Mục #5, #6, #7 không thể đạt được cho tới khi tính năng "hồ sơ chờ xác nhận" được xây dựng từ đầu (phụ thuộc các đề xuất đã nêu ở `Audit - Ho so kham bac si`) — không phải "thiếu UI trạng thái" đơn thuần mà là thiếu cả tính năng gốc.

## Trạng thái thực hiện

Không sửa code nào ở bước này — chỉ kiểm tra và ghi nhận.

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
