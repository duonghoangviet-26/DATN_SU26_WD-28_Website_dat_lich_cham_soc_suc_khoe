# Phân tích chức năng "Lịch làm việc của bác sĩ" — Báo cáo hiện trạng (Prompt 1)

> Ngày phân tích: **2026-07-13**
> Phạm vi: chức năng **Lịch làm việc bác sĩ** (`/doctor/schedule`) + phần **Xin nghỉ** liên quan.
> Trạng thái: **CHỈ PHÂN TÍCH — KHÔNG sửa source code, KHÔNG đổi MongoDB, KHÔNG chạy seed/migration.**
> Tài liệu liên quan (đã có sẵn, đọc để đối chiếu): `docs/Bác sĩ/*`, `docs/DB_GAP_ANALYSIS.md`,
> `docs/Phan tich - Luong Lich hen - Checkin - Hang doi - Kham ... (2026-07-11).md`.

---

## ⚠️ Xác nhận không sửa source code

Trong Prompt 1 KHÔNG có thay đổi nào với: frontend, backend, controller, service, route, middleware,
model, schema, type, component, hook, mock, seed, script, cấu hình môi trường, MongoDB Cloud.
Chỉ tạo 3 file tài liệu trong `docs/`. Không chạy seed, không chạy migration.

---

## A. Tổng quan chức năng hiện tại

### A.1 Luồng hiện tại (đăng nhập → hiển thị lịch)

```
Đăng nhập (auth.service → JWT lưu localStorage 'token')
→ axiosInstance interceptor tự gắn Authorization: Bearer <token>
→ [BE] verifyToken giải mã JWT → req.user = { id, role }
→ [BE] requireRole('doctor')  (mount ở routes/doctor/index.js cho TOÀN BỘ /api/doctor/*)
→ [BE] controller: BacSi.findOne({ user_id: req.user.id })  ← xác định bác sĩ TỪ TOKEN, không nhận từ FE
→ [BE] LichLamViec.find({ doctor_id, ngay: {$gte from, $lte to} }).populate('slots.benh_nhan_id','ho_ten')
→ [BE] flattenSchedules(): trải mỗi schedule.slots[] thành mảng slot phẳng
→ [FE] scheduleService.getAll({from,to}) trả DoctorSlot[]
→ [FE] DoctorSchedule.tsx: tính 6 ngày làm việc, nhóm theo ngày, render accordion + badge trạng thái.
```

Có **2 luồng con** ở trang này:
- **Xem lịch** → `GET /api/doctor/schedule?from=&to=` (schedule.controller.getSchedules).
- **Gửi yêu cầu nghỉ / yêu cầu hủy ca** → 2 cơ chế KHÁC NHAU (xem mục A.4).

### A.2 Chức năng đang CÓ

- Bác sĩ xem lịch làm việc của **chính mình** (xác định qua token — an toàn).
- Hiển thị theo **6 ngày làm việc gần nhất** (bỏ Chủ nhật, bỏ ngày đã qua) — tính ở FE.
- Mỗi ngày: danh sách slot (khung giờ 30 phút), giờ bắt đầu/kết thúc, phòng khám (nếu có),
  trạng thái slot (Còn trống / Đã đặt / Tạm nghỉ / Đã hủy / Hết hạn / Đang giữ chỗ), tên bệnh nhân.
- Tổng hợp đầu ngày: đếm `x trống · y đặt · z nghỉ` + thanh chấm màu (DotBar).
- **Gửi yêu cầu nghỉ** cho slot `active` → tạo `NghiPhepBacSi` (chờ Admin duyệt).
- **Yêu cầu hủy** cho slot `booked` (đã có bệnh nhân) → gắn cờ `slot.cancel_requested` (chờ Admin xử lý).
- Trang **Xin nghỉ** riêng (`DoctorLeaveRequests.tsx`): tạo yêu cầu nghỉ (cả ngày / khung giờ),
  danh sách + lọc theo trạng thái/ngày/từ khóa, **hủy** yêu cầu khi còn `cho_duyet`.

### A.3 Chức năng còn THIẾU (so với đặc tả nghiệp vụ ở đầu bài)

| Nghiệp vụ mong đợi | Hiện trạng |
|---|---|
| Xem theo **tuần**, chuyển **tuần trước / tuần sau** | ❌ Chỉ có "6 ngày tới" cố định, không lùi về quá khứ, không có nút "Hôm nay" |
| Xem **lịch sử ca đã làm** (chỉ đọc) | ❌ FE lọc bỏ ngày < hôm nay → không xem được ca cũ |
| **Y tá hỗ trợ** trong ca | ⚠️ DB đã có `nurse_id` nhưng API không trả; FE **hardcode** "Chưa phân công y tá" |
| **Số lịch hẹn trong ca / danh sách bệnh nhân của ca** (chi tiết ca) | ❌ Không có modal chi tiết ca; slot chỉ hiện 1 tên bệnh nhân |
| **Mở chi tiết lịch hẹn** từ ca | ❌ Không có liên kết sang `DoctorAppointmentDetail` |
| **Sức chứa / số chỗ còn lại / "ca đã đầy"** | ⚠️ Không có field sức chứa; suy ra từ slot (mỗi slot = 1 chỗ) |
| Trạng thái **"đang diễn ra"** theo thời gian | ❌ Không tính; chỉ có trạng thái slot tĩnh |
| **Số lịch hẹn bị ảnh hưởng** khi xin nghỉ | ❌ Không đếm khi tạo `NghiPhepBacSi` |
| Xem **ghi chú xử lý của Admin** cho yêu cầu nghỉ | ⚠️ DB có `NghiPhepBacSi.ghi_chu` nhưng `formatLeave()` **không trả** field này |
| Phân biệt nghỉ **thường / khẩn cấp** | ❌ DB chưa có field loại nghỉ |

