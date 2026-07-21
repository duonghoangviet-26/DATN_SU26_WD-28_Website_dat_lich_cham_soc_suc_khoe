# Kiểm tra dữ liệu demo — Luồng Bác sĩ (BS Khang TEST)

> Ngày: 2026-07-20 · Nhánh `Bac_si` · DB Atlas Cloud (dùng chung). Chỉ kiểm tra (read-only), **giữ nguyên dữ liệu** theo yêu cầu.

## 1. Hiện trạng dữ liệu bác sĩ hôm nay (verify từ đúng logic controller)

Bác sĩ: **BS. Trần Minh Khang (TEST)** — `doctor.test@vitafamily.local` (`doctor_id=6a4fba7e…047cae`).

| Màn hình bác sĩ | API | Dữ liệu |
|---|---|---|
| **Dashboard** | `getTodayOverview` | 8 lịch hôm nay · chờ khám 2 · đang khám 1 · hoàn thành 1 · **Y tá hỗ trợ: Điều dưỡng Thanh Hà** |
| **Hàng đợi khám** | `examQueue` | 7 lượt: dang_cho 1, trong_phong 1, hoan_thanh 5 |
| **Xác nhận hồ sơ** | `listPendingResults` | **3 hồ sơ CHỜ XÁC NHẬN** + 5 đã xác nhận |

Nguồn dữ liệu: bộ seed `LIVETEST_KH_001..008` (xem `docs/Y tá/Luong test hoan chinh…`) + thao tác thử của người dùng đã đẩy A5/A7 sang "chờ xác nhận".

## 2. Kết luận
**Đủ và hợp lý để demo luồng bác sĩ.** Không cần thêm dữ liệu:
- Dashboard đã có ca trực + y tá hỗ trợ + số liệu.
- Hàng đợi khám có bệnh nhân ở nhiều trạng thái (đang chờ / trong phòng / đã xong).
- Có 3 hồ sơ ở "chờ xác nhận" → đủ để demo cả **Xác nhận hồ sơ** lẫn **Yêu cầu chỉnh sửa** mà không hết dữ liệu.

## 3. Kịch bản demo luồng bác sĩ (đề xuất)
1. **Đăng nhập BS Khang (TEST)** → **Dashboard**: chỉ ca trực hôm nay, y tá hỗ trợ "Điều dưỡng Thanh Hà", số lịch chờ/đang/xong.
2. **Hàng đợi khám**: xem danh sách bệnh nhân hôm nay theo mức ưu tiên; có người "đang trong phòng", người "chờ".
3. **Xác nhận hồ sơ** (danh sách chờ xác nhận, 3 hồ sơ):
   - Mở 1 hồ sơ → **Xác nhận hồ sơ** ⇒ lịch chuyển `completed` (khóa, y tá không sửa được nữa).
   - Mở hồ sơ khác → **Yêu cầu chỉnh sửa** (nhập lý do) ⇒ trả về y tá (`waiting_record` + `yeu_cau_chinh_sua`).
4. (Tùy chọn) Đăng nhập lại **Y tá Thanh Hà** → trang **"Hồ sơ cần chỉnh sửa"** thấy hồ sơ vừa bị yêu cầu sửa → sửa & gửi lại ⇒ quay lại bác sĩ chờ xác nhận. *(Vòng revision khép kín — đã sửa bug thiếu `appointment_id`, xem `docs/Y tá/Bug fix - Ho so can chinh sua…`.)*
5. **Thống kê / Lịch làm việc**: bác sĩ có 158 ngày lịch + số liệu tích lũy để trình.

## 4. Ghi chú vận hành
- Muốn đưa luồng về **điểm bắt đầu chuẩn** ngay trước demo: `cd backend && node src/scripts/seed-khang-nurse-live-flow.js --confirm` (dọn marker cũ + tạo lại A1→A8).
- Dọn sạch sau demo: `node src/scripts/seed-khang-nurse-live-flow.js --cleanup`.
- Dữ liệu mang marker `(LIVETEST)` / `LIVETEST_KH_*` — dễ nhận biết là dữ liệu demo.
