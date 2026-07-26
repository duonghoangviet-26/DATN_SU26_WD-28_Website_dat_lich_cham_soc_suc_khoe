# Khoanh vùng toàn bộ code trang Y tá — Sơ đồ file & luồng dữ liệu

> Ngày: 2026-07-18 · Nhánh: `Bac_si` · Giai đoạn: **chỉ đọc code, không sửa**.
> Đối chiếu với: [Phan tich nghiep vu tong quan trang Y ta (2026-07-18)] và [Audit - Trang thai thuc te trang Y ta (2026-07-18)].

## Kiểm tra đặc biệt (trả lời nhanh)

| Câu hỏi | Kết luận (có bằng chứng) |
|---|---|
| Nurse page thật hay giao diện mẫu? | **Thật** — 4 trang có logic + gọi API. |
| Dùng API thật hay mock? | **API thật** qua `axiosInstance` → `http://localhost:5000/api`. **Không có mock nurse** (grep `frontend/src/mock` = rỗng). |
| Có bị sao chép từ admin/doctor? | Không sao chép trang; có layout/sidebar/header **riêng** (`components/nurse/*`), pages tự viết. Dùng chung `PageHeader/Badge/Icon`. |
| Route có bảo vệ role nurse? | **Có 2 lớp:** FE `ProtectedRoute roles={['nurse']}` (`AppRoutes.tsx:149`) + BE `requireRole('nurse')` (`routes/nurse/index.js:15`). |
| BE có API riêng cho nurse? | **Có** — `/api/nurse/*` (dashboard, appointments, medical-records, room-status, queue). |
| FE có truyền nurseId tùy ý? | **Không** — mọi controller lấy `req.user.id` từ token, FE không gửi nurseId. **An toàn.** |
| Trùng chức năng doctor ↔ nurse? | Trùng **khái niệm hàng đợi** (HangDoi) và hồ sơ khám, nhưng khác vai trò. |
| File nurse không được route dùng? | Không có **page** mồ côi. Nhưng **controller `queue` + `room-status` (BE) không trang FE nào gọi**. |
| API tồn tại nhưng FE không gọi? | **Có 9 endpoint chết trong UI:** `/nurse/queue/*` (7) + `/nurse/room-status` (2). |
| FE gọi endpoint không tồn tại? | Không. Nhưng `NurseRevisions` **đọc field không có trong response** (xem P1). |
| Nhiều service cùng một việc? | **Có** — `getQueue` (`/nurse/appointments`, hệ cũ) vs `getQueueEntries` (`/nurse/queue`, hệ mới): 2 khái niệm hàng đợi song song. |
| Hard-code dữ liệu? | **Không** dữ liệu nghiệp vụ hard-code. (Chỉ có label hằng số hợp lệ.) |
| Type không khớp response? | **Có — P1:** `NurseRevisionItem`. |
| File cũ/chết? | `queue`+`room-status` (BE) dead-in-UI; comment `axiosInstance.ts` lỗi thời ("chưa có backend"). |

---

# A. Sơ đồ file

### Frontend

