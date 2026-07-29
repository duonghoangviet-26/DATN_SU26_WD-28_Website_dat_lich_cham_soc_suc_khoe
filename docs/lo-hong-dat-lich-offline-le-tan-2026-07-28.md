# Lỗ hổng nghiệp vụ — Đặt lịch offline (lễ tân) — 2026-07-28

> Bối cảnh: đang thiết kế lại luồng "khách vãng lai đến quầy" cho lễ tân (xem hội thoại
> brainstorm cùng ngày). Trước khi chốt spec, rà lại **code hiện có** để tìm lỗ hổng đang
> khai thác được ngay bây giờ, và liệt kê rủi ro cần thiết kế phòng trước cho luồng mới.
> File tham chiếu bắt buộc: `.claude/rules/lich-lam-viec-bac-si.md`.

## A. Lỗ hổng ĐANG TỒN TẠI trong code hiện tại (`receptionist/booking.controller.js`)

### A1 — CRITICAL: Lễ tân đặt được vào slot ONLINE, ngày bất kỳ trong tương lai
**File:** `backend/src/controllers/receptionist/booking.controller.js` — `getSlots()` (dòng 170-274),
`createBooking()` (dòng 372-668).

**Bằng chứng:** hàm import sẵn `cacKhungDuocBanTaiQuay`, `laHomNay`, `locSlotBanTaiQuay` từ
`walkInWindow.service.js` (dòng 21-27) nhưng **không gọi bất kỳ hàm nào trong số đó** ở `getSlots`
hay `createBooking`. Grep xác nhận: cả 3 hàm chỉ xuất hiện ở dòng import, không có lần gọi nào
trong thân file.

**Test case:**
1. Đăng nhập lễ tân, gọi `GET /api/receptionist/booking/doctors/:id/slots?date=2026-08-20` (10 ngày
   sau) → trả về đầy đủ slot `active`, không phân biệt `loai_slot`.
2. Gọi `POST /api/receptionist/booking` với `schedule_id`/`slot_id` của một slot **online** ngày đó
   → server chấp nhận, tạo `LichHen` thành công.

**Hậu quả:** phá vỡ hoàn toàn mô hình quota 70/30 (mục 4) — lễ tân (hoặc bất kỳ ai đăng nhập được
tài khoản lễ tân) có thể chiếm slot dành cho khách đặt online của bất kỳ ngày tương lai nào, không
giới hạn "chỉ hôm nay, chỉ khung hiện tại/kế tiếp, chỉ slot walk_in" theo mục 13. Đây chính là điều
mục 13 minh định cấm: *"Không được chạm slot online, không được chọn ngày tương lai."*

### A2 — CRITICAL: Gán bác sĩ bằng `Math.random()`, không qua cutoff
**File:** cùng file, dòng 427-510 (nhánh `doctor_id === 'auto'`).

**Test case:** gọi `createBooking` cùng payload nhiều lần với `doctor_id: 'auto'` cùng
`schedule_id/slot_id` → mỗi lần có thể ra bác sĩ khác nhau (không lặp lại được), vi phạm thẳng mục
12 *"Thứ tự gán XÁC ĐỊNH, KHÔNG random"*. Nhánh này cũng **không gọi `daQuaCutoffOnline`** (không hề
import) — có thể đặt được slot online còn 1 phút nữa tới giờ khám, trong khi khách đặt online thật
đã bị chặn từ `T-30'`. Bất đối xứng: lễ tân có đặc quyền vượt cutoff mà khách thường không có.

### A3 — HIGH: Không chống trùng lượt — một khách bị/được đặt nhiều lịch cùng ngày
**Test case:** gọi `createBooking` 3 lần liên tiếp cho cùng `so_dien_thoai_khach`, 3 khung giờ khác
nhau trong ngày → cả 3 đều tạo `LichHen` thành công, không có kiểm tra nào tương đương
`timLuotTrungTrongNgay`/`nhaGiuChoCuCuaNguoiKham` (đang có ở `patient/booking.controller.js` nhưng
không được port sang đây). Một lễ tân sơ ý double-click, hoặc client lỗi gọi lại API, tạo ra nhiều
lịch trùng cho cùng một người mà không hủy giữ chỗ cũ.

