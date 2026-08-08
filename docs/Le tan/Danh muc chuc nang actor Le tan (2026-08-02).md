# Danh mục chức năng actor Lễ tân — VitaFamily

Ngày lập: **2026-08-02** · Nhánh: `Bac_si`

Tài liệu này liệt kê **toàn bộ chức năng mà lễ tân cần có**, kèm trạng thái thực tế của
code tại thời điểm lập. Dùng để cả nhóm nắm được lễ tân đang làm được gì, còn thiếu gì,
và ai cần làm phần nào.

## Cách đọc

| Ký hiệu | Nghĩa |
|---|---|
| ✅ | Dùng được bình thường |
| ⚠️ | Có nhưng thiếu/hụt, dùng được một phần |
| ❌ | Chưa dùng được |

Cột **API** ghi đường dẫn rút gọn; tiền tố đầy đủ là `/api/receptionist`.

Lễ tân hiện có 5 màn hình: **Tổng quan** · **Lịch hẹn (Phòng khám)** ·
**Tiếp nhận tại quầy** · **Thanh toán & Thu ngân** · **Tin tức**.

---

## Nhóm 1 — Tiếp đón & nhận diện người bệnh

| # | Chức năng | Màn hình | API | TT |
|---|---|---|---|---|
| 1.1 | Tra cứu người bệnh theo số điện thoại | Tiếp nhận tại quầy | `GET /patient-intake/search` | ✅ |
| 1.2 | Chọn đúng người bệnh khi 1 SĐT có nhiều hồ sơ | Tiếp nhận tại quầy | (cùng trên) | ⚠️ |
| 1.3 | Nhận diện tài khoản online gắn với SĐT | Tiếp nhận tại quầy | (cùng trên) | ✅ |
| 1.4 | Cảnh báo lịch hẹn mồ côi (không xác định được chủ) | Tiếp nhận tại quầy | `ambiguous_appointments` | ⚠️ |
| 1.5 | Tạo hồ sơ bệnh nhân mới tại quầy | Tiếp nhận tại quầy | `POST /patient-intake/profiles` | ⚠️ |
| 1.6 | Liên kết hồ sơ với tài khoản online | Tiếp nhận tại quầy | (cùng trên) | ✅ |

**Ghi chú thiếu sót:**
- **1.2** — Backend đã trả `quan_he`, `nhom_gia_dinh`, `so_dien_thoai` riêng của từng hồ sơ,
  nhưng UI chỉ hiện họ tên + ngày sinh + giới tính in thô (`nam`/`nu`). Khi 3 người nhà dùng
  chung một số, lễ tân không đủ thông tin trên màn hình để chọn đúng người.
- **1.4** — Chỉ hiện banner cảnh báo, lễ tân không có thao tác nào để xác minh và gắn lịch.
- **1.5** — Nút tạo hồ sơ bị khoá cứng khi SĐT đã có tài khoản online
  (`PatientIntake.tsx:585`). Khách vãng lai dùng nhờ số của người nhà thì không tạo được hồ sơ,
  hoặc buộc phải gắn nhầm vào tài khoản người khác.

---

## Nhóm 2 — Check-in & hàng đợi

| # | Chức năng | Màn hình | API | TT |
|---|---|---|---|---|
| 2.1 | Check-in khách **đã đặt lịch** | Tiếp nhận tại quầy | `PATCH /appointments/:id/arrived` | ✅ |
| 2.2 | Check-in khách **đã đặt lịch** | Lịch hẹn | (cùng trên) | ❌ |
| 2.3 | Xác minh danh tính trước khi check-in | — | — | ❌ |
| 2.4 | Kiểm tra khả năng tiếp nhận khách vãng lai | Tiếp nhận tại quầy | `GET /patient-intake/availability` | ✅ |
| 2.5 | Tiếp nhận khách vãng lai vào hàng đợi | Tiếp nhận tại quầy | `POST /patient-intake/check-in` | ✅ |
| 2.6 | Xem danh sách chờ tiếp nhận hôm nay | Lịch hẹn | `GET /appointments/pending-checkin` | ✅ |
| 2.7 | Sinh + hiển thị mã số thứ tự | Tiếp nhận / Tổng quan | `checkInNumber.service` | ✅ |
| 2.8 | **In phiếu số thứ tự cho khách** | — | — | ❌ |

