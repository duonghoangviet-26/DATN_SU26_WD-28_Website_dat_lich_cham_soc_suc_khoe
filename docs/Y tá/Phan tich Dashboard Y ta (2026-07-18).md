# PROMPT 6 — Phân tích Dashboard Y tá

> Ngày: 2026-07-18 · Chỉ đọc code (`controllers/nurse/dashboard.controller.js`, `pages/nurse/NurseDashboard.tsx`) + dữ liệu thật đã probe. Không sửa.

## 1. Dashboard hiện tại đang có gì

**Backend `GET /api/nurse/dashboard`** (gom 1 lần, lọc theo `nurseId = req.user.id`):
- `bac_si_ho_tro[]` ← `LichLamViec.find({nurse_id, ngay=hôm nay})` populate BacSi → `ten_bac_si`, `chuyen_khoa`, `phong_kham`.
- Các số từ `LichHen.find({nurse_id, ngay_kham=hôm nay})`: `tong_check_in`, `dang_cho_kham`, `dang_kham`, `cho_nhap_ho_so`.
- Các số hồ sơ từ `KetQuaKham.find({nguoi_nhap_id})`: `ho_so_cho_xac_nhan`, `ho_so_can_sua`, `ho_so_da_xac_nhan`.
- `hang_doi_gan_nhat[]` (tối đa 5, sắp theo `gio_kham`).

**Frontend:** header chào + mô tả · khối "Đang hỗ trợ hôm nay" (bác sĩ/phòng) · lưới **7 thẻ số** · khối "Hàng đợi gần nhất" (link tới chi tiết + "Xem tất cả"→`/nurse/queue`). Có **loading / error / empty** đầy đủ. Responsive `grid-cols-2 sm:3 lg:4` + `flex-wrap`.

## 2. Nguồn dữ liệu & kiểm tra từng thẻ

| Thẻ | Nguồn | Định nghĩa trong code | Đánh giá |
|---|---|---|---|
| Đã check-in hôm nay (`tong_check_in`) | LichHen(nurse_id) | `status ∉ {pending, cancelled}` | ❌ **Sai nhãn** — gộp cả `confirmed` (chưa đến), `no_show`, `skipped` vào "đã check-in" |
| Đang chờ khám (`dang_cho_kham`) | LichHen | `status ∈ {confirmed, checked_in}` | ⚠️ Trộn "đã đặt/chưa đến" (`confirmed`) với "đã đến/đang chờ" (`checked_in`) |
| Đang khám (`dang_kham`) | LichHen | `status = in_progress` | ✅ Đúng |
| Chờ nhập hồ sơ (`cho_nhap_ho_so`) | LichHen + KetQuaKham | `status ∈ {confirmed, completed, waiting_record}` và chưa có hồ sơ | ⚠️ Gộp `confirmed` (chưa khám) → thổi phồng |
| Chờ bác sĩ xác nhận (`ho_so_cho_xac_nhan`) | KetQuaKham(nguoi_nhap_id) | `status = cho_xac_nhan` | ✅ Đúng |
| Cần chỉnh sửa (`ho_so_can_sua`) | KetQuaKham | `status = yeu_cau_chinh_sua` | ✅ Đúng |
| Đã xác nhận (`ho_so_da_xac_nhan`) | KetQuaKham | `status = da_xac_nhan` | ✅ Đúng |

**Kiểm tra chuyên sâu:**
- **Timezone/cùng ngày:** cả `scheduleToday` và `apptsToday` dùng chung mốc `setHours(0,0,0,0)` local (server chạy TZ=UTC, `ngay_kham` lưu UTC-midnight) → **nhất quán nội bộ**. Rủi ro chỉ khi TZ server đổi.
- **Lọc theo y tá đăng nhập:** ✅ `nurse_id = req.user.id` (token), **không tin FE**.
- **Ca sáng/chiều:** model gán y tá **theo NGÀY** (`LichLamViec.nurse_id`, không theo slot) → dashboard không tách sáng/chiều; **không trộn sai**, nhưng cũng **không hiển thị khung giờ ca**.
- **Hủy có bị tính tổng?** `cancelled` bị loại khỏi `tong_check_in`/`dang_cho` ✅. Nhưng **`no_show` và `skipped` VẪN bị tính** vào `tong_check_in` ❌.
- **Hồ sơ cần sửa có được ưu tiên?** ❌ Chỉ là **1 thẻ số**, không có danh sách/hành động; không dẫn tới `/nurse/revisions`.
- **Việc tiếp theo:** `hang_doi_gan_nhat` (5) sắp theo `gio_kham` — hợp lý nhưng **không chứa hồ sơ bị trả về** (việc chặn bác sĩ quan trọng nhất).
- **Không có ca hôm nay:** ✅ hiện "Chưa được phân công ca nào hôm nay".
- **Nhiều ca/ngày:** y tá có thể là `nurse_id` của nhiều bác sĩ cùng ngày → `bac_si_ho_tro` liệt kê mảng ✅.
- **Card dẫn đúng trang?** ❌ **7 thẻ số là `<div>`, KHÔNG click được.** Chỉ `hang_doi_gan_nhat` + "Xem tất cả" có link. Bấm thẻ "Cần chỉnh sửa" không đi đâu.
- **Hard-code?** ✅ Không — `STAT_CARDS` chỉ là cấu hình nhãn, số liệu từ API.
- **Phòng hiển thị:** lấy từ `BacSi.phong_kham_mac_dinh`, **không phải** phòng thực của ca (`LichLamViec.slots[].phong_kham`) → có thể lệch phòng thật.

