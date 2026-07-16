# Thiết kế tìm kiếm & lọc lịch hẹn bác sĩ — Báo cáo trước khi code

> Ngày: 2026-07-11. Phạm vi: chỉ trang "Lịch hẹn của tôi" (`/doctor/appointments`). Chưa sửa code — đây là báo cáo bắt buộc trước khi code theo yêu cầu mục XV.

---

## 1. Cơ chế lọc hiện tại nằm ở frontend hay backend

**Backend**, nhưng rất hạn chế. `doctorAppointmentService.getAll({status, date})` (`frontend/src/services/doctor-appointment.service.ts:10-16`) truyền thẳng `status`/`date` thành query string lên `GET /api/doctor/appointments`. Backend (`backend/src/controllers/doctor/appointments.controller.js`, hàm `list()`, dòng 58-79) nhận `status`/`date`, dựng `filter = { doctor_id: docId, ...status, ...ngay_kham range }`, query MongoDB, **sort cố định** `{ ngay_kham: 1, gio_kham: 1 }`, trả **toàn bộ mảng** (không phân trang). Frontend hiện không tự lọc gì thêm — nhận sao hiển thị vậy.

## 2. API hiện hỗ trợ những query nào

Đã đọc trực tiếp `list()` — chỉ 2 tham số:

| Tham số | Hỗ trợ | Ghi chú |
|---|---|---|
| `status` | ✅ | Khớp chính xác 1 giá trị enum `AppointmentStatus` |
| `date` | ✅ | Chỉ **1 ngày cụ thể** (`$gte` ngày đó, `$lt` ngày kế tiếp) — **không hỗ trợ khoảng ngày (from/to)** |
| Tìm kiếm (tên/mã/SĐT) | ❌ | Không có tham số nào, không có logic `$regex`/text search trong `list()` |
| Sắp xếp tuỳ chọn | ❌ | Sort cố định cứng trong code, không đọc từ query |
| Phân trang / `total` | ❌ | Không có `limit`/`skip`/`page`, response là mảng thô, không có field đếm tổng |

**Kết luận quan trọng**: vì `list()` không phân trang, khi gọi không kèm `status`/`date`, API trả **toàn bộ lịch hẹn của bác sĩ đó** (đã lọc `doctor_id` từ JWT — không phải toàn hệ thống). Đây là cơ sở để thiết kế kiến trúc lọc mới ở mục 8.

## 3. Logic phân loại Hôm nay / Sắp tới / Đã qua hiện có hay chưa

**Chưa có** ở trang Lịch hẹn. Trang hiện chỉ có `isExpiredPending()` (kiểm tra riêng lịch `pending` quá hạn), không có khái niệm "nhóm theo thời gian" nào khác. (`DoctorSchedule.tsx` có "6 ngày làm việc gần nhất" nhưng phục vụ mục đích khác — xem lịch làm việc, không phải lịch hẹn.)

## 4. Cách hệ thống đang xử lý múi giờ — **phát hiện 1 bug có thật**

Đã đối chiếu với `docs/Bác sĩ/Debug - Lich da thanh toan khong hien o trang bac si (2026-07-11).md` (điều tra bằng dữ liệu MongoDB thật, không suy đoán): `ngay_kham` được lưu dạng **UTC-midnight nhất quán** (vd `2026-07-12T00:00:00.000Z` đại diện cho ngày 12/07, không phải một thời điểm thực trong ngày). Dự án đã có sẵn hàm xử lý đúng quy ước này: `toLocalDateStr()` (`frontend/src/utils/format.ts:34-39`, comment gốc: *"Dùng thay cho `new Date().toISOString().slice(0,10)` để tránh lệch ngày từ 00:00–07:00 VN (+7)"*) — và `DoctorSchedule.tsx` đã dùng đúng hàm này.

**Bug phát hiện**: `DoctorAppointments.tsx` dòng 301 hiện tính `const todayStr = new Date().toISOString().slice(0, 10)` — **chính là cách làm mà `toLocalDateStr()` được tạo ra để tránh**. Trong khung giờ 00:00–06:59 giờ Việt Nam, `toISOString()` (UTC) trả về **ngày hôm trước**, khiến `todayStr` sai lệch 1 ngày → `isExpiredPending()` (dùng `todayStr` để so sánh) có thể phân loại sai lịch hẹn `pending` trong khung giờ đó. Đây là lỗi có thật, sẽ được sửa khi triển khai tab thời gian (dùng `toLocalDateStr()` thay thế, cùng tiện ích đã có sẵn, không tạo hàm mới).

