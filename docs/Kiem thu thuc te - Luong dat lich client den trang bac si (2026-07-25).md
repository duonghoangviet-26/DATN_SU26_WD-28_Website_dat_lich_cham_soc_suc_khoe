# Kiểm thử thực tế — Luồng đặt lịch từ client đến trang bác sĩ (2026-07-25)

> **Cách chạy:** DB riêng `DATN_VITAFAMILY_CLAUDE_TEST` trên cùng cluster Atlas (KHÔNG đụng `DATN_VITAFAMILY` của nhóm), backend cổng 5050, frontend cổng 5199.
> **Lý do tách:** cổng 5000 đã có một backend khác đang chạy và **nối vào DB thật** — test qua cổng đó sẽ ghi dữ liệu giả vào DB nhóm.
> **Cách mô phỏng:** gọi thẳng API như client thật (đăng nhập → chọn chuyên khoa → chọn khung giờ → đặt → thanh toán), rồi đối chiếu trên giao diện bác sĩ và admin.

---

## 1. Seed script hoàn toàn không chạy được — 8 lỗi (ĐÃ SỬA)

`npm run db:seed` vỡ ngay từ bước chèn dữ liệu nền. Không có seed thì không dựng được môi trường test, và **cả nhóm không reset được DB**.

| # | Lỗi | Vị trí | Nguyên nhân |
|---|---|---|---|
| S1 | `services[6]` ngoài phạm vi | `BacSi.create` | Mảng `services` bị `.filter((item) => item.loai !== 'home')` nên chỉ còn 5 phần tử (0–4). Bộ lọc thêm vào lúc ngừng hỗ trợ dịch vụ tại nhà, chỉ số cứng bên dưới không cập nhật |
| S2 | `services[6]` ngoài phạm vi (lần 2) | `NhatKyThaoTac.create` | Cùng nguyên nhân S1 |
| S3 | `BacSi` đầu tiên thiếu `user_id` **và** `chi_nhanh_id` | `BacSi.create` | Trường bị mất trong lần merge hỏng encoding |
| S4 | `LichLamViec[0]` thiếu `ngay` | `LichLamViec.create` | Như S3. Giá trị đúng suy ra từ lịch hẹn tham chiếu: `twoDaysAgo` |
| S5 | `LichLamViec[3]` thiếu `ngay` | `LichLamViec.create` | Như S4. Giá trị đúng: `tomorrow` |
| S6 | `dich_vu_phat_sinh` dùng `gia` | `KetQuaKham.create` | Schema đã đổi sang `don_gia` + `thanh_tien` (required), seed không đổi theo |
| S7 | `items` dùng `ngay_bat_dau`/`ngay_ket_thuc` (4 chỗ) | `DonThuoc.create` | Schema đã đổi sang `so_ngay` (required). Khớp doc *"So ngay uong thuoc… mat khi cap nhat ket qua kham (2026-07-16)"* |
| S8 | 3 khối text hỏng font + **khóa object trùng lặp** | `BacSi`, 2× `LichLamViec.ghi_chu_ngay`, `HoaDon.chi_tiet_thu_phi` | Rác sót lại của lần sửa encoding: `'B??c s?? da li???u'` |

**Bài học:** S3–S5 và S8 cùng một gốc — một lần merge hỏng encoding đã ghi đè object đầu tiên của nhiều mảng, để lại bản mojibake và **làm rơi mất trường bắt buộc**. Khi gặp text `??` trong repo, phải kiểm tra luôn các trường bị thiếu ở object đó.

Sau khi sửa, seed chạy sạch: 3 `BacSi`, 5 `LichLamViec`, 5 `LichHen`, 3 `DonThuoc`…

---

## 2. Lỗi runtime xác nhận bằng thực nghiệm

### 2.1 ❌ Lệch múi giờ — cho đặt và THU TIỀN khung giờ đã trôi qua (L16)

Nghiêm trọng nhất. Thời điểm test **14:02** giờ VN:

```
BS. Nguyễn Thu An: 15 khung chào bán hôm nay | bây giờ 14:02
❌ chào bán 9 khung ĐÃ QUA: 08:00, 08:30, 09:00, 09:30, 10:00, 10:30, 11:00, 13:30, 14:00
Đặt vào khung 08:00 -> status 201: Tạo lịch hẹn thành công
Thanh toán -> paid | lịch hẹn: confirmed
```

Bệnh nhân **đặt và thanh toán thành công** một lịch khám lúc 08:00, trong khi đã 14:02 — trễ 6 tiếng. Nguyên nhân: `buildSlotDateTime` dùng `setUTCHours`, nên `"08:00"` thành 08:00Z = **15:00 giờ VN**, vẫn nằm ở tương lai nên `isSlotInPast` trả `false`.

Hệ quả dây chuyền: mọi mốc `T-30'`, `T-15'`, `T+15'` của thiết kế mới đều tính từ giờ khám → **phải sửa cái này trước mọi thứ khác**.

