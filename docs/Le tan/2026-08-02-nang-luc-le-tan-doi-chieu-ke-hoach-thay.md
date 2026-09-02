# Chốt năng lực actor Lễ tân — đối chiếu kế hoạch của thầy với code thật

Ngày: 2026-08-02 · Nhánh: `Bac_si`

Nguồn đối chiếu:
- `docs/Le tan/Ke hoach xu ly loi actor Le tan 2026-08-02.md` (LT-00 → LT-12, góp ý của thầy)
- `docs/Le tan/LT-07-LT-10-LT-11-backend-da-hoan-thanh-va-ui-can-bo-sung.md`
- Code thật trên nhánh `Bac_si` tại thời điểm lập tài liệu

Mục tiêu: chốt **lễ tân làm được gì / không được làm gì**, và chỉ ra chính xác chỗ nào
còn hở để phối hợp trơn tru với bác sĩ và khách hàng.

---

## 1. Bảng đối chiếu LT-00 → LT-12

Cột "Kế hoạch" là trạng thái tự khai trong tài liệu của thầy. Cột "Kiểm chứng" là kết quả
đọc code thật.

| Task | Backend | Frontend lễ tân | Kiểm chứng |
|---|---|---|---|
| **LT-00** Contract trạng thái + quyền | ✅ | ✅ | `utils/appointmentStatus.js` trả `allowed_actions` / `lock_reason` / `queue_state`; `Appointments.tsx:83` dùng qua `hasAction()` |
| **LT-01** Bác sĩ nghỉ đột xuất, chuyển bác sĩ | ✅ | ✅ | `reportDoctorUnavailable` + ~~`bulkRescheduleAppointments`~~ (**đã gỡ 2026-08-23** — crash 100% + bỏ qua rule mục 5/11/15; thay bằng luồng `de_xuat_doi` trên trang **Điều phối lịch hẹn**); UI có `bulkDoctorLeaveModal` |
| **LT-02** Khách đến muộn | ✅ | ✅ | `markLateArrival` đủ 3 phương án `end_of_shift` / `nearest_available` / `tomorrow`; UI có `lateModal` |
| **LT-03** Bác sĩ khám kéo dài | ⚠️ một phần | ⚠️ một phần | Cảnh báo có (`queueOverflow.service.js`, `doctor-statuses`); **chuyển lượt chờ sang bác sĩ khác CHƯA CÓ** |
| **LT-04** Hủy lịch trả slot ngay | ✅ | ✅ | `releaseAppointmentSlot()` trong transaction; UI có `cancelModal` |
| **LT-05** Khóa khi bác sĩ đang khám | ✅ | ✅ | `assertReceptionistAppointmentAction()`; `lock_reason: IN_ROOM` |
| **LT-06** Số thứ tự check-in | ✅ | ⚠️ | `checkInNumber.service.js` + unique index `{ngay_checkin_key, so_thu_tu_checkin}`; hiển thị OK nhưng **phiếu in là code chết** (xem §4.3) |
| **LT-07** Nhiều hồ sơ chung SĐT | ✅ | ❌ hỏng | Guard trùng lịch đã có (`receptionist/booking.controller.js:611-619`); **check-in ở màn Lịch hẹn luôn lỗi 400** (xem §4.1) |
| **LT-08** Bắt buộc thông báo khách | ✅ | ❌ | `notifyAppointmentCustomerChange()` ghi `CUSTOMER_CONTACT_REQUIRED`; **không có màn nào cho lễ tân xử lý danh sách cần gọi** |
| **LT-09** Lịch sử dời lịch của lễ tân | ✅ | ⚠️ | `LichSuLichHen.vai_tro` đã có `receptionist`; nhưng UI chỉ hiện lịch sử **khi khách hết lượt dời** (`Appointments.tsx:417`), không có timeline trong chi tiết lịch |
| **LT-10** Sửa hồ sơ hành chính có audit | ✅ | ❌ | 2 API sẵn sàng, frontend chưa gọi hàm nào |
| **LT-11** Yêu cầu chỉnh sửa bệnh án | ✅ | ❌ | **Nhóm quyết định BỎ** — xung đột với thầy, xem §5.1 |
| **LT-12** Trạng thái bác sĩ cho lễ tân | ✅ | ✅ | `getDoctorOperationalStatuses`; `Dashboard.tsx:220` "Trạng thái vận hành bác sĩ" |

