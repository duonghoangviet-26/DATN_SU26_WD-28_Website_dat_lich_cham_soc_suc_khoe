# PROMPT 7 — Phân tích Ca làm việc được phân công (Y tá)

> Ngày: 2026-07-18 · Chỉ đọc code + dữ liệu thật. Không sửa.

## Phát hiện bao trùm (đọc trước)

1. **Y tá KHÔNG có trang "Ca làm việc" riêng.** `nurseMenu.ts` chỉ 3 mục (Tổng quan, Hàng đợi, Hồ sơ cần chỉnh sửa). Thông tin ca **chỉ xuất hiện trong Dashboard** ở khối `bac_si_ho_tro`, và **chỉ của HÔM NAY**.
2. **Không có tính năng admin nào gán y tá vào ca.** Grep `nurse_id` trong `controllers/admin` + `routes` = **0 match**. Nơi duy nhất **ghi** `LichLamViec.nurse_id` là **script thủ công** `scripts/link-nurse-to-khang-data.js`. → Cơ chế phân công mà **toàn bộ trang y tá phụ thuộc** hiện **không tồn tại như một chức năng dùng được** trong sản phẩm.
3. Cơ chế phân công (thiết kế): `LichLamViec.nurse_id` (1 y tá / bác sĩ / **ngày**, không theo slot — comment model). `LichHen.nurse_id` là **snapshot** lẽ ra copy lúc đặt lịch nhưng **chưa thực thi**.

## Bảng phân tích

| Trường hợp | Hiện trạng (bằng chứng) | Đúng/Sai | Rủi ro | Đề xuất |
|---|---|---|---|---|
| **Cách hệ thống phân công y tá** | `LichLamViec.nurse_id` theo ngày; **không có UI/endpoint admin** để set — chỉ script | ❌ Thiếu chức năng cốt lõi | Không vận hành thật được; phụ thuộc can thiệp DB thủ công | Admin cần chức năng "Gán y tá cho ca" (thuộc admin, không phải nurse) |
| **Gán vào lịch bác sĩ hay lịch hẹn?** | Cả hai field tồn tại; **nguồn chính = `LichLamViec.nurse_id`** (ca); `LichHen.nurse_id` là snapshot chưa được set | ⚠️ Đúng thiết kế, sai thực thi | Hai nguồn dễ lệch; lịch hẹn hiện luôn null | Chốt: gán ở CA, copy sang lịch hẹn lúc đặt |
| **Ca quá khứ / hôm nay / tương lai** | Dashboard chỉ query `ngay = hôm nay`. **Không có xem quá khứ/tương lai/tuần** | ⚠️ Thiếu (chấp nhận được ở mức đồ án) | Y tá không xem được lịch ngày mai | (Tùy) thêm xem tuần chỉ-đọc nếu cần |
| **Hiển thị Chủ nhật / ngày không làm sai** | `LichLamViec.trang_thai_ngay` enum `[lam_viec, nghi, nghi_phep]`; Dashboard `scheduleToday` **không lọc `trang_thai_ngay`** | ⚠️ Sai tiềm ẩn | Có thể hiện ca vào ngày `nghi`/`nghi_phep` | Lọc `trang_thai_ngay='lam_viec'` khi hiển thị ca |
| **Ca bị hủy / đóng / bác sĩ nghỉ** | Không đối chiếu `NghiPhepBacSi`/`trang_thai_ngay` trong `bac_si_ho_tro` | ⚠️ Sai tiềm ẩn | Hiện bác sĩ đang nghỉ như đang trực | Đối chiếu nghỉ phép/`trang_thai_ngay` |
| **Ca có bệnh nhân nhưng y tá bị đổi** | `LichHen.nurse_id` snapshot (giữ lịch sử) vs `LichLamViec.nurse_id` (hiện tại) → **hai nguồn khác nhau** | ⚠️ | Dashboard (LichLamViec) và Queue (LichHen) có thể chỉ khác nhau y tá | Thống nhất một nguồn quyền sở hữu |
| **Y tá bị gán trùng 2 phòng cùng lúc** | Không ràng buộc: 1 y tá có thể là `nurse_id` của nhiều `LichLamViec` cùng ngày (nhiều phòng) | ❌ Không validate | Y tá "phân thân" 2 phòng | (Admin) chặn gán trùng khi tạo chức năng gán |
| **Y tá hỗ trợ nhiều bác sĩ cùng lúc** | Cho phép; `bac_si_ho_tro` liệt kê mảng | ⚠️ Hiển thị OK, không cảnh báo xung đột | Quá tải/không khả thi thực tế | Cảnh báo/khống chế ở khâu gán (admin) |
| **Timezone & format ngày** | `setHours(0,0,0,0)` local; server TZ=UTC; `ngay` lưu UTC-midnight | ✅ Nhất quán nội bộ | Lệch nếu đổi TZ server | Giữ, ghi chú TZ |
| **Filter ngày / tuần / trạng thái** | **Không có** (không có trang ca) | ❌ Thiếu | — | Chỉ thêm nếu quyết định dựng trang ca |
| **Quyền truy cập** | Mọi query lọc `nurse_id = req.user.id`; không endpoint xem toàn hệ thống | ✅ Đúng | — | Giữ |
| **Mở danh sách bệnh nhân từ ca** | Dashboard "Xem tất cả" → `/nurse/queue` (lọc `nurse_id`, hôm nay) | ✅ Gián tiếp hoạt động | Rỗng nếu chưa gán nurse_id | Giải P0.1 |
| **Empty / loading / error** | Dashboard có đủ; **không có trang ca riêng để đánh giá** | ✅ (dashboard) | — | — |

