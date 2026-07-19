# PROMPT 10 — Phân tích Chi tiết lịch hẹn (Y tá)

> Ngày: 2026-07-18 · Đọc `pages/nurse/NurseAppointmentDetail.tsx` + `controllers/nurse/appointments.controller.js` (`getById`). Không sửa.

## Bố cục hiện tại

```
[← Quay lại hàng đợi]   Tiêu đề: [Tên BN] · [ma_lich_hen · ngày giờ]
┌──────────────── Cột trái (1/3) ──────────────┬──────── Cột phải (2/3) ────────┐
│ Thông tin bệnh nhân                           │ (banner) BS yêu cầu chỉnh sửa  │
│  • Tuổi/Giới tính                             │ (card)  Lịch sử thay đổi        │
│  • Số điện thoại                              │ (banner) Chờ BS xác nhận        │
│  • Bệnh nền (amber)                           │ (banner) Đã xác nhận            │
│  • Dị ứng (red)                               │ ────────────────────────────── │
│ Thông tin lịch hẹn                            │ Tiếp nhận ban đầu:              │
│  • Bác sĩ · Chuyên khoa · Dịch vụ             │  HA/Mạch/Nhiệt độ/Cân nặng/     │
│  • Phòng khám (hoặc địa chỉ)                  │  Chiều cao · Triệu chứng · Ghi   │
│  • Trạng thái · Thanh toán (chỉ xem)          │  chú điều dưỡng                 │
│ Lý do khám (nếu có)                           │ Hồ sơ khám:                     │
│                                               │  Chẩn đoán* · Hướng dẫn · Ghi   │
│                                               │  chú · Ngày tái khám            │
│                                               │  [Lưu nháp/Cập nhật] [Gửi BS]   │
└───────────────────────────────────────────────┴─────────────────────────────────┘
```
Gate dữ liệu: `LichHen.findOne({_id, nurse_id: req.user.id})` → 404 nếu không thuộc y tá.
`isEditable = !ketQuaStatus || 'ban_nhap' || 'yeu_cau_chinh_sua'`; `canFillForm = !da_co_ket_qua && status ∉ {cancelled,no_show}`.

## Trường dữ liệu thực tế đang hiển thị (từ `getById`)

| Nhóm | Trường trả về & hiển thị |
|---|---|
| Bệnh nhân | `benh_nhan`(tên), `tuoi`, `gioi_tinh`, `so_dien_thoai`, `benh_nen`(amber), `di_ung`(red) |
| Lịch hẹn | `ma_lich_hen`, `ngay_kham`, `gio_kham`, `bac_si`, `chuyen_khoa`, `ten_dich_vu`, `phong_kham`/`dia_chi_kham`, `loai_kham`, `ly_do_kham`, `status`, `payment_status`(chỉ xem) |
| Hồ sơ | `da_co_ket_qua`, `ket_qua{status, chan_doan, huong_dan_dieu_tri, ghi_chu, trieu_chung_ban_dau, ghi_chu_dieu_duong, ngay_tai_kham, doctor_revision_note, lich_su_sua[]}` |
| Sinh hiệu | `sinh_hieu{can_nang, chieu_cao, huyet_ap, nhiet_do, nhip_tim}` |

## Đánh giá theo nhiệm vụ

| Mục | Kết quả |
|---|---|
| Dữ liệu trả về | ✅ Đủ cho tiếp nhận + nhập hồ sơ |
| Dữ liệu nhạy cảm | ⚠️ SĐT hiển thị (cần cho tiếp nhận — chấp nhận); không lộ email/địa chỉ chi tiết; `benh_nen`/`di_ung` là y khoa nhưng y tá được xem — **không quá lộ** |
| Ownership | ✅ Backend chặn bằng `nurse_id` (không phải FE), 404 nếu không thuộc |
| Route trực tiếp | ✅ Gõ URL → `getById` gate → 404 → UI "không thuộc ca của bạn" |
| Refresh trang | ✅ `useEffect(load,[id])` nạp lại từ API, không stale |
| Appointment không tồn tại | ✅ 404 → error UI |
| Không thuộc y tá | ✅ 404 (cùng query) |
| Trạng thái đổi từ thiết bị khác | ⚠️ Không realtime; phải reload. `isEditable` tính từ dữ liệu đã nạp → có thể bấm Lưu cho hồ sơ vừa bị khóa nơi khác, nhưng **backend guard chặn** (409) |
| Action button | ⚠️ Đúng bộ nút, nhưng **Lưu nháp 409** (createDraft ép HangDoi — P0.2) |
| Điều hướng | ⚠️ "Quay lại" **luôn về `/nurse/queue`** kể cả khi vào từ Revisions |
| Loading/error/empty | ✅ Có loading + error (empty N/A) |
| UI quá tải | ✅ Vừa phải, không quá tải |
| Dữ liệu null | ✅ Fallback '—'/'Không có' |
| Format ngày giờ | ✅ `formatDate`/`formatDateTime` + `gio_kham` |
| Hiển thị hồ sơ | ✅ Form + badge trạng thái + banner + lịch sử |