**Tổng kết:** backend gần như xong (11/13 đủ, LT-03 thiếu một phần). Nút thắt nằm ở
**frontend** — 3 task có backend đầy đủ mà UI không dùng được (LT-07 hỏng, LT-08 và LT-10
chưa có), và 1 task backend thiếu thật (LT-03).

---

## 2. Lễ tân LÀM ĐƯỢC GÌ — chốt theo màn hình

### 2.1 Với khách hàng

| Thao tác | Màn hình | API | Trạng thái |
|---|---|---|---|
| Tra cứu người bệnh theo SĐT | Tiếp nhận tại quầy | `GET /patient-intake/search` | ✅ chạy |
| Tạo hồ sơ mới tại quầy | Tiếp nhận tại quầy | `POST /patient-intake/profiles` | ⚠️ kẹt khi SĐT đã có tài khoản online |
| Check-in khách **đã đặt lịch** | Tiếp nhận tại quầy | `PATCH /appointments/:id/arrived` | ✅ chạy |
| Check-in khách **đã đặt lịch** | Lịch hẹn (Phòng khám) | `PATCH /appointments/:id/arrived` | ❌ **lỗi 400** |
| Tiếp nhận khách **vãng lai** | Tiếp nhận tại quầy | `POST /patient-intake/check-in` | ✅ chạy |
| Kiểm tra khả năng tiếp nhận | Tiếp nhận tại quầy | `GET /patient-intake/availability` | ✅ chạy |
| Dời lịch (khách yêu cầu / lỗi phòng khám) | Lịch hẹn | `PATCH /appointments/:id/reschedule` | ✅ chạy |
| Hủy lịch + trả slot ngay | Lịch hẹn | `PATCH /appointments/:id/cancel` | ✅ chạy |
| Xử lý khách đến muộn (3 phương án) | Lịch hẹn | `PATCH /appointments/:id/mark-late` | ✅ chạy |
| Xem lịch sử dời lịch | Lịch hẹn | `GET /appointments/:id/reschedule-history` | ⚠️ chỉ hiện khi hết lượt dời |
| Sửa thông tin hành chính hồ sơ | — | `PATCH /patient-intake/profiles/:id` | ❌ chưa có UI |
| Xem lịch sử sửa hồ sơ | — | `GET /patient-intake/profiles/:id/audit` | ❌ chưa có UI |
| Xử lý danh sách "cần gọi thủ công" | — | — | ❌ chưa có UI |
| Thu tiền, xuất hóa đơn | Thanh toán & Thu ngân | `/payments/*` | ✅ chạy |

### 2.2 Với bác sĩ

| Thao tác | Màn hình | API | Trạng thái |
|---|---|---|---|
| Xem trạng thái vận hành bác sĩ | Tổng quan | `GET /appointments/doctor-statuses` | ✅ chạy |
| Thấy cảnh báo quá tải / khám kéo dài | Tổng quan | cùng API trên | ✅ chạy |
| Thấy lượt đang chờ + lịch chưa check-in bị ảnh hưởng | Tổng quan | cùng API trên | ✅ chạy |
| Báo bác sĩ nghỉ đột xuất + sinh đề xuất dời hàng loạt | Lịch hẹn | `POST /appointments/doctor-unavailable` | ✅ chạy |
| ~~Dời hàng loạt (Auto-fill)~~ | Lịch hẹn | ~~`POST /appointments/bulk-reschedule`~~ | **đã gỡ 2026-08-23** (crash 100% + bỏ qua rule mục 5/11/15). Thay bằng luồng `de_xuat_doi` trên trang **Điều phối lịch hẹn**. |
| Xem danh sách chờ tiếp nhận | Lịch hẹn | `GET /appointments/pending-checkin` | ✅ chạy |
| **Chuyển lượt đang chờ sang bác sĩ khác** | — | — | ❌ **chưa có cả BE lẫn FE** |