### A.4 Hai cơ chế "nghỉ / hủy" — cần phân biệt rõ

| | Gửi yêu cầu nghỉ (slot `active`) | Yêu cầu hủy ca (slot `booked`) |
|---|---|---|
| Nút FE | "Gửi yêu cầu nghỉ" (vàng) | "Yêu cầu hủy" (đỏ) |
| Service FE | `doctorLeaveService.create()` | `scheduleService.requestCancelSlot()` |
| API | `POST /api/doctor/leaves` | `POST /api/doctor/schedule/:scheduleId/slots/:slotId/request-cancel` |
| Ghi vào | `NghiPhepBacSi` (bản ghi nghỉ theo **ngày/khung giờ**) | `LichLamViec.slots[].cancel_requested = true` |
| Liên kết ca cụ thể | **KHÔNG** — chỉ theo ngày + (tùy chọn) khung giờ | Có — đúng slot đó |
| Đếm lịch hẹn ảnh hưởng | Không | Không (Admin tự xử lý) |
| Nhật ký thao tác | Không | Có (`NhatKyThaoTac`, hành động `CANCEL_SLOT`) |

> **Điểm cần lưu ý nghiệp vụ:** hai cơ chế này rời rạc. "Gửi yêu cầu nghỉ" cho 1 ca `active`
> thực chất tạo một đơn nghỉ theo ngày/khung giờ, **không** đánh dấu gì lên chính slot đó
> (nút chỉ ẩn nhờ state `leaveRequestedSlotIds` trong phiên — reload trang là mất). Xem mục F/G.

### A.5 Quyền hiện tại (đối chiếu "được / không được")

- ✅ **Được**: xem lịch của mình, xem theo ngày, lọc trạng thái (ở trang Xin nghỉ), xem phòng,
  gửi yêu cầu nghỉ, xem trạng thái yêu cầu, rút yêu cầu khi `cho_duyet`.
- ✅ **Không có đường nào để làm việc bị cấm**: không có endpoint tạo/sửa/xóa ca, đổi phòng,
  gán/đổi y tá, đổi sức chứa, tự đóng/mở ca, tự duyệt nghỉ, hủy lịch hẹn, đổi bác sĩ,
  hoàn tiền, sửa trạng thái thanh toán → **khớp** yêu cầu "bác sĩ không được phép".
- ⚠️ **Chưa có (đang thiếu, không phải vi phạm)**: xem tuần trước/sau, xem lịch quá khứ,
  xem ghi chú xử lý của Admin.

### A.6 Phạm vi thực tế

Chức năng đang chạy trên **API + MongoDB thật** (không phải mock) cho cả xem lịch, xin nghỉ,
yêu cầu hủy. Mô hình dữ liệu tốt và đủ để mở rộng; phần thiếu chủ yếu là **API chưa trả đủ field
đã có trong DB** và **FE chưa có màn tuần/chi tiết ca**.

---

## B. Cấu trúc code

### B.1 Frontend (trực tiếp thuộc chức năng — sẽ có thể sửa ở prompt sau)

| File | Vai trò |
|---|---|
| `frontend/src/pages/doctor/DoctorSchedule.tsx` | Trang Lịch làm việc (accordion 6 ngày, dialog nghỉ/hủy) |
| `frontend/src/pages/doctor/DoctorLeaveRequests.tsx` | Trang Xin nghỉ (tạo/lọc/hủy yêu cầu) |
| `frontend/src/services/schedule.service.ts` | `getAll({from,to})`, `requestCancelSlot()` |
| `frontend/src/services/doctor-leave.service.ts` | `list()`, `create()`, `cancel()` |
| `frontend/src/types/index.ts` | `DoctorSlot`, `DoctorLeaveRequest` (+ `AdminDoctorSchedule*`) |
| `frontend/src/utils/constants.ts` | `SCHEDULE_SLOT_STATUS_COLOR`, `DOCTOR_LEAVE_STATUS_COLOR` |
| `frontend/src/utils/format.ts` | `toLocalDateStr`, `formatDate` |
| `frontend/src/components/doctor/DoctorSidebar.tsx`, `routes/doctorMenu.ts` | Điều hướng trang bác sĩ |

### B.2 Frontend (dùng chung — chỉ đọc để hiểu)

`services/axiosInstance.ts` (gắn token, xử lý 401), `context/AuthContext.tsx`,
`routes/ProtectedRoute.tsx`, `components/common/*` (Badge, Toast, PageHeader, ConfirmDialog…).

### B.3 Frontend (ngoài phạm vi — KHÔNG đụng)

`services/doctor.service.ts` (quản lý bác sĩ phía **admin/client**, còn nhiều mock),
`pages/admin/ManageDoctorSchedules.tsx` (lịch bác sĩ phía **admin**),
`mock/doctor-schedule.ts` (mock demo — xem mục E), toàn bộ `pages/nurse/*`, `pages/admin/*` khác.

### B.4 Backend (trực tiếp thuộc chức năng)

