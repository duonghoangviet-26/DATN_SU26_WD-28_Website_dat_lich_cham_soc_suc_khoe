# Audit — Thiết kế giao diện trang Bác sĩ (Giai đoạn 1: Khảo sát)

> Ngày kiểm tra: 2026-07-11
> Phạm vi: chỉ giao diện trang bác sĩ (`/doctor/*`). Không đụng admin, bệnh nhân, y tá, logic nghiệp vụ, API.
> Đây là **báo cáo hiện trạng — chưa sửa code**. Các audit nghiệp vụ trước đó (`Audit - Ra soat trang bac si`, `Audit - UI trang thai...`, ngày 2026-07-08) đã cũ — nhiều lỗi biên dịch/thiếu tính năng nêu ở đó (DoctorProfile lỗi TS, thiếu trang Xin nghỉ, thiếu Hồ sơ chờ xác nhận) **đã được vá** ở các commit sau. Báo cáo này chỉ nói về **thiết kế thị giác** (màu, layer, spacing, tái sử dụng component), không lặp lại audit nghiệp vụ cũ.

---

## 1. Kết luận nhanh (khác với giả định trong yêu cầu)

Yêu cầu ban đầu giả định giao diện "màu sắc lộn xộn, layer không phân biệt, mỗi trang một kiểu". **Thực tế không nghiêm trọng như vậy.** Dự án đã có sẵn một design system khá kỷ luật:

- `tailwind.config.js`: bảng màu `brand.50–900` (xanh dương y tế) + `surface` (nền app xám nhạt) + `boxShadow.card` riêng.
- `index.css`: đã định nghĩa sẵn `.btn-primary/.btn-secondary/.btn-danger/.btn-ghost/.btn-icon`, `.input/.input-label`, `.card/.card-hover`, `.table-head-row/.table-cell/.table-row`, `.spinner`, `.empty-state`.
- `components/common/`: `PageHeader`, `Badge` (status màu chuẩn hoá 5 màu), `Modal`, `ConfirmDialog`, `Toast`, `Loading`, `Empty`, `Skeleton`, `Pagination`, `Button` (variant/size chuẩn).
- `DoctorLayout` + `DoctorSidebar` + `DoctorHeader`: đã tách riêng hoàn toàn khỏi Admin, dùng đúng `bg-surface` cho layer nền và `card` (nền trắng) cho nội dung, sidebar active dùng `bg-brand-500`, không có menu/hành động vượt quyền.
- Cả 6 trang (`DoctorDashboard`, `DoctorAppointments`, `DoctorSchedule`, `DoctorPendingRecords`, `DoctorLeaveRequests`, `DoctorProfile`) đều dùng chung `PageHeader`, đều dùng `Badge` cho trạng thái, đều tông màu `slate` cho text phụ và `brand` cho nhấn mạnh — **không có màu hard-code lạ, không có trang nào lệch tông** khỏi bảng màu chung.

**Vấn đề thật sự** không phải là "hệ màu hỗn loạn", mà là **trùng lặp code / bỏ qua component đã có sẵn**, khiến từng trang tự viết lại cùng một thứ theo cách hơi khác nhau — đây mới là nguồn gốc cảm giác "thiếu nhất quán" khi đọc kỹ từng trang.

---

## 2. Vấn đề cụ thể tìm thấy

### 2.1. Loading / Error state viết tay lặp lại, bỏ qua component có sẵn
Component `Loading` và `Empty` đã tồn tại và thiết kế đẹp (icon y tế, animation) nhưng **không trang doctor nào dùng**. Thay vào đó mỗi trang tự viết:
```
loading ? <div className="flex h-48 items-center justify-center text-slate-400">Đang tải...</div>
error ? <div className="flex h-64 ... border-red-200 bg-red-50">...</div>
```
Lặp lại y hệt ở `DoctorDashboard`, `DoctorAppointments`, `DoctorSchedule`, `DoctorPendingRecords`, `DoctorLeaveRequests` (5/6 trang). Error state không có nút "Thử lại" (yêu cầu ở mục XI của spec).

### 2.2. Modal viết tay lặp lại 6 lần, bỏ qua `Modal` dùng chung
`components/common/Modal.tsx` đã có sẵn (header chuẩn, nút đóng, khoá scroll, size chuẩn) nhưng **không trang doctor nào dùng**. Mỗi trang tự dựng lại y hệt phần khung `fixed inset-0 bg-black/40 ... rounded-2xl bg-white shadow-xl`:
- `ExamModal`, `ReasonModal` trong `DoctorAppointments.tsx`
- `RecordViewModal` trong `DoctorPendingRecords.tsx`
- `CreateLeaveModal` trong `DoctorLeaveRequests.tsx`
- `leaveDialog`, `cancelDialog` (2 modal khác) trong `DoctorSchedule.tsx`