| Khu vực | Đường dẫn | Chức năng | Đang dùng? | Nhận xét |
|---|---|---|---|---|
| Route | `frontend/src/routes/AppRoutes.tsx` (145–158) | Định tuyến `/nurse/*` + bọc guard + layout | ✅ | 4 route: index, queue, appointments/:id, revisions |
| Menu | `frontend/src/routes/nurseMenu.ts` | Sidebar menu | ✅ | Chỉ **3 mục** (Tổng quan, Hàng đợi, Hồ sơ cần chỉnh sửa). Không có profile/tiếp nhận/phòng |
| Guard | `frontend/src/routes/ProtectedRoute.tsx` | Chặn theo role | ✅ | Kiểm `roles.includes(user.role)` |
| Layout | `frontend/src/layouts/NurseLayout.tsx` | Khung trang | ✅ | Sidebar + Header + Outlet |
| Component | `frontend/src/components/nurse/NurseSidebar.tsx` | Sidebar | ✅ | Render `nurseMenu` |
| Component | `frontend/src/components/nurse/NurseHeader.tsx` | Header | ✅ | — |
| Component chung | `components/common/PageHeader`, `Badge`; `components/admin/icons` | Dùng chung | ✅ | — |
| Page | `frontend/src/pages/nurse/NurseDashboard.tsx` | Tổng quan | ✅ | Gọi `getDashboard` |
| Page | `frontend/src/pages/nurse/NurseQueue.tsx` | Hàng đợi bệnh nhân | ✅ | Gọi `getQueue` → **/nurse/appointments (hệ cũ)** |
| Page | `frontend/src/pages/nurse/NurseAppointmentDetail.tsx` | Chi tiết + nhập hồ sơ | ✅ | Gọi getById/createDraft/update/submit/resubmit |
| Page | `frontend/src/pages/nurse/NurseRevisions.tsx` | Hồ sơ cần chỉnh sửa | ✅ | Gọi `getRevisions` — **field mismatch (P1)** |
| Service | `frontend/src/services/nurse.service.ts` | Gọi API | ⚠️ Một phần | 15 method; **9 method HangDoi/room-status không page nào dùng** |
| Service chung | `frontend/src/services/axiosInstance.ts` | Axios + token | ✅ | Comment lỗi thời ("chưa có backend") |
| Types | `frontend/src/types/index.ts` (1061–1264) | Kiểu Nurse* | ✅ | `NurseRevisionItem` lệch response |
| Context | `frontend/src/context/AuthContext` | user/role/token | ✅ | — |
| Utils | `utils/constants.ts` (labels), `utils/format.ts` | Nhãn + format | ✅ | — |
| Profile | *(không tồn tại)* | — | ❌ | **Chưa có trang thông tin cá nhân nurse** |
| Mock | *(không có)* | — | — | Không mock nurse |

### Backend

| Khu vực | Đường dẫn | Chức năng | Đang dùng? | Nhận xét |
|---|---|---|---|---|
| Mount | `backend/src/routes/index.js` (11,23) | Mount `/api/nurse` | ✅ | — |
| Route root | `backend/src/routes/nurse/index.js` | Guard chung + gom sub-route | ✅ | `verifyToken, requireRole('nurse')` |
| Route | `routes/nurse/dashboard.routes.js` | GET / | ✅ | — |
| Route | `routes/nurse/appointments.routes.js` | GET /, GET /:id | ✅ | Hệ cũ (nurse_id) |
| Route | `routes/nurse/medical-records.routes.js` | GET/POST/PATCH | ✅ | Hồ sơ + submit/resubmit + revisions |
| Route | `routes/nurse/room-status.routes.js` | GET /, PATCH /:doctorId | ⚠️ BE live, **UI chết** | Không page gọi |
| Route | `routes/nurse/queue.routes.js` | checkin/call/into-room/finish/skip/cancel | ⚠️ BE live, **UI chết** | Không page gọi |
| Controller | `controllers/nurse/dashboard.controller.js` | Số liệu tổng quan | ✅ | Lọc `LichHen.nurse_id` (rỗng nếu chưa set) |
| Controller | `controllers/nurse/appointments.controller.js` | listQueue + getById | ✅ | Gate `LichHen.nurse_id` |
| Controller | `controllers/nurse/medical-records.controller.js` | CRUD hồ sơ + submit | ✅ | Gate `HangDoi` (hệ mới) — **lệch gate với appointments** |
| Controller | `controllers/nurse/room-status.controller.js` | Trạng thái phòng | ⚠️ UI chết | `findOrCreateRoomStatus` dùng chung với queue |
| Controller | `controllers/nurse/queue.controller.js` | Hàng đợi động | ⚠️ UI chết | Nơi **duy nhất** tạo `HangDoi` |
| Middleware | `middlewares/auth.middleware.js` | verifyToken, requireRole | ✅ | — |
| Util | `utils/nurse-scope.js` | `getMyDoctorIdsToday`, `getTodayRange` | ✅ | Dựa `LichLamViec.nurse_id` |
| Util | `utils/response.js` | ok/created/fail | ✅ | — |
| Util | `utils/validators.js` | `isNgayTaiKhamHopLe` | ✅ | Dùng trong medical-records |
| Model | `models/LichHen.js` | Lịch hẹn | ✅ đọc | field `nurse_id` (default null) |
| Model | `models/LichLamViec.js` | Ca làm việc + slots | ✅ đọc | field `nurse_id` (default null) |
| Model | `models/KetQuaKham.js` | Hồ sơ khám | ✅ đọc | sparse-unique appointment_id/hang_doi_id |
| Model | `models/SinhHieuKham.js` | Sinh hiệu | ✅ đọc | sparse-unique như trên |
| Model | `models/HangDoi.js` | Hàng đợi động | ✅ đọc | `tinhMucUuTien` |
| Model | `models/TrangThaiPhongKham.js` | Trạng thái phòng | ✅ đọc | 1 bản ghi/bác sĩ/ngày |
| Model chung | `NguoiDung, ThanhVien, BacSi, NhatKyThaoTac, ThongBao` | — | ✅ đọc | join/audit/notify |
| Script | `scripts/link-nurse-to-khang-data.js` | Backfill nurse_id (test) | 🧪 công cụ | Chỉ dữ liệu test doctor.test |
| Script | `scripts/inspect-khang-doctor-data.js` | Kiểm tra dữ liệu | 🧪 công cụ | — |

