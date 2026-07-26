# PROMPT 27 — Báo cáo khóa hồ sơ sau khi bác sĩ xác nhận (Y tá)

> Ngày: 2026-07-19 · Nhánh `Bac_si`. Hồ sơ `da_xac_nhan` → chỉ đọc với y tá (FE + BE). Không thêm cơ chế mở khóa.

## Bối cảnh
Phần lớn logic khóa đã có sẵn từ các prompt trước (PROMPT 22/24/25). PROMPT 27 rà lại **cả FE và BE**, bịt 2 khoảng trống còn lại:
1. `getById` chưa trả **người/thời điểm xác nhận** → FE không hiển thị được (yêu cầu FE).
2. Thông báo lỗi 409 khi `da_xac_nhan` còn chung chung.

## Thay đổi

| File | Thay đổi |
|---|---|
| `backend/.../nurse/appointments.controller.js` | `getById`: `populate('nguoi_xac_nhan_id','ho_ten')`; thêm `thoi_diem_xac_nhan` + `nguoi_xac_nhan` vào payload `ket_qua` (chỉ đọc) |
| `backend/.../nurse/medical-records.controller.js` | `update` + `submitForDoctorConfirm`: khi `status==='da_xac_nhan'` trả **message rõ ràng** ("Hồ sơ đã được bác sĩ xác nhận — không thể chỉnh sửa / gửi lại"), giữ mã **409**. Trạng thái luôn đọc TƯƠI từ DB (`findOne`), không tin FE |
| `frontend/.../types/index.ts` | `NurseMedicalRecord`: thêm optional `thoi_diem_xac_nhan?`, `nguoi_xac_nhan?` (chỉ đọc) |
| `frontend/.../pages/nurse/NurseAppointmentDetail.tsx` | Banner `da_xac_nhan`: đổi thành khối 2 dòng — dòng 1 "đã xác nhận, chỉ xem", dòng 2 hiển thị **Người xác nhận + thời điểm** nếu dữ liệu có |

## Đáp ứng yêu cầu

### Frontend (đã đạt)
- **Không hiện nút sửa / gửi lại** ✅ — nút "Cập nhật" và "Gửi bác sĩ" nằm trong `{isEditable && (...)}`; `isEditable=false` khi `da_xac_nhan`.
- **Hiển thị trạng thái đã xác nhận** ✅ — Badge xanh "Đã xác nhận" + banner.
- **Hiển thị thời gian/người xác nhận nếu dữ liệu có** ✅ — **mới thêm** (từ `nguoi_xac_nhan` + `thoi_diem_xac_nhan`; ẩn nếu null).
- **Form read-only** ✅ — mọi input/textarea có `readOnly={!isEditable}`.

### Backend (đã đạt)
- **Từ chối request sửa** ✅ — `update` guard status ∉ {ban_nhap, yeu_cau_chinh_sua} → 409.
- **Từ chối request gửi lại** ✅ — `resubmit` allowedFrom = {yeu_cau_chinh_sua}; `da_xac_nhan` → 409.
- **Kiểm tra trạng thái mới nhất trong DB** ✅ — `findOne(...)` đọc bản ghi tươi ngay trong request (submit/resubmit đọc trong transaction).
- **Không tin trạng thái do FE truyền** ✅ — FE không gửi `status`; server tự đọc.
- **Trả mã lỗi phù hợp** ✅ — **409 Conflict** (xung đột trạng thái) + message cụ thể.
- **Không cho update qua endpoint chung** ✅ — chỉ có `PATCH /:id` (guarded), `POST /` (createDraft chặn `exists` → không tạo đè hồ sơ đã có), `/:id/submit|/:id/resubmit` (guarded). Không endpoint nào bỏ qua guard.

### Không mở khóa
- ✅ Không thêm cơ chế mở khóa / bỏ qua. Sửa hồ sơ đã xác nhận (nếu cần) là nghiệp vụ quyền cao hơn, **nằm ngoài prompt này** — không đụng tới.

## Kiểm thử
- **Backend** `node --check` (2 controller) → OK.
- **Frontend** type-check → **110 lỗi/3 file = baseline**, 0 lỗi mới (lỗi cũ ở `mock/doctor-appointments`, `Profile.tsx`, duplicate identifier trong `types` — không liên quan).
- **Build** `vite build` → ✅ (8.72s).
- **Rà đường ghi** (`grep` routes nurse): 4 endpoint ket_qua_kham đều có guard; `room-status`/`checkin`/`queue` không đụng hồ sơ.

| Kịch bản | Kỳ vọng | Cơ chế |
|---|---|---|
| PATCH sửa hồ sơ `da_xac_nhan` | 409 "đã xác nhận — không thể chỉnh sửa" | `update` guard (DB-fresh) |
| PATCH `/submit` hồ sơ `da_xac_nhan` | 409 "không thể gửi lại" | allowedFrom |
| POST tạo đè khi đã có hồ sơ | 409 "hồ sơ đã tồn tại" | `exists(hang_doi_id/appointment_id)` |
| FE mở hồ sơ `da_xac_nhan` | Không nút, form read-only, banner + người/giờ xác nhận | `isEditable=false` |
| FE giả mạo status để lộ nút | BE vẫn 409 | không tin FE, đọc DB |

- **Chưa chạy live** (ghi DB / bấm UI thật) — cần server + hồ sơ ở trạng thái `da_xac_nhan` (seed, Bước 17). Hiện DB có 4 KetQuaKham `da_xac_nhan` (dữ liệu cũ, appointment-only) để xem chế độ read-only.

## Rủi ro & ghi nhận
- **Rủi ro thấp.** Không đổi schema, không thêm field DB; chỉ đọc thêm 2 field có sẵn (`nguoi_xac_nhan_id`, `thoi_diem_xac_nhan`) + siết message.
- **Không đụng doctor page** — luồng bác sĩ set `da_xac_nhan` + `nguoi_xac_nhan_id`/`thoi_diem_xac_nhan` là phần bác sĩ (ngoài phạm vi). Nếu bác sĩ CHƯA ghi 2 field này khi xác nhận thì banner chỉ hiện dòng "đã xác nhận" (ẩn người/giờ) — không lỗi. *(Cần xác nhận luồng doctor có set 2 field không — chỉ để hiển thị đầy đủ; không bắt buộc cho việc khóa.)*
- Field model `co_the_sua` (Boolean) tồn tại nhưng **không dùng làm khóa** — khóa dựa trên `status` (nguồn sự thật của state machine), tránh phụ thuộc cờ có thể lệch.

## Vấn đề còn tồn
- Kiểm chứng luồng doctor có set `nguoi_xac_nhan_id`/`thoi_diem_xac_nhan` (chỉ ảnh hưởng hiển thị, không ảnh hưởng khóa).
- Full UI test chờ seed (Bước 17).
