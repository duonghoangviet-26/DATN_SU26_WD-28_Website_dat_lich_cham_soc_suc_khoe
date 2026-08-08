# Triển khai mục 11 — Mốc thời gian của một khung — 2026-07-26

Tiếp nối `docs/Trien khai muc 3 - Bac si dang ky theo ca (2026-07-26).md`.
Rule: `.claude/rules/lich-lam-viec-bac-si.md` mục 4 + 11.

---

## 1. Bốn mốc của một khung

Khung bắt đầu lúc `T`, giờ `Asia/Ho_Chi_Minh`:

| Mốc | Sự kiện | Trạng thái |
|---|---|---|
| `T-30'` | Đóng đặt online; slot online chưa bán → walk-in | ✅ |
| `T-30'` | Hạn chót xin dời lịch | ⏳ luồng dời lịch chưa tồn tại |
| `T-15'` | Hạn chót mọi giữ chỗ chờ thanh toán | ✅ |
| `T` → `T+15'` | Grace — khách online giữ ưu tiên | ⏳ thuộc mục 6 |
| Hết ca | `no_show`, mất 100% | ⏳ thuộc mục 8 |

Đợt này làm **hai mốc đầu tiên có tác động tiền bạc trực tiếp**: cutoff bán hàng và hạn giữ chỗ.

---

## 2. Quota là chính sách giữ chỗ có thời hạn, không phải vách ngăn cứng

Trước đây quota 70/30 là **vách ngăn vĩnh viễn**: slot sinh ra là `online` thì mãi mãi `online`. Hệ quả — 09:00 còn ghế trống dành cho khách online, khách đứng ở quầy lúc 08:55 vẫn bị từ chối, rồi tới 09:00 ghế đó bỏ không.

Nay slot online chưa bán **tự chuyển** thành walk-in tại `T-30'`.

Chảy **một chiều**. Walk-in không bao giờ chảy ngược thành online: trước cutoff, khách tới quầy không được lấy chỗ online của khung hiện tại (rule mục 4).

### Chỉ đụng slot `active`

`pending_payment` đang có người trong luồng thanh toán, `booked` đã bán. Đổi `loai_slot` của chúng là cướp chỗ người đã trả tiền. Điều kiện `status='active'` được lặp lại **trong `arrayFilters` lúc ghi**, không chỉ lúc đọc — giữa hai thời điểm đó có thể có người vừa giữ chỗ.

### Lazy + cron, không chỉ cron

Chuyển đổi chạy **ngay lúc có ai đọc lịch** (`donDepSlotTruocKhiDoc`), cron 5′ chỉ là lưới an toàn cho lịch không ai đọc tới. Nếu chỉ có cron, khách đứng ở quầy lúc `T-29'` phải chờ tới 5 phút mới thấy ghế mở ra — trong khi khung chỉ dài 30 phút.

Thứ tự trong `donDepSlotTruocKhiDoc` quan trọng: **nhả giữ chỗ quá hạn trước**, rồi mới xét cutoff. Ngược lại thì slot vừa được nhả phải chờ lượt quét sau mới được chuyển.

Cron quét toàn hệ thống **chỉ từ hôm nay trở đi** — lịch quá khứ đã qua cutoff từ lâu, chuyển cũng vô nghĩa mà lại ghi đè hàng nghìn bản ghi cũ.

---

## 3. Giữ chỗ co giãn

```js
paymentDeadline = min(now + 15', T - 15')
```

Cửa sổ cố định 15′ có một lỗ hổng tinh vi: khách bấm đặt lúc `T-20'` thì giữ chỗ sống tới `T-5'`. Slot chỉ được nhả **sau** mốc `T-15'` — đúng lúc lễ tân đã hết quyền bán khung đó. Ghế trống mà không ai ngồi được.

Co giãn bảo đảm slot bỏ dở luôn quay về pool **trước** cutoff.

Khi `now ≥ T-15'`, hàm trả `null` và `createBooking` từ chối — không cấp giữ chỗ nào nữa.

---

## 4. Chặn bằng mốc thời gian, không bằng trạng thái dữ liệu

`createBooking` kiểm `daQuaCutoffOnline()` **độc lập** với việc slot đã được chuyển sang `walk_in` hay chưa.