### 2.3 Với dữ liệu

Mọi thao tác thay đổi lịch của lễ tân đều đã ghi `LichSuLichHen` với `vai_tro='receptionist'`
và tạo `ThongBao` (hoặc audit `CUSTOMER_CONTACT_REQUIRED` khi khách không có tài khoản).
Sửa hồ sơ hành chính ghi `NhatKyThaoTac` với `UPDATE_PATIENT_PROFILE_ADMINISTRATIVE`,
lưu before/after theo từng trường.

---

## 3. Lễ tân KHÔNG được làm gì — ranh giới đã cứng trong code

| Cấm | Cơ chế chặn |
|---|---|
| Sửa bệnh án, chẩn đoán, đơn thuốc, sinh hiệu, dịch vụ phát sinh | `denyDirectMedicalRecordPatch` → **403** |
| Sửa trường chuyên môn trong hồ sơ bệnh nhân | `normalizeAdministrativeProfileUpdate` → **403** |
| Dời / hủy lịch khi bệnh nhân đã vào phòng | `allowed_actions=[]` + `lock_reason=IN_ROOM` → **409** |
| Hủy lịch đã check-in | Guard theo `HangDoi.trang_thai` |
| Đặt lịch hộ qua điện thoại | Rule mục 13 — `walkInWindow.service.js` chỉ cho hôm nay, chỉ slot `walk_in`, chỉ khung đang/kế tiếp |
| Chạm slot online của khách | `walkInWindow.service.js` |
| Đặt trùng khung giờ cho cùng một hồ sơ | `receptionist/booking.controller.js:611` → **409** |
| Đánh dấu `no_show` bằng tay | Chỉ cron `noShowSweep.service.js` tự đặt |
| Sửa hồ sơ mà không nêu lý do | Bắt buộc `ly_do` / `ly_do_cap_nhat` → **400** |

Ranh giới này **khớp đúng** bảng quyền ở mục 3.2 kế hoạch của thầy.

---

## 4. Khoảng cách thật sự còn lại, xếp theo mức nghiêm trọng

### 4.1 🔴 Check-in ở màn Lịch hẹn luôn lỗi — chặn nghiệp vụ

`Appointments.tsx:341` và `:356` gọi endpoint **không kèm body**:

```js
axiosInstance.patch(`/receptionist/appointments/${id}/arrived`)
```

Sau LT-07, `markAsArrived` bắt buộc `ho_so_benh_nhan_id` + `so_dien_thoai` + `ho_ten`
(`appointment.controller.js:261-267`) → trả **400** mọi lần bấm.

Hệ quả: lễ tân chỉ còn check-in được qua màn Tiếp nhận tại quầy. Đây là lỗi **chặn
nghiệp vụ**, ưu tiên cao nhất.

### 4.2 🔴 LT-08 không có đầu ra cho lễ tân

Backend đã ghi `CUSTOMER_CONTACT_REQUIRED` khi khách không có tài khoản để nhận thông báo
in-app. Nhưng grep toàn bộ `frontend/src`: **không có màn nào đọc các bản ghi này**.

Nghiệm thu LT-08 của thầy yêu cầu *"gửi thất bại không mất lịch thay đổi nhưng xuất hiện
trong danh sách cần xử lý"* — hiện danh sách đó không tồn tại trong UI. Khách bị dời lịch
mà không có tài khoản sẽ **không ai gọi**, vì lễ tân không thấy.

### 4.3 🟠 Phiếu số thứ tự chỉ là thông báo giả

`QueueTicketTemplate.tsx` có sẵn và đúng (`queueNumber`, khổ 80mm, `@page`), nhưng:

- `setPrintData` **không được gọi ở bất kỳ đâu** — chỉ xuất hiện đúng 1 lần ở dòng khai báo
- `window.print()` không hề có trong `Appointments.tsx` (chỉ có ở `Payments.tsx:155`)
- Thay vào đó là `alert('Đã xác nhận Check-in và đẩy lệnh in Số thứ tự tới máy in thành công!')`
  ở `Appointments.tsx:364`, `PatientIntake.tsx:232` và `:307`