| File | Vai trò |
|---|---|
| `backend/src/controllers/doctor/schedule.controller.js` | `getSchedules`, `requestCancelSlot` |
| `backend/src/controllers/doctor/leaves.controller.js` | `listMyLeaveRequests`, `createLeaveRequest`, `cancelLeaveRequest` |
| `backend/src/routes/doctor/schedule.routes.js`, `leaves.routes.js`, `index.js` | Định tuyến + gắn middleware |
| `backend/src/models/LichLamViec.js` | Model lịch làm việc (document = 1 bác sĩ × 1 ngày, chứa `slots[]`) |
| `backend/src/models/NghiPhepBacSi.js` | Model yêu cầu nghỉ |
| `backend/src/models/LichHen.js` | Model lịch hẹn (ref `schedule_id` + `slot_id`) |
| `backend/src/models/BacSi.js` | Hồ sơ bác sĩ (nối `user_id` → tài khoản) |

### B.5 Backend (dùng chung / liên quan gián tiếp — chỉ đọc)

`middlewares/auth.middleware.js` (verifyToken, requireRole), `utils/response.js` (ok/created/fail),
`models/NguoiDung.js`, `models/index.js`, `models/NhatKyThaoTac.js`,
`controllers/doctor/stats.controller.js` (`getTodayOverview` — đếm hàng đợi từ `LichHen`),
`controllers/doctor/appointments.controller.js` (danh sách/chi tiết lịch hẹn),
`services/scheduleGenerator.service.js` (**hệ thống/admin** tự sinh slot — bác sĩ không đụng),
`config/db.js` (kết nối MongoDB Cloud, DB `DATN_VITAFAMILY`).

---

## C. Dữ liệu thật (MongoDB Cloud)

> **Giới hạn quan trọng (xem mục "Giới hạn"):** trong lần phân tích này KHÔNG kết nối trực tiếp
> MongoDB Cloud (tránh phơi bày chuỗi kết nối/secret trong `.env`, và Prompt 1 cấm tạo script
> ghi mới). Số liệu thật dưới đây trích từ **báo cáo đọc-chỉ-đọc đã có sẵn**
> `docs/Bác sĩ/Audit - Doi chieu du lieu that MongoDB - Bac si Khang (2026-07-11).md`
> (chạy bằng script read-only `backend/src/scripts/inspect-khang-doctor-data.js`), phản ánh dữ
> liệu **tại 2026-07-11** — cần xác nhận lại nếu dữ liệu đã đổi.

### C.1 Collection liên quan (tên thật)

`lich_lam_viec` (LichLamViec), `lich_hen` (LichHen), `nghi_phep_bac_si` (NghiPhepBacSi),
`bac_si` (BacSi), `nguoi_dung` (NguoiDung), `khach_vang_lai` (KhachVangLai),
`ket_qua_kham` (KetQuaKham), `nhat_ky_thao_tac` (NhatKyThaoTac).

### C.2 Cấu trúc & quan hệ (theo model + dữ liệu thật)

- **Tài khoản → bác sĩ**: `NguoiDung._id` → `BacSi.user_id` (unique). Bác sĩ được xác định bằng
  `BacSi.findOne({ user_id: req.user.id })`.
- **Lịch làm việc → bác sĩ**: `LichLamViec.doctor_id` → `BacSi._id`. Unique index `{doctor_id, ngay}`
  → **1 bác sĩ có tối đa 1 document/ngày**, mỗi document chứa nhiều `slots[]`.
- **Lịch hẹn → ca**: `LichHen.schedule_id` → `LichLamViec._id`, `LichHen.slot_id` → `slots[]._id`
  (bắt buộc với cả `clinic` lẫn `home` theo `pre('validate')`).
- **Phòng**: `slots[].phong_kham` (String snapshot) — cấp **slot**, không phải ObjectId ref.
- **Y tá**: `LichLamViec.nurse_id` (cấp **ngày**) + `LichHen.nurse_id` (snapshot lúc đặt) — ref
  `NguoiDung`. **Đã tồn tại và đã có dữ liệu** cho bác sĩ Khang TEST (8/8 lịch, 10/10 lịch hẹn).
- **Khách offline**: `LichHen.khach_vang_lai_id` → `KhachVangLai`, `ten_khach`, `loai_benh_nhan`,
  `hinh_thuc_dat_lich` — hỗ trợ ở tầng dữ liệu.

### C.3 Số liệu thật (bác sĩ Khang TEST, 2026-07-11)

- 8 `LichLamViec` (07-08…07-16/2026); ngày 07-15 kín cả 16 slot ("ngày test hết chỗ").
- 10 `LichHen`: `pending` 1, `confirmed` 1, `completed` 4, `checked_in` 1, `in_progress` 1,
  `cancelled` 1, `no_show` 1. Thanh toán: `paid` 8, `unpaid` 1, `refunded` 1.
- Bệnh nhân: 1 có tài khoản (Nguyễn Thị Hạnh TEST) + 8 khách vãng lai (`ten_khach`).
- Y tá: đã gắn "Điều dưỡng Thanh Hà" vào 8/8 lịch + 10/10 lịch hẹn (sau bước sửa 2026-07-11).

### C.4 Dữ liệu thiếu / không nhất quán (từ audit sẵn có)

- **`payment_status` không có chứng từ**: 8 lịch `paid` nhưng **0 `HoaDon`, 0 `ThanhToan`** cho bộ
  dữ liệu test này → `payment_status` là snapshot độc lập, không có hóa đơn/giao dịch đứng sau.