## Phần logic THUỘC ADMIN vs CHỈ HIỂN THỊ cho y tá

| Chức năng | Thuộc về | Hiện trạng |
|---|---|---|
| Tạo/sửa/xóa ca làm việc | **Admin/hệ thống** (cron sinh ca) | Có cho bác sĩ; **thiếu gán y tá** |
| **Gán y tá vào ca** | **Admin** | ❌ **Không có** (chỉ script) — đây là lỗ hổng gốc |
| Đổi bác sĩ/phòng/giờ của ca | **Admin** | Ngoài phạm vi nurse ✅ |
| Xem ca của mình (ngày/giờ/bác sĩ/phòng/số lịch) | **Nurse (chỉ xem)** | ⚠️ Chỉ có bác sĩ/phòng/chuyên khoa **hôm nay**; **thiếu giờ ca + số lịch trong ca** |
| Mở danh sách bệnh nhân thuộc ca | **Nurse** | ✅ qua `/nurse/queue` |

## Kết luận & thứ tự ưu tiên

- **Lỗ hổng gốc (chặn vận hành thật):** không có tính năng admin gán y tá vào ca → `nurse_id` chỉ set được bằng script. **Đây là việc của ADMIN, không phải nurse page.** Ghi nhận là hạng mục riêng ngoài phạm vi sửa nurse, nhưng **bắt buộc phải có** để nurse page dùng được ngoài demo.
- **Trong phạm vi hiển thị của y tá:** khối "ca hôm nay" **thiếu giờ bắt đầu/kết thúc và số lịch trong ca**; **không lọc `trang_thai_ngay`/nghỉ phép bác sĩ** → có thể hiển thị sai ca nghỉ.
- **Không cần dựng trang "Ca làm việc" phức tạp** cho y tá (đúng như đề bài) — chỉ cần **nâng khối "ca hôm nay" trong Dashboard** cho đủ thông tin (giờ ca, phòng thực từ `slots`, số lịch) và lọc đúng ngày làm.

| # | Việc | Thuộc | Mức |
|---|---|---|---|
| 1 | Chức năng admin "Gán y tá cho ca" (+ chặn gán trùng giờ) | Admin | **P1** (ngoài scope nurse, ghi báo cáo) |
| 2 | Copy `nurse_id` lịch hẹn từ ca lúc đặt (P0.1) | Booking | **P0** |
| 3 | Bổ sung khối "ca hôm nay": giờ ca + phòng thực (`slots`) + số lịch trong ca | Nurse Dashboard | P2 |
| 4 | Lọc `trang_thai_ngay='lam_viec'` + đối chiếu nghỉ phép khi hiển thị ca | Nurse Dashboard | P2 |

*Chỉ phân tích, chưa sửa code. Hạng mục #1 nằm ngoài nurse page — không tự sửa, chỉ đề xuất.*
