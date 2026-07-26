# PROMPT 19 — Báo cáo sửa Dashboard Y tá

> Ngày: 2026-07-18 · Nhánh `Bac_si`. Bước 6. Chỉ sửa Dashboard + type + service phục vụ Dashboard.

## Thay đổi

| File | Thay đổi | Lý do |
|---|---|---|
| `backend/src/controllers/nurse/dashboard.controller.js` | Thêm `trang_thai_den` vào select; **bỏ `tong_check_in`/`dang_cho_kham`** (sai ngữ nghĩa); **thêm `tong_lich_hom_nay`** (loại cancelled/no_show), **`can_tiep_nhan`** (pending/confirmed & `trang_thai_den!=='da_den'`); **sửa `cho_nhap_ho_so`** = `waiting_record && chưa có hồ sơ` (bỏ `confirmed`/`completed` bị thổi phồng); giữ `dang_kham`, `ho_so_*`, `hang_doi_gan_nhat` | Số liệu đúng ngữ nghĩa đến/khám (PROMPT 6) |
| `frontend/src/types/index.ts` | `NurseDashboard`: đổi `tong_check_in`+`dang_cho_kham` → `tong_lich_hom_nay`+`can_tiep_nhan` | Khớp response |
| `frontend/src/pages/nurse/NurseDashboard.tsx` | STAT_CARDS mới (nhãn + link `to`); thẻ `<div>` → **`<Link>` click được** (hover) | Card dẫn tới danh sách lọc |

**Ngữ nghĩa số (trước → sau):**
- `tong_check_in` (gom cả `confirmed` chưa đến + `no_show` + `skipped`) → **bỏ**. Thay bằng `tong_lich_hom_nay` (chỉ loại hủy/không đến).
- `dang_cho_kham` (trộn chưa-đến/đã-đến) → **bỏ**. Thay bằng `can_tiep_nhan` (chưa đến, theo `trang_thai_den`).
- `cho_nhap_ho_so`: `[confirmed, completed, waiting_record]` → chỉ **`waiting_record` & chưa có hồ sơ**.

## Đáp ứng yêu cầu prompt
- Dữ liệu thật từ API, **không hard-code** ✅ · **không doanh thu / không số liệu toàn hệ thống** ✅ (đã scope theo ca ở PROMPT 18).
- **Số liệu cùng timezone** ✅ (local, `setHours` — không đổi).
- **Không tính lịch hủy sai** ✅ (`tong_lich_hom_nay` loại `cancelled`/`no_show`; `can_tiep_nhan` chỉ pending/confirmed).
- **Không có ca** ✅ (bac_si_ho_tro rỗng → "Chưa được phân công ca nào hôm nay"; mọi số = 0).
- **Loading/error/empty** ✅ (giữ nguyên).
- **Responsive** ✅ (grid `grid-cols-2 sm:3 lg:4`, không đổi).
- **Card dẫn tới danh sách lọc:** "Hồ sơ cần chỉnh sửa" → `/nurse/revisions` (lọc thật ✅); các thẻ lịch → `/nurse/queue?status=X`. **Lưu ý trung thực:** `NurseQueue` hiện CHƯA đọc `?status=` từ URL → hôm nay các link này mở danh sách chưa auto-lọc; việc để `NurseQueue` đọc query param thuộc **Bước 8 (Danh sách lịch hẹn)** — cố ý không sửa `NurseQueue` ở prompt này. Link đã mã hóa sẵn để Bước 8 kích hoạt.

## Kiểm thử
- **Backend syntax** `node --check` → OK.
- **Frontend type-check** → **110 lỗi/3 file** (y hệt baseline pre-existing ở mock/Profile/types) — **0 lỗi mới**, rename khớp cả type lẫn FE.
- **Build** `vite build` → ✅ (7.84s).
- **Probe READ-ONLY (dữ liệu thật, không ghi):** ngày 07-08 (nurse có ca, 1 lịch `completed`):
  - `tong_lich_hom_nay=1`, `can_tiep_nhan=0` (completed KHÔNG bị tính là cần tiếp nhận), `dang_kham=0`, `cho_nhap_ho_so=0` → **đúng, hết over-count**.
  - Hôm nay 0 ca → mọi số 0 + empty state (đã xác minh scope ở PROMPT 18).
- **Chưa chạy live end-to-end:** cần server + seed hôm nay (Bước 17) để bấm thử UI với dữ liệu đủ trạng thái.

## Ảnh hưởng & rủi ro
- **API:** response Dashboard đổi field (`tong_check_in`/`dang_cho_kham` → `tong_lich_hom_nay`/`can_tiep_nhan`) — đã cập nhật type + FE đồng bộ; **test `nurse-doctor-status-sync.test.js` giữ nguyên** (chỉ dùng `cho_nhap_ho_so` ≥1 cho `waiting_record` — định nghĩa mới vẫn thỏa — và `hang_doi_gan_nhat` — giữ nguyên).
- **Database:** không đụng. **Admin/doctor/patient:** không đụng.
- **Rủi ro thấp.** `trang_thai_den` chỉ được set khi check-in; hiện check-in chưa nối UI nên `can_tiep_nhan` ≈ tất cả lịch chưa khám (đúng thực tế: chưa ai check-in).

## Vấn đề còn tồn
- `NurseQueue` đọc `?status=` từ URL → Bước 8.
- Khối "ca hôm nay" chưa có giờ ca/phòng thực → Bước 7.
- Full UI test chờ seed hôm nay (Bước 17).