- **Khách vãng lai không có bệnh nền/dị ứng** (không có `ThanhVien`) — giới hạn cấu trúc.
- Không có lịch hẹn `waiting_doctor_confirm` trong bộ test (dù enum đã có).

### C.5 Rủi ro dữ liệu ảnh hưởng chức năng

- **Múi giờ**: `LichLamViec.ngay` là `Date`. BE trả bằng `ngay.toISOString().slice(0,10)` (UTC),
  FE so khớp bằng `toLocalDateStr` (giờ **local**). Nếu `ngay` được lưu là nửa đêm **local** ở
  vùng +7 thì `toISOString()` sẽ lùi 1 ngày → **lệch ngày**. Cần kiểm tra cách sinh `ngay` ở
  `scheduleGenerator.service.js` để xác nhận (xem mục F — Múi giờ).

---

## D. Bảng ánh xạ dữ liệu (MongoDB → Backend → API → Frontend)

| Dữ liệu nghiệp vụ | Collection/field thật | Backend lấy? | API trả? | FE dùng? | Tình trạng |
|---|---|---|---|---|---|
| Ngày làm việc | `lich_lam_viec.ngay` | ✅ | ✅ `ngay` (UTC slice) | ✅ | Đủ (rủi ro múi giờ) |
| Giờ bắt đầu/kết thúc slot | `slots[].gio_bat_dau/ket_thuc` | ✅ | ✅ | ✅ | Đủ |
| Tên ca | (không có field) | — | — | — | DB chưa hỗ trợ (đặt tên theo giờ) |
| Bác sĩ | `doctor_id` (từ token) | ✅ | ẩn (không cần) | — | Đủ |
| Phòng | `slots[].phong_kham` | ✅ | ✅ `phong_kham` | ✅ | Đủ |
| Y tá hỗ trợ | `lich_lam_viec.nurse_id` | ❌ | ❌ | hardcode "Chưa phân công" | **DB có, BE chưa lấy; FE hardcode** |
| Trạng thái ca (slot) | `slots[].status` | ✅ | ✅ `status` | ✅ | Đủ |
| Trạng thái "đang diễn ra" (theo giờ) | (tính) | ❌ | ❌ | ❌ | **Có thể tính** từ ngày+giờ |
| Số lịch hẹn trong ca | đếm `lich_hen` theo `schedule_id` | ❌ | ❌ | ❌ | **Có thể tính** (chưa làm) |
| Số BN đã đến/đang chờ/đang khám/hoàn thành | `lich_hen.status`, `trang_thai_den` | ✅ (ở `stats/today`) | ✅ (Dashboard, KHÔNG ở schedule) | Dashboard | **Thuộc lịch hẹn/hàng đợi, không thuộc màn lịch** |
| Sức chứa | (không có field) | — | — | — | **DB chưa hỗ trợ** (ngầm định 1 BN/slot) |
| Số chỗ còn lại / ca đã đầy | đếm slot `active` | ❌ (BE) / ✅ (FE đếm) | phần | FE DaySummary | **Có thể tính** từ slot |
| Danh sách bệnh nhân trong ca | `slots[].benh_nhan_id` (ho_ten) | ✅ (populate) | ✅ 1 tên/slot | ✅ | Đủ ở mức 1 BN/slot; **guest không có tên** |
| Yêu cầu nghỉ | `nghi_phep_bac_si` | ✅ | ✅ | ✅ | Đủ |
| Trạng thái yêu cầu nghỉ | `nghi_phep_bac_si.trang_thai` | ✅ | ✅ | ✅ | Đủ (`da_huy` đã có) |
| Lý do nghỉ | `nghi_phep_bac_si.ly_do` | ✅ | ✅ | ✅ | Đủ |
| Ghi chú xử lý của Admin | `nghi_phep_bac_si.ghi_chu` | ✅ (có ở DB) | ❌ `formatLeave` bỏ | ❌ | **DB/BE có, API chưa trả** |
| Số lịch hẹn bị ảnh hưởng khi nghỉ | tính từ `lich_hen` | ❌ | ❌ | ❌ | **Có thể tính** (chưa làm) |
| Dịch vụ của từng lịch hẹn | `lich_hen.ten_dich_vu/service_id` | (ở màn lịch hẹn) | — | — | Ngoài phạm vi màn lịch |
| Nguồn đặt online/offline | `lich_hen.hinh_thuc_dat_lich`, `khach_vang_lai_id` | (ở màn lịch hẹn) | — | — | Ngoài phạm vi màn lịch |
| Trạng thái thanh toán (chỉ xem) | `lich_hen.payment_status` | (ở màn lịch hẹn) | — | — | Ngoài phạm vi màn lịch |
| Tiến độ khám / check-in | `lich_hen.status`, `gio_den_thuc_te` | (ở nurse/appointments) | — | — | **Thuộc hàng đợi, không thuộc lịch** |
| `lock_expires_at` (giữ chỗ) | `slots[].lock_expires_at` | ❌ (flatten bỏ) | ❌ | type có field | **API chưa trả** dù type FE khai báo |
| `cancel_requested` | `slots[].cancel_requested` | ✅ | ✅ | ✅ | Đủ |

---

## E. Mock và hardcode

