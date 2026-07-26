# Bug fix — Trang "Hồ sơ cần chỉnh sửa" (Y tá) hỏng nút Chỉnh sửa

> Ngày: 2026-07-20 · Nhánh `Bac_si` · Debug theo systematic-debugging (tìm root cause trước khi sửa).

## 1. Triệu chứng
Trang **Y tá → "Hồ sơ cần chỉnh sửa"** (`NurseRevisions.tsx`) lỗi chức năng: bấm **"Chỉnh sửa hồ sơ"** không mở đúng hồ sơ; ngày khám và tên bác sĩ hiển thị `—`, lý do khám không hiện.

## 2. Root cause (đã reproduce trên dữ liệu thật)
Contract **backend ↔ frontend lệch**:

- FE type `NurseRevisionItem` + component dùng: `appointment_id`, `ngay_kham`, `bac_si_yeu_cau`, `ly_do_kham` (+ `doctor_revision_note`, `thoi_diem_yeu_cau`, `benh_nhan`).
- Backend `GET /api/nurse/medical-records/revisions` (`listRevisions`) **chỉ trả**: `id, hang_doi_id, benh_nhan, doctor_revision_note, thoi_diem_yeu_cau`.

Thiếu **`appointment_id`** ⇒ nút điều hướng `/nurse/appointments/undefined` (hỏng). Thiếu `ngay_kham`/`bac_si_yeu_cau`/`ly_do_kham` ⇒ `formatDate(undefined)` trả `—`, mất thông tin.

Reproduce (chạy đúng query cũ trên hồ sơ A7 `yeu_cau_chinh_sua`): response keys = `id, hang_doi_id, benh_nhan, doctor_revision_note, thoi_diem_yeu_cau` — **không có `appointment_id`**.

> Đây là bug có sẵn (FE cập nhật điều hướng theo `appointment_id` nhưng `listRevisions` chưa cập nhật projection), **không** do dữ liệu seed.

## 3. Fix
`backend/src/controllers/nurse/medical-records.controller.js` → `listRevisions`:
- Trả thêm `appointment_id` (có sẵn trên `KetQuaKham`).
- Join `LichHen` theo `appointment_id` để lấy `ngay_kham`, `ly_do_kham` (và fallback tên khách).
- Populate `lich_su_sua.nguoi_sua_id` → `bac_si_yeu_cau` = người thao tác gần nhất (bác sĩ bấm "Yêu cầu chỉnh sửa").
- Giữ nguyên `benh_nhan` (ưu tiên `hang_doi_id.ten_benh_nhan`) → không đổi hành vi cũ.

## 4. Verify
Gọi trực tiếp hàm `listRevisions` (req/res giả) trên dữ liệu thật:
```
appointment_id = 6a5dc6ff…134  → nút điều hướng /nurse/appointments/6a5dc6ff…134 (hợp lệ)
bac_si_yeu_cau = "BS. Trần Minh Khang (TEST)" · ngay_kham = 2026-07-20 · ly_do_kham = "Mất ngủ"
```
Cả 4 field trước đây thiếu đều có. FE không cần đổi (đã khớp type `NurseRevisionItem`).

## 5. Giới hạn còn lại (không thuộc phạm vi bug này)
- Hồ sơ **offline** (chỉ có `hang_doi_id`, không có `appointment_id`): nút Chỉnh sửa vẫn chưa có đích điều hướng riêng — hiện luồng revision chủ yếu cho ca online. Ghi nhận để xử lý sau nếu có yêu cầu.
