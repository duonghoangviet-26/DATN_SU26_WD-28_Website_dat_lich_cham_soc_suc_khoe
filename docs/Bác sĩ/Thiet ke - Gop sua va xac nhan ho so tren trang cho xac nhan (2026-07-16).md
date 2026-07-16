# Thiết kế — Gộp sửa + xác nhận hồ sơ vào trang "Hồ sơ chờ xác nhận"

> Ngày: 2026-07-16 · Nhánh: `Bac_si`
> Trạng thái: **ĐÃ TRIỂN KHAI** (TDD) — xem mục 7 "Kết quả triển khai" ở cuối.

## 1. Bối cảnh & vấn đề

Luồng xác nhận kết quả khám (B4) hiện có 2 điểm bất hợp lý:

1. Trang **"Hồ sơ chờ xác nhận"** (`DoctorPendingRecords.tsx`) chỉ **xem** (`:319-329`, chỉ nút "Chi tiết"). Nút xác nhận thật lại nằm ở trang Lịch hẹn (`DoctorAppointments.tsx:690-703`) → thao tác rời rạc, sai kỳ vọng theo tên trang.
2. Bác sĩ muốn sửa hồ sơ y tá nhập thì phải **"Yêu cầu chỉnh sửa"** đẩy ngược về y tá (`requestResultRevision`, `appointments.controller.js:421`) → vòng lặp qua lại chậm.
3. Hồ sơ chỉ hiển thị **tên bệnh nhân** — thiếu thông tin lâm sàng (dị ứng/bệnh nền/tuổi/giới) để bác sĩ chẩn đoán & kê thuốc an toàn.

## 2. Quyết định (đã chốt với người dùng)

- **Gộp** sửa + xác nhận vào modal ngay trên trang "Hồ sơ chờ xác nhận".
- **Bỏ** luồng "Yêu cầu chỉnh sửa" (đẩy về y tá). Bác sĩ **sửa trực tiếp** khi xem.
- Thao tác: **1 nút "Lưu & Xác nhận"** (lưu chỉnh sửa + chốt `da_xac_nhan` trong 1 lần).
- **Trích** `ExamResultModal` ra component dùng chung → 2 trang cùng 1 logic.
- Hiển thị **khối thông tin bệnh nhân đầy đủ** (dị ứng/bệnh nền nổi bật).
- Hồ sơ **bác sĩ tự nhập** giữ nguyên vào thẳng `da_xac_nhan` — **ngoài phạm vi**.

## 3. Thiết kế backend

### 3.1 Gộp lưu + xác nhận (atomic)
- Trích helper nội bộ `applyResultEdits(result, body, appt, docId)` chứa toàn bộ logic sửa hiện có trong `updateResult` (validate `ngay_tai_kham` qua `isNgayTaiKhamHopLe`, upsert/xóa `DonThuoc`).
- `updateResult()` gọi helper (giữ nguyên hành vi).
- `confirmResult()` nhận thêm **body chỉnh sửa (optional)**: nếu có → gọi `applyResultEdits` rồi set `da_xac_nhan` + push `lich_su_sua`, trong cùng 1 `save()`. Không còn trạng thái nửa vời, không trùng lặp validate.

### 3.2 Hardening (H1) — ValidationError → 400
- Schema `DonThuoc` đã validate (`ten_thuoc` bắt buộc, `so_ngay` 1–90, `gio_uong` `HH:MM`, `items` 1–10). Nhưng controller đang bắt bằng `catch → fail(res, 500)` → API trả **500 thô** khi gọi trực tiếp bỏ qua UI.
- Sửa: trong `applyResultEdits`/`confirmResult`/`createResult`/`updateResult`, bắt riêng `err.name === 'ValidationError'` → **400** kèm message gọn.

### 3.3 Gỡ requestResultRevision
- Xóa route `PATCH /doctor/appointments/:id/result/request-revision` + controller export.
- **Giữ** giá trị enum `yeu_cau_chinh_sua` trong `KetQuaKham` schema (dữ liệu cũ).
- **Không** đụng code y tá (`nurse/medical-records.controller.js`) — đang phát triển dở.