## Trường THIẾU
- **Ca làm việc / khung giờ ca** — không hiển thị.
- **Ghi chú tiếp nhận/lễ tân** (`LichHen.ghi_chu_le_tan`, `ghi_chu_tiep_nhan`) — có trong DB nhưng `getById` **không trả**.
- **SĐT cho lịch đặt bằng tài khoản:** `getById` chỉ lấy `so_dien_thoai_khach` (dành cho khách vãng lai) → lịch member đặt qua tài khoản thường **null → hiển thị '—'** (trang bác sĩ dùng `so_dien_thoai_khach ?? user.so_dien_thoai` — **nurse thiếu fallback này**).
- (Tùy) nhóm máu `nhom_mau` — có ở `ThanhVien`, không trả.

## Trường DƯ / nhạy cảm
- Không có trường dư đáng kể. Không lộ email/địa chỉ ngoài `dia_chi_kham` (chỉ khi khám tại nhà — hợp lý).

## Nút SAI nghiệp vụ
- **Không có nút vượt quyền** (không xóa/hủy/đổi bác sĩ-y tá-phòng-dịch vụ-giá-thanh toán/xác nhận hồ sơ thay bác sĩ). ✅ Đúng.
- Khóa hồ sơ sau xác nhận đúng (`isEditable=false` khi `da_xac_nhan`, không hiện nút). ✅
- **Thiếu (theo nghiệp vụ):** không có nút "Tiếp nhận bệnh nhân/check-in" tại đây (check-in nằm ở luồng chưa nối UI).

## Lỗi API / quyền
- **Lỗi quyền:** không có — ownership chặn ở backend, không FE-filter. ✅
- **Lỗi API:** (P0.2) `Lưu nháp` 409 vì createDraft ép HangDoi; (P0.1) hôm nay `nurse_id` null → **mọi getById 404** (detail không mở được); (P1.2) gate xem (`nurse_id`) ≠ gate lưu (`HangDoi`) trên cùng màn hình.

## Bố cục đề xuất
Giữ nguyên khung 2 cột (tốt). Bổ sung:
- Cột trái, thẻ "Thông tin lịch hẹn": thêm **Ca/khung giờ** + **ghi chú tiếp nhận**.
- Trường SĐT: fallback `so_dien_thoai_khach ?? user.so_dien_thoai` (đồng bộ trang bác sĩ).
- Nút "Quay lại" thông minh (về trang nguồn: queue hoặc revisions).
- (Khi giải P0.2) nút Lưu nháp chạy được; (khi quyết định nối check-in) thêm nút "Tiếp nhận" có điều kiện trạng thái.

## Kế hoạch sửa (ưu tiên, chưa thực hiện)

| # | Việc | File dự kiến | Mức |
|---|---|---|---|
| 1 | Giải P0.1 (nurse_id lúc đặt) → detail mở được | booking controllers | **P0** |
| 2 | Giải P0.2 (createDraft không ép HangDoi) → Lưu nháp chạy | `medical-records.controller.js` | **P0** |
| 3 | Thống nhất gate xem & lưu (P1.2) | appointments vs medical-records controller | **P1** |
| 4 | Bổ sung SĐT fallback + ghi chú tiếp nhận + ca/giờ vào `getById` | `appointments.controller.getById` | **P2** |
| 5 | Nút "Quay lại" theo trang nguồn | `NurseAppointmentDetail.tsx` | P3 |
| 6 | (Nếu chọn nối) nút Tiếp nhận có điều kiện | `NurseAppointmentDetail.tsx` | P2 |

*Chỉ phân tích, chưa sửa code.*