### A4 — HIGH: Thu tiền không có bằng chứng đồng ý điều khoản, không ghi nhật ký
**Test case:** `payment_method: 'cash'` → `payment_status: 'paid'`, `status: 'confirmed'` ngay lập
tức, không có trường tương đương `dong_y_dieu_khoan`/`dieu_khoan_dong_y_luc` (mục 5 bắt buộc), và
không có `NhatKyThaoTac` nào được ghi cho hành động thu tiền mặt này (khác hẳn `getAvailability` —
hàm tra cứu vô hại lại được ghi log, còn hành động thu tiền thật thì không).

**Hậu quả kép:**
- Nếu khách sau này khiếu nại "không hề đồng ý chính sách không hoàn tiền" khi bị tính `no_show`,
  phòng khám không có bằng chứng nào để đối chứng (đúng điều mục 5 cấm: *"Không có bằng chứng khách
  đồng ý điều khoản... thì KHÔNG được thu tiền"*).
- Không có nhật ký thu tiền mặt → lễ tân có thể đánh dấu "paid" mà không thực thu, hoặc thực thu mà
  không đánh dấu, không có dấu vết để đối soát cuối ca. Đây là lỗ hổng gian lận nội bộ (thất thoát
  tiền mặt) chứ không chỉ là lỗi kỹ thuật.

### A5 — HIGH: Tự động gắn `user_id` theo số điện thoại do lễ tân gõ tay, không xác minh
**File:** dòng 406-416 — `NguoiDung.findOne({so_dien_thoai: so_dien_thoai_khach, ...})`.

**Test case:** lễ tân (vô tình gõ nhầm số, hoặc cố ý) nhập số điện thoại của MỘT NGƯỜI KHÁC (không
phải khách đang đứng trước mặt) → hệ thống tự động gắn lịch hẹn này vào tài khoản của người đó, không
OTP, không xác nhận nào. Lịch sử khám bệnh (nhạy cảm) của người bị gắn nhầm giờ hiển thị trong hồ sơ
của họ; nếu sau đó khách "vô hình" kia không đến, họ còn bị tính `no_show`/mất tiền dù chưa từng yêu
cầu đặt lịch. Đây là lỗ hổng **gán danh tính sai** dựa hoàn toàn vào một chuỗi ký tự không xác thực.

### A6 — MEDIUM: Tra cứu SĐT trả toàn bộ thông tin, không giới hạn/không log
Áp dụng cho endpoint tra cứu khách hàng dự kiến xây mới (xem mục B3) nhưng cũng đã đúng tinh thần với
`getFamilyGroup` hiện tại: không giới hạn số lần thử, không ghi nhật ký ai tra cứu số nào. Một tài
khoản lễ tân (hoặc bị chiếm đoạt) có thể dò một dải số điện thoại để biết ai là bệnh nhân của phòng
khám, họ có những ai trong gia đình, ngày sinh — rò rỉ PII hàng loạt mà không để lại dấu vết.

---

## B. Rủi ro PHẢI THIẾT KẾ PHÒNG TRƯỚC cho luồng walk-in mới (chưa code, tránh lặp lại)

### B1 — Trùng hàng đợi khi có nhiều lễ tân/quầy
Nếu 2 lễ tân cùng lúc tra cứu và check-in **cùng một khách** (hai quầy khác nhau không biết nhau) vào
2 bác sĩ khác nhau → 2 bản ghi `HangDoi` cho cùng một người, tính trùng vào thống kê "số người đang
chờ", làm méo thuật toán gợi ý bác sĩ ít khách, và khách bị gọi tên 2 lần ở 2 phòng.
**Cần:** trước khi `checkInVangLai`, kiểm tra đã có `HangDoi` đang hoạt động
(`dang_cho|da_goi|trong_phong`) cùng SĐT/hồ sơ trong hôm nay chưa — nếu có, chặn và báo lễ tân.

### B2 — Danh sách bác sĩ "đang rảnh" bị lỗi thời (stale) giữa lúc hiển thị và lúc bấm xác nhận
Trang danh sách tải lúc `now = T`, lễ tân thao tác 5-10 phút mới bấm xác nhận (nhập thông tin khách ở
bước 3) → tại thời điểm submit, khung "kế tiếp" ban đầu có thể đã kết thúc, hoặc bác sĩ được chọn đã
hết slot walk_in cho khách khác chen vào trước.
**Cần:** `checkInVangLai`/endpoint check-in PHẢI tự tính lại `locSlotBanTaiQuay` tại thời điểm nhận
request, không tin danh sách phía client gửi lên — trả 409 rõ ràng để FE tải lại nếu đã đổi.

### B3 — Tra cứu SĐT lộ toàn bộ hồ sơ gia đình cho bất kỳ số nào được thử
Thiết kế endpoint `GET /walkin/patients?phone=` cần: (a) ghi `NhatKyThaoTac` mỗi lần tra cứu (đã có
tiền lệ ở `getAvailability`), (b) không trả dữ liệu y tế nhạy cảm (`di_ung`, `benh_nen`) ở bước tìm
kiếm — chỉ trả tên + ngày sinh đủ để lễ tân nhận diện đúng người, chi tiết y tế chỉ hiện sau khi đã
chọn đúng hồ sơ.

### B4 — Lễ tân luôn chọn cùng một bác sĩ bất kể gợi ý ít khách hơn
Vì quyết định thiết kế là "hiển thị danh sách, lễ tân chọn tay" (không auto-assign), hệ thống không
có gì chặn việc lễ tân luôn dồn khách cho một bác sĩ quen biết dù người đó đang đông nhất — đây không
phải lỗi kỹ thuật nhưng là lỗ hổng vận hành (thiên vị, hoặc merge với rủi ro nhận "hoa hồng" ngoài
luồng). **Cần:** ghi nhật ký cả "bác sĩ hệ thống gợi ý đầu danh sách" lẫn "bác sĩ lễ tân thực chọn"
để có dữ liệu đối chiếu về sau, không chặn cứng quyền chọn tay (đã chốt ở câu hỏi trước).

### B5 — Tạo `KhachVangLai` trùng lặp vô tội vạ
Không có kiểm tra "đã tồn tại KhachVangLai với SĐT này chưa" ở bước tạo mới — lễ tân thao tác nhanh có
thể bỏ qua kết quả tra cứu và bấm thẳng "tạo khách mới", sinh ra nhiều bản ghi cho cùng một người, làm
loãng lịch sử khám của họ. **Cần:** khi submit tạo mới mà trùng SĐT đã tồn tại, cảnh báo xác nhận thay
vì tạo âm thầm (đã đưa vào mục Xử lý lỗi của spec).

### B6 — Không có lưới an toàn cho "khám xong mà chưa thu tiền"
Đã chốt khoanh vùng billing ra ngoài phạm vi spec lần này, nhưng cần ghi nhận rõ: `HangDoi` không có
`appointment_id` (khách vãng lai) khi `finish()` xong không có bất kỳ cơ chế nào nhắc lễ tân/kế toán
còn khoản chưa thu. Rủi ro thất thu ("khám chùa") tồn tại cho tới khi thiết kế phần billing riêng.
Khuyến nghị tối thiểu ngay cả trước khi có spec billing: thêm một danh sách cuối ca "đã hoàn thành
nhưng chưa có hoá đơn" để đối chiếu thủ công.

---

## Tổng kết mức độ ưu tiên xử lý

| # | Mức độ | Đã có trong luồng mới (dự kiến) hay chưa |
|---|---|---|
| A1 | CRITICAL | Có — thay bằng `locSlotBanTaiQuay` bắt buộc |
| A2 | CRITICAL | Có — bỏ hẳn random, chỉ hiện danh sách lễ tân chọn tay |
| A3 | HIGH | Chưa nêu rõ trong spec — cần bổ sung B1 |
| A4 | HIGH | Ngoài phạm vi (billing) — ghi nhận nợ kỹ thuật |
| A5 | HIGH | Có cải thiện: lookup rõ ràng thay vì auto-link ngầm, nhưng vẫn cần cảnh báo khi trùng SĐT (B5) |
| A6 | MEDIUM | Cần bổ sung ghi log tra cứu (B3) |
| B1–B6 | Thiết kế phòng trước | Bổ sung vào spec trước khi viết plan implementation |
