# Design: Xóa hoàn toàn vai trò Nurse (Y tá) khỏi hệ thống

> Ngày: 2026-07-24
> Trạng thái: Approved by user (2026-07-24)
> Bối cảnh: `docs/Y tá/Audit - Xac minh xoa hoan toan Nurse khoi he thong (2026-07-24).md` xác nhận
> Nurse vẫn là subsystem sống ở mọi tầng. User yêu cầu: "tiến hành xóa trang y tá và dữ liệu db
> liên quan đến trang y tá".

## 1. Mục tiêu

Loại bỏ hoàn toàn role `nurse` khỏi kiến trúc — DB schema, API, permission/RBAC, UI, business
logic — và chuyển các trách nhiệm còn hữu ích của Nurse sang **Lễ tân (receptionist)** và
**Bác sĩ (doctor)**, đúng workflow người dùng mô tả:

> "luồng hiện tại bây giờ là lễ tân nhận checkin online và tạo ca khám cho offline, sau đó
> chuyển cho bác sĩ để bác sĩ biết bệnh nhân đã đến"

Không còn bất kỳ trang, API, model, hay logic nào giả định sự tồn tại của Nurse.

## 2. Quyết định đã chốt với user (2026-07-24)

1. **Hàng đợi khám (HangDoi)**: `checkin` + xem danh sách hàng đợi → **Lễ tân**. Các thao tác
   trong phòng khám (`call`, `into-room`, `finish`, `skip`, `cancel`) → **Bác sĩ** (chỉ hàng đợi
   của chính mình).
2. **Luồng "Bác sĩ xác nhận / yêu cầu chỉnh sửa"** (`confirmResult`, `requestRevision`,
   `confirmResultByRecord`, status `cho_xac_nhan`/`yeu_cau_chinh_sua`/`waiting_doctor_confirm`/
   `waiting_record`) → **xóa luôn**. Bác sĩ chỉ dùng đường có sẵn `createResult` (tự nhập, tự
   chốt `da_xac_nhan` ngay lập tức, không cần bước xác nhận riêng).
3. **Migration dữ liệu trên MongoDB Cloud (DATN_VITAFAMILY — DB thật, dùng chung cả nhóm)**:
   Claude tự kết nối và chạy trực tiếp (dry-run trước, sau đó chạy thật, có báo cáo kết quả).

## 3. Kiến trúc đích

### 3.1 Hàng đợi khám (HangDoi) — bảng phân công lại

| Hành động | Trước (nurse) | Sau |
|---|---|---|
| `checkin` (online có `appointment_id`, walk-in có `ten_benh_nhan`+`so_dien_thoai`) | `POST /api/nurse/queue/checkin` | `POST /api/receptionist/queue/checkin` |
| Xem hàng đợi hôm nay (mọi bác sĩ) | `GET /api/nurse/queue` | `GET /api/receptionist/queue` |
| `call` (gọi bệnh nhân) | `PATCH /api/nurse/queue/:id/call` | `PATCH /api/doctor/queue/:id/call` |
| `into-room` (vào phòng) | `PATCH /api/nurse/queue/:id/into-room` | `PATCH /api/doctor/queue/:id/into-room` |
| `finish` (kết thúc khám) | `PATCH /api/nurse/queue/:id/finish` | `PATCH /api/doctor/queue/:id/finish` |
| `skip` (bỏ lượt) | `PATCH /api/nurse/queue/:id/skip` | `PATCH /api/doctor/queue/:id/skip` |
| `cancel` (hủy lượt) | `PATCH /api/nurse/queue/:id/cancel` | `PATCH /api/doctor/queue/:id/cancel` |

**Scoping đổi:**
- Lễ tân: checkin/list áp dụng cho *mọi bác sĩ có lịch làm hôm nay* — không cần khái niệm
  "y tá phụ trách bác sĩ nào" (`nurse-scope.js` bị xóa). Cần helper mới kiểu
  `getDoctorIdsWorkingToday()` (không tham số user) thay cho `getMyDoctorIdsToday(nurseId)`.