---

# B. Sơ đồ luồng dữ liệu (ghi rõ file từng bước)

**Chung mọi request:** `axiosInstance.ts` (gắn Bearer token) → `routes/index.js` (`/api/nurse`) → `routes/nurse/index.js` (`verifyToken` → `requireRole('nurse')` tại `middlewares/auth.middleware.js`) → sub-route.

**1. Dashboard**
```
NurseDashboard.tsx → nurseService.getDashboard (nurse.service.ts)
 → GET /api/nurse/dashboard → dashboard.routes.js → dashboard.controller.getDashboard
 → models: NguoiDung, LichLamViec(nurse_id), LichHen(nurse_id), KetQuaKham(nguoi_nhap_id), ThanhVien
 → utils/response.ok → UI (STAT_CARDS + hàng đợi gần nhất)
```

**2. Hàng đợi bệnh nhân**
```
NurseQueue.tsx → nurseService.getQueue
 → GET /api/nurse/appointments → appointments.routes.js → appointments.controller.listQueue
 → LichHen.find({nurse_id, ngay_kham, status∈QUEUE_STATUSES}).populate(doctor_id→user_id/specialties)
 → formatQueueItem(ThanhVien, KetQuaKham) → ok → UI (bảng)
```

**3. Chi tiết + nhập/gửi hồ sơ**
```
[Xem]  NurseAppointmentDetail.tsx → getAppointmentById
        → GET /api/nurse/appointments/:id → appointments.controller.getById
        → LichHen.findOne({_id, nurse_id}).populate(member_id, doctor_id) + KetQuaKham + SinhHieuKham → ok → UI
[Lưu]  → createDraft/updateRecord → POST/PATCH /api/nurse/medical-records[/:id]
        → medical-records.controller → resolve HangDoi theo appointment_id (findEntryInShift)
        → KetQuaKham.create/save + upsertVitals(SinhHieuKham)  ⚠ 409 nếu không có HangDoi
[Gửi]  → submit/resubmit → PATCH /api/nurse/medical-records/:id/submit
        → KetQuaKham.status='cho_xac_nhan' + LichHen.status='waiting_doctor_confirm' → ok → UI
```

**4. Hồ sơ cần chỉnh sửa**
```
NurseRevisions.tsx → getRevisions
 → GET /api/nurse/medical-records/revisions → medical-records.controller.listRevisions
 → KetQuaKham.find({nguoi_nhap_id, status='yeu_cau_chinh_sua'}).populate(hang_doi_id)
 → trả {id, hang_doi_id, benh_nhan, doctor_revision_note, thoi_diem_yeu_cau}
 → UI dùng appointment_id/ngay_kham/bac_si_yeu_cau/ly_do_kham ⇒ undefined  ⚠ P1
```

**5. Hệ HangDoi/room-status (UI CHẾT):** service có `getQueueEntries/checkinQueue/call/intoRoom/finish/skip/cancel/getRoomStatus/updateRoomStatus` → map tới `queue.controller`/`room-status.controller` thật, nhưng **không component nào import** → luồng dừng ở service.

---

# C. Phân loại file

**File chỉ cần đọc để hiểu (không đụng):**
- Guard/hạ tầng: `ProtectedRoute.tsx`, `axiosInstance.ts`, `AuthContext`, `middlewares/auth.middleware.js`, `utils/response.js`.
- Model: `LichHen.js`, `LichLamViec.js`, `KetQuaKham.js`, `SinhHieuKham.js`, `HangDoi.js`, `TrangThaiPhongKham.js`, `NguoiDung/ThanhVien/BacSi`.
- Booking (đọc để hiểu nguồn nurse_id): `controllers/patient/booking.controller.js`, `controllers/receptionist/booking.controller.js`.

