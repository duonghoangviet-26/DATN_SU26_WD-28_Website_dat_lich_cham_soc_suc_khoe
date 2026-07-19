# PROMPT 14 — Kiểm tra API & Frontend Service của nurse page

> Ngày: 2026-07-18 · Đọc `services/{nurse.service,axiosInstance}.ts`, `routes/nurse/*`, `controllers/nurse/*`, `middlewares/auth.middleware.js`, `models/*`. Không sửa.

## Frontend service — tổng quan

| Mục | Hiện trạng |
|---|---|
| Base URL | `axiosInstance`: `VITE_API_BASE_URL || http://localhost:5000/api` |
| Axios instance | Dùng chung; timeout 10s; header JSON |
| Token | Interceptor gắn `Authorization: Bearer <localStorage.token>` |
| 401 | Interceptor: xóa token/user → `window.location='/login'` |
| Query params | `getQueue({date,status})`, `getQueueEntries({status})` — build object |
| Request body | createDraft/update: object field cụ thể; submit/resubmit: PATCH không body |
| Response mapping | `res.data.data` (bóc envelope) |
| Error handling | Service **không catch** → ném lên component; component `try/catch` → toast/error state. **Không nuốt lỗi** |
| Abort request | ❌ Không có `AbortController` — đổi filter nhanh có thể race response cũ |
| Loading state | Có ở từng page (useState) |
| Cache | ❌ Không có (không react-query); refetch bằng `load()` |
| Refetch | Cục bộ sau mutation; **không invalidate chéo trang** |
| Type/interface | `types/index.ts` Nurse* — phần lớn khớp; **`NurseRevisionItem` lệch (P1.1)** |
| Fallback mock | ❌ Không có (tốt) |
| Gọi API trùng | `getQueue` vs `getQueueEntries` — **2 khái niệm hàng đợi** (không trùng call, trùng ý niệm) |

## Backend — tổng quan

- **Guard chung:** `routes/nurse/index.js` → `verifyToken` + `requireRole('nurse')` cho **toàn bộ** `/api/nurse/*`. ✅
- **Validation:** thủ công trong controller (kiểm `chan_doan`, `ten_benh_nhan`, `so_dien_thoai`…); **không có middleware validate** (express-validator/joi). ⚠️
- **Whitelist field:** createDraft/update destructure field cụ thể → an toàn mass-assignment. ✅
- **Response format:** `ok/created/fail` → `{success, message, data}`. ✅ nhất quán.
- **Error code:** 400/403/404/409/500 dùng hợp lý.
- **Transaction:** ❌ luồng hồ sơ không có (booking có session).
- **Logging:** `NhatKyThaoTac` cho queue/room-status; **KHÔNG cho medical-records & checkin**. ⚠️
- **Pagination:** ❌ không có ở mọi endpoint nurse.
- **Sort/filter:** list sort `gio_kham`; filter theo `nurse_id`/`status`/`ngay_kham`.
- **Index/performance:** ⚠️ **`LichHen` KHÔNG có index trên `nurse_id`** (các query nurse lọc `nurse_id` dựa vào index `ngay_kham` rồi lọc thêm). **`KetQuaKham` không có index trên `nguoi_nhap_id`/`bac_si_phu_trach_id`/`status`** → dashboard/list quét collection. Dữ liệu nhỏ nên chưa thấy chậm, nhưng là nợ kỹ thuật.

## Bảng đối chiếu theo chức năng