| Vị trí | Mock/hardcode | Đang dùng ở đâu | Ảnh hưởng | Xử lý đề xuất (prompt sau) |
|---|---|---|---|---|
| `pages/doctor/DoctorSchedule.tsx:275` | Chuỗi cố định **"Chưa phân công y tá"** | Màn lịch, mọi slot | Che mất `nurse_id` thật đã có trong DB | Sau khi API trả `nurse_id` → hiển thị tên y tá thật, fallback text khi null |
| `mock/doctor-schedule.ts` | `mockSlots` (96 slot giả, tên BN/phòng cố định) | **KHÔNG** được `DoctorSchedule.tsx` import (đã dùng API thật) | Dead code, gây nhiễu | Xóa ở Phase "Loại bỏ mock" sau khi xác nhận không còn nơi dùng |
| `types/index.ts` `DoctorSlot.lock_expires_at` | Field type có nhưng API không trả | Type FE | FE không crash (optional) nhưng dữ liệu luôn undefined | Hoặc BE trả field, hoặc bỏ khỏi type |
| `services/doctor.service.ts` | Nhiều hàm mock (`updateServiceFields`, `getBySpecialtySlug`, `getAllMock`…) | Trang **admin/client** quản lý bác sĩ | Ngoài phạm vi màn lịch bác sĩ | Không đụng trong phạm vi này |
| `DoctorSchedule.tsx` state `leaveRequestedSlotIds` | "Đã gửi yêu cầu nghỉ" chỉ giữ trong RAM phiên | Ẩn nút sau khi gửi | Reload trang là mất → có thể gửi trùng | Cần trạng thái thật (xem Gap DB) |

> **Kết luận mock:** màn Lịch làm việc bác sĩ **không phụ thuộc mock** để chạy — chạy trên API
> thật. Chỉ còn 1 hardcode nghiệp vụ ("Chưa phân công y tá") và 1 file mock dead-code.

---

## F. Lỗi / khoảng trống phát hiện (phân loại)

- **Nghiệp vụ**
  - Không có màn **tuần / chuyển tuần / xem quá khứ** — trái kỳ vọng "trang bác sĩ mặc định theo tuần".
  - "Gửi yêu cầu nghỉ" 1 ca `active` **không gắn với slot cụ thể**, không đếm lịch hẹn ảnh hưởng.
  - Không phân biệt nghỉ có kế hoạch / khẩn cấp.
- **Database**
  - Không có field **sức chứa**; không có **loại nghỉ**; không có cờ **slot đã có yêu cầu nghỉ**.
  - `nurse_id` đã có nhưng **chưa được API bác sĩ trả** (xem gap file).
- **Backend/API**
  - `flattenSchedules` **không trả** `nurse_id`, `trang_thai_ngay`, `chi_nhanh_id`, `lock_expires_at`,
    số lịch hẹn/ca, đếm bệnh nhân theo trạng thái.
  - `formatLeave` **không trả** `ghi_chu`, `den_ngay` cho hiển thị đầy đủ, `nguoi_duyet`.
  - `createLeaveRequest` **không kiểm tra trùng** yêu cầu nghỉ cùng ngày, không đếm ảnh hưởng.
- **Frontend**
  - Hardcode "Chưa phân công y tá".
  - `leaveRequestedSlotIds` chỉ giữ trong phiên (có thể gửi trùng sau reload).
  - `types/index.ts` có **lỗi cú pháp/duplicate** ở `AppointmentStatus` và vài interface (dòng ~14-18,
    ~239-243, ~275-276…) — **ngoài phạm vi màn lịch**, chỉ ghi nhận, **không sửa** ở Prompt 1
    (cần xác nhận vì sao dự án vẫn build được).
- **Phân quyền**: không phát hiện lỗ hổng (xem mục G).
- **UI/UX**: thiếu chi tiết ca, thiếu điều hướng tuần, "Y tá" luôn hiển thị "Chưa phân công".
- **Đồng bộ trạng thái**: nút "Gửi yêu cầu nghỉ" và trạng thái đơn nghỉ ở trang Xin nghỉ không
  đồng bộ với slot ở màn Lịch (2 nguồn dữ liệu khác nhau).
- **Múi giờ**: rủi ro lệch ngày UTC vs local (mục C.5) — **chưa xác nhận** hướng lệch.
- **Dữ liệu mock**: chỉ còn dead-code `mock/doctor-schedule.ts`.

---

## G. Phân quyền & bảo mật (đọc code)

| Tình huống tấn công | BE kiểm tra ở đâu | Đủ? | Rủi ro |
|---|---|---|---|
| Bác sĩ đổi `scheduleId`/`slotId` trên URL để hủy ca người khác | `LichLamViec.findOne({_id, doctor_id: bacSi._id})` | ✅ | Không truy cập được ca người khác |
| Bác sĩ gọi API xem lịch người khác | `doctor_id` lấy từ token, không nhận từ FE | ✅ | Không |
| Bác sĩ rút yêu cầu nghỉ người khác | `NghiPhepBacSi.findOne({_id, bac_si_id: docId})` | ✅ | Không |
| Bác sĩ tự duyệt yêu cầu nghỉ | Không có endpoint duyệt ở `/doctor/*` | ✅ | Không |
| Bác sĩ sửa phòng/y tá/giờ/sức chứa | Không tồn tại endpoint | ✅ | Không |
| Bác sĩ sửa trạng thái thanh toán / hủy lịch hẹn | Không tồn tại endpoint | ✅ | Không |
| Không đăng nhập gọi API | `verifyToken` (mount toàn bộ `/api/doctor`) | ✅ | 401 |
| Tài khoản không phải bác sĩ gọi API bác sĩ | `requireRole('doctor')` | ✅ | 403 |
| Client tự truyền `doctor_id`/`role` | grep xác nhận **không** controller nào đọc từ body/query/params | ✅ | Không |