## 5. File liên quan

| File | Vai trò |
|---|---|
| `frontend/src/pages/doctor/DoctorAppointments.tsx` | Page chính — nơi sẽ sửa |
| `frontend/src/services/doctor-appointment.service.ts` | `getAll({status, date})` — giữ nguyên chữ ký, có thể gọi với tham số rỗng |
| `frontend/src/types/index.ts` | `DoctorAppointmentDetail`, `AppointmentStatus` — chỉ đọc, không đổi |
| `frontend/src/utils/format.ts` | `toLocalDateStr()` — dùng lại, không sửa |
| `frontend/src/utils/constants.ts` | `APPOINTMENT_STATUS_LABEL`, `APPOINTMENT_STATUS_COLOR` — dùng lại (đã tập trung từ bước trước) |
| `backend/src/controllers/doctor/appointments.controller.js` | Chỉ đọc — xác nhận phạm vi API hiện tại, **không sửa** trong lần này |
| `backend/src/routes/doctor/appointments.routes.js` | Chỉ đọc |
| `backend/src/models/LichHen.js` | Chỉ đọc — xác nhận có `timestamps: { createdAt: 'ngay_tao' }` (mục 7) |

## 6. Bộ lọc có thể triển khai NGAY (không cần sửa backend)

Vì `list()` không phân trang, gọi API **một lần duy nhất** với `status`/`date` rỗng đã trả về toàn bộ dữ liệu hợp lệ (đúng phạm vi bác sĩ, do backend tự lọc `doctor_id` từ token — frontend không truyền và không thể ghi đè định danh bác sĩ). Từ đó, các mục sau làm được **hoàn toàn phía client**, không gọi thêm API khi đổi bộ lọc:

- **Tab thời gian** Hôm nay/Sắp tới/Đã qua/Tất cả — so sánh `ngay_kham` (qua `toLocalDateStr(new Date(...))`) với hôm nay (qua `toLocalDateStr()`).
- **Số lượng trên mỗi tab** — đếm trên mảng đã tải, dữ liệu thật, đúng phạm vi bác sĩ (không phải toàn hệ thống, không phải bác sĩ khác).
- **Tìm kiếm**: theo `benh_nhan`, `ma_lich_hen`, `so_dien_thoai` (cả 3 field đã có sẵn trong `DoctorAppointmentDetail`) — so khớp không phân biệt hoa/thường, `trim()` từ khoá.
- **Lọc trạng thái** — chuyển từ gửi API sang lọc client (đồng bộ kiến trúc "tải 1 lần").
- **Lọc 1 ngày cụ thể HOẶC khoảng ngày (from–to)** — backend chỉ hỗ trợ 1 ngày; khoảng ngày làm được ở client vì đã có toàn bộ dữ liệu.
- **Sắp xếp giờ khám tăng dần / giảm dần** — dữ liệu `ngay_kham`+`gio_kham` đã đủ.
- **Filter chip + xoá từng điều kiện + xoá tất cả** — thuần UI.
- **Result summary** (tổng số kết quả + mô tả phạm vi) — tính trên mảng đã lọc.
- **Bộ lọc nâng cao — CHỈ thêm "Dịch vụ khám"**: `ten_dich_vu` có sẵn trong dữ liệu, danh sách lựa chọn suy ra từ các giá trị duy nhất đang xuất hiện (không hard-code danh sách dịch vụ). Không thêm chuyên khoa/ca khám/phòng khám/trạng thái thanh toán/tình trạng hồ sơ khám vào bộ lọc nâng cao trong lần này — dữ liệu tồn tại nhưng chưa có yêu cầu cụ thể xác nhận đây là nhu cầu thật sự cấp thiết, tránh làm phình bộ lọc không cần thiết (đúng nguyên tắc mục IV "Không đưa tất cả bộ lọc lên hàng đầu... không thêm bộ lọc chỉ vì database có dữ liệu").
- **URL query (tối thiểu)**: dự án **đã có tiền lệ** dùng `useSearchParams` (react-router-dom) ở `pages/client/Profile.tsx`, `Booking.tsx`, và 2 trang admin — không phải công nghệ mới. Đề xuất đồng bộ tối thiểu: tab thời gian + trạng thái + từ khoá tìm kiếm vào URL (đủ để refresh không mất bộ lọc, copy URL được). **Không đồng bộ khoảng ngày/sắp xếp vào URL trong lần đầu** để giữ phạm vi gọn — có thể bổ sung sau nếu cần.