### 2.2 ❌ Không chặn đặt trùng (L12)

```
Đặt lần 1 (khung 08:00) -> 201 thành công
Đặt lần 2 (khung 08:30, cùng bác sĩ, cùng ngày) -> 201 thành công
```

Trang bác sĩ hiển thị cả hai: `08:00 Phạm Thị Hồng` và `08:30 Phạm Thị Hồng`. Không có bất kỳ kiểm tra nào — bệnh nhân đặt bao nhiêu lượt/ngày cũng được.

### 2.3 ❌ Cấu hình chuyên khoa đã mất (L14)

```
Số slot mỗi khung 30': {"08:00":1, "08:30":1, ..., "17:00":1}
Phân bố loai_slot: {"online": 15}
khung_index: null
```

15 khung × **1 slot**, **100% online**, không có slot walk-in nào. Đúng như dự đoán: `ChuyenKhoa` mất 3 trường cấu hình nên generator rơi vào fallback. Giao diện bác sĩ cũng hiển thị *"Trong đó trống: 13 Online"* — không có mục "Tại chỗ".

### 2.4 ⚠️ Chênh lệch định nghĩa "đã đặt" giữa admin và bác sĩ

Cùng một ngày, admin hiện `2/15`, trang bác sĩ hiện `1/15`. Không sai — admin gộp `booked` + `pending_payment`, trang bác sĩ tách riêng ("Đã đặt 1", "Đang giữ chỗ 1"). Nhưng hai trang nói hai con số khác nhau về cùng một ngày thì nên thống nhất nhãn.

### 2.5 ⚠️ Nút hành động vẫn hiện trên khung giờ đã trôi qua trong hôm nay

Slot 08:00 hôm nay (đã qua 6 tiếng) vẫn hiện nút "Yêu cầu hủy". Trang chỉ ẩn hành động theo **ngày** quá khứ (`isPastDay`), chưa ẩn theo **khung giờ** đã qua trong ngày hiện tại. Hành vi này có từ trước, giao diện lịch mới kế thừa nguyên.

### 2.6 ⚠️ Hộp "TÀI KHOẢN DEMO" ở trang đăng nhập sai dữ liệu

Hiển thị `haiv5634@gmail.com`, `lt14062006meitu@gmail.com`, `luongtran140606@gmail.com` — không khớp tài khoản seed (`admin@vitafamily.vn`, `doctor.an@vitafamily.vn`, `patient01.demo@vitafamily.vn`, mật khẩu `123456`). Người mới clone repo làm theo hướng dẫn này sẽ không đăng nhập được.

---

## 3. Những phần chạy ĐÚNG

| Luồng | Kết quả |
|---|---|
| Đăng nhập bệnh nhân | ✅ |
| Chọn chuyên khoa → bác sĩ → khung giờ trống | ✅ |
| Đặt lịch (tạo `LichHen` + `HoaDon` + `ThanhToan`) | ✅ 201 |
| Giữ slot `pending_payment` | ✅ |
| Thanh toán mock VNPay (tạo session → hoàn tất) | ✅ → `paid` / `confirmed` |
| **Lịch hẹn hiện ở trang bác sĩ** | ✅ Dashboard + danh sách lịch hẹn đều thấy |
| Lịch làm việc dạng calendar (tuần/tháng, drawer, ca sáng/chiều) | ✅ |
| Hàng đợi / check-in endpoint | ✅ 200, rỗng vì chưa ai check-in |
| **Trang admin sau refactor component dùng chung** | ✅ Không hồi quy: lưới, chấm xác nhận, drawer, đủ 5 nút quản trị + trạng thái disabled đúng |

---

## 4. Thứ tự xử lý đề nghị

1. **L16 múi giờ** — chặn trước tiên, vì đang thu tiền cho lịch quá khứ và mọi mốc giờ mới phụ thuộc nó.
2. **L12 chặn đặt trùng** — 1 lượt/chuyên khoa/ngày/`member_id` (rule §5).
3. **L14 khôi phục cấu hình `ChuyenKhoa`** — không có thì toàn bộ nghiệp vụ 70/30 vô nghĩa.
4. Mục 2.5 (ẩn hành động theo khung đã qua), 2.6 (sửa hộp tài khoản demo), 2.4 (thống nhất nhãn "đã đặt").

Chi tiết nghiệp vụ và 25 lỗ hổng đã phân tích: `docs/Phan tich lo hong luong dat lich Online-Offline (2026-07-25).md`.

---

## 5. Dọn dẹp

DB test `DATN_VITAFAMILY_CLAUDE_TEST` **vẫn còn** trên cluster để đối chiếu lại nếu cần. Xóa bằng `npm run db:test-dbs` khi không dùng nữa. Backend/frontend test (cổng 5050/5199) đã tắt; tiến trình cổng 5000 của nhóm không bị đụng tới.
