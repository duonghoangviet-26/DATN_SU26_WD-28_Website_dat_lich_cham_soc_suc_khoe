# PROMPT 24 — Báo cáo sửa Form tạo & lưu nháp hồ sơ (Y tá)

> Ngày: 2026-07-18 · Nhánh `Bac_si`. Chỉ sửa tạo/lưu nháp (KHÔNG đụng gửi bác sĩ). FE-only.

## Thay đổi (chỉ `frontend/pages/nurse/NurseAppointmentDetail.tsx`)

| Hạng mục | Thay đổi |
|---|---|
| **Cảnh báo chưa lưu** | Chụp `snapshot` form lúc nạp/lưu; tính `dirty`; `beforeunload` cảnh báo khi đóng/reload; nút "Quay lại" `window.confirm` nếu `dirty` |
| **Nhãn chuyên môn** | Banner xanh "Nội dung chuyên môn là **ghi nhận theo kết luận của bác sĩ** — y tá nhập hộ"; đổi nhãn "Chẩn đoán (theo bác sĩ)"; placeholder "Ghi lại kết luận chẩn đoán của bác sĩ..." |
| **Validation rõ ràng** | `chanDoanError` inline (viền đỏ + dòng lỗi) thay cho chỉ toast; xóa lỗi khi gõ lại |
| **Chống double / trùng** | `handleSaveDraft`: guard `if (saving) return`; nút disabled khi saving; (BE có `exists` + unique index) |
| **Reload không giữ dữ liệu cũ** | `load()` LUÔN set mọi field (kể cả rỗng) → mở lịch khác không còn dính giá trị cũ |

## Không cần đổi Backend (đã đạt)
`createDraft` (`medical-records.controller`) đã: **destructure field cụ thể** (whitelist) → không mass-assignment; set `nguoi_nhap_id=req.user.id`, `bac_si_phu_trach_id=entry.doctor_id`, `status='ban_nhap'` **phía server** → y tá **không** đổi được người bệnh/bác sĩ/lịch hẹn/người xác nhận qua body. (Đã xác minh PROMPT 11.)

## Đáp ứng yêu cầu
**Dữ liệu:**
- Dùng field schema thực tế, không thêm field ✅ (`chan_doan`, `huong_dan_dieu_tri`, `ghi_chu`, `trieu_chung_ban_dau`, `ghi_chu_dieu_duong`, `ngay_tai_kham`, `sinh_hieu`).
- FE type khớp BE ✅ (`NurseMedicalRecordDraftPayload` không đổi).
- Validation FE/BE nhất quán ✅ (`chan_doan` bắt buộc cả hai; `ngay_tai_kham` > ngày khám cả hai — `min` FE + `isNgayTaiKhamHopLe` BE).
- Whitelist / không mass-assignment ✅ (BE). Không đổi người bệnh/bác sĩ/lịch/người xác nhận ✅.

**Trải nghiệm:**
- Hiển thị rõ bệnh nhân + lịch hẹn ✅ (cột trái + tiêu đề). Có lưu nháp ✅.
- **Cảnh báo rời trang chưa lưu** ✅ (beforeunload + confirm nút Quay lại).
- Disable khi đang lưu ✅. **Chống tạo trùng** ✅ (guard + BE exists + unique). Xử lý reload ✅ (reset field). Xử lý lỗi mạng ✅ (catch → toast, **không gọi load() khi lỗi → giữ nguyên dữ liệu form**).
- **Không mất dữ liệu khi API lỗi** ✅. Thông báo lưu thành công ✅. **Validation rõ ràng** ✅ (inline).
- **Nội dung chuyên môn thể hiện là ghi theo bác sĩ** ✅ (banner + nhãn).

## Kiểm thử
- **Frontend type-check** → **110 lỗi/3 file = baseline**, 0 lỗi mới.
- **Build** `vite build` → ✅ (8.07s).
- **Kịch bản prompt (code-reasoned):**

| Kịch bản | Hành vi |
|---|---|
| Tạo lần đầu | Chưa có `ket_qua` → `createDraft`. (Cần bệnh nhân đã check-in để có `HangDoi` — đúng thiết kế; nếu chưa → BE 409, FE hiện lỗi rõ) |
| Mở lại nháp | `ket_qua` có → field nạp sẵn → `updateRecord`; `dirty` chỉ bật khi sửa |
| Nhấn lưu nhiều lần | `if (saving) return` + nút disabled → **1 request**; BE unique index chặn trùng |
| Dữ liệu thiếu | `chanDoanError` inline "Chẩn đoán là bắt buộc (ghi theo kết luận bác sĩ)" |
| Không có quyền | `getById` ca-scope → 404 (không mở được form) |

- **Chưa chạy live** — cần server + seed hôm nay (Bước 17) để bấm thử toàn luồng (check-in → lưu nháp).

## Rủi ro & ghi nhận
- **Rủi ro thấp** (FE-only, không đổi API/DB).
- **Ghi nhận nhỏ:** `minNgayTaiKham` (thuộc tính `min` của input) vẫn dùng `toISOString` (UTC) → có thể lệch 1 ngày ở biên; **backend là chốt** (`isNgayTaiKhamHopLe`) nên không sai dữ liệu. Để dọn cùng đợt sửa timezone toàn hệ (ghi nhận PROMPT 21).
- Luồng "Lưu nháp" phụ thuộc bệnh nhân đã check-in (thiết kế HangDoi) — nút Tiếp nhận (PROMPT 22) mở khóa luồng này.

## Vấn đề còn tồn
- Chưa sửa "gửi bác sĩ" (đúng phạm vi — bước sau).
- Đồng nhất timezone `minNgayTaiKham` (gộp đợt timezone).
- Full UI test chờ seed hôm nay (Bước 17).