6 modal, 6 lần viết tay phần khung giống hệt nhau.

### 2.3. Nút hành động theo trạng thái: không có biến thể dùng chung
`components/common/Button.tsx` có variant chuẩn (`primary/secondary/ghost/danger`, size `sm/md/lg`) nhưng **chỉ được dùng ở 2 trang client** (`Profile.tsx`, `Booking.tsx`), không dùng ở doctor page. Các nút hành động nhỏ trong bảng (Xác nhận/Từ chối/Hoàn thành/Yêu cầu chỉnh sửa/Hủy) ở `DoctorAppointments.tsx` và `DoctorLeaveRequests.tsx` đều là chuỗi Tailwind viết tay lặp lại từng màu (`border-green-200 bg-green-50 text-green-600`, `border-amber-200 bg-amber-50 text-amber-600`, `border-red-200 bg-red-50 text-red-600`...) — không sai màu, nhưng là copy-paste ~15 lần thay vì 1 component `size="xs"` + `variant="success|warning|danger"`.

### 2.4. Bảng: hằng số `TH_PLAIN` định nghĩa lặp lại 3 lần
`index.css` đã có `.table-head-row` / `.table-cell` / `.table-row` nhưng **hoàn toàn không được dùng**. Thay vào đó `DoctorAppointments.tsx`, `DoctorPendingRecords.tsx`, `DoctorLeaveRequests.tsx` mỗi file tự khai:
```ts
const TH_PLAIN = 'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500'
```
Giống hệt nhau, copy 3 lần.

### 2.5. Toast: 2 cách làm song song
`DoctorSchedule.tsx` và `DoctorLeaveRequests.tsx` dùng đúng component `Toast` dùng chung. `DoctorAppointments.tsx` tự viết toast riêng (div `fixed right-6 top-6` + `setTimeout` thủ công) thay vì tái sử dụng `Toast`.

### 2.6. Màu trạng thái được định nghĩa lại ở từng trang thay vì 1 nguồn
Mỗi trang tự khai `STATUS_COLOR` / `STATUS_LABEL` cục bộ thay vì lấy từ 1 nơi chung (`utils/constants.ts` đã có sẵn `APPOINTMENT_STATUS_LABEL`, `PAYMENT_STATUS_LABEL` nhưng **không có** `APPOINTMENT_STATUS_COLOR` tương ứng — chỉ có label, màu phải tự đoán lại mỗi trang). Hệ quả: `DoctorDashboard.tsx` map màu cho cả `checked_in`/`in_progress` (→ xanh dương/vàng), nhưng `DoctorAppointments.tsx` chỉ map `pending/confirmed/completed/cancelled` — nếu dữ liệu tương lai có `checked_in`, `no_show`, badge ở trang Lịch hẹn sẽ rơi về mặc định (`gray`) trong khi Dashboard hiển thị màu khác cho cùng trạng thái đó. Hiện tại luồng thực tế chưa dùng các trạng thái này (theo audit nghiệp vụ cũ) nên chưa gây lỗi thấy được, nhưng là rủi ro drift màu giữa các màn khi luồng đó được bật.

### 2.7. Container nội dung không giới hạn chiều rộng
`DoctorLayout.tsx`: `<main className="flex-1 overflow-y-auto p-4 lg:p-6">` — không có `max-width`. Trên màn hình rất rộng, bảng/card sẽ giãn hết chiều ngang, không có "Layer 2 — khu vực nội dung chính giới hạn chiều rộng hợp lý" như spec yêu cầu. Mức độ: nhẹ, chỉ ảnh hưởng màn hình > ~1920px.

### 2.8. Sidebar active dùng nền đặc thay vì "primary soft"
`DoctorSidebar.tsx`: menu active = `bg-brand-500 text-white` (nền đặc). Spec đề xuất "nền primary soft, icon/chữ màu primary". Đây là lựa chọn thẩm mỹ hợp lệ (tương phản cao, rõ ràng), **không phải lỗi** — nêu ra để quyết định giữ nguyên hay đổi sang phong cách "soft" nhẹ nhàng hơn.