**File có khả năng cần sửa (chỉ khi có prompt sửa):**
- `controllers/nurse/medical-records.controller.js` — gate/HangDoi coupling.
- `controllers/nurse/appointments.controller.js` + `dashboard.controller.js` — phụ thuộc nurse_id.
- `frontend/src/pages/nurse/NurseRevisions.tsx` + `types/index.ts` (`NurseRevisionItem`) — mismatch.
- `controllers/patient/booking.controller.js`, `controllers/receptionist/booking.controller.js` — set nurse_id (nếu chọn hướng bridge; **cần chứng minh bắt buộc trước khi đụng file dùng chung**).

**File KHÔNG được đụng (ngoài phạm vi/đủ tốt):**
- `auth.middleware.js`, `ProtectedRoute.tsx`, `axiosInstance.ts` (trừ sửa comment lỗi thời — không bắt buộc), toàn bộ model (không đổi schema ở giai đoạn này), route files (thin, đúng).

**File nghi ngờ không còn/không được dùng trong UI:**
- `controllers/nurse/queue.controller.js` + `routes/nurse/queue.routes.js`.
- `controllers/nurse/room-status.controller.js` + `routes/nurse/room-status.routes.js`.
- 9 method HangDoi/room-status trong `nurse.service.ts`.
- (Chỉ "dead-in-UI", **không xóa** — cần quyết định kiến trúc trước.)

---

# D. Vấn đề ban đầu (phân mức)

**P0 — chặn luồng làm việc thực tế**
- **P0.1** Booking (patient + receptionist) **không set `LichHen.nurse_id`** → NurseQueue/Dashboard/Detail **rỗng** với lịch đặt bình thường (hôm nay = 0). Cả luồng y tá không có dữ liệu nếu không backfill thủ công. *(File: 2 booking controller.)*
- **P0.2** `createDraft` **bắt buộc có `HangDoi` entry**, mà không trang nào tạo được (checkin UI chết) → **"Lưu nháp" trả 409** cho lịch chưa có HangDoi. Chặn chức năng cốt lõi "nhập hồ sơ". *(File: `medical-records.controller.js`.)*

**P1 — sai nghiệp vụ/quyền/đồng bộ nghiêm trọng**
- **P1.1** `NurseRevisions` field mismatch: nút **"Chỉnh sửa hồ sơ" điều hướng `/nurse/appointments/undefined`** → mở chi tiết lỗi → **vòng sửa hồ sơ hỏng từ trang này**. *(File: `NurseRevisions.tsx` + `listRevisions` + type.)*
- **P1.2** **Hai gate song song trên cùng màn hình:** xem chi tiết gate bằng `LichHen.nurse_id` (hệ cũ) nhưng lưu hồ sơ gate bằng `HangDoi`/`getMyDoctorIdsToday` (hệ mới) → "xem được nhưng lưu lỗi". *(File: appointments vs medical-records controller.)*

**P2 — thiếu chức năng quan trọng**
- **P2.1** Hệ **hàng đợi động + trạng thái phòng** (checkin/gọi/vào phòng/kết thúc) có backend đầy đủ nhưng **không nối UI** → chức năng tiếp nhận/điều phối hiện diện không dùng được.
- **P2.2** **Không có trang thông tin cá nhân** nurse.
- **P2.3** Menu chỉ 3 mục; thiếu lối vào "tiếp nhận"/phòng (nếu quyết định dùng hệ mới).

**P3 — chất lượng code/UX**
- **P3.1** `getQueue` (hệ cũ) và `getQueueEntries` (hệ mới) trùng khái niệm gây nhầm.
- **P3.2** 9 method service + 2 controller "dead-in-UI" gây hiểu nhầm "đã xong".
- **P3.3** `axiosInstance.ts` comment lỗi thời ("chưa có backend").
- **P3.4** `NurseRevisions` hiển thị "—"/ngày không hợp lệ do field thiếu (hệ quả P1.1).

---
*Chỉ đọc code, chưa sửa. Ưu tiên xử lý theo thứ tự P0 → P1 khi có prompt sửa. P0.1/P0.2/P1.2 đã có phương án ở spec "Bridge tối thiểu"; P1.1 là phát hiện MỚI ở prompt này.*