**Ghi chú thiếu sót:**
- **2.2 — LỖI CHẶN NGHIỆP VỤ.** `Appointments.tsx:341` và `:356` gọi endpoint **không kèm
  body**, trong khi backend bắt buộc `ho_so_benh_nhan_id` + `so_dien_thoai` + `ho_ten`
  (`appointment.controller.js:261-267`) → trả **400** mọi lần bấm. Lễ tân hiện chỉ check-in
  được qua màn Tiếp nhận tại quầy.
- **2.3** — Chưa có bước buộc lễ tân chọn đúng hồ sơ trước khi check-in, dẫn tới rủi ro
  check-in nhầm người khi trùng số điện thoại.
- **2.8** — `QueueTicketTemplate.tsx` đã viết đúng (khổ 80mm, có `queueNumber`) nhưng
  **`setPrintData` không được gọi ở bất kỳ đâu** và `window.print()` không có trong
  `Appointments.tsx`. Thay vào đó là `alert('Đã ... đẩy lệnh in Số thứ tự tới máy in thành
  công!')` ở 3 chỗ. Hệ thống **báo đã in nhưng không in gì cả**.

---

## Nhóm 3 — Điều phối lịch hẹn thường ngày

| # | Chức năng | Màn hình | API | TT |
|---|---|---|---|---|
| 3.1 | Xem danh sách lịch hẹn (hôm nay / mai / sắp tới / đã qua) | Lịch hẹn | `GET /appointments` | ✅ |
| 3.2 | Lọc theo bác sĩ, ngày, từ khoá | Lịch hẹn | (cùng trên) | ✅ |
| 3.3 | Xem chi tiết lịch hẹn | Lịch hẹn | (cùng trên) | ✅ |
| 3.4 | Dời lịch — khách yêu cầu (trần 1 lần) | Lịch hẹn | `PATCH /appointments/:id/reschedule` | ✅ |
| 3.5 | Dời lịch — lỗi phòng khám (không tính hạn mức) | Lịch hẹn | (cùng trên) | ✅ |
| 3.6 | Hủy lịch + trả slot lại pool ngay | Lịch hẹn | `PATCH /appointments/:id/cancel` | ✅ |
| 3.7 | Thao tác hàng loạt (hủy / dời nhiều lịch) | Lịch hẹn | `POST /appointments/bulk-*` | ✅ |
| 3.8 | Chỉ hiện nút hợp lệ theo trạng thái lịch | Lịch hẹn | `allowed_actions` | ✅ |
| 3.9 | Khoá thao tác khi bệnh nhân đang trong phòng | Lịch hẹn | `lock_reason` | ✅ |

Nhóm này đã hoàn chỉnh.

---

## Nhóm 4 — Điều phối khi có sự cố

| # | Chức năng | Màn hình | API | TT |
|---|---|---|---|---|
| 4.1 | Báo bác sĩ nghỉ đột xuất | Lịch hẹn | `POST /appointments/doctor-unavailable` | ✅ |
| 4.2 | Sinh đề xuất dời cho các lịch bị ảnh hưởng | Lịch hẹn | (cùng trên) | ✅ |
| 4.3 | Chuyển khách sang bác sĩ khác cùng chuyên khoa | Lịch hẹn | `POST /appointments/bulk-reschedule` | ✅ |
| 4.4 | Khách đến muộn — đưa xuống cuối ca | Lịch hẹn | `PATCH /appointments/:id/mark-late` | ✅ |
| 4.5 | Khách đến muộn — slot trống gần nhất trong ngày | Lịch hẹn | (cùng trên) | ✅ |
| 4.6 | Khách đến muộn — dời sang ngày hôm sau | Lịch hẹn | (cùng trên) | ✅ |
| 4.7 | Cảnh báo bác sĩ khám kéo dài / quá tải | Tổng quan | `GET /appointments/doctor-statuses` | ✅ |
| 4.8 | **Chuyển lượt đang chờ sang bác sĩ khác** | — | — | ❌ |