### 2.9. Câu hỏi phạm vi nghiệp vụ — không tự quyết định
`DoctorDashboard.tsx` có thẻ thống kê **"Doanh thu tháng"** (`stats.doanh_thu_thang`). Yêu cầu chỉnh sửa giao diện có nêu "không dùng dữ liệu doanh thu... hoặc dữ liệu quản trị" trên trang bác sĩ. Đây là doanh thu cá nhân của bác sĩ (không phải doanh thu toàn hệ thống), có thể vẫn hợp lý cho bác sĩ tự theo dõi thu nhập hành nghề. **Không tự xoá field này** vì đó là thay đổi dữ liệu hiển thị/nghiệp vụ ngoài phạm vi "chỉnh sửa giao diện" — cần quyết định của bạn trước khi đụng tới.

---

## 3. Danh sách file

| File | Vai trò | Nhóm | Lý do |
|---|---|---|---|
| `frontend/src/layouts/DoctorLayout.tsx` | Layout khung (sidebar+header+main) | A — được sửa | Chỉ dùng cho doctor, thêm max-width container |
| `frontend/src/components/doctor/DoctorSidebar.tsx` | Sidebar menu | A | Riêng cho doctor |
| `frontend/src/components/doctor/DoctorHeader.tsx` | Header | A | Riêng cho doctor |
| `frontend/src/pages/doctor/DoctorDashboard.tsx` | Trang tổng quan | A | Thay loading/error thủ công bằng `Loading`, thêm nút thử lại |
| `frontend/src/pages/doctor/DoctorAppointments.tsx` | Lịch hẹn + modal kết quả khám | A | Gộp modal vào `Modal`, gộp toast vào `Toast`, thay TH_PLAIN, chuẩn hoá nút hành động |
| `frontend/src/pages/doctor/DoctorSchedule.tsx` | Lịch làm việc | A | Gộp 2 dialog vào `Modal` |
| `frontend/src/pages/doctor/DoctorPendingRecords.tsx` | Hồ sơ chờ xác nhận | A | Gộp modal, thay TH_PLAIN, dùng `Empty`/`Loading` |
| `frontend/src/pages/doctor/DoctorLeaveRequests.tsx` | Xin nghỉ | A | Gộp modal, thay TH_PLAIN |
| `frontend/src/pages/doctor/DoctorProfile.tsx` | Hồ sơ cá nhân | A | Đã khá chuẩn — chỉ thêm error state |
| `frontend/src/index.css` | `.btn-*`, `.card`, `.table-*`, `.input-*` dùng toàn hệ thống | B — chỉ đọc, có thể **thêm** class mới không phá class cũ | Dùng chung với Admin/Client — không sửa class hiện có, chỉ thêm biến thể mới nếu cần (vd `.btn-xs-success`) |
| `frontend/tailwind.config.js` | Bảng màu `brand`/`surface` dùng toàn hệ thống | B | Dùng chung toàn hệ thống — không đổi |
| `frontend/src/components/common/Badge.tsx`, `Modal.tsx`, `Loading.tsx`, `Empty.tsx`, `Toast.tsx`, `Button.tsx`, `ConfirmDialog.tsx`, `PageHeader.tsx` | Component dùng chung toàn hệ thống | B | Doctor page sẽ **dùng** các component này, chỉ sửa nếu thiếu prop cần thiết (vd `Button` chưa có variant "success"/"warning") — sửa thêm prop, không đổi behavior cũ |
| `frontend/src/utils/constants.ts` | Label trạng thái dùng chung | B | Có thể **thêm** map màu trạng thái (`APPOINTMENT_STATUS_COLOR`...) cạnh label đã có, không đổi label cũ |
| Toàn bộ `pages/admin/**`, `pages/client/**`, `pages/nurse/**` (nếu có), backend, model, mock data cấu trúc | — | C — không đụng | Ngoài phạm vi doctor page |

---

## 4. Design system đề xuất (tận dụng theme hiện tại — không tạo mới)

Không tạo bảng màu mới. Chỉ **chuẩn hoá cách dùng** những gì đã có:

