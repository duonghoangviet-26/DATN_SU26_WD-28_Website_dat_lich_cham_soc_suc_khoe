# Kế hoạch sửa — Bridge tối thiểu: trang Y tá chạy end-to-end nối Bác sĩ

> Ngày: 2026-07-18 · Nhánh: `Bac_si` · Loại: design spec (chốt trước khi viết implementation plan).
> Tiền đề: [Audit - Trang thai thuc te trang Y ta (2026-07-18)]. Hướng đã chốt với người dùng: **Bridge tối thiểu** + **script seed test có tag**.

## 1. Mục tiêu

Trang y tá chạy **end-to-end nối bác sĩ** mà:
- Không cần chạy script backfill thủ công cho từng bác sĩ.
- Không phụ thuộc hệ hàng đợi động `HangDoi` (giữ nguyên dormant cho tương lai).
- Không đổi schema, không thêm trang FE mới.

Cụ thể sau khi sửa: y tá đặt lịch/được phân ca → thấy bệnh nhân ở hàng đợi → mở chi tiết → nhập & lưu hồ sơ → gửi bác sĩ xác nhận → (nếu bị trả) sửa lại. Toàn bộ chạy được **không vướng lỗi 409 "chưa check-in vào hàng đợi"**.

## 2. Phạm vi (chỉ Backend + 1 script)

| # | File | Thay đổi |
|---|---|---|
| A1 | `backend/src/controllers/patient/booking.controller.js` | LichHen.create (clinic): thêm `nurse_id` copy từ schedule đã claim |
| A2 | `backend/src/controllers/receptionist/booking.controller.js` | Tương tự A1 |
| B | `backend/src/controllers/nurse/medical-records.controller.js` → `createDraft` | Bỏ chặn 409; thêm đường "appointment-only" khi không có HangDoi |
| C | `backend/src/controllers/nurse/medical-records.controller.js` → `update` + `upsertVitals` | Fallback mốc thời gian & key vitals theo `appointment_id` khi `hang_doi_id` null |
| S | `backend/src/scripts/seed-nurse-today-test.js` (mới) | Seed idempotent, có tag, tạo dữ liệu test hôm nay |
| T | `backend/src/**/__tests__` hoặc cạnh test sẵn có | Test TDD cho đường createDraft mới |

## 3. Non-goals (KHÔNG làm lần này)

- Không nối hệ HangDoi (checkin/gọi/vào phòng/kết thúc/room-status) vào UI.
- Không gỡ service/endpoint HangDoi (khác với phương án "chốt hệ cũ, gỡ HangDoi").
- Không đồng bộ `nurse_id` cho các lịch đã đặt TRƯỚC khi admin gán y tá vào ca (edge case — ghi nhận ở mục 8, để plan sau).
- Không đổi FE (`NurseAppointmentDetail` đã gửi `appointment_id` sẵn).

## 4. Chi tiết kỹ thuật

### 4.A — Copy `nurse_id` khi đặt lịch
Cả 2 controller đều đã: (1) `LichLamViec.findOneAndUpdate(...)` để claim slot, trả về `updated` (nguyên document ca làm việc, có `nurse_id`); (2) `LichHen.create([{...}])` ngay sau đó.
- Thêm vào payload LichHen.create: `nurse_id: loai_kham === 'clinic' ? (updated?.nurse_id ?? null) : null`.
- Lịch `home` → `nurse_id = null` (không có ca phòng khám). Đúng nghiệp vụ.
- Nếu ca chưa được gán y tá tại thời điểm đặt → `null` (không lỗi). Chấp nhận được.

### 4.B — `createDraft` bỏ ràng buộc HangDoi bắt buộc
Hiện tại: nếu truyền `appointment_id` mà không có HangDoi entry → **409**. Đây là ràng buộc nhân tạo; schema `KetQuaKham` cho phép hồ sơ chỉ gắn `appointment_id` (sparse-unique `appointment_id`/`hang_doi_id`, pre-validate chỉ cần ≥1).

Logic mới:
1. Nếu có `hang_doi_id` (hoặc `appointment_id` **có** HangDoi entry) → **giữ nguyên đường cũ** (`findEntryInShift` + `keysFromEntry`).
2. Nếu chỉ có `appointment_id` và **không** có HangDoi entry → **đường mới "appointment-only"**:
   - Load `appt = LichHen.findById(appointment_id)`; 404 nếu không có.
   - **Phân quyền:** `String(appt.nurse_id) === req.user.id`; else 403 "Lịch hẹn không thuộc ca của bạn". (Cùng gate với `getById`/`listQueue` → thống nhất xem & lưu — mục D.)
   - Chặn trùng: `KetQuaKham.exists({ appointment_id })` → 409 "Hồ sơ đã tồn tại".
   - Chặn trạng thái: nếu `appt.status ∈ [cancelled, no_show]` → 409.
   - `chan_doan` bắt buộc (giữ nguyên). `ngay_tai_kham` validate với mốc = `appt.ngay_kham`.
   - Tạo `KetQuaKham.create({ appointment_id, nguoi_nhap_id: req.user.id, bac_si_phu_trach_id: appt.doctor_id, status: 'ban_nhap', ...fields })` (KHÔNG set `hang_doi_id`).
   - Vitals: `upsertVitals` theo `appointment_id` + `member_id: appt.member_id`.