## 7. Bộ lọc CẦN backend bổ sung (không tự sửa, chỉ báo cáo)

| Tính năng | Vì sao thiếu | Đề xuất |
|---|---|---|
| Sắp xếp "Mới đặt gần đây / Cũ nhất" | `DoctorAppointmentDetail` **không có** field thời điểm đặt lịch. Đã kiểm tra `formatAppointment()` (`appointments.controller.js:17-56`) — không select/trả field này. **Nhưng dữ liệu tồn tại**: `LichHen.js` có `timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' }` (dòng 89) — Mongoose tự lưu `ngay_tao` cho mọi lịch hẹn, chỉ là API hiện không trả field này. | Backend: thêm `ngay_tao: a.ngay_tao` vào object trả về của `formatAppointment()`; frontend: thêm field vào `DoctorAppointmentDetail`. Thay đổi nhỏ, rủi ro thấp — **cần bạn duyệt trước khi backend team thực hiện**, không tự làm vì đây là sửa backend. |
| Tab "Cần xử lý" | Có thể suy ra từ dữ liệu hiện có (`pending`+home chưa hết hạn, `confirmed` hôm nay chưa hoàn thành, hồ sơ `ket_qua_status='cho_xac_nhan'`) — **về lý thuyết làm được ngay không cần backend**, nhưng tiêu chí chính xác "thế nào là cần xử lý" chưa được bạn xác nhận rõ ràng bằng nghiệp vụ. Theo đúng yêu cầu *"Không tạo tab 'Cần xử lý' bằng dữ liệu giả hoặc tự suy đoán"*, **tạm không thêm tab này** trong lần triển khai đầu, chờ bạn xác nhận tiêu chí cụ thể. |
| Phân trang thật (`total` từ server) | API hiện trả toàn bộ mảng, không `limit`/`skip`/`total`. | Vì kiến trúc mới tải hết 1 lần, phân trang có thể làm **hoàn toàn client-side** (cắt mảng đã lọc) — không cần backend trong lần này. Ghi nhận rủi ro dài hạn ở mục 12 nếu số lịch hẹn/bác sĩ tăng rất lớn. |

## 8. Cấu trúc state lọc đề xuất

Toàn bộ derive bằng `useMemo` từ 1 mảng gốc `all` (tải 1 lần lúc mount, **không** refetch khi đổi filter):

```ts
type TimeTab = 'today' | 'upcoming' | 'past' | 'all'

const [all, setAll] = useState<DoctorAppointmentDetail[]>([])       // tải 1 lần
const [timeTab, setTimeTab] = useState<TimeTab>('today')            // mặc định "Hôm nay"
const [searchTerm, setSearchTerm] = useState('')                    // lọc local, không cần debounce mạng
const [statusFilter, setStatusFilter] = useState<'' | AppointmentStatus>('')
const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null) // khác null → đang dùng khoảng ngày tuỳ chỉnh, tự chuyển timeTab sang 'all'
const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')   // mặc định theo từng tab (mục III.4)
const [serviceFilter, setServiceFilter] = useState('')              // bộ lọc nâng cao, giá trị suy ra từ dữ liệu
```

`getAll({})` **chỉ gọi 1 lần lúc mount** (không phụ thuộc filter nữa) — loại bỏ hoàn toàn nguồn race-condition giữa các lần đổi filter (không còn request nào để đua nhau). Đây là thay đổi kiến trúc so với hiện tại (hiện đang gọi lại API mỗi khi đổi `filterDate`/`filterStatus`) — cần bạn xác nhận vì đây là điểm mấu chốt của toàn bộ thiết kế.

## 9. URL query — đề xuất tối thiểu

Đồng bộ 3 giá trị: `tab` (`today|upcoming|past|all`), `status`, `q` (từ khoá tìm kiếm) — dùng `useSearchParams` theo đúng pattern đã có trong dự án. Không đồng bộ khoảng ngày/sắp xếp/dịch vụ (giữ URL gọn, tránh phức tạp không cần thiết). Vì trang này xem chi tiết bằng **expand-row tại chỗ** (không điều hướng sang route khác), lý do "quay lại từ trang chi tiết vẫn giữ danh sách" không thật sự cấp thiết ở đây — vẫn thêm URL query vì lợi ích "refresh không mất filter" + "copy URL" độc lập với lý do đó.