| Hạng mục | Giữ nguyên | Bổ sung |
|---|---|---|
| Màu chính | `brand.500` (nút, active, nhấn mạnh), `brand.50/100` (nền soft) | — |
| Nền layer | `bg-surface` (app), `bg-white`/`.card` (surface) | Thêm `max-w-[1400px] mx-auto` cho vùng nội dung chính trong `DoctorLayout` |
| Trạng thái | `Badge` màu green/red/blue/yellow/gray | Thêm `APPOINTMENT_STATUS_COLOR`, `KET_QUA_STATUS_COLOR`, `LEAVE_STATUS_COLOR` **tập trung** trong `utils/constants.ts`, mọi trang import từ đây thay vì tự khai |
| Nút | `.btn-primary/secondary/danger/ghost` (cỡ chuẩn), `Button.tsx` (cỡ có `sm`) | Thêm biến thể nhỏ cho hành động trong bảng: dùng `Button` với `size="sm"` + thêm `variant="success"` và `variant="warning"` vào `Button.tsx` (hiện chỉ có primary/secondary/ghost/danger) |
| Modal | `Modal.tsx` (header+close+scroll lock có sẵn) | Không đổi — chỉ thay các modal viết tay bằng cách gọi component này |
| Bảng | `.table-head-row`, `.table-cell`, `.table-row` (có sẵn, chưa ai dùng) | Không đổi — thay `TH_PLAIN` cục bộ bằng class có sẵn |
| Loading/Empty | `Loading.tsx`, `Empty.tsx` (có sẵn, chưa ai dùng ở doctor) | Không đổi — dùng thay div viết tay; thêm nút "Thử lại" cho error state (component riêng nhỏ hoặc inline) |
| Toast | `Toast.tsx` (có sẵn) | Thay toast viết tay trong `DoctorAppointments` |
| Spacing/Radius/Shadow | `rounded-xl`, `shadow-card`, `p-5`/`p-6` đã nhất quán giữa các trang | Không đổi |

---

## 5. Kế hoạch chỉnh sửa (từng bước nhỏ)

| Bước | Nội dung | File sửa | Rủi ro | Cách kiểm tra |
|---|---|---|---|---|
| 1 | Thêm `variant="success"/"warning"` vào `Button.tsx`; thêm map màu trạng thái tập trung vào `utils/constants.ts` (không đổi label cũ) | `Button.tsx`, `utils/constants.ts` | Thấp — chỉ thêm, không đổi API cũ | `tsc --noEmit`, kiểm tra 2 trang client đang dùng `Button` không đổi giao diện |
| 2 | `DoctorLayout.tsx`: thêm max-width cho vùng nội dung | `DoctorLayout.tsx` | Thấp | Xem desktop rộng + mobile, không vỡ layout |
| 3 | Thay loading/error viết tay bằng `Loading`/error-card có nút thử lại ở 5 trang | `DoctorDashboard`, `DoctorAppointments`, `DoctorSchedule`, `DoctorPendingRecords`, `DoctorLeaveRequests` | Thấp — chỉ đổi UI hiển thị, giữ nguyên state/logic gọi API | Test tắt mạng / mock lỗi, xem loading/error/nút thử lại |
| 4 | Gộp 6 modal viết tay vào `Modal.tsx` dùng chung | `DoctorAppointments`, `DoctorSchedule`, `DoctorPendingRecords`, `DoctorLeaveRequests` | Trung bình — modal có form phức tạp (ExamModal nhiều field), cần giữ nguyên toàn bộ logic form, chỉ đổi khung bọc ngoài | Mở từng modal, kiểm tra tất cả field, validate, nút Lưu/Đóng hoạt động đúng như trước |
| 5 | Thay `TH_PLAIN` bằng `.table-head-row`/`.table-cell`, thay nút hành động lặp lại bằng `Button size="sm"` | `DoctorAppointments`, `DoctorPendingRecords`, `DoctorLeaveRequests` | Thấp — thuần CSS class | So sánh bảng trước/sau, đảm bảo không đổi text/hành vi nút |
| 6 | Gộp toast viết tay trong `DoctorAppointments` vào `Toast.tsx` | `DoctorAppointments.tsx` | Thấp | Bấm các hành động, xem toast hiện đúng như cũ |
| 7 | Kiểm tra cuối: responsive (mobile/tablet/desktop), không có màu lệch, sidebar/breadcrumb đúng route | Tất cả file trên | — | Test thủ công từng trang ở 3 kích thước màn hình |

**Chưa đưa vào kế hoạch** (cần bạn quyết định trước): mục 2.8 (đổi sidebar active sang "soft") và mục 2.9 (thẻ "Doanh thu tháng").

---

## 6. Quyết định đã chốt (2026-07-11)