## 3. Dashboard đang thiếu gì
- Khung giờ ca (sáng/chiều/giờ bắt đầu–kết thúc).
- Tách bạch **"chưa đến"** vs **"đã đến (chờ khám)"** (hệ thống có `trang_thai_den`/`gio_den_thuc_te`/`checked_in` nhưng dashboard không dùng).
- **Ô hành động "Hồ sơ bác sĩ yêu cầu sửa"** (danh sách + link) — ưu tiên cao nhất.
- Thẻ số **điều hướng** tới trang lọc tương ứng.
- Phòng thực theo ca (thay vì phòng mặc định).

## 4. Dữ liệu nào SAI
1. **`tong_check_in`** — đếm cả chưa-đến/`no_show`/`skipped` là "đã check-in". *Nghiêm trọng về nghĩa.*
2. **`dang_cho_kham`** — gộp `confirmed`(chưa đến) với `checked_in`(đã đến).
3. **`cho_nhap_ho_so`** — gộp `confirmed`(chưa khám) → phồng số.
4. Gốc chung: **chưa nối luồng check-in/hiện diện** nên dashboard "đoán" trạng thái đến bằng trạng thái đặt lịch → sai ngữ nghĩa. Cộng thêm **P0.1 nurse_id** → hôm nay mọi số = 0.

## 5. Thành phần lẫn admin/doctor
**Không có.** Dashboard đã đúng phạm vi: không doanh thu, không tổng hệ thống, không dữ liệu y tá/bác sĩ khác, không công cụ gán ca/phòng/thanh toán. ✅

## 6. API tổng hợp có cần không
**Cần và nên giữ** endpoint gom `GET /nurse/dashboard` (tránh nhiều lời gọi). Chỉ nên **sửa định nghĩa số** cho đúng ngữ nghĩa đến/khám, **không** tách thành nhiều API.

## 7. Wireframe nội dung đề xuất

```
┌───────────────────────────────────────────────────────────┐
│ Chào [Y tá] · Hôm nay [dd/mm/yyyy]                          │
├───────────────────────────────────────────────────────────┤
│ CA HÔM NAY                                                  │
│ [BS. A · Chuyên khoa · Phòng 101 · 07:30–11:30]            │
│ [BS. B · ... nếu có nhiều ca]                              │
├───────────────────────────────────────────────────────────┤
│ TÌNH TRẠNG BỆNH NHÂN (trong ca)                            │
│ [Chưa đến] [Đã đến-chờ khám] [Đang khám]                   │
├───────────────────────────────────────────────────────────┤
│ HỒ SƠ (của tôi)                                            │
│ [Chờ nhập] [BS yêu cầu sửa ●] [Đã gửi chờ XN] [Đã XN]      │
│  (mỗi thẻ click → trang lọc tương ứng)                     │
├──────────────────────────────┬────────────────────────────┤
│ ƯU TIÊN: BS YÊU CẦU SỬA       │ HÀNG ĐỢI GẦN NHẤT           │
│ • BN X — lý do trả về         │ • 07:30 BN P — chờ khám     │
│ • BN Y — ...                  │ • 08:00 BN Q — đang khám    │
│ [Xem tất cả → /revisions]     │ [Xem tất cả → /queue]       │
└──────────────────────────────┴────────────────────────────┘
```
Nguyên tắc: **2 ô hành động** (Hồ sơ cần sửa + Hàng đợi) là trọng tâm; thẻ số chỉ để liếc nhanh và **đều click được**.

## 8. Danh sách sửa theo ưu tiên (chưa thực hiện)

| # | Việc | Mức | Ghi chú |
|---|---|---|---|
| 1 | Set `LichHen.nurse_id` khi đặt lịch (gốc P0.1) | **P0** | Dashboard mới có dữ liệu |
| 2 | Sửa ngữ nghĩa đến/khám: dùng `trang_thai_den`/`gio_den_thuc_te`/`checked_in`; loại `no_show`/`skipped` khỏi "đã check-in"; tách "chưa đến" vs "đã đến" | **P1** | Không đổi schema |
| 3 | Đưa "Hồ sơ bác sĩ yêu cầu sửa" thành ô hành động (list + link) | **P1** | Ưu tiên nghiệp vụ |
| 4 | Cho thẻ số điều hướng tới trang lọc | **P2** | UX |
| 5 | Hiển thị khung giờ ca + phòng thực theo `LichLamViec.slots` | **P2** | — |
| 6 | Rà lại `cho_nhap_ho_so` (loại `confirmed` chưa khám) | **P3** | Tùy định nghĩa nghiệp vụ |

*Chỉ phân tích, chưa sửa code.*
