# PROMPT 9 — Phân tích Tiếp nhận bệnh nhân / Check-in (Y tá)

> Ngày: 2026-07-18 · Đọc `controllers/nurse/queue.controller.js`, `models/{HangDoi,TrangThaiPhongKham,LichHen}.js`, `utils/nurse-scope.js`. Dùng **trạng thái thật trong code**. Không sửa.

## 0. Sự thật nền tảng (đọc trước khi kết luận)

- **Toàn bộ luồng check-in/tiếp nhận KHÔNG được nối vào UI y tá.** `queue.controller` (checkin/call/into-room/finish/skip/cancel) + 9 method service tồn tại nhưng **không component nào gọi** (menu không có mục "Tiếp nhận"). → Từ trang y tá, **chức năng này thực tế không dùng được**.
- **Gate của check-in dùng CA** (`getMyDoctorIdsToday` = `LichLamViec.nurse_id` hôm nay), trong khi **danh sách lịch hẹn dùng `LichHen.nurse_id`**. → Hai cổng khác nhau: có thể thấy lịch trong danh sách nhưng **không check-in được** (và ngược lại).
- **Dữ liệu thật:** hôm nay `LichLamViec.nurse_id` = 0 → `getMyDoctorIdsToday` rỗng → **mọi check-in hôm nay trả 403**. `HangDoi` hiện 28 bản ghi rác offline/skipped.
- Check-in **không đặt `status='checked_in'`** (enum này gần như **chết**) — thay vào đó set `trang_thai_den='da_den'` + `gio_den_thuc_te`, và `pending→confirmed`. Đồng bộ tới bác sĩ đi qua **bản ghi `HangDoi`** (doctor queue), không qua `LichHen.status`.

## 1. Trả lời "cần phân tích thêm"