## 10. Wireframe filter bar mới (văn bản)

```
[Page header] "Lịch hẹn của tôi" — mô tả

[Tab thời gian — segmented control, soft active]
 Hôm nay (5) | Sắp tới (12) | Đã qua (34) | Tất cả (51)

[Filter card]
 [🔍 Tìm bệnh nhân, mã lịch hẹn, SĐT...    ✕]   [Trạng thái ▾]   [📅 Khoảng ngày ▾]   [Sắp xếp ▾]   [Bộ lọc nâng cao (1) ▾]

[Filter chips — chỉ hiện khi có điều kiện khác mặc định]
 [Trạng thái: Đã xác nhận ✕] [Dịch vụ: Khám tổng quát ✕]                              [Xóa tất cả]

[Result summary]
 "5 lịch hẹn hôm nay"  /  "8 kết quả trong khoảng 10/07–17/07/2026"

[Bảng (desktop/tablet) — đã có từ đợt trước] / [Card list (mobile) — đã có từ đợt trước]
```

Khi chọn khoảng ngày tuỳ chỉnh: tab thời gian tự chuyển sang "Tất cả" (không giữ "Hôm nay" active sai lệch — theo đúng quy tắc mục VI), chip "Khoảng ngày: 10/07–17/07/2026" xuất hiện thay cho việc tab nào đó vẫn sáng.

## 11. Test case dự kiến (đối chiếu 24 case yêu cầu)

Áp dụng được ngay (client-side, không cần backend): #1-5, #7-18, #20-23 — tổng 21/24.
Không áp dụng được trong lần này: #6 ("Tìm theo mã lịch hẹn nếu API hỗ trợ" — API không cung cấp search riêng nhưng field `ma_lich_hen` có trong dữ liệu đã tải nên **vẫn tìm được**, thực ra đạt được). #19 (API lỗi) và #24 (không thấy lịch bác sĩ khác) đã được đảm bảo sẵn ở tầng backend/loading-error hiện có, sẽ giữ nguyên khi refactor.

## 12. Rủi ro ảnh hưởng API/hiệu năng

- **Đổi hành vi gọi API**: từ "gọi lại mỗi khi đổi filter" sang "gọi 1 lần duy nhất lúc vào trang". Ưu điểm: không còn race-condition, không loading nhấp nháy khi đổi filter, đúng yêu cầu "không tải lại toàn bộ trang khi thay đổi bộ lọc". Nhược điểm: nếu dữ liệu thay đổi ở phía khác (vd y tá vừa nhập hồ sơ) trong lúc bác sĩ đang xem, danh sách không tự cập nhật cho tới khi vào lại trang — chấp nhận được vì các hành động (xác nhận/hoàn thành...) đã tự cập nhật local state ngay khi bác sĩ thao tác (`updateAppt`), không phụ thuộc việc polling.
- **Hiệu năng dài hạn**: tải toàn bộ lịch hẹn của 1 bác sĩ trong 1 lần chấp nhận được ở quy mô hiện tại (demo/dữ liệu thật còn nhỏ). Nếu về sau 1 bác sĩ tích lũy hàng nghìn lịch hẹn, cần bổ sung phân trang thật từ backend (mục 7) — ghi nhận là nợ kỹ thuật, không phải vấn đề cần xử lý ngay.
- **Không ảnh hưởng phạm vi dữ liệu bác sĩ**: toàn bộ lọc mới đều thao tác trên mảng đã được backend giới hạn theo `doctor_id` từ JWT — không có cách nào ở tầng lọc client khiến dữ liệu bác sĩ khác lọt vào.
- **Bug múi giờ đã phát hiện (mục 4)** sẽ được sửa như một phần của việc thêm tab thời gian — không phải thay đổi ngoài phạm vi vì cùng nằm trong logic phân loại theo ngày.

---

## 13. Trạng thái thực hiện

Báo cáo hoàn tất — **chưa sửa code**. Chờ xác nhận trước khi triển khai, đặc biệt xác nhận điểm mấu chốt ở mục 8 (chuyển từ "lọc qua API" sang "tải 1 lần, lọc client") và phạm vi bộ lọc nâng cao (chỉ "Dịch vụ khám") ở mục 6.