Lý do: khách có thể bấm đặt từ một trang đã mở sẵn trước cutoff, hoặc quét lazy chưa kịp chạy. Trạng thái dữ liệu là *kết quả* của một lần quét; mốc thời gian mới là *nguồn sự thật*. Kiểm cả hai là phòng vệ nhiều lớp cho đúng thứ đang bảo vệ tiền của khách.

---

## 5. Đã làm

| File | Thay đổi |
|---|---|
| `utils/clinicTime.js` | `cacMocCuaKhung()`, `daQuaCutoffOnline()`, `hanGiuChoCoGian()` + 3 hằng chính sách `PHUT_DONG_DAT_ONLINE` / `PHUT_HAN_CHOT_GIU_CHO` / `PHUT_GRACE` |
| `services/slotRelease.service.js` | `chuyenSlotOnlineQuaCutoffTrongLich()`, `chuyenSlotOnlineQuaCutoffToanHeThong()`, `donDepSlotTruocKhiDoc()` |
| `controllers/patient/booking.controller.js` | Quét lazy đầy đủ; chặn đặt sau cutoff; giữ chỗ co giãn |
| `controllers/receptionist/booking.controller.js` | Quét lazy đầy đủ — lễ tân thấy ngay chỗ online vừa mở ra |
| `cron/index.js` | Thêm bước chuyển cutoff vào nhịp 5′, chạy sau bước nhả slot |

---

## 6. Kiểm chứng

### Mốc thời gian (khung 09:00 giờ VN)

```
T = 09:00 · đóng đặt 08:30 · hạn giữ chỗ 08:45 · hết grace 09:15   ✓

Cutoff:  08:00 chưa qua ✓ · 08:29 chưa qua ✓ · 08:30 ĐÃ qua ✓ · 08:45 ĐÃ qua ✓
         giờ rỗng → coi như đã qua (an toàn: không chào bán khung không rõ giờ) ✓

Giữ chỗ: 08:00 → 15'  ✓   08:30 → 15'  ✓   08:35 → 10'  ✓
         08:44 → 1'   ✓   08:45 → null ✓   09:00 → null ✓
```

### Chuyển đổi cutoff, giả lập "bây giờ" = 09:45

```
Trước:  09:00: 1 online, 1 walk-in
        10:00: 1 online, 1 walk-in, 1 đang giữ
        11:00: 1 online, 1 walk-in, 1 đã bán

Sau:    09:00: 0 online, 2 walk-in           ← đã qua cutoff
        10:00: 0 online, 2 walk-in, 1 đang giữ  ← slot đang giữ KHÔNG bị đụng
        11:00: 1 online, 1 walk-in, 1 đã bán    ← chưa tới cutoff (T-30' = 10:30)
```

Nhật ký: một bản ghi/lịch/lần quét — *"Qua moc T-30': chuyen 2 slot online chua ban sang walk-in (khung 09:00, 10:00)"*. Chạy lại không chuyển thêm và không ghi nhật ký rác (idempotent) ✓

### Test suite

58/58 pass trên môi trường độc lập.

---

## 7. Ảnh hưởng sang khu vực thành viên khác

| Khu vực | Mức độ |
|---|---|
| **Client** | **Đổi hành vi**: không đặt được online trong vòng 30 phút trước giờ khám (409 kèm hướng dẫn ra quầy). Hạn thanh toán có thể ngắn hơn 15 phút khi đặt sát giờ |
| **Lễ tân** | **Được lợi**: thấy thêm chỗ khi khung tới `T-30'` mà chỗ online chưa bán |
| **Bác sĩ** | Không đổi |
| **Admin** | Không đổi code; nhật ký hệ thống có thêm `CHUYEN_SLOT_ONLINE_SANG_WALK_IN` |

Điểm cần nói rõ với người làm **client**: nếu FE đang hiển thị đếm ngược thanh toán cố định 15 phút thì phải đọc `payment_deadline` từ response thay vì tự cộng 15 phút — nay giá trị này co giãn.

---

## 8. Chưa làm

- Hạn chót **xin dời lịch** tại `T-30'` — luồng dời lịch chưa tồn tại (mục 5/14/15)
- Grace `T` → `T+15'` và bậc ưu tiên hàng đợi — thuộc mục 6
- `no_show` tự động khi hết ca — thuộc mục 8
- Mục 12 (tự gán bác sĩ + giá theo chuyên khoa), 13 (chặn lễ tân đặt hộ), 14/15
