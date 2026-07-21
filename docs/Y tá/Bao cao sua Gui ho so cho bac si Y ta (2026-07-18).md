# PROMPT 25 — Báo cáo sửa Gửi hồ sơ cho bác sĩ xác nhận (Y tá)

> Ngày: 2026-07-18 · Nhánh `Bac_si`. Sửa `submit`/`resubmit` + `handleSubmit`. Không sửa doctor page.

## Thay đổi

| File | Thay đổi |
|---|---|
| `backend/.../medical-records.controller.js` | `submitForDoctorConfirm`: **bọc transaction** (`session.withTransaction`) cho cập nhật `KetQuaKham` + `LichHen` → **nguyên tử** (rollback cả hai nếu lỗi); thêm kiểm `chan_doan` bắt buộc trước khi gửi; trả thêm `appointment_status`. Thêm class `HttpError` + `import mongoose` |
| `frontend/.../NurseAppointmentDetail.tsx` | `handleSubmit`: **guard `saving`** (chống gửi 2 lần) + **chặn gửi khi còn thay đổi chưa lưu** (`dirty` → nhắc Lưu nháp trước) |

## Đáp ứng điều kiện
- Hồ sơ tồn tại ✅ (`findOne` → 404). Thuộc lịch hợp lệ ✅ (`appointment_id` lookup trong transaction). Y tá có quyền ✅ (`nguoi_nhap_id` = người tạo).
- Trạng thái cho phép gửi ✅ (`submit`: `ban_nhap`; `resubmit`: `yeu_cau_chinh_sua`).
- **Dữ liệu bắt buộc hợp lệ** ✅ (thêm kiểm `chan_doan` trước khi gửi — trước đây bỏ sót).
- Hồ sơ chưa xác nhận ✅ (`da_xac_nhan` không nằm trong allowedFrom → 409).
- Không request đang chạy ✅ (FE `saving` guard).

## Đáp ứng sau khi gửi
- Trạng thái hồ sơ → `cho_xac_nhan` ✅.
- **Lịch hẹn → `waiting_doctor_confirm`** ✅ (đồng bộ trong CÙNG transaction).
- **Doctor page thấy hồ sơ chờ** ✅ — `listPendingResults` lọc `bac_si_phu_trach_id` (đã gán lúc createDraft) + `cho_xac_nhan`. **KHÔNG cần sửa doctor page** (không có lỗi tích hợp — field đã có sẵn).
- Nurse page: hồ sơ chuyển sang giai đoạn **"Đã gửi bác sĩ"** trong danh sách "Hồ sơ cần nhập" (sort xuống cuối, rời khỏi nhóm cần thao tác `chua_tao`/`ban_nhap`). *(Giữ đúng thiết kế 4 giai đoạn của PROMPT 23; refetch cập nhật ngay.)*
- Hồ sơ hạn chế chỉnh sửa ✅ (FE `isEditable=false` khi `cho_xac_nhan`; BE `update` chặn trạng thái ≠ `ban_nhap`/`yeu_cau_chinh_sua`).
- Thông báo thành công ✅. Chống gửi hai lần ✅ (FE guard + BE 409 lần 2).
- **Xử lý lỗi cập nhật giữa appointment & record** ✅ — **transaction**: nếu `LichHen.save` lỗi thì `KetQuaKham` rollback, không còn lệch "hồ sơ cho_xac_nhan mà lịch vẫn waiting_record".
- **Transaction** ✅ — deployment là replica set (đã verify).

## Kiểm thử
- **Backend syntax** `node --check` → OK.
- **Transaction hỗ trợ** (probe read-only): `withTransaction` chạy được → replica set ✅ (submit an toàn runtime).
- **Frontend type-check** → **110 lỗi/3 file = baseline**, 0 lỗi mới. **Build** ✅ (6.25s).
- **Kịch bản (code-enforced):**

| Kịch bản | Hành vi |
|---|---|
| Gửi hợp lệ (`ban_nhap`) | KetQuaKham→`cho_xac_nhan` + LichHen→`waiting_doctor_confirm` (atomic) |
| Gửi hai lần | FE `saving` guard; BE lần 2 từ `cho_xac_nhan` → **409** |
| Hồ sơ đã xác nhận | `da_xac_nhan` ∉ allowedFrom → **409** |
| Thiếu chẩn đoán | **400** "Chẩn đoán là bắt buộc trước khi gửi" |
| Còn thay đổi chưa lưu | FE chặn + nhắc "Lưu nháp trước khi gửi" |
| Lỗi giữa 2 bảng | transaction rollback → không lệch |

- **Chưa chạy live submit** (ghi DB) — cần server + seed (Bước 17).

## Rủi ro & ghi nhận
- **Rủi ro thấp–trung.** Transaction cần replica set — **đã verify hỗ trợ**. `withTransaction` tự retry callback khi transient error; callback đọc lại từ trạng thái đã commit nên không nhân đôi tác dụng.
- **Không sửa doctor page** (đúng ràng buộc — không có lỗi tích hợp bắt buộc; `bac_si_phu_trach_id` + `cho_xac_nhan` đủ để bác sĩ thấy).
- **Diễn giải "chuyển khỏi danh sách cần nhập":** hồ sơ ở lại danh sách nhưng đổi giai đoạn sang "Đã gửi bác sĩ" (thiết kế PROMPT 23). Nếu muốn ẩn hẳn khỏi danh sách sau khi gửi → tinh chỉnh nhỏ ở `pendingRecords` (chờ bạn quyết, vì mâu thuẫn nhẹ với PROMPT 23).

## Vấn đề còn tồn
- Quyết định hiển thị hồ sơ đã gửi trong "cần nhập" (giữ vs ẩn).
- Full UI test chờ seed hôm nay (Bước 17).