### 3.4 Thông tin bệnh nhân
- Không đổi backend — `formatAppointment()` (`:30-55`) đã trả `tuoi/gioi_tinh/so_dien_thoai/di_ung/benh_nen/ly_do_kham`. Modal gọi `getById(appointment_id)`.

## 4. Thiết kế frontend

### 4.1 Trích `components/doctor/ExamResultModal.tsx`
Từ khối inline `DoctorAppointments.tsx:~60-284`. Bổ sung:
- **Khối "Thông tin bệnh nhân"** đầu modal (read-only): tuổi · giới tính · SĐT · lý do khám · **dị ứng/bệnh nền tô đỏ nổi bật** · triệu chứng y tá ghi (`trieu_chung_ban_dau`).
- Prop `mode`:
  - `'edit'` (trang Lịch hẹn): giữ nút "Lưu kết quả/Cập nhật".
  - `'confirm'` (trang chờ, status `cho_xac_nhan`): nút chính **"Lưu & Xác nhận"**.
  - Hồ sơ `da_xac_nhan`: read-only (chỉ xem, không nút sửa/xác nhận).
- **H2**: lọc bỏ dòng thuốc rỗng hoàn toàn trước khi gửi.

### 4.2 Viết lại `DoctorPendingRecords.tsx`
- Thay `RecordViewModal` bằng `ExamResultModal` mode `confirm`.
- Mở row → fetch song song `getById` + `getByAppointment`.
- Sau "Lưu & Xác nhận" → reload danh sách (row rời `cho_xac_nhan`).

### 4.3 `DoctorAppointments.tsx`
- **Bỏ** nút "Xác nhận hồ sơ" / "Yêu cầu chỉnh sửa" (`:690-703`) + `ReasonModal` yêu cầu chỉnh sửa + handler.
- Giữ "Xem hồ sơ" và luồng bác sĩ tự nhập kết quả (mode `edit`).
- Dùng `ExamResultModal` đã trích.

## 5. Ma trận kiểm thử (28 case — góc hội đồng bắt bẻ)

| # | Trường hợp | Kỳ vọng |
|---|---|---|
| **Phân quyền** | | |
| 1 | Bác sĩ A xác nhận hồ sơ bác sĩ B | 404 (đã đạt) |
| 2 | Role `user`/`nurse` gọi confirm | 403 |
| 3 | Không/không hợp lệ token | 401 |
| 4 | `getById` lịch hẹn không thuộc mình (lộ dị ứng/bệnh nền) | 404 (đã đạt) |
| **Trạng thái** | | |
| 5 | Xác nhận hồ sơ đã `da_xac_nhan` | 409 |
| 6 | Xác nhận hồ sơ `yeu_cau_chinh_sua` (data cũ) | 409 |
| 7 | Xác nhận hồ sơ `ban_nhap` | Không hiện list + confirm 409 |
| 8 | Xác nhận khi chưa có `KetQuaKham` | 404 |
| **Validate khi Lưu & Xác nhận (API trực tiếp)** | | |
| 9 | `so_ngay = 0` hoặc `> 90` | 400 (cần H1) |
| 10 | Thuốc thiếu `ten_thuoc` | 400 (cần H1) |
| 11 | `gio_uong = "25:99"` sai định dạng | 400 (cần H1) |
| 12 | `ngay_tai_kham` = ngày khám / quá khứ | 400 |
| 13 | `ngay_tai_kham` hợp lệ / null | 200 |
| 14 | `ngay_tai_kham = 2026-07-20` lưu đúng ngày (không lệch -1 UTC) | Đúng ngày |
| 15 | `thuoc = []` (xóa hết đơn) | 200, xóa `DonThuoc`, không mồ côi |
| **Hiển thị / null-safety** | | |
| 16 | Member null → tuổi/giới undefined | "—", không vỡ UI |
| 17 | `di_ung`/`benh_nen = null` | "Không có" |
| 18 | Khách vãng lai (`ten_khach`) | Tên khách đúng |
| **Đồng bộ sau xác nhận** | | |
| 19 | Xác nhận, không dịch vụ phát sinh | Lịch hẹn → `completed`, rời tab Chờ |
| 20 | Xác nhận khi có `dich_vu_phat_sinh` | Không auto-complete |
| 21 | `lich_su_sua` ghi "Bác sĩ xác nhận" (+ nội dung sửa) | Có |
| **Đồng thời / UX** | | |
| 22 | Double-click "Lưu & Xác nhận" | Nút disable; request 2 nhận 409 |
| 23 | Mở hồ sơ `da_xac_nhan` | Read-only, field khóa |
| 24 | Mất mạng giữa chừng | Toast lỗi, nút không kẹt |
| 25 | Không còn hồ sơ chờ | Empty state rõ |
| **Regression** | | |
| 26 | Lịch hẹn: bác sĩ tự nhập kết quả (mode edit) | Như cũ |
| 27 | Dashboard đếm hồ sơ chờ xác nhận | Đúng như cũ |
| 28 | Không còn nút/route "Yêu cầu chỉnh sửa" chết | Đã gỡ sạch |