Tức là hệ thống **báo đã in nhưng không in gì cả**. Số thứ tự có tồn tại trong dữ liệu và
hiển thị trên màn hình, nhưng khách không cầm được phiếu.

### 4.4 🟠 LT-10 chưa có UI

2 API sẵn sàng, frontend chưa gọi. Lễ tân không sửa được sai sót họ tên / ngày sinh / SĐT
của hồ sơ cũ, dù thầy đã chốt đây là quyền của lễ tân.

### 4.5 🟠 LT-03 thiếu "chuyển lượt chờ"

Thầy viết ở LT-03: *"Lễ tân được chuyển lượt đã check-in sang chờ"*. Rà toàn bộ
`controllers/receptionist/`: `HangDoi` **chỉ được đọc**, chưa có chỗ nào ghi `doctor_id`
mới. Đây là **thứ duy nhất còn thiếu backend** trong toàn bộ backlog.

Phân biệt cho rõ: dời `LichHen` (đã có) là đổi cam kết đặt chỗ; chuyển `HangDoi` (chưa có)
là đổi bác sĩ cho người **đang ngồi chờ tại phòng khám**. Hai việc khác nhau.

### 4.6 🟡 LT-07 UI thiếu thông tin phân biệt người bệnh

Danh sách hồ sơ (`PatientIntake.tsx:430-446`) chỉ hiện họ tên, ngày sinh, giới tính in raw
(`nam`/`nu`), và chuỗi cứng "Thành viên gia đình". Backend **đã trả** `quan_he`,
`nhom_gia_dinh`, `so_dien_thoai` riêng của hồ sơ nhưng UI không dùng.

Khi 3 người nhà chung một số, lễ tân không có đủ dữ liệu trên màn hình để chọn đúng người.

### 4.7 🟡 Không tạo được hồ sơ walk-in trên SĐT đã có tài khoản

`PatientIntake.tsx:585`: nút submit bị disable khi `accounts.length > 0 && !selectedAccountId`.
Khách vãng lai dùng nhờ số của người nhà → lễ tân buộc phải gắn hồ sơ vào tài khoản người
khác, hoặc không tạo được.

Kèm theo `createProfileAndCheckIn:247` có fallback `accounts.find(...) || accounts[0]` —
nhiều tài khoản chung số thì **gán nhầm im lặng**.

### 4.8 🟡 LT-09 lịch sử bị giấu

`GET /:id/reschedule-history` chỉ được gọi ở một chỗ: hàm kiểm tra khách hết lượt dời
(`Appointments.tsx:417`). Thầy yêu cầu ở LT-09 UI một timeline trong **chi tiết lịch**
("10:15 - Lễ tân Nguyễn A chuyển từ BS B..."). Modal chi tiết hiện không có mục này.

### 4.9 ⚪ Mojibake màn Lịch hẹn

`Appointments.tsx` bị double-encode toàn bộ tiếng Việt (`'ÄÃ£ Ä‘áº¿n'` thay vì `'Đã đến'`),
xác nhận bằng hexdump. Màn này đang hiển thị chữ rác. Chỉ 2 file trong toàn frontend bị.

---

## 5. Xung đột cần thầy/nhóm chốt

### 5.1 ⚠️ LT-11 — nhóm quyết định bỏ, trái với kế hoạch của thầy

Thầy viết rõ ở LT-11:

> *"Lễ tân chỉ được tạo **yêu cầu chỉnh sửa** bệnh án, nêu rõ lỗi hành chính/thiếu thông
> tin và đính kèm lý do."*

và nghiệm thu:

> *"lễ tân không thể PATCH chẩn đoán/đơn thuốc; **tạo yêu cầu có lý do thành công**;
> bác sĩ sửa tạo revision"*

Ngày 2026-08-02 nhóm quyết định **bỏ hẳn** luồng yêu cầu chỉnh sửa, lý do: lễ tân không có
chuyên môn để đánh giá bệnh án hay đơn thuốc, nên cũng không nên có quyền yêu cầu sửa.