| Chức năng | Frontend service | Endpoint thực tế | Backend xử lý | Đúng quyền? | Vấn đề |
|---|---|---|---|---|---|
| Dashboard | `getDashboard` | `GET /nurse/dashboard` | `dashboard.getDashboard` — LichLamViec/LichHen(nurse_id)/KetQuaKham(nguoi_nhap_id) | ✅ token | Ngữ nghĩa số sai (PROMPT 6); index thiếu |
| Ca được phân công | (trong dashboard) | (không endpoint riêng) | `bac_si_ho_tro` từ LichLamViec.nurse_id | ✅ | Chỉ hôm nay; thiếu giờ ca (PROMPT 7) |
| Danh sách lịch hẹn | `getQueue` | `GET /nurse/appointments` | `listQueue` gate `LichHen.nurse_id` | ✅ | Không phân trang/tìm kiếm; thiếu cột hồ sơ (PROMPT 8) |
| Chi tiết lịch hẹn | `getAppointmentById` | `GET /nurse/appointments/:id` | `getById` gate `nurse_id` | ✅ ownership | SĐT thiếu fallback (PROMPT 10) |
| Check-in | `checkinQueue` | `POST /nurse/queue/checkin` | `queue.checkin` gate ca | ✅ nhưng **UI chưa gọi** | Không nối UI; không audit; race→500 (PROMPT 9) |
| (Gọi/vào phòng/kết thúc/bỏ/hủy) | `call/intoRoom/finish/skip/cancel Queue` | `PATCH /nurse/queue/:id/*` | `queue.*` gate ca | ✅ **UI chưa gọi** | Dead-in-UI; `cancel` set LichHen=cancelled (P2 review) |
| Trạng thái phòng | `getRoomStatus`/`updateRoomStatus` | `GET/PATCH /nurse/room-status[/:doctorId]` | `room-status.*` gate ca | ✅ **UI chưa gọi** | Dead-in-UI |
| Hồ sơ cần nhập | (lọc từ list/detail) | (không endpoint riêng) | — | — | Nên là bộ lọc |
| Tạo hồ sơ / Lưu nháp | `createDraft` | `POST /nurse/medical-records` | `createDraft` gate ca+HangDoi | ⚠️ | **Ép HangDoi → 409 (P0.2)** |
| Cập nhật nháp | `updateRecord` | `PATCH /nurse/medical-records/:id` | `update` gate `nguoi_nhap_id` | ✅ | Không ghi `lich_su_sua` |
| Gửi bác sĩ | `submit` | `PATCH /nurse/medical-records/:id/submit` | `submit` → cho_xac_nhan + LichHen | ✅ | Không transaction |
| Danh sách cần chỉnh sửa | `getRevisions` | `GET /nurse/medical-records/revisions` | `listRevisions` | ✅ | **Luôn rỗng (luồng gỡ)**; response thiếu `appointment_id` (P1.1) |
| Sửa hồ sơ | `updateRecord` | `PATCH /nurse/medical-records/:id` | `update` (ban_nhap/yeu_cau_chinh_sua) | ✅ | Như trên |
| Gửi lại | `resubmit` | `PATCH /nurse/medical-records/:id/resubmit` | `resubmit` (từ yeu_cau_chinh_sua) | ✅ | Không kích hoạt được (PROMPT 12) |
| Xem hồ sơ đã xác nhận | `getAppointmentById` (embed) / `getById(record)` | `GET /nurse/appointments/:id` / `GET /nurse/medical-records/:id` | trả ket_qua | ✅ | — |
| Profile | ❌ không có service | ❌ không có endpoint | — | — | **Thiếu hoàn toàn** |

**Type ↔ response cần soi:** service khai kiểu nhưng **không kiểm tra runtime** (`res.data.data as T`) → `NurseRevisionItem` lệch không bị bắt lúc build (P1.1). `submit/resubmit` service khai trả `{id,status,appointment_status}` nhưng controller chỉ trả `{id,status}` → `appointment_status` **luôn undefined** (mismatch nhỏ).

## Đề xuất contract chuẩn hóa (KHÔNG sửa code — chỉ đặc tả)

**1. Envelope thống nhất (giữ nguyên chuẩn hiện có):**
```
Thành công: { success: true, message: string, data: T }
Lỗi:        { success: false, message: string }   // + (tùy) code, errors[]
```

**2. Danh sách có phân trang (chuẩn hóa cho list/queue):**
```
GET /nurse/appointments?date&status&q&page&limit
data: { items: NurseQueueItem[], total, page, limit }
```
(`q` = tìm theo tên/`ma_lich_hen`; thêm khi dữ liệu hỗ trợ — đã có `ho_ten`/`ma_lich_hen`.)

**3. Chuẩn field response — sửa 2 mismatch:**
- `GET /nurse/medical-records/revisions` → **thêm `appointment_id`** (khớp `NurseRevisionItem`), hoặc bỏ trang nếu chọn "gỡ revision".
- `submit/resubmit` → trả đúng `{id, status, appointment_status}` hoặc sửa type bỏ `appointment_status`.

**4. Thống nhất "hàng đợi": một khái niệm** — hoặc `GET /nurse/appointments` (LichHen), hoặc `GET /nurse/queue` (HangDoi), không để service phơi cả hai gây nhầm.

**5. Bổ sung (khi triển khai):** `AbortController` cho request theo filter; index `LichHen.nurse_id`, `KetQuaKham.{nguoi_nhap_id,bac_si_phu_trach_id,status}`; transaction cho `submit`; audit `NhatKyThaoTac` cho medical-records + checkin.

**6. Endpoint còn THIẾU (chỉ liệt kê, chưa thêm):** `GET/PATCH /nurse/profile` (nếu quyết định làm Profile).

*Chỉ phân tích + đặc tả contract, chưa sửa code, chưa thêm endpoint.*