| Câu hỏi | Trả lời (bằng chứng code) |
|---|---|
| Ai đánh dấu "không đến"? | **Không phải qua các endpoint nurse này.** Nurse có `skip` (→`HangDoi=skipped`+`LichHen.status=skipped`) và `cancel` (→`cancelled`), **không** set `no_show`. `no_show`/`no_show_confirmed_at` do luồng khác (cron auto-cancel mỗi 15' / lễ tân) — ngoài phạm vi nurse |
| Giới hạn thời gian đánh dấu không đến? | Không có trong code nurse; check-in chỉ chặn "khác ngày", không chặn sớm/muộn (chỉ mất ưu tiên nếu trễ >30' qua `tinhMucUuTien`) |
| Cần modal xác nhận? | Không có UI → chưa có; **nên có** cho `skip`/`cancel` (khó hoàn tác) |
| Ghi thời gian thực hiện? | ✅ `HangDoi.checkin_time`, `thoi_diem_goi/vao_phong/ket_thuc`; `LichHen.gio_den_thuc_te` |
| Ghi tài khoản thực hiện? | ✅ `HangDoi.nguoi_tiep_nhan_id` + `vai_tro_tiep_nhan` |
| Audit log? | ⚠️ `call/into-room/finish/skip/cancel` có ghi `NhatKyThaoTac`; **riêng `checkin` KHÔNG ghi audit** (thiếu nhất quán) |
| Hoàn tác check-in? | ❌ Không có endpoint hoàn tác (không xóa HangDoi / revert `trang_thai_den`) |
| Ai được hoàn tác? | Không định nghĩa |
| Đến sai ca | Gate `doctorIds` (ca hôm nay) → **403** nếu bác sĩ không thuộc ca y tá |
| Đến nhưng bác sĩ nghỉ | ❌ Check-in **không** đối chiếu `NghiPhepBacSi`/`LichLamViec.trang_thai_ngay` → vẫn check-in được cho bác sĩ đang nghỉ |
| Admin đổi lịch | Đổi `ngay_kham` → check "khác ngày" chặn; đổi `doctor_id` → gate đánh giá lại. Chấp nhận được |

## 2. A. State transition (trạng thái thật trong code)

**Trạng thái dùng:** `LichHen.status` [pending, confirmed, checked_in*, in_progress, waiting_record, waiting_doctor_confirm, completed, cancelled, no_show, skipped]; `LichHen.trang_thai_den` ["da_den"]; `HangDoi.trang_thai` [dang_cho, da_goi, trong_phong, skipped, cancelled, hoan_thanh]; `TrangThaiPhongKham.trang_thai` [san_sang, tam_nghi, dang_kham, dang_don_phong]. (*`checked_in` tồn tại nhưng không được set.)*

| Trạng thái hiện tại | Hành động y tá | Trạng thái sau | Điều kiện | KHÔNG được phép khi |
|---|---|---|---|---|
| LichHen `pending`/`confirmed`, chưa có HangDoi | **checkin** | `LichHen.trang_thai_den='da_den'`, `gio_den_thuc_te=now`, `pending→confirmed`; tạo `HangDoi=dang_cho` | Lịch tồn tại · thuộc **ca hôm nay** (`getMyDoctorIdsToday`) · đúng ngày · chưa có HangDoi | `cancelled/no_show/completed/skipped` · khác ngày · ngoài ca · **đã có HangDoi** |
| HangDoi `dang_cho`/`da_goi` | **call** | `HangDoi=da_goi`, `so_lan_goi++` | Entry thuộc ca | Không ở `dang_cho`/`da_goi` |
| HangDoi `dang_cho`/`da_goi` + phòng `san_sang` | **into-room** | `HangDoi=trong_phong`; phòng `dang_kham`; **`LichHen.status=in_progress`** | Phòng phải `san_sang` | Bệnh nhân không hiện diện · phòng chưa sẵn sàng |
| HangDoi `trong_phong` | **finish** | `HangDoi=hoan_thanh`; phòng `dang_don_phong`; **`LichHen.status=waiting_record`** | Đúng bệnh nhân đang trong phòng | Không ở `trong_phong` · bệnh nhân không khớp |
| HangDoi `dang_cho`/`da_goi` | **skip** | `HangDoi=skipped`; **`LichHen.status=skipped`** | Entry thuộc ca | Không ở `dang_cho`/`da_goi` |
| HangDoi `dang_cho`/`da_goi` | **cancel** | `HangDoi=cancelled`; **`LichHen.status=cancelled`** | Entry thuộc ca | Không ở `dang_cho`/`da_goi` |
| Phòng `dang_kham→dang_don_phong→san_sang⇄tam_nghi` | **room-status** | Theo enum thủ công | Đúng chuỗi chuyển | `dang_kham→san_sang` trực tiếp · `tam_nghi` khi còn bệnh nhân |

## 3. B. Lỗi hiện tại

| Lỗi | File | Hậu quả | Mức | Đề xuất |
|---|---|---|---|---|
| Check-in/tiếp nhận **không nối UI** | `NurseQueue.tsx`, `nurse.service.ts`, `nurseMenu.ts` | Chức năng không dùng được từ trang y tá | **P2** | Quyết định kiến trúc: nối hoặc gỡ |
| **Gate check-in (ca) ≠ gate danh sách (`LichHen.nurse_id`)** | `queue.controller.js` vs `appointments.controller.js` | Thấy lịch nhưng không check-in được (403), khó hiểu | **P1** | Thống nhất một cơ sở phân quyền |
| Hôm nay `getMyDoctorIdsToday` rỗng | (gốc P0.1) `LichLamViec.nurse_id` chưa gán | Mọi check-in hôm nay 403 | **P0** | Có chức năng admin gán y tá + set nurse_id |
| `checkin` **không ghi audit** (khác các hành động khác) | `queue.controller.checkin` | Mất dấu vết ai/khi tiếp nhận trong `NhatKyThaoTac` | P3 | Ghi `NhatKyThaoTac` như call/skip |
| `findOne`→`create` **không atomic** | `queue.controller.checkin` | Hai request đồng thời → 500 (unique index cứu toàn vẹn nhưng sai mã lỗi) | P3 | Bắt lỗi duplicate → trả 409 |
| `status='checked_in'` **không được set** (enum chết) | `queue.controller.checkin` + `dashboard.controller` | Dashboard/list đếm "đã đến" theo `status` → không phản ánh check-in | **P2** | Dùng `trang_thai_den`/`gio_den_thuc_te` cho "đã đến" |
| Check-in **không đối chiếu bác sĩ nghỉ**/`trang_thai_ngay` | `queue.controller.checkin` | Tiếp nhận cho bác sĩ đang nghỉ | P2 | Chặn nếu ca `nghi`/bác sĩ nghỉ phép |
| **`cancel` set `LichHen.status=cancelled`** (hủy cấp lịch hẹn) | `queue.controller.cancel` | Y tá hủy lịch hẹn (kèm hệ luỵ hoàn tiền?) — nghi vượt quyền tiếp nhận | **P2 (review)** | Rà quyền: y tá nên "bỏ lượt" (skipped/no_show) chứ không "hủy booking" |
| Không có **hoàn tác check-in** | `queue.controller` | Lỡ check-in nhầm không sửa được | P3 | Cân nhắc endpoint hoàn tác có phân quyền |
| Check-in **không chặn `unpaid`** | `queue.controller.checkin` | Nếu dự án bắt trả trước, vẫn tiếp nhận lịch chưa thanh toán (thanh toán chỉ xem — đúng, nhưng không chặn) | P3 | Làm rõ quy tắc: chặn hay chỉ cảnh báo |
| Không modal xác nhận cho `skip`/`cancel` | (UI chưa có) | Thao tác khó hoàn tác dễ nhầm | P3 | Thêm modal khi dựng UI |

## 4. Kết luận

- Logic backend check-in **khá đầy đủ và hợp lý** (chặn khác ngày, trùng, ngoài ca; ghi thời gian + người tiếp nhận; đồng bộ HangDoi cho bác sĩ), **nhưng chết trong UI** và **lệch gate với danh sách**.
- Ưu tiên: **P0** (gán y tá vào ca + nurse_id) → **P1** (thống nhất gate) → **P2** (nối UI hoặc gỡ; rà quyền `cancel`; "đã đến" theo `trang_thai_den`) → **P3** (audit checkin, atomic, modal, hoàn tác).
- **Điểm cần bạn quyết về nghiệp vụ:** (1) y tá có được "hủy lịch hẹn" không, hay chỉ "bỏ lượt/không đến"; (2) có bắt buộc thanh toán trước khi check-in không. Hai điều này quyết định cách sửa `cancel`/`checkin`.

*Chỉ phân tích, chưa sửa code.*