## 6. Ripple đã cân nhắc

- Tab "Cần chỉnh sửa" phía y tá sẽ không còn hồ sơ mới (do bỏ đẩy ngược) — chấp nhận, xử lý khi làm module y tá.
- Trang Lịch hẹn mất nút xác nhận là **chủ đích** (một nguồn duy nhất).
- Ngõ cụt sửa-lại của hồ sơ bác sĩ tự nhập (GAP-001) vẫn còn — ngoài phạm vi, ghi nhận.

## 7. Kết quả triển khai (2026-07-16)

### Backend
- `controllers/doctor/appointments.controller.js`: trích helper `applyResultEdits()` (dùng chung `updateResult` + `confirmResult`); `confirmResult()` nhận kèm body chỉnh sửa → "Lưu & Xác nhận" atomic + ghi `lich_su_sua` phân biệt có/không sửa; **H1** bắt `ValidationError` → 400 ở `createResult`/`updateResult`/`confirmResult`; gỡ `requestResultRevision`.
- `routes/doctor/appointments.routes.js`: gỡ route `PATCH /:id/result/request-revision`.

### Frontend
- **Mới** `components/doctor/ExamResultModal.tsx`: modal dùng chung + khối "Thông tin bệnh nhân" (dị ứng/bệnh nền tô đỏ, tuổi/giới/SĐT/lý do khám/triệu chứng y tá) + prop `mode` (`edit`/`confirm`) + nút "Lưu & Xác nhận" + banner lỗi.
- **Mới** `utils/prescription.ts`: `stripEmptyDrugs()` (H2).
- `pages/doctor/DoctorPendingRecords.tsx`: viết lại — mở modal `confirm` (fetch `getById` lấy thông tin bệnh nhân), nút "Xử lý"/"Chi tiết", reload sau xác nhận.
- `pages/doctor/DoctorAppointments.tsx`: gỡ modal inline + nút Xác nhận/Yêu cầu chỉnh sửa + handler; dùng `ExamResultModal` mode `edit`.
- `services/doctor-appointment.service.ts`: `confirmResult(id, payload?)` gửi body; gỡ `requestResultRevision`.
- `types/index.ts`: thêm `ExamResultEditPayload`; thêm `trieu_chung_ban_dau`/`ghi_chu_dieu_duong` vào `ExaminationResult`.

### Kiểm thử
- **Backend** (mới `tests/doctor.confirm-result.test.js`, self-contained tạo/xóa fixture trên Cloud): 14/14 pass — phủ toàn bộ ma trận (confirm-kèm-sửa, 409 trạng thái, 404 phân quyền cross-doctor, 403 role, 401, H1 400 cho so_ngay/ten_thuoc/gio_uong, 400 ngày tái khám trùng, xóa đơn, route revision đã gỡ). `doctor.api` 15/15, `doctor.leave-sync` 6/6, `doctor.schedule` 14/14, `admin.medical-read` 1/1 — không hồi quy.
- **Frontend**: 42/42 pass (thêm `doctor-appointment.service.test.ts`, `prescription.test.ts`); `tsc` sạch trên file đã sửa (lỗi còn lại chỉ ở `src/mock/*` legacy — có sẵn); `eslint` sạch.
- Fixture test tự dọn sạch trên Cloud (0 orphan).
- **Chưa** kiểm thử giao diện tự động bằng trình duyệt (không có công cụ automation trong phiên) — cần bác sĩ bấm thử trực tiếp trên UI.