### 6.1. Sidebar active (mục 2.8) — ĐỔI sang "soft"
Đổi `DoctorSidebar.tsx` từ nền đặc `bg-brand-500 text-white` sang: nền `brand` nhạt (`bg-brand-50`), chữ + icon màu `brand` đậm (`text-brand-600`/`700`), thêm thanh chỉ báo nhỏ bên trái (border-left hoặc block 3-4px) để nhận diện active. Yêu cầu ràng buộc: giữ nguyên logic `NavLink` xác định active hiện tại (chỉ đổi `className`), hover phải phân biệt rõ với active, kiểm tra tương phản + responsive. Xác nhận: `DoctorSidebar.tsx` là component riêng của doctor (`components/admin/Sidebar.tsx` là file khác, tách biệt hoàn toàn) — sửa không ảnh hưởng Admin. **Sẽ thực hiện ở bước riêng, không nằm trong bước 1.**

### 6.2. Thẻ "Doanh thu tháng" (mục 2.9) — BỎ, thay bằng thống kê nghiệp vụ
Bỏ khỏi `DoctorDashboard.tsx`. Kiểm tra dữ liệu thực tế khả dụng theo 4 ưu tiên người yêu cầu đưa ra:

| Ưu tiên | Chỉ số | Có sẵn ở đâu? |
|---|---|---|
| 1. Hồ sơ chờ bác sĩ xác nhận | **Có** — `doctorAppointmentService.listPendingResults()` trả `DoctorPendingRecord[]`, đang dùng ở trang "Hồ sơ chờ xác nhận". Đếm bằng `.length`. Chưa có field đếm sẵn trong `DoctorStats`/`DoctorTodayOverview` — phải gọi thêm 1 API con hoặc dùng `.length` của danh sách. |
| 2. Bệnh nhân đang chờ khám | Có sẵn — `DoctorTodayOverview.cho_kham` |
| 3. Bệnh nhân đang khám | Có sẵn — `DoctorTodayOverview.dang_kham` |
| 4. Bệnh nhân đã hoàn thành hôm nay | Có sẵn — `DoctorTodayOverview.hoan_thanh` |

**Lưu ý quan trọng**: mục 2, 3, 4 (`cho_kham`, `dang_kham`, `hoan_thanh`) **đã được hiển thị** ở card "Công việc hôm nay" (`todayCards`) ngay phía trên trong cùng trang — hiển thị lại ở khối thống kê bên dưới sẽ trùng lặp thông tin trên cùng 1 màn hình. Chỉ số duy nhất **chưa có mặt ở đâu khác** trên Dashboard là ưu tiên #1 (hồ sơ chờ xác nhận). Đề xuất khi thực hiện: thay thẻ "Doanh thu tháng" bằng thẻ **"Hồ sơ chờ xác nhận"** (gọi thêm `doctorAppointmentService.listPendingResults()`, dùng `.length`, có thể bấm để điều hướng sang `/doctor/pending-records` giống cách "Xem tất cả" đã làm với lịch hẹn). Không hard-code, không tạo API giả. **Sẽ thực hiện ở bước riêng, không nằm trong bước 1.**

---

## 7. Trạng thái thực hiện

- Giai đoạn 1 (khảo sát): hoàn tất.
- Quyết định mục 2.8, 2.9: đã chốt (mục 6) — **chưa code**, chờ thực hiện ở bước riêng sau bước 1.
- Bước 1 (chuẩn hóa Button variant + màu trạng thái tập trung): **đã hoàn tất**, xem nhật ký bên dưới.
- Mục 6.1 (sidebar active → soft): **đã hoàn tất**, xem mục 9.
- Mục 6.2 (bỏ "Doanh thu tháng" → "Hồ sơ chờ xác nhận"): **đã hoàn tất**, xem mục 10.
- Bước 2 kế hoạch (max-width layout): **đã hoàn tất**, xem mục 11.

---

## 8. Nhật ký thực hiện — Bước 1: chuẩn hóa Button variant + màu trạng thái tập trung

### File đã sửa
- `frontend/src/components/common/Button.tsx`
- `frontend/src/utils/constants.ts`

### File chỉ đọc để đối chiếu (không sửa)
`Badge.tsx` (tham chiếu union màu `green/red/blue/yellow/gray`), 6 trang doctor (để lấy chính xác từng map màu cũ trước khi tập trung hoá), `pages/client/Profile.tsx` + `Booking.tsx` (2 nơi duy nhất đang dùng `Button`, để đảm bảo không đổi hành vi).

### Diff logic

**`Button.tsx`**: thêm 2 variant mới `success` (`bg-green-600` solid, cùng công thức `bg-{color}-600 hover:bg-{color}-700 shadow-sm shadow-{color}-100` như `primary`/`danger` đã có) và `warning` (`bg-amber-500 hover:bg-amber-600`). Không đổi variant cũ (`primary/secondary/ghost/danger`), không đổi `size`, không đổi API props.