**Điểm cần lưu ý (không phải lỗ hổng):**
- `createLeaveRequest` không kiểm tra trùng đơn nghỉ → bác sĩ có thể spam nhiều đơn cùng ngày.
- `requestCancelSlot` không chặn slot của ngày **đã qua** (chỉ chặn theo trạng thái `booked`).

---

## H. Kết luận

- **Chức năng ở mức**: khung xem lịch + xin nghỉ **đã chạy thật trên API/MongoDB**, phân quyền chắc.
  Còn thiếu **màn tuần/lịch sử**, **chi tiết ca**, **hiển thị y tá**, và một số field API chưa trả.
- **Đang dùng dữ liệu thật?** — **Có** (không phụ thuộc mock để chạy). Chỉ còn 1 hardcode + 1 mock dead-code.
- **Có thể bắt đầu sửa code chưa?** — **Có**, nhưng nên theo thứ tự: (1) mở rộng response API
  (`nurse_id`, `ghi_chu`, đếm lịch hẹn), (2) làm màn tuần + chi tiết ca ở FE, (3) đồng bộ trạng thái
  yêu cầu nghỉ, (4) dọn mock. Các thay đổi model (sức chứa, loại nghỉ, cờ yêu-cầu-nghỉ-trên-slot) là
  **additive** — xem `doctor-schedule-database-gap-analysis.md`.
- **Vấn đề chặn lớn nhất**: (a) API chưa expose dữ liệu đã có trong DB (`nurse_id`, `ghi_chu`);
  (b) thiếu định nghĩa nghiệp vụ **sức chứa/"ca đầy"**; (c) rủi ro **múi giờ** cần xác nhận trước
  khi tin số ngày hiển thị.

**Điều kiện cần hoàn thành trước khi code:**
1. Chốt định nghĩa **sức chứa** ("ca đầy" = hết slot `active`? hay có field riêng?).
2. Chốt hành vi **màn tuần** (tuần trước/sau, giới hạn quá khứ tới đâu).
3. Xác nhận **múi giờ** lưu `ngay` (kiểm tra `scheduleGenerator.service.js`).
4. Chốt **loại nghỉ thường/khẩn cấp** có làm trong phạm vi đồ án không.

---

## I. Cập nhật sau Prompt 2 (Backend/API — 2026-07-13)

> Chỉ sửa **backend/controller/route/util + test**. KHÔNG sửa frontend, KHÔNG sửa model/schema,
> KHÔNG thêm field DB, KHÔNG chạy seed/migration. Kiểm thử bằng integration test thật chạy trên
> server đang chạy + MongoDB Cloud.

### I.1 Lỗi backend ĐÃ sửa

| Trước | Sau |
|---|---|
| API danh sách lịch **không trả** y tá / trạng thái ngày / chi nhánh / lock | `flattenSchedules` nay trả `nurse`, `nurse_id`, `trang_thai_ngay`, `chi_nhanh_id`, `lock_expires_at` (populate `nurse_id`) — **dữ liệu thật, không hardcode** |
| **Không có** API chi tiết ca | Thêm `GET /api/doctor/schedule/:scheduleId` (chỉ đọc): thông tin ngày, y tá, slots, danh sách lịch hẹn thuộc ca (join tên BN online **+ khách vãng lai**), `thong_ke` (đếm slot + đếm lịch hẹn theo nhóm) — có kiểm tra quyền sở hữu (`doctor_id`) |
| `formatLeave` **bỏ** `ghi_chu` | Nay trả `ghi_chu`, `thoi_diem_duyet`, `ngay_cap_nhat` |
| `createLeaveRequest` **không chống trùng**, không đếm ảnh hưởng | Thêm chống trùng (409 nếu đã có đơn `cho_duyet/da_duyet` trùng khoảng ngày) + trả `so_lich_hen_anh_huong` (đếm động, **không lưu DB**) |
| Logic "còn hiệu lực" chưa chuẩn hóa | Thêm util `utils/appointmentStatus.js` (một nơi định nghĩa nhóm trạng thái, tránh lặp) |

### I.2 Lỗi CHƯA sửa (đúng phạm vi — để Prompt sau)

- **Frontend** vẫn hardcode "Chưa phân công y tá" và chưa dùng API chi tiết ca / field mới → **Prompt 3**.
- **3 test lịch hẹn (appointments) fail** do **seed drift** (`doctor.test` không còn đúng 8 lịch hẹn) —
  **có sẵn từ baseline trước khi sửa**, thuộc module lịch hẹn (ngoài phạm vi Prompt 2). Không sửa.
- **Nghỉ khẩn cấp / loại nghỉ**: chưa làm (cần field mới + quyết định nghiệp vụ) → giữ trong gap.
- **Sức chứa tường minh**: không làm (mô hình 1 slot = 1 chỗ, "đầy" = hết slot `active`) → giữ trong gap.

### I.3 Kết luận thay đổi sau khi kiểm tra thực tế

- Xác nhận backend **định danh bác sĩ từ token** ở mọi endpoint đã sửa; test cross-doctor trả **404**.
- Xác nhận `nurse_id`/`ghi_chu` là **API/FE chưa expose**, không phải DB thiếu — đã expose ở backend.
- Kết quả test: **22/25 pass**; 3 fail còn lại là pre-existing (appointments seed drift), không do Prompt 2.

