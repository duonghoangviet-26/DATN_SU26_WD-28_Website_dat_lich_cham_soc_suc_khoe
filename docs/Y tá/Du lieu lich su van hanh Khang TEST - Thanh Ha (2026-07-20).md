# Dữ liệu "lịch sử vận hành" — BS Khang (TEST) ↔ Y tá Thanh Hà

> Ngày: 2026-07-20 · DB Atlas Cloud (dùng chung) · Mục tiêu: làm dữ liệu 2 actor giống **phòng khám đang chạy thật** để demo.

## 1. Kiểm tra quan hệ trước khi thêm (read-only)
- **Đã có liên kết** doctor↔nurse: `LichLamViec.nurse_id` (11 ca), `LichHen.nurse_id` (21), hàng đợi 35 lượt 100% do Thanh Hà tiếp nhận.
- **Nhưng mỏng:** chỉ **4 hồ sơ trọn vòng** (y tá nhập → bác sĩ xác nhận), ngày trực ngắt quãng, nhiều ngày 1–2 lịch, tên bệnh nhân test lộn xộn.

## 2. Đã thêm — `seed-khang-nurse-history.js --confirm`
- **6 ngày làm việc liên tục** 13–18/07 (bỏ Chủ nhật), mỗi ngày ~5 bệnh nhân **tên VN thực tế** (Nguyễn Văn An, Trần Thị Hương…).
- Mỗi ngày: 4 ca **đi trọn vòng** (check-in → khám → y tá nhập hồ sơ → **bác sĩ xác nhận** → `completed` + `paid`, có sinh hiệu) + 1 ca **hủy** (refunded).
- Chuyên khoa Tai Mũi Họng: chẩn đoán/hướng dẫn thực tế (viêm họng, viêm xoang, viêm tai giữa…).
- Tổng thêm: **30 lịch hẹn** (24 completed trọn vòng + 6 hủy), **24 hồ sơ da_xac_nhan** + 24 sinh hiệu.
- Marker ẩn: `ma_lich_hen` prefix `LIVEHIST_` (tên bệnh nhân KHÔNG có nhãn để trông thật).

## 3. Kết quả sau khi thêm (verify)
| Chỉ số bác sĩ | Trước | Sau |
|---|---|---|
| Tổng lượt khám | 32 | **62** |
| Ca hoàn thành | ~1 | **32** |
| Tỉ lệ hoàn thành | — | **52%** |
| Doanh thu tháng | ~0 | **7.040.000đ** |
| Hồ sơ khám | 9 | **33** |
| **Trọn vòng y tá↔bác sĩ** | 4 | **28** |

Phân bố: 13–18/07 có 6–10 lịch/ngày + hôm nay 20/07 (8 lịch, luồng LIVETEST đang chạy dở).

## 4. Hoàn tác
- Dọn lịch sử: `node src/scripts/seed-khang-nurse-history.js --cleanup` (xóa theo marker `LIVEHIST_` + trả slot về `active`).
- Dọn luồng hôm nay: `node src/scripts/seed-khang-nurse-live-flow.js --cleanup`.
- 2 bộ dữ liệu độc lập, không đè nhau.

## 5. Ghi chú
- Không tạo HoaDon/ThanhToan (ngoài phạm vi doctor↔nurse); `payment_status` đặt trực tiếp để thống kê doanh thu chạy.
- Toàn bộ ca "vắng" trong lịch sử này là `cancelled` (không có `no_show` mới) — có thể bổ sung nếu cần đa dạng hơn.
- Không đụng bác sĩ thật `@vitafamily.vn`, không tạo actor mới.
