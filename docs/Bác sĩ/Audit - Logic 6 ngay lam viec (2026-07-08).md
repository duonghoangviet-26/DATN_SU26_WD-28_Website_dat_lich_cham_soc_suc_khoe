# Audit — Logic "6 ngày làm việc gần nhất" ở trang Bác sĩ

> Ngày kiểm tra: 2026-07-08
> Phạm vi: chỉ phần doctor page hiển thị lịch. Không sửa logic đặt lịch bệnh nhân, không sửa admin.
> Đây là **báo cáo hiện trạng — chưa sửa gì**.

---

## 1. Có hàm tạo danh sách 6 ngày làm việc không

Có, nhưng nằm ở phía hệ thống/admin, không nằm trong trang bác sĩ.

| Nơi | Hàm | Vai trò |
|---|---|---|
| `backend/src/services/scheduleGenerator.service.js` | `isWorkingDay()`, `getRollingWindowDates()`, `generateInitialWindowForDoctor()`, `generateRollingWindowForAllDoctors()` | Sinh dữ liệu (ghi vào DB), gọi từ cron, `POST /api/admin/slots/generate`, và `doctor.service.js.approveDoctor()` — toàn bộ thuộc luồng admin/hệ thống |
| `frontend/src/mock/doctor-schedule.ts` | `getRollingWindow()` | Chỉ để sinh dữ liệu giả cho demo, sẽ bị xóa khi gắn API thật |
| `frontend/src/pages/doctor/DoctorSchedule.tsx` + `backend/src/controllers/doctor/schedule.controller.js: getSchedules` | — | **Không có hàm này.** Trang chỉ hiển thị nguyên xi những gì `LichLamViec.find({doctor_id, ...})` trả về, không tự tính "6 ngày gần nhất" ở tầng đọc/hiển thị |

## 2. Có loại bỏ Chủ nhật không

Gián tiếp có — nhờ Chủ nhật chưa bao giờ được sinh ra ở tầng generator (`isWorkingDay`: `date.getDay() !== 0`). Nhưng bản thân trang hiển thị (`DoctorSchedule.tsx`) không có logic loại Chủ nhật của riêng nó — chỉ tin tưởng dữ liệu đầu vào đã sạch, không có lớp phòng vệ thứ 2 ở tầng đọc.

## 3. Có loại bỏ ngày đã qua không

Không, ở tầng hiển thị. `orderedDates = Object.keys(slotsByDate).sort()` không filter theo `todayStr`. Hàm `effectiveStatus()` chỉ đổi màu/label ("Hết hạn") cho slot có `ngay < todayStr`, không loại bản ghi đó khỏi danh sách ngày hiển thị. Cũng không có `.slice(0, 6)` hay giới hạn số ngày tối đa nào — nếu DB tồn đọng lịch từ nhiều tuần trước (generator không thấy đoạn xóa dữ liệu cũ), trang bác sĩ sẽ hiển thị hết, chỉ khác màu.

## 4. Có lấy bù sang tuần sau không

Có, nhưng chỉ ở generator, chạy 1 lần lúc bác sĩ được duyệt. `getRollingWindowDates()` (dò từng ngày kế tiếp, bỏ Chủ nhật, dừng khi đủ 6) implement đúng thuật toán trong yêu cầu — với ví dụ "hôm nay Thứ Tư" cho đúng kết quả Thứ Tư–Thứ Bảy + Thứ Hai–Thứ Ba tuần sau. Việc duy trì về sau (`generateRollingWindowForAllDoctors`, cron 23:55) dùng chiến lược khác: mỗi ngày sinh thêm đúng 1 ngày ở mốc "hôm nay + 7" — kết quả tương đương (luôn giữ 6 ngày làm việc kế tiếp trong DB), nhưng là cơ chế nền chạy 1 lần/ngày, không phải logic "mở trang thì tính lại 6 ngày gần nhất từ hôm nay". Nếu cron lỗi vài ngày liên tiếp (comment code đã tự thừa nhận rủi ro này), cửa sổ 6 ngày sẽ hẹp dần và trang bác sĩ không có cơ chế tự bù — chỉ hiển thị đúng những gì DB có.

## 5. Logic nằm ở doctor page hay bị trộn với admin

Logic sinh 6 ngày nằm đúng chỗ về nghiệp vụ — hoàn toàn ở phía admin/hệ thống (`scheduleGenerator.service.js`, cron, `admin/slots.controller.js`), khớp nguyên tắc "bác sĩ không được tự tạo lịch làm việc". Không phải lỗi trộn logic admin vào trang bác sĩ.

Vấn đề thực sự: trang bác sĩ (phần đọc/hiển thị) không có lớp lọc/giới hạn của riêng mình, phụ thuộc hoàn toàn vào giả định "DB luôn sạch đúng 6 ngày làm việc tương lai, không tồn đọng ngày quá khứ". Đây là thiếu một lớp phòng vệ hiển thị (defensive display filter) ở tầng doctor page, không phải lỗi vượt quyền/lẫn quyền.

## 6. Trạng thái thực hiện

Không sửa code nào ở bước này.

## 7. Đề xuất tách hàm (chỉ trong phạm vi doctor page — CHƯA áp dụng)

- Thêm 1 hàm thuần túy chỉ dùng riêng cho doctor page, ví dụ đặt trong `frontend/src/pages/doctor/DoctorSchedule.tsx` hoặc tách ra `frontend/src/utils/` (chỉ import bởi doctor page): nhận danh sách ngày đã có dữ liệu + `todayStr`, trả về tối đa 6 ngày làm việc gần nhất — lọc `ngay >= todayStr`, lọc bỏ Chủ nhật dù dữ liệu lỡ dính, cắt `.slice(0, 6)`. Hàm này chỉ lọc/hiển thị, không sinh dữ liệu, không gọi API tạo lịch — giữ đúng ranh giới "bác sĩ chỉ xem".
- Áp dụng hàm này thay cho `Object.keys(slotsByDate).sort()` trần trụi ở `orderedDates`, để trang tự bảo vệ thay vì phụ thuộc 100% vào giả định dữ liệu backend luôn sạch.
- Nên truyền `from`/`to` khi gọi `scheduleService.getAll({ from, to })` (đã có sẵn tham số này trong service, chỉ chưa được `DoctorSchedule.tsx` sử dụng) thay vì tải hết rồi lọc — cùng phát hiện tương tự đã ghi ở audit "Danh sách lịch hẹn" trước đó.
- Không đụng `scheduleGenerator.service.js`, `admin/slots.controller.js`, hay cron — các file này thuộc admin/hệ thống, đúng phạm vi yêu cầu.

---

## Liên quan

- `Audit - Ra soat trang bac si (2026-07-08).md` — audit tổng quát toàn bộ trang bác sĩ.
- `Audit - Route va phan quyen trang bac si (2026-07-08).md` — audit route & phân quyền.
- `Audit - Dashboard bac si (2026-07-08).md` — audit màn Dashboard.
- `Audit - Lich lam viec bac si (2026-07-08).md` — audit màn Lịch làm việc (nút gán phòng/khóa ca).
- `Audit - Danh sach lich hen bac si (2026-07-08).md` — audit danh sách lịch hẹn.
- `Audit - Chi tiet lich hen bac si (2026-07-08).md` — audit chi tiết lịch hẹn.
- `Audit - Ho so kham bac si (2026-07-08).md` — audit hồ sơ khám.
- `Audit - Xin nghi bac si (2026-07-08).md` — audit chức năng xin nghỉ (nếu đã lưu).