**Hệ quả nếu bỏ:** vế đầu nghiệm thu (403 khi lễ tân PATCH) vẫn đạt; vế "tạo yêu cầu thành
công" **không đạt**. Backend đã code xong luồng này (`9b4a495`) nên gỡ là chủ động, không
phải thiếu sót.

**Cần thầy xác nhận** trước khi gỡ, vì đây là mục nghiệm thu của thầy chứ không phải quyết
định nội bộ.

*Lưu ý:* trạng thái `yeu_cau_chinh_sua` **không mất đi** — nó thuộc luồng bác sĩ
(`doctor/appointments.controller.js:903-925`), bác sĩ vẫn tự đánh dấu hồ sơ cần sửa được.

### 5.2 Vai trò y tá — đã loại khỏi rule

Hệ thống chỉ có 4 vai trò: `['user', 'patient', 'doctor', 'admin', 'receptionist']`
(`models/NguoiDung.js:47`) — không có y tá. Nhóm chốt ngày 2026-08-02: **không thêm actor
y tá**, phần việc đó do lễ tân và bác sĩ gánh. Sẽ sửa dòng 72 của
`.claude/rules/lich-lam-viec-bac-si.md` để tránh hiểu nhầm về sau.

Lưu ý repo còn thư mục `docs/Y tá/` và `docs/NURSE_DOCTOR_WORKFLOW.md` — là tài liệu thiết
kế cũ, giữ làm lịch sử, không triển khai.

### 5.3 Năm câu hỏi mục 7 của thầy vẫn chưa có câu trả lời chính thức

| Câu hỏi | Hiện code đang làm gì |
|---|---|
| Khách không phản hồi bao lâu thì áp phương án giữ chỗ? | Có cron áp phương án, ngưỡng chưa được chốt bằng văn bản |
| Trễ bao nhiêu phút thì chỉ được cuối hàng / phải chuyển ngày? | Grace 15′ theo rule mục 11; ranh giới "phải chuyển ngày" do lễ tân tự quyết |
| Ngưỡng "khám kéo dài": slot+15′, 60′, hay theo chuyên khoa? | `queueOverflow.service.js` đọc từ env, mặc định 30′/60′ |
| Kênh thông báo: in-app/email hay SMS thật? | Chỉ in-app + audit gọi thủ công. **Chưa có SMS** |
| Admin được sửa nội dung chuyên môn hay chỉ mở khóa? | Code **đã cho** admin override 4 trường có audit — đúng khuyến nghị của thầy nhưng chưa được xác nhận |

---

## 6. Đề xuất thứ tự làm tiếp

| # | Việc | Loại | Lý do |
|---:|---|---|---|
| 1 | Sửa check-in 400 + modal xác minh danh tính (LT-07) | FE | Đang chặn nghiệp vụ |
| 2 | Mojibake `Appointments.tsx` | FE | Nằm trên đường đi của việc 1 |
| 3 | Bổ sung thông tin phân biệt hồ sơ + tạo hồ sơ walk-in (LT-07) | FE | Hoàn tất LT-07 |
| 4 | UI sửa hồ sơ hành chính + lịch sử audit (LT-10) | FE | Backend đã sẵn |
| 5 | Gỡ LT-11 (sau khi thầy xác nhận) | BE | Chờ §5.1 |
| 6 | Nối phiếu in số thứ tự thật, bỏ `alert` giả | FE | Khách cần cầm phiếu |
| 7 | Màn "Cần gọi thủ công" (LT-08) | FE | Nghiệm thu LT-08 đang hụt |
| 8 | Timeline lịch sử trong chi tiết lịch (LT-09) | FE | Nghiệm thu LT-09 đang hụt |
| 9 | Chuyển lượt chờ sang bác sĩ khác (LT-03) | BE + FE | Thứ duy nhất thiếu backend |

Việc 1–5 nằm trong gói đang triển khai (xem
`docs/Le tan/2026-08-02-thiet-ke-ui-le-tan-lt07-lt10-va-go-lt11.md`). Việc 6–9 nên tách gói
riêng, mỗi gói một spec.
