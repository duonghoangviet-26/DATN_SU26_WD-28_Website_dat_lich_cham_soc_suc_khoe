# PROMPT 11 — Phân tích chức năng Nhập hồ sơ khám (Y tá)

> Ngày: 2026-07-18 · Đọc `controllers/nurse/medical-records.controller.js`, `pages/nurse/NurseAppointmentDetail.tsx`, `models/{KetQuaKham,SinhHieuKham}.js`, `utils/validators.js`, `types/index.ts`. Không sửa.

## Ghi chú vai trò chuyên môn (quan trọng)
- Form có **"Chẩn đoán *" (bắt buộc)** + "Hướng dẫn điều trị" — đây là nội dung **chuyên môn của bác sĩ**. Placeholder "Theo kết luận của bác sĩ..." có gợi ý, nhưng **thiếu nhãn/disclaimer rõ ràng** "nhập lại nội dung bác sĩ cung cấp".
- Điểm tốt: `bac_si_phu_trach_id` được set = bác sĩ (trách nhiệm chuyên môn quy về bác sĩ); `trieu_chung_ban_dau` + `ghi_chu_dieu_duong` tách riêng là phần **của y tá** (schema có comment). **Đơn thuốc KHÔNG thuộc luồng y tá** (model `DonThuoc` riêng, form không có) — đúng nghiệp vụ.
- **Khuyến nghị:** thêm nhãn khẳng định "ghi theo kết luận bác sĩ" cho khối chẩn đoán, để bảo vệ được trong đồ án.

## A. Luồng hồ sơ hiện tại (trạng thái thật)

```
Bác sĩ khám xong (finish → LichHen.status=waiting_record; hoặc lịch confirmed)
  → Y tá mở chi tiết (appointments.getById, gate nurse_id)
  → createDraft → KetQuaKham.status='ban_nhap'      ⚠️ HIỆN 409 nếu không có HangDoi (P0.2)
  → update (khi 'ban_nhap'/'yeu_cau_chinh_sua')
  → submit → status='cho_xac_nhan' + LichHen.status='waiting_doctor_confirm'   [KHÓA sửa]
  → Bác sĩ:
       • Xác nhận  → status='da_xac_nhan' + LichHen='completed'   [KHÓA vĩnh viễn]
       • Yêu cầu sửa → status='yeu_cau_chinh_sua' + doctor_revision_note   [MỞ lại]
            → update → resubmit → 'cho_xac_nhan' (quay vòng)
```
Ràng buộc: `update` chỉ khi `∈{ban_nhap, yeu_cau_chinh_sua}`; `submit` chỉ từ `ban_nhap`; `resubmit` chỉ từ `yeu_cau_chinh_sua`. Sở hữu: `update/getById(record)` gate `nguoi_nhap_id = req.user.id` (chỉ **y tá tạo** mới sửa được).

## B. Ma trận hành động

| Trạng thái hồ sơ | Y tá xem | Sửa | Gửi | Bị khóa | Hành động tiếp theo |
|---|---|---|---|---|---|
| (chưa có) | — | Tạo mới | — | — | `createDraft` (⚠️ 409) |
| `ban_nhap` | ✅ | ✅ | ✅ `submit` | ✗ | Sửa / Gửi bác sĩ |
| `cho_xac_nhan` | ✅ | ✗ | ✗ | ✅ | Chờ bác sĩ |
| `yeu_cau_chinh_sua` | ✅ | ✅ | ✅ `resubmit` | ✗ | Sửa / Gửi lại |
| `da_xac_nhan` | ✅ | ✗ | ✗ | ✅ | Kết thúc |

FE khớp đúng ma trận này (`isEditable`, ẩn nút khi khóa) — **không rò nút sửa khi khóa**.

## C. Đối chiếu dữ liệu (UI ↔ API ↔ DB)

| Nội dung nghiệp vụ | UI form | API (createDraft/update) | DB (KetQuaKham/SinhHieuKham) | Vấn đề |
|---|---|---|---|---|
| Chẩn đoán | `chanDoan` (required) | `chan_doan` (required, trim) | `chan_doan` (required) | **Không maxlength** → nội dung dài không giới hạn |
| Hướng dẫn điều trị | `huongDan` | `huong_dan_dieu_tri` | `huong_dan_dieu_tri` | Không maxlength |
| Ghi chú bổ sung | `ghiChu` | `ghi_chu` | `ghi_chu` | Không maxlength |
| Triệu chứng ban đầu (y tá) | `trieuChung` | `trieu_chung_ban_dau` | `trieu_chung_ban_dau` | ✅ |
| Ghi chú điều dưỡng (y tá) | `ghiChuDieuDuong` | `ghi_chu_dieu_duong` | `ghi_chu_dieu_duong` | ✅ |
| Ngày tái khám | `ngayTaiKham` (min=+1) | `ngay_tai_kham` (validate > ngày khám) | `ngay_tai_kham` | ✅ (FE+BE cùng chặn) |
| Sinh hiệu (HA/mạch/nhiệt/cân/cao) | 5 input | `sinh_hieu{...}` | `SinhHieuKham` | ✅ |