**Ghi chú thiếu sót:**
- **4.8** — Đây là **thứ duy nhất thiếu cả backend lẫn frontend**. Rà toàn bộ
  `controllers/receptionist/`: `HangDoi` chỉ được **đọc**, chưa có chỗ nào ghi `doctor_id` mới.

  Cần phân biệt rõ: dời `LichHen` (mục 3.4–3.5, đã có) là đổi **cam kết đặt chỗ** của khách
  chưa đến. Chuyển `HangDoi` (mục 4.8, chưa có) là đổi bác sĩ cho người **đang ngồi chờ tại
  phòng khám**. Hai việc khác nhau, không thay thế cho nhau.

---

## Nhóm 5 — Thông báo khách hàng

| # | Chức năng | Màn hình | API | TT |
|---|---|---|---|---|
| 5.1 | Tự gửi thông báo khi hủy lịch | (chạy nền) | `notifyAppointmentCustomerChange` | ✅ |
| 5.2 | Tự gửi thông báo khi dời lịch | (chạy nền) | (cùng trên) | ✅ |
| 5.3 | Tự gửi thông báo khi đổi bác sĩ | (chạy nền) | (cùng trên) | ✅ |
| 5.4 | **Danh sách khách cần gọi thủ công** | — | — | ❌ |
| 5.5 | **Đánh dấu đã gọi xác nhận** | — | — | ❌ |
| 5.6 | Xem thông báo hệ thống của lễ tân | Tổng quan | `GET /notifications/recent` | ✅ |

**Ghi chú thiếu sót:**
- **5.4 / 5.5** — Backend đã ghi audit `CUSTOMER_CONTACT_REQUIRED` khi khách **không có tài
  khoản** để nhận thông báo in-app. Nhưng **không có API nào cho lễ tân đọc** các bản ghi này,
  và cũng không có màn hình nào hiển thị.

  Hệ quả: khách bị dời hoặc hủy lịch mà không có tài khoản thì **không ai gọi**, vì lễ tân
  không hề biết. Đây là lỗ hổng nghiệp vụ, không chỉ là thiếu UI.

  Cả hai mục cần thêm backend (1 endpoint đọc + 1 endpoint đánh dấu đã gọi) rồi mới làm UI.

---

## Nhóm 6 — Hồ sơ bệnh nhân

| # | Chức năng | Màn hình | API | TT |
|---|---|---|---|---|
| 6.1 | Xem hồ sơ + lịch hẹn hôm nay | Tiếp nhận tại quầy | `GET /patient-intake/search` | ✅ |
| 6.2 | **Sửa thông tin hành chính (9 trường, bắt buộc lý do)** | — | `PATCH /patient-intake/profiles/:id` | ❌ |
| 6.3 | **Xem lịch sử cập nhật hồ sơ (before/after)** | — | `GET /patient-intake/profiles/:id/audit` | ❌ |

**Ghi chú thiếu sót:**
- **6.2 / 6.3** — Backend đã hoàn thành đầy đủ (commit `1761448`), frontend **chưa gọi hàm
  nào**. Lễ tân không sửa được sai sót họ tên / ngày sinh / SĐT của hồ sơ cũ.

9 trường hành chính lễ tân được sửa: `ho_ten`, `so_dien_thoai`, `ngay_sinh`, `gioi_tinh`,
`nhom_mau`, `di_ung`, `benh_nen`, `dia_chi`, `ghi_chu`.

---

## Nhóm 7 — Thu ngân & hóa đơn

| # | Chức năng | Màn hình | API | TT |
|---|---|---|---|---|
| 7.1 | Danh sách ca chờ thu / đã thu | Thanh toán | `GET /payments/cases` | ✅ |
| 7.2 | Xem chi tiết hóa đơn + dịch vụ phát sinh | Thanh toán | `GET /payments/cases/:id` | ✅ |
| 7.3 | Tạo hóa đơn (tiền mặt / chuyển khoản) | Thanh toán | `POST /payments/cases/:id/invoice` | ✅ |
| 7.4 | Xác nhận đã thu tiền | Thanh toán | `PATCH .../payments/:pid/confirm` | ✅ |
| 7.5 | Hủy giao dịch thanh toán | Thanh toán | `PATCH .../payments/:pid/cancel` | ✅ |
| 7.6 | In biên lai | Thanh toán | `POST .../receipt-print` | ✅ |
| 7.7 | Thêm dịch vụ phát sinh vào hóa đơn | Thanh toán | `GET /payments/offline/services` | ✅ |