Tách nhánh gọn: rút phần đọc-nguồn (entry vs appt) thành object chung `{ authGate, doctorId, memberId, refTime, keys }` để `create` dùng một đường.

### 4.C — `update` + `upsertVitals` fallback
- `update`: hiện `HangDoi.findById(result.hang_doi_id)` để lấy `checkin_time`. Khi `result.hang_doi_id` null → dùng `LichHen.findById(result.appointment_id)` lấy `ngay_kham` làm mốc validate ngày tái khám.
- `upsertVitals`: hiện key cứng `{ hang_doi_id: entry._id }`. Sửa nhận **nguồn linh hoạt**: nếu có entry → key `hang_doi_id`; nếu appointment-only → key `{ appointment_id }` + set `appointment_id`, `member_id` từ appt.

### 4.S — Script seed test hôm nay
`backend/src/scripts/seed-nurse-today-test.js` — chạy `node src/scripts/seed-nurse-today-test.js` từ `backend/`.
- **Tag nhận dạng:** `ghi_chu`/`ly_do_kham` chứa `SEED-NURSE-TODAY` để lọc & xóa.
- Idempotent: `deleteMany` theo tag trước khi tạo lại.
- Việc làm:
  1. Tìm y tá "Điều dưỡng Thanh Hà" + bác sĩ `doctor.test`.
  2. Gán `nurse_id` cho `LichLamViec` của doctor.test **hôm nay** (tạo ca nếu chưa có, thêm 1 slot).
  3. Tạo 1 `LichHen` clinic **hôm nay**, `status='confirmed'`, `payment_status='paid'`, `nurse_id` = y tá trên, member có bệnh nền/dị ứng (để test hiển thị cảnh báo).
- **In rõ** id đã tạo + cách xóa. Không đụng dữ liệu khác.
- Kèm script `unseed`/cờ `--clean` để gỡ (hoặc hướng dẫn `deleteMany` theo tag).

### 4.T — Test (TDD, viết trước)
Trước khi sửa 4.B, viết test đỏ:
- `createDraft`: body `{ appointment_id, chan_doan }`, DB **không** có HangDoi entry cho lịch đó, lịch có `nurse_id = y tá gọi API` → kỳ vọng **201** + `KetQuaKham` có `appointment_id`, `hang_doi_id` null, `status='ban_nhap'`, `bac_si_phu_trach_id = appt.doctor_id`.
- Ca 403: lịch có `nurse_id` khác → 403.
- Ca 409 trùng: đã có hồ sơ cho appointment → 409.
- Chạy thấy đỏ (vì code hiện trả 409 "chưa check-in") → sửa → xanh. Không phá test HangDoi cũ (đường entry vẫn chạy).

## 5. Tiêu chí nghiệm thu

1. Đặt 1 lịch clinic mới (UI bệnh nhân) cho bác sĩ có ca đã gán y tá → LichHen có `nurse_id` đúng.
2. Đăng nhập y tá → `NurseQueue` (tab hôm nay) hiện lịch đó; Dashboard đếm đúng.
3. Mở chi tiết → nhập chẩn đoán → **Lưu nháp thành công** (không 409) → hồ sơ `ban_nhap`.
4. Bấm **Gửi bác sĩ xác nhận** → `LichHen.status='waiting_doctor_confirm'`, `KetQuaKham.status='cho_xac_nhan'`.
5. Bác sĩ thấy hồ sơ ở "Hồ sơ chờ xác nhận"; yêu cầu chỉnh sửa → y tá thấy ở `/nurse/revisions` → sửa → gửi lại.
6. Toàn bộ test (cũ + mới) xanh.

## 6. Thứ tự triển khai đề xuất
T (test đỏ) → B → C → A1/A2 → S (seed) → chạy test xanh → verify UI thủ công theo mục 5.

## 7. Rủi ro & giảm thiểu
- **DB Cloud dùng chung:** seed có tag + idempotent + hướng dẫn xóa; không đụng bản ghi khác.
- **Tương thích hệ HangDoi:** đường entry giữ nguyên, chỉ THÊM nhánh appointment-only → không phá luồng offline/hàng đợi hiện có (test cũ bảo vệ).
- **Không commit tự động** (theo yêu cầu người dùng — git-history đồ án).

## 8. Ghi nhận cho plan sau (ngoài phạm vi)
- Đồng bộ `nurse_id` vào các LichHen đã đặt khi admin gán y tá cho ca SAU đó.
- Chốt một hệ duy nhất về lâu dài (nối HangDoi vào UI hoặc gỡ) — xem audit mục 5.

---
*Spec để chốt. Chưa sửa code. Sau khi người dùng duyệt → chuyển sang writing-plans tạo checklist triển khai.*