**`constants.ts`**: thêm 1 type `BadgeColor` (`'green'|'red'|'blue'|'yellow'|'gray'`, khớp union màu trong `Badge.tsx`) và 6 map màu tập trung, đặt cạnh label tương ứng đã có sẵn:
- `APPOINTMENT_STATUS_COLOR` — khớp map đang dùng ở `DoctorDashboard.tsx` (bao phủ đủ `checked_in`/`in_progress`/`no_show` mà `DoctorAppointments.tsx` đang thiếu — xem mục 2.6).
- `PAYMENT_STATUS_COLOR` — khớp `PAYMENT_COLOR` cũ trong `DoctorAppointments.tsx` cho `unpaid/paid/refunded`; bổ sung `partial/pending/failed` (trước đây không có màu ở đâu cả vì các trạng thái này có label nhưng chưa từng hiển thị badge).
- `DOCTOR_APPROVAL_COLOR` — khớp `APPROVAL_COLOR` cũ trong `DoctorProfile.tsx`.
- `KET_QUA_KHAM_STATUS_COLOR` — khớp `KET_QUA_STATUS_COLOR` cũ (giống hệt nhau ở `DoctorAppointments.tsx` và `DoctorPendingRecords.tsx`).
- `SCHEDULE_SLOT_STATUS_COLOR` — khớp `STATUS_COLOR` cũ trong `DoctorSchedule.tsx`.
- `DOCTOR_LEAVE_STATUS_COLOR` — khớp `STATUS_COLOR` cũ trong `DoctorLeaveRequests.tsx`.

Không đổi bất kỳ tên trạng thái (key) hay label nào đã có. Không xoá các map `STATUS_COLOR`/`APPROVAL_COLOR`/`PAYMENT_COLOR` cục bộ trong 6 trang doctor — **các trang chưa được sửa để import từ nguồn mới này** (việc thay thế thuộc bước 5 của kế hoạch, để tránh sửa hàng loạt trang trong 1 lần theo đúng yêu cầu).

### Cách đã kiểm tra
- `npx tsc --noEmit` trong `frontend/`: không có lỗi nào phát sinh từ `Button.tsx` hoặc `constants.ts` (lọc theo tên file, 0 kết quả).
- Toàn bộ lỗi TS hiện có trong repo (32 lỗi) đều nằm ở `src/mock/doctor-appointments.ts`, đã tồn tại từ trước, không liên quan tới thay đổi ở bước này, ngoài phạm vi bước 1.
- Không có trang nào (kể cả `Profile.tsx`/`Booking.tsx` đang dùng `Button`) bị đổi giao diện vì chỉ thêm variant mới, không sửa variant cũ.

### Rủi ro còn lại
- 2 map màu mới (`APPOINTMENT_STATUS_COLOR`, `PAYMENT_STATUS_COLOR`) hiện **chưa được trang nào sử dụng** — chỉ tồn tại như nguồn dùng chung, chưa có tác dụng thực tế cho tới khi áp dụng ở bước 5. Rủi ro drift màu nêu ở mục 2.6 vẫn còn cho tới khi đó.
- Giá trị màu bổ sung cho `partial/pending/failed` (payment) là lựa chọn mới (chưa từng có màu trước đây) — cần bạn duyệt lại khi áp dụng vào trang thật, vì đây là quyết định thẩm mỹ nhỏ chưa được xác nhận riêng.

---

## 9. Nhật ký thực hiện — Mục 6.1: Sidebar active → soft

### File đã sửa
- `frontend/src/components/doctor/DoctorSidebar.tsx` (duy nhất)

### Diff logic
Chỉ đổi chuỗi `className` của `NavLink` theo `isActive`, không đổi bất kỳ logic nào khác:
- Trước: `isActive ? 'bg-brand-500 text-white shadow-sm' : ...`
- Sau: `isActive ? 'bg-brand-50 text-brand-700 before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-brand-600' : ...`

Thêm `relative` vào class nền (base) của item để làm điểm neo cho thanh chỉ báo (`::before`) — thanh cao 20px, rộng 3px, bo góc phải, màu `brand-600`, căn giữa theo chiều dọc item, nằm sát mép trái. Icon (`stroke="currentColor"`) và chữ tự đổi màu theo `text-brand-700` — không cần sửa thêm gì ở `Icon` component.