Nhóm này đã hoàn chỉnh.

---

## Nhóm 8 — Theo dõi & giám sát

| # | Chức năng | Màn hình | API | TT |
|---|---|---|---|---|
| 8.1 | Tổng quan số liệu trong ngày | Tổng quan | `dashboard` | ✅ |
| 8.2 | Trạng thái vận hành từng bác sĩ | Tổng quan | `GET /appointments/doctor-statuses` | ✅ |
| 8.3 | Lượt đang chờ / bệnh nhân trong phòng | Tổng quan | (cùng trên) | ✅ |
| 8.4 | Lịch chưa check-in bị ảnh hưởng bởi quá tải | Tổng quan | (cùng trên) | ✅ |
| 8.5 | Xem lịch sử dời lịch của một lịch hẹn | Lịch hẹn | `GET /appointments/:id/reschedule-history` | ⚠️ |

**Ghi chú thiếu sót:**
- **8.5** — API chỉ được gọi ở đúng một chỗ: hàm kiểm tra khách đã hết lượt dời
  (`Appointments.tsx:417`). Modal chi tiết lịch hẹn **không có timeline lịch sử**, nên lễ tân
  không tra cứu chủ động được "lịch này ai đã dời, lúc nào, vì sao".

---

## Nhóm 9 — Nội dung

| # | Chức năng | Màn hình | API | TT |
|---|---|---|---|---|
| 9.1 | Danh sách / tạo / sửa tin tức | Tin tức | `/news` | ✅ |

---

## ⛔ Lễ tân KHÔNG được làm

Các ranh giới dưới đây **đã được chặn cứng trong code**, không phải quy ước miệng.

| Cấm | Cơ chế chặn | Mã lỗi |
|---|---|---|
| Sửa bệnh án, chẩn đoán, đơn thuốc, sinh hiệu, dịch vụ phát sinh | `denyDirectMedicalRecordPatch` | 403 |
| Sửa trường chuyên môn trong hồ sơ bệnh nhân | `normalizeAdministrativeProfileUpdate` | 403 |
| Dời / hủy lịch khi bệnh nhân đã vào phòng | `allowed_actions=[]` + `lock_reason=IN_ROOM` | 409 |
| Hủy lịch đã check-in | Guard theo `HangDoi.trang_thai` | 409 |
| Nhận đặt lịch qua điện thoại | Rule mục 13 + `walkInWindow.service.js` | — |
| Chạm slot online của khách | `walkInWindow.service.js` | 409 |
| Chọn ngày tương lai khi tiếp nhận tại quầy | `walkInWindow.service.js` | 409 |
| Đặt trùng khung giờ cho cùng một hồ sơ | `booking.controller.js:611` | 409 |
| Đánh dấu `no_show` bằng tay | Chỉ cron `noShowSweep.service.js` tự đặt | — |
| Sửa hồ sơ mà không nêu lý do | Bắt buộc `ly_do` / `ly_do_cap_nhat` | 400 |
| Tự đổi trạng thái vận hành của bác sĩ | API chỉ đọc | — |

Ranh giới này khớp đúng bảng phân quyền mục 3.2 trong kế hoạch của thầy.

---

## Tổng kết

**53 chức năng** trong bộ đầy đủ:

| Trạng thái | Số lượng | Tỉ lệ |
|---|---:|---:|
| ✅ Dùng được | 41 | 77% |
| ⚠️ Thiếu/hụt | 4 | 8% |
| ❌ Chưa dùng được | 8 | 15% |

### Phân loại 8 mục ❌ theo việc cần làm

| Cần làm gì | Mục | Số lượng |
|---|---|---:|
| **Backend đã sẵn, chỉ thiếu frontend** | 2.2, 2.3, 6.2, 6.3 | 4 |
| **Thuần frontend** | 2.8 | 1 |
| **Cần thêm backend rồi mới làm UI** | 4.8, 5.4, 5.5 | 3 |