---

## J. Cập nhật sau Prompt 3 (Frontend — 2026-07-13)

> Chỉ sửa **frontend** (page/service/type/util/mock) + **1 fix backend nhỏ đã xác nhận, trực tiếp
> chặn tính năng** (xem J.2). KHÔNG sửa module ngoài phạm vi, KHÔNG đổi MongoDB, KHÔNG chạy seed.

### J.1 Lỗi frontend ĐÃ sửa / hoàn thiện

| Trước | Sau |
|---|---|
| "6 ngày làm việc gần nhất" cố định, không xem được quá khứ/tuần khác | **Lịch tuần thật**: nút Tuần trước/Tuần sau/Hôm nay, xem được mọi tuần (kể cả quá khứ, chỉ đọc — ẩn nút xin nghỉ/hủy) |
| Hardcode "Chưa phân công y tá" | Hiển thị `nurse` thật từ API (đã xác minh qua trình duyệt thật: "Điều dưỡng Thanh Hà") |
| Không có chi tiết ca / danh sách lịch hẹn trong ngày | Modal "Chi tiết ngày làm việc" dùng API Prompt 2: y tá, phòng, thống kê, danh sách lịch hẹn (cả khách vãng lai), nút điều hướng sang `/doctor/appointments` |
| "Đã gửi yêu cầu nghỉ" chỉ giữ trong RAM phiên (GAP-5) | Đối chiếu thật với `GET /doctor/leaves` (`findCoveringLeave`) — bền vững qua reload, không gửi trùng |
| `NghiPhepBacSi.ghi_chu` (ghi chú Admin) chưa hiển thị | Hiện ở trang Xin nghỉ, dưới badge trạng thái, khi đã `da_duyet`/`tu_choi` |
| `mock/doctor-schedule.ts` (dead code, 0 import) | Đã xóa (xác nhận bằng grep trước khi xóa) |

### J.2 Fix backend nhỏ đã xác nhận (báo cáo trước khi làm, đúng quy định Prompt 3 mục "chỉ sửa lỗi nhỏ trực tiếp")

**Phát hiện**: `LichLamViec.ngay` được ghi bằng `new Date(str); x.setHours(0,0,0,0)` (local midnight —
cùng pattern ở `scheduleGenerator.service.js` và `seed-doctor-test-data.js`), nhưng controller đọc lại
bằng `.toISOString().slice(0,10)` (UTC) — lệch 1 ngày trên mọi server chạy múi giờ khác UTC (đã verify
bằng phép tính trực tiếp: `startOfDay('2026-07-20')` → lưu `2026-07-19T17:00:00Z` → đọc lại UTC = sai
thành "2026-07-19"). Đây chính là rủi ro "múi giờ" đã ghi trong báo cáo Prompt 1 (mục C.5), nay được
xác nhận và sửa vì **trực tiếp chặn** tính năng lịch tuần của Prompt 3.
- **Sửa**: `backend/src/controllers/doctor/schedule.controller.js` — thêm `localDateStr()`/`localStartOfDay()`
  (đọc/ghi bằng local time, đối xứng với cách ghi), áp dụng cho: serialize `ngay` (2 chỗ) + filter `from/to`.
- **Không đổi**: schema, generator, seed script, dữ liệu MongoDB hiện có.
- **Verify an toàn**: so sánh trực tiếp trên server đang chạy — kết quả **không đổi** (server hiện tại
  chạy ở UTC nên trước/sau fix cho cùng kết quả), xác nhận fix không gây regression, chỉ loại bỏ rủi ro
  tiềm ẩn khi chạy ở múi giờ khác UTC (vd máy dev +7). Toàn bộ test backend (25 test) vẫn 22 pass/3 fail
  y hệt trước fix.

### J.3 Phát hiện dữ liệu THẬT ngoài dự kiến (qua kiểm thử trình duyệt thật — quan trọng)

Khi mở `/doctor/schedule` bằng Playwright thật (đăng nhập `doctor.test`), phát hiện **1 ngày có 2
document `LichLamViec` khác nhau cho cùng `doctor_id` + cùng ngày lịch** (07-13 đến 07-17/2026, mỗi
ngày 2 `schedule_id` khác nhau, dữ liệu khác nhau — vd 1 bản có phòng, 1 bản không). Unique index
`{doctor_id, ngay: 1}` không bắt được vì 2 document có `Date` instant khác nhau dù cùng ngày lịch
(rất có thể do seed script và cron `scheduleGenerator.service.js` cùng tự sinh độc lập cho cùng ngày).
- **Đây là bất thường DATABASE thật, không phải lỗi code Prompt 2/3.**
- **Không tự sửa dữ liệu** (đúng nguyên tắc "không tự đổi MongoDB").
- **Frontend đã xử lý trung thực**: phát hiện >1 `schedule_id`/ngày → hiện badge cảnh báo đỏ
  "⚠ N bản ghi trùng ngày — cần Admin kiểm tra", tách "Chi tiết" thành nút riêng cho từng bản ghi
  (không gộp, không đoán bản ghi nào đúng), gắn nhãn "Bản ghi N" trên từng slot để phân biệt.
- **Đã kiểm chứng qua Playwright thật**: cả 2 "Bản ghi" đều mở modal đúng, hiển thị đúng dữ liệu
  riêng của từng document (vd Bản ghi 2 của ngày 13/07 có 3 lịch hẹn Tai Mũi Họng thật).