- Bác sĩ: `call`/`into-room`/`finish`/`skip`/`cancel` chỉ áp dụng cho `HangDoi.doctor_id ===
  docId của chính bác sĩ đang đăng nhập` — đơn giản hơn cơ chế "ca trực" của nurse, dùng thẳng
  `getDocId(req.user.id)` đã có sẵn trong `doctor/appointments.controller.js`.
- `GET /api/doctor/queue` (`examQueue`, đã có sẵn) — giữ nguyên, đã đọc `HangDoi` theo
  `doctor_id`. Có thể bổ sung field `so_lan_goi` (đang chỉ có ở nurse.list) nếu FE bác sĩ cần
  hiển thị số lần đã gọi — quyết định cụ thể để lúc viết plan.

**Thay đổi hành vi:**
- `finish()` hiện tại set `LichHen.status = 'waiting_record'` để báo y tá vào nhập hồ sơ.
  **Bỏ dòng set status này** — giữ nguyên `in_progress` sau khi finish; bác sĩ tự gọi
  `createResult`/`complete` khi sẵn sàng (2 hàm này đã nhận `in_progress` làm trạng thái hợp lệ).
- `TrangThaiPhongKham`: field `y_ta_co_mat` bỏ khỏi logic ghi (không xóa field DB ngay để tránh
  vỡ dữ liệu cũ nếu không cần thiết — quyết định cụ thể lúc viết migration: xóa field nếu
  không còn nơi nào đọc). `nguoi_dieu_khien_vai_tro` bỏ giá trị `'nurse'` khỏi enum, action mới
  ghi `'doctor'`.
- `NhatKyThaoTac.vai_tro: 'nurse'` trong các hàm audit log (`ghiAuditQueue`) → đổi giá trị ghi
  mới thành `'doctor'` hoặc `'receptionist'` tùy hành động. Bản ghi audit **cũ** trong DB thật
  giữ nguyên (là lịch sử, không sửa).

### 3.2 Gỡ luồng "Bác sĩ xác nhận / yêu cầu chỉnh sửa"

- Xóa endpoint (route + controller export):
  - `PATCH /api/doctor/appointments/:id/result/confirm` (`confirmResult`)
  - `PATCH /api/doctor/appointments/:id/result/request-revision` (`requestRevision`)
  - `PATCH /api/doctor/appointments/result/:ketQuaId/confirm-by-record` (`confirmResultByRecord`)
- `LichHen.status` enum: bỏ `waiting_record`, `waiting_doctor_confirm`. Enum còn lại:
  `pending, confirmed, checked_in, in_progress, completed, cancelled, no_show, skipped`.
- `KetQuaKham.status` enum: bỏ `cho_xac_nhan`, `yeu_cau_chinh_sua`. Giữ nguyên `ban_nhap`,
  `da_xac_nhan` (không đổi tên để không phá dữ liệu cũ / các nơi khác đang đọc 2 giá trị này).
- `updateResult()`: bỏ nhánh khóa dựa trên `status === 'da_xac_nhan'` cần "yêu cầu chỉnh sửa"
  mới sửa được → khóa hẳn sau khi `da_xac_nhan` (không có đường quay lại sửa qua API này nữa).
  Đây là thu hẹp hành vi có chủ đích, khớp tinh thần "hoàn thành hồ sơ" một lần của spec gốc.
- Bác sĩ chỉ còn 2 API cho hồ sơ khám: `POST .../result` (tạo, tự động `da_xac_nhan`) và
  `PUT .../result` (sửa, chỉ khi còn `ban_nhap`/`co_the_sua`).
- Mọi comment trong code nhắc tới "y tá"/"nurse" ở luồng này (vd `appointments.controller.js:
  440, 573`) → xóa/viết lại không còn nhắc Nurse.

### 3.3 Vai trò & Model

- `NguoiDung.role` enum (`backend/src/models/NguoiDung.js:29`): bỏ `'nurse'`.
  → `['user', 'patient', 'doctor', 'admin', 'receptionist']`.