**Field DB có nhưng UI/nurse KHÔNG nhập:** `dich_vu_phat_sinh`, `dich_vu_tu_choi`, `chi_dinh_tai_kham`(bool), `da_dat_lich_tai_kham`, `da_gui_cho_benh_nhan`, `co_the_sua`, `lich_su_sua` (do **bác sĩ** ghi). Đơn thuốc = model `DonThuoc` riêng (không thuộc y tá). → Đa số **đúng nghiệp vụ** (thuộc bác sĩ).

**Field UI có nhưng backend KHÔNG lưu:** **không có** — `createDraft`/`update` destructure đúng danh sách field → **an toàn mass-assignment** (không thể set `status`/`nguoi_xac_nhan_id`/... qua body).

**Field quan trọng THIẾU nghiệp vụ:** (a) **`ngayTaiKham` đặt được nhưng cờ `chi_dinh_tai_kham` không set** → không phân biệt "có chỉ định tái khám"; (b) **sửa của y tá không ghi `lich_su_sua`** (chỉ bác sĩ ghi) → thiếu vết y tá sửa; (c) đính kèm file (X-quang…) — **không có** (nếu đề tài cần).

## D. Danh sách lỗi (P0–P3)

**P0**
- **P0.2** `createDraft` ép resolve `HangDoi` → **409 "chưa check-in vào hàng đợi"** cho lịch không có HangDoi. Dữ liệu thật: **7/7 hồ sơ hiện có là appointment-only** ⇒ code hiện tại không tạo nổi chúng → regression chặn chức năng lõi. *(File: `medical-records.controller.createDraft`)*
- **P0.1** (gốc) `nurse_id` null → `appointments.getById` 404 → **không mở được chi tiết để nhập** hôm nay.

**P1**
- **P1.2** Gate xem (`appointments` dùng `nurse_id`) ≠ gate lưu (`medical-records` dùng `HangDoi`/`getMyDoctorIdsToday`) → xem được nhưng lưu 409.
- **Ownership `nguoi_nhap_id`**: y tá thứ 2 (cùng ca) mở được chi tiết nhưng `update` → 404 "không thuộc bạn" → khó hiểu khi 2 y tá luân ca. *(cân nhắc cho phép theo ca thay vì theo người tạo)*

**P2**
- Thiếu nhãn khẳng định "nhập theo kết luận bác sĩ" ở khối chẩn đoán (rủi ro trách nhiệm chuyên môn).
- Không set `chi_dinh_tai_kham` dù nhập ngày tái khám.
- Sửa của y tá không ghi `lich_su_sua` (thiếu audit nội dung).
- **Cho nhập hồ sơ khi lịch mới `confirmed` (chưa thực khám)** — không chặn theo bước `waiting_record`; tùy nghiệp vụ nhưng dễ nhập sớm.

**P3**
- Không maxlength các text field → nội dung dài không giới hạn (DB bloat).
- **Không cảnh báo "thay đổi chưa lưu"** khi rời trang/reload → mất dữ liệu thầm lặng.
- Không auto-save.
- Hai tab/hai thiết bị: last-write-wins (không optimistic lock); backend guard status cứu phần lớn (409 nếu trạng thái đổi).
- Sinh hiệu nhập số: cast NaN nếu gõ lạ (FE type=number giảm rủi ro).
- Race "nhấn tạo 2 lần": unique index cứu toàn vẹn nhưng có thể trả 500 thay vì 409.

**Đánh giá an toàn (điểm tốt, không phải lỗi):**
- Mass-assignment: an toàn (whitelist field). ✅
- XSS: React auto-escape khi render → hiển thị an toàn (không `dangerouslySetInnerHTML`); backend không sanitize nhưng rủi ro thấp. ✅
- Gửi thiếu dữ liệu: FE + BE cùng bắt buộc `chan_doan`. ✅
- Gửi 2 lần: chặn bằng `allowedFromStatuses` + disable nút. ✅
- Khóa sau xác nhận: FE ẩn nút + BE 409. ✅
- Mất mạng: axios timeout 10s → toast lỗi. ✅

## Kế hoạch sửa (ưu tiên)
1. **P0.2** — `createDraft` cho phép neo `appointment_id` khi không có HangDoi (khớp 7/7 dữ liệu thật).
2. **P0.1** — set `nurse_id` lúc đặt lịch.
3. **P1.2** — thống nhất gate xem & lưu.
4. **P1** — xét ownership theo ca (nhiều y tá) thay vì chỉ `nguoi_nhap_id`.
5. **P2** — nhãn "nhập theo bác sĩ"; set `chi_dinh_tai_kham`; ghi `lich_su_sua` khi y tá sửa; (tùy) chặn nhập trước `waiting_record`.
6. **P3** — maxlength; cảnh báo unsaved; race→409.

*Chỉ phân tích, chưa sửa code.*