Nhánh `else` (chưa active, kể cả hover) **giữ nguyên 100%** — `text-slate-600 hover:bg-slate-100 hover:text-slate-800` — nên active (nền xanh nhạt + chữ xanh đậm + thanh chỉ báo) và hover (nền xám nhạt, không thanh chỉ báo) vẫn phân biệt rõ ràng, không thể nhầm lẫn.

Logic xác định route active (`NavLink` của `react-router-dom`, prop `end`, `to`) **không đổi** — chỉ đổi map từ `isActive` sang class.

`DoctorSidebar.tsx` là component riêng của doctor (khác hoàn toàn `components/admin/Sidebar.tsx`) nên không ảnh hưởng Admin hay vai trò khác.

### Cách đã kiểm tra
- `npx tsc --noEmit`: không có lỗi nào ở `DoctorSidebar.tsx`.
- Đối chiếu tương phản: nền `brand-50` (#eff4ff) + chữ `brand-700` (#2348c8) — chữ đậm trên nền rất nhạt, tỉ lệ tương phản cao hơn nhiều ngưỡng AA cho text thường.
- Chưa mở trình duyệt để xem trực quan (không có yêu cầu chạy dev server trong bước này) — cần bạn xác nhận hình ảnh thực tế nếu muốn, đặc biệt ở độ rộng sidebar 260px và chế độ drawer mobile (đóng/mở không đổi, chỉ đổi màu item bên trong).

### Rủi ro còn lại
- Thanh chỉ báo bên trái đặt tại mép trái của chính item (bo góc `rounded-lg` của item), không phải mép trái toàn sidebar — đúng theo mô tả "thanh chỉ báo nhỏ bên trái" nhưng nếu bạn hình dung thanh chỉ báo phải chạm sát viền ngoài cùng của sidebar (bên ngoài phần `px-3` của `<nav>`), cần điều chỉnh thêm.
- Chưa xem bằng mắt trên trình duyệt thật.

---

## 10. Nhật ký thực hiện — Mục 6.2: Bỏ "Doanh thu tháng" → "Hồ sơ chờ xác nhận"

### File đã sửa
- `frontend/src/pages/doctor/DoctorDashboard.tsx` (duy nhất)

### Diff logic
- Thêm `import { doctorAppointmentService } from '@/services/doctor-appointment.service'` — service này đã tồn tại sẵn (dùng ở `DoctorAppointments.tsx`, `DoctorPendingRecords.tsx`), không tạo API mới.
- Thêm state `pendingRecordCount` (khởi tạo `0`).
- Thêm `doctorAppointmentService.listPendingResults()` làm phần tử thứ 4 trong `Promise.all(...)` đã có sẵn ở `useEffect` tải dữ liệu Dashboard; lấy `pendingRecords.length` gán vào `pendingRecordCount`. Đây chính là API thật đang cấp dữ liệu cho trang "Hồ sơ chờ xác nhận" — không tạo dữ liệu giả, không hard-code số.
- Trong mảng `statCards`, thay hẳn phần tử `{ label: 'Doanh thu tháng', value: formatPrice(stats.doanh_thu_thang), ... }` bằng `{ label: 'Hồ sơ chờ xác nhận', value: pendingRecordCount.toString(), iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600', icon: 'file-text', sub: pendingRecordCount > 0 ? 'cần bạn xác nhận' : 'không có hồ sơ chờ' }` — giữ đúng cấu trúc field (`label/value/iconBg/iconColor/icon/sub`) như 3 thẻ còn lại để không phá vỡ kiểu dữ liệu mảng khi `.map()`.
- Xoá import `formatPrice` (không còn nơi nào dùng trong file sau khi bỏ thẻ doanh thu) — `formatDate` vẫn giữ nguyên vì còn dùng cho danh sách đánh giá.
- Màu vàng (`bg-yellow-100`/`text-yellow-600`) khớp với màu đã dùng cho trạng thái "chờ" ở nơi khác (`KET_QUA_KHAM_STATUS_COLOR.cho_xac_nhan = yellow` vừa thêm ở bước 1), giữ nhất quán ngữ nghĩa màu.
- **Không** đổi `type DoctorStats` (vẫn còn field `doanh_thu_thang`, `ty_le_huy` — dữ liệu `ty_le_huy` vẫn hiển thị ở khối "Tỉ lệ hoạt động" phía dưới, không mất thông tin gì). Không đụng API/backend/mock — chỉ ngừng hiển thị 1 field có sẵn và hiển thị 1 field có sẵn khác thay vào.
- Không thêm hành vi click/điều hướng cho thẻ mới (cân nhắc rồi bỏ) để giữ đúng cấu trúc object giống 3 thẻ còn lại, tránh làm phức tạp kiểu dữ liệu mảng không cần thiết.

### Cách đã kiểm tra
- `npx tsc --noEmit`: không có lỗi nào ở `DoctorDashboard.tsx`.
- Đối chiếu: `pendingRecordCount` lấy từ đúng API thật (`/doctor/appointments/pending-results` qua `listPendingResults()`), cùng nguồn dữ liệu với trang "Hồ sơ chờ xác nhận" — số liệu giữa Dashboard và trang chi tiết sẽ luôn khớp nhau.
- Chưa chạy dev server / chưa xem trực quan trên trình duyệt.

### Rủi ro còn lại
- Card "Hồ sơ chờ xác nhận" hiện **không** điều hướng khi bấm (khác với "Xem tất cả" ở danh sách lịch hẹn gần nhất, vốn đã điều hướng) — nếu bạn muốn nhất quán "click để xem", cần bổ sung `onClick` cho card này (và cân nhắc có nên áp dụng cho toàn bộ 4 card hay chỉ riêng card này).
- Chưa xem bằng mắt trên trình duyệt thật.

---

## 11. Nhật ký thực hiện — Bước 2 kế hoạch: Max-width cho layout chính

### File đã sửa
- `frontend/src/layouts/DoctorLayout.tsx` (duy nhất)

### Diff logic
Bọc `<Outlet />` bằng 1 `div` giới hạn chiều rộng và tự căn giữa, nằm bên trong `<main>` (giữ nguyên `<main>` làm vùng cuộn + padding như cũ):
```
<main className="flex-1 overflow-y-auto p-4 lg:p-6">
  <div className="mx-auto w-full max-w-[1400px]">
    <Outlet />
  </div>
</main>
```
Không đổi `<DoctorSidebar>`, `<DoctorHeader>`, không đổi `bg-surface` ở layer ngoài cùng, không đổi cách `sidebarOpen` hoạt động. `max-w-[1400px]` chỉ ảnh hưởng màn hình rất rộng (> ~1400px cộng padding + sidebar 260px); ở laptop/tablet/mobile thông thường, `w-full` khiến nội dung vẫn chiếm hết chỗ như trước — không thay đổi hành vi trên các kích thước màn hình phổ biến.

### Cách đã kiểm tra
- `npx tsc --noEmit`: không có lỗi nào ở `DoctorLayout.tsx`.
- Về mặt logic: `mx-auto` + `max-w-[1400px]` + `w-full` là pattern chuẩn Tailwind cho "container căn giữa, giới hạn chiều rộng, co giãn bình thường dưới ngưỡng" — không có rủi ro phá layout ở màn hình hẹp vì `max-w` chỉ giới hạn chiều rộng tối đa, không đặt chiều rộng cố định.
- Chưa chạy dev server / chưa xem trực quan trên trình duyệt ở màn hình rộng thật để xác nhận cảm giác thị giác.

### Rủi ro còn lại
- Giá trị `1400px` là ước lượng hợp lý (chưa có thiết kế pixel chính xác từ bạn) — có thể cần tinh chỉnh sau khi xem trực quan trên màn hình rộng thật.
- Chưa xem bằng mắt trên trình duyệt thật.

---

## 12. Trạng thái tổng hợp

Đã hoàn tất: bước 1 (Button variant + màu trạng thái tập trung), mục 6.1 (sidebar soft), mục 6.2 (thẻ Dashboard), bước 2 kế hoạch (max-width). Còn lại theo kế hoạch gốc (mục 5): bước 3 (loading/error dùng `Loading`/`Empty` + nút thử lại ở 5 trang), bước 4 (gộp 6 modal viết tay vào `Modal.tsx`), bước 5 (thay `TH_PLAIN` + nút hành động lặp lại bằng class/component chuẩn — lúc này mới thực sự dùng tới các map màu đã tạo ở bước 1), bước 6 (gộp toast trong `DoctorAppointments` vào `Toast.tsx`), bước 7 (kiểm tra cuối responsive). Toàn bộ các bước trên **chưa thực hiện code nào ở các trang doctor** (`DoctorAppointments`, `DoctorSchedule`, `DoctorPendingRecords`, `DoctorLeaveRequests`, `DoctorProfile` — ngoại trừ `DoctorDashboard` đã sửa 1 chỗ ở mục 6.2).