- `Role` TS type (`frontend/src/types/index.ts:4`): bỏ `"nurse"`.
- Xóa field: `LichHen.nurse_id`, `LichLamViec.nurse_id`, `PhongKham.nurse_ids`.
- Xóa model: `backend/src/models/NghiPhepYTa.js` (và mọi import/route/controller dùng nó, nếu
  còn — audit trước chưa thấy route riêng cho nghỉ phép y tá ngoài model, xác nhận lại lúc
  viết plan).
- Admin **Quản lý phòng khám** (`frontend/src/pages/admin/ManageClinics/ManageClinics.tsx`,
  `ClinicRoomsTab.tsx`, `backend/src/controllers/admin/clinic-room.controller.js`): bỏ hoàn
  toàn phần chọn/gán y tá cho phòng (`nurse_ids`, `validateStaff` nhánh nurse, populate
  `nurse_ids`). Phòng khám sau refactor chỉ gắn `doctor_ids`.
- `SendNotificationTab.tsx`: bỏ "Y tá" khỏi danh sách nhóm đối tượng nhận thông báo.

### 3.4 Frontend — xóa toàn bộ

- `frontend/src/layouts/NurseLayout.tsx`
- `frontend/src/components/nurse/` (NurseSidebar, NurseHeader)
- `frontend/src/pages/nurse/` (6 trang: Dashboard, Schedule, Queue, PendingRecords,
  AppointmentDetail, Revisions)
- `frontend/src/services/nurse.service.ts`
- `frontend/src/routes/nurseMenu.ts`
- Nhánh route `/nurse` trong `frontend/src/routes/AppRoutes.tsx` (import + `<Route>` block)
- Tài khoản demo "Y tá" trong `frontend/src/pages/auth/Login.tsx` (dòng khai báo + redirect
  `role === 'nurse'`)
- Toàn bộ interface `Nurse*` trong `frontend/src/types/index.ts` (~15 interface, dòng
  1020–1265) + field `nurse`/`nurse_id`/`y_ta_ho_tro` trong các interface khác (dòng 636-637,
  728-729, 752, 888)
- UI "Y tá hỗ trợ" trong `DoctorDashboard.tsx` (dòng 142-144) và `DoctorSchedule.tsx`
  (dòng 164) — thay bằng hiển thị phù hợp (vd bỏ hẳn dòng này, hoặc hiển thị lễ tân trực nếu
  có dữ liệu tương đương — quyết định cụ thể lúc viết plan)
- `frontend/src/__tests__/services/nurse.service.test.ts`
- Test liên quan trong `schedule.service.test.ts` nếu có phần mock nurse

### 3.5 Backend — xóa toàn bộ

- `backend/src/routes/nurse/` (6 file: dashboard, appointments, medical-records, room-status,
  queue, schedule)
- `backend/src/controllers/nurse/` (6 file tương ứng) — logic hữu ích được **di dời** (không
  copy nguyên, viết lại gọn theo scoping mới) sang `receptionist`/`doctor` như mục 3.1.
- `backend/src/utils/nurse-scope.js`
- `backend/src/models/NghiPhepYTa.js`
- Mount `/nurse` trong `backend/src/routes/index.js` (dòng 11, 24)
- Script: `backend/src/scripts/seed-nurse-test-data.js`,
  `seed-khang-nurse-live-flow.js`, `seed-khang-nurse-history.js`,
  `link-nurse-to-khang-data.js`, `verify-khang-nurse-live-flow.js`
- `backend/src/scripts/seed-all.js`: bỏ đoạn tạo user `nurse@vitafamily.vn` (dòng 208-211),
  đổi `nguoi_nhap_id`/`nguoi_do_id`/`nguoi_sua_id`/`nguoi_cap_nhat_id` (dòng 276, 1031-1168)
  sang dùng bác sĩ demo thay vì `nurse`.

## 4. Migration dữ liệu trên MongoDB Cloud (DATN_VITAFAMILY)