- **Cần xử lý ở tầng database/nghiệp vụ** (ngoài phạm vi Prompt 3): xem mục K trong gap-analysis.

### J.4 Vấn đề CHƯA sửa (đúng phạm vi — ngoài Prompt 3 hoặc để prompt sau)

- **Không sửa** ~90 lỗi `tsc` pre-existing không liên quan (duplicate identifier trong `ServiceItem`,
  `AppointmentItem`, `PaymentItem`, `AdminDoctorWorkdayItem`... và `mock/doctor-appointments.ts`) —
  xác nhận **có từ trước** Prompt 3 (bị che bởi 1 lỗi cú pháp chặn toàn bộ `tsc`), **không liên quan**
  Lịch làm việc bác sĩ. Chỉ sửa đúng phần cú pháp chặn compile (dedupe `AppointmentStatus`, **không**
  thêm giá trị mới để tránh phá vỡ 3 file admin/dashboard khác đang phụ thuộc union hẹp hơn).
- **Chưa xử lý** dữ liệu trùng ngày ở tầng database (mục J.3) — cần Admin/backend investigate.
- **Bộ lọc trạng thái ca** (ngoài tuần/hôm nay) — cân nhắc bỏ qua để tránh phức tạp không cần thiết
  (đúng hướng dẫn "Không bắt buộc tạo cả hai nếu làm tăng độ phức tạp không cần thiết").

### J.5 UI đã hoàn thiện — xác nhận qua Playwright thật (không chỉ code review)

Đăng nhập → `/doctor/schedule` → **0 console error** trong toàn bộ luồng (load, chuyển tuần, mở modal,
đổi viewport mobile). Ảnh chụp màn hình xác nhận: card không bóp méo, badge trạng thái rõ ràng, y tá/
phòng hiển thị dữ liệu thật, modal chi tiết đúng dữ liệu, mobile (375px) không vỡ layout.

---

# Final Review Result (Prompt 4 — 2026-07-13)

Review nghiệm thu cuối sau khi Backend (Prompt 2) và Frontend (Prompt 3) đã ổn định. **Không viết lại
code**, chỉ review + sửa 1 lỗi test brittle trong phạm vi. Chi tiết đầy đủ ở
`docs/doctor-schedule-final-acceptance-report.md`.

## Kết quả review
- **Git diff**: đúng 9 file trong phạm vi (backend controllers/routes + frontend page/service/types/
  constants/util + xóa mock). **Không** đụng `.env`, `package-lock`, `node_modules`, module admin/
  patient/payment.
- **Backend**: ownership enforced ở mọi query (`BacSi.findOne({ user_id: req.user.id })` → `_id`;
  detail/cancel dùng `findOne({ _id, doctor_id })`). Middleware `verifyToken → requireRole('doctor')`
  áp ở mount point `routes/doctor/index.js` cho toàn bộ route con. Đếm lịch hẹn dùng helper chung
  `thongKeLichHen` (loại cancelled/no_show khỏi `tong_lich_hen`, đếm riêng nhóm `khac` để không bỏ sót
  trạng thái lạ). Không có hành động admin/tự-hủy-lịch/sửa-thanh-toán.
- **Frontend**: 100% dữ liệu API thật, không mock runtime, không hardcode nghiệp vụ; dữ liệu thiếu →
  fallback trung thực ("Chưa phân công", "Chưa có phòng"). Map nhãn/màu trạng thái lịch hẹn + thanh
  toán **đầy đủ** (gồm `waiting_doctor_confirm`) → không có badge trống.

## Lỗi đã sửa (1)
- **BUG-P4-01 (Medium, test brittleness)**: `backend/tests/doctor.api.test.js` assert cứng
  `data.length === 8` (DB Cloud dùng chung nay có 13 lịch hẹn) → ném lỗi **trước** khi gán fixture
  `appointments`, làm test #6 và **test bảo mật cross-doctor #7 crash ở bước setup, không bao giờ chạy
  tới assertion 404**. Sửa: gán fixture trước + assert **sàn** `>= 8`. Sau sửa: **backend 25/25**, test
  #7 chạy thật và pass. Đã kiểm chứng độc lập tính bảo mật bằng gọi API trực tiếp (doctor B đọc
  appointment của doctor A → 404).

## Kết quả test cuối
| Nhóm | Kết quả |
|---|---|
| Backend integration (`npm test`) | **25/25 pass** |
| Frontend unit (`vitest run`) | **37/37 pass** |
| `tsc --noEmit` | 108 lỗi **pre-existing** (chỉ ở `mock/doctor-appointments.ts` + interface payment/service trong `types/index.ts`) — **0 lỗi từ file chức năng lịch** |
| `vite build` | **pass** |
| Phân quyền (live API battery) | **12/12 pass** (cross-doctor 404, no-token 401, invalid-token 401) |
| Browser E2E (Playwright thật) | **0 console error**, week view + modal + mobile 375px đúng |

## Còn lại (không chặn nghiệm thu chức năng)
- **GAP-8** (Database, ưu tiên cao): vẫn tồn tại document `LichLamViec` trùng ngày lịch. FE đã cảnh
  báo trung thực (badge đỏ + tách "Bản ghi 1/2"). Cần Admin/backend xử lý ở tầng dữ liệu — xem
  gap-analysis. **Không tự sửa DB.**
- 108 lỗi `tsc` pre-existing ở module payment/service/mock — ngoài phạm vi, không ảnh hưởng build/chức
  năng lịch.