### Phân loại 4 mục ⚠️

| Mục | Cần làm |
|---|---|
| 1.2 | Hiển thị thêm dữ liệu backend đã trả sẵn |
| 1.4 | Thêm thao tác xác minh, không chỉ cảnh báo |
| 1.5 | Bỏ khoá cứng, thêm lựa chọn "không liên kết tài khoản" |
| 8.5 | Đưa timeline vào modal chi tiết lịch hẹn |

---

## Thứ tự đề xuất làm tiếp

| # | Việc | Mục liên quan | Loại | Mức |
|---:|---|---|---|---|
| 1 | Sửa check-in lỗi 400 + modal xác minh danh tính | 2.2, 2.3 | FE | 🔴 chặn nghiệp vụ |
| 2 | Sửa mojibake màn Lịch hẹn | — | FE | ⚪ nằm trên đường đi của việc 1 |
| 3 | Bổ sung thông tin phân biệt hồ sơ + tạo hồ sơ walk-in | 1.2, 1.4, 1.5 | FE | 🟡 |
| 4 | UI sửa hồ sơ hành chính + lịch sử audit | 6.2, 6.3 | FE | 🟠 |
| 5 | Nối phiếu in số thứ tự thật, bỏ `alert` giả | 2.8 | FE | 🟠 |
| 6 | Màn "Cần gọi thủ công" + đánh dấu đã gọi | 5.4, 5.5 | BE + FE | 🔴 lỗ hổng nghiệp vụ |
| 7 | Timeline lịch sử trong chi tiết lịch hẹn | 8.5 | FE | 🟡 |
| 8 | Chuyển lượt đang chờ sang bác sĩ khác | 4.8 | BE + FE | 🟠 |

Việc 1–4 nằm trong gói đang triển khai. Việc 5–8 nên tách gói riêng, mỗi gói một spec.

---

## Ghi chú quan trọng cho cả nhóm

### Vai trò y tá — hệ thống KHÔNG có

`models/NguoiDung.js:47` chỉ định nghĩa `['user', 'patient', 'doctor', 'admin', 'receptionist']`.
Nhóm chốt ngày 2026-08-02: **không thêm actor y tá**; phần việc thường gán cho y tá
(check-in, sinh hiệu) do **lễ tân và bác sĩ** đảm nhiệm.

Repo còn thư mục `docs/Y tá/` và `docs/NURSE_DOCTOR_WORKFLOW.md` — là **tài liệu thiết kế cũ,
giữ làm lịch sử, không triển khai**. Đừng dựa vào đó để code.

### LT-11 (lễ tân yêu cầu bác sĩ chỉnh sửa bệnh án) — đang chờ thầy xác nhận

Nhóm quyết định **bỏ** luồng này với lý do lễ tân không có chuyên môn để đánh giá bệnh án
hay đơn thuốc. Tuy nhiên kế hoạch của thầy có mục nghiệm thu *"tạo yêu cầu có lý do thành
công"*, nên **chưa gỡ code, chờ xác nhận**.

Lưu ý: hàng rào **403 chặn lễ tân sửa trực tiếp bệnh án vẫn giữ nguyên** trong mọi phương án.
Trạng thái `yeu_cau_chinh_sua` cũng không mất — nó thuộc luồng bác sĩ.

---

## Tài liệu liên quan

- `docs/Le tan/Ke hoach xu ly loi actor Le tan 2026-08-02.md` — kế hoạch gốc của thầy (LT-00 → LT-12)
- `docs/Le tan/2026-08-02-nang-luc-le-tan-doi-chieu-ke-hoach-thay.md` — đối chiếu từng task LT với code thật
- `docs/Le tan/2026-08-02-thiet-ke-ui-le-tan-lt07-lt10-va-go-lt11.md` — thiết kế gói đang triển khai
- `docs/Le tan/LT-07-LT-10-LT-11-backend-da-hoan-thanh-va-ui-can-bo-sung.md` — bàn giao backend
- `.claude/rules/lich-lam-viec-bac-si.md` — rule nghiệp vụ lịch hẹn (bất biến)