DB thật, dùng chung cả nhóm (`MONGODB_URI` trong `.env`, log kết nối
"✅ Đã kết nối MongoDB Cloud (DATN_VITAFAMILY)"). Script migration độc lập
(`backend/src/scripts/migrate-remove-nurse.js`), idempotent, chạy 2 pha:

**Pha 1 — Dry-run** (mặc định, không ghi): đếm và in ra số document sẽ bị ảnh hưởng ở mỗi bước.

**Pha 2 — Apply** (cờ `--apply`): thực thi các bước sau, in log số lượng đã đổi:
1. Xóa toàn bộ `NguoiDung` có `role: 'nurse'`.
2. Xóa toàn bộ collection `NghiPhepYTa`.
3. `$unset: { nurse_id: 1 }` trên toàn bộ `LichHen`, `LichLamViec`.
4. `$unset: { nurse_ids: 1 }` trên toàn bộ `PhongKham`.
5. `LichHen` có `status` ∈ {`waiting_record`, `waiting_doctor_confirm`} → set `status: 'in_progress'`.
6. `KetQuaKham` có `status` ∈ {`cho_xac_nhan`, `yeu_cau_chinh_sua`} → set `status: 'ban_nhap'`.
7. **Không đụng** `NhatKyThaoTac` (giữ nguyên nhật ký lịch sử `vai_tro: 'nurse'` — đây là audit
   trail thật, không phải cấu hình sống).

Claude sẽ chạy Pha 1 trước, báo cáo số liệu cho user xem, rồi mới chạy Pha 2 (theo đúng phê
duyệt đã có — không cần hỏi lại giữa 2 pha vì đã được chấp thuận trước, nhưng sẽ dừng lại báo
cáo nếu số liệu dry-run bất thường/lớn hơn dự kiến).

## 5. Không đụng tới

- `docs/Y tá/*.md` (~40 file) và `docs/Bác sĩ/*.md`, `docs/NURSE_DOCTOR_WORKFLOW.md`: giữ
  nguyên làm tài liệu lịch sử, không phải action item.
- Toàn bộ nghiệp vụ Ca → Khung giờ → Slot, quota online/walk-in, ưu tiên hàng đợi
  (`.claude/rules/lich-lam-viec-bac-si.md` mục 1–8) — không đổi, chỉ đổi *ai gọi API check-in/
  vận hành hàng đợi*, không đổi thuật toán ưu tiên hay cấu trúc slot.
- Luồng đặt lịch, thanh toán, hủy/hoàn tiền của bệnh nhân — không liên quan Nurse.

## 6. Kiểm thử & xác minh

- Backend: chạy test hiện có (`__tests__`) sau khi sửa, thêm/sửa test cho route mới
  `receptionist/queue`, `doctor/queue` nếu có test suite cho controller pattern này.
- Kiểm tra thủ công build: `npm run build` (frontend), khởi động backend không lỗi import sau
  khi xóa file.
- Grep lại toàn repo `nurse|NURSE|Y tá` sau khi hoàn tất — chỉ còn match trong `docs/Y tá/`,
  `docs/Bác sĩ/` (tài liệu lịch sử) và các audit report đã viết.
- Xác nhận migration: chạy lại dry-run sau khi apply — phải trả về 0 document cần đổi.

## 7. Rủi ro còn lại sau refactor (đã biết trước, chấp nhận)

- `updateResult()` khóa hẳn sau `da_xac_nhan` là thu hẹp hành vi so với hiện tại (hiện tại có
  đường "yêu cầu chỉnh sửa" để mở khóa) — nếu bác sĩ nhập sai sau khi chốt, không còn cách sửa
  qua UI/API thông thường (chỉ sửa tay qua DB). Chấp nhận theo đúng tinh thần spec gốc
  ("hoàn thành hồ sơ" là bước chốt, không có đường revision).
- Field `so_lan_goi` (số lần gọi bệnh nhân) hiện chỉ có ở `nurse/queue.controller.js:list()`,
  không có ở `doctor/appointments.controller.js:examQueue()` — nếu bác sĩ cần thấy số này, cần
  bổ sung lúc viết plan (đã note ở mục 3.1).
