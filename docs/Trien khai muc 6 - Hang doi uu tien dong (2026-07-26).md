# Triển khai mục 6 — Hàng đợi, ưu tiên động — 2026-07-26

Tiếp nối `docs/Trien khai muc 11 - Moc thoi gian cua khung (2026-07-26).md`.
Rule: `.claude/rules/lich-lam-viec-bac-si.md` mục 6.

---

## 1. Lỗi cũ: đến sớm bị phạt oan

Cách cũ tính bậc ưu tiên **một lần lúc check-in** rồi lưu cứng vào `muc_uu_tien`, dựa trên cửa sổ `±30'` quanh giờ hẹn:

```js
if (treHon > 30) return 'offline'
if (|lech| <= 30) return 'online_uu_tien'
return 'online_thuong'
```

Khách check-in **sớm hơn 30 phút** rơi vào nhánh cuối — `online_thuong` — và giá trị đó **không bao giờ được cập nhật lại**. Kết quả: người đi sớm cho chắc bị xếp sau người thong thả tới trước giờ hẹn 5 phút, ngay cả khi khung của họ tới trước.

Đã chứng minh bằng số:

```
Khung T = 09:00.  A check-in 08:15 (sớm 45').  B check-in 08:55 (sớm 5').
  cách CŨ : A = online_thuong,  B = online_uu_tien   → B được gọi trước A
  cách MỚI: lúc 09:01 cả hai cùng online_uu_tien     → A được gọi trước (check-in sớm hơn)
```

---

## 2. Bậc ưu tiên tính động

`tinhBacUuTienDong(entry, now)` — thuần tính toán, không chạm DB:

| Bậc | Điều kiện |
|---|---|
| `online_uu_tien` | online, **đã tới khung** (`now ≥ T`) và check-in ≤ `T+15'` |
| `online_thuong` | online, đã check-in nhưng **chưa tới khung** (đến sớm) |
| `offline` | khách tới quầy, **hoặc** online check-in sau `T+15'` |

Người đến sớm **tự động** lên `online_uu_tien` khi `now` chạm `T` — không cần ghi lại gì, không cần cron.

Field `muc_uu_tien` trong DB được **giữ lại** nhưng đánh dấu deprecated: nay chỉ là snapshot lúc check-in phục vụ đối chiếu. Giữ để không phá dữ liệu cũ và không phá code thành viên khác đang đọc nó. API vẫn trả trường tên `muc_uu_tien` — nhưng là **giá trị động**, nên FE không cần đổi gì mà lại hiển thị đúng.

---

## 3. Aging chỉ nâng một bước

Rule: chờ quá 2 khung (60′) → nâng 1 bậc, chống bỏ đói khách vãng lai.

Cài đặt **chỉ nâng `offline → online_thuong`**, không nâng `online_thuong → online_uu_tien`.

Lý do: nâng người đến sớm lên `online_uu_tien` sẽ cho họ được gọi **trước đầu khung của mình**, trái ràng buộc ngay trong cùng mục 6. Họ đã tự lên bậc khi `now` chạm `T` rồi — aging thêm chỉ phá trật tự. Còn khách vãng lai không có khung nên không vướng ràng buộc đó, và họ mới chính là đối tượng aging sinh ra để cứu.

Aging cũng chỉ áp cho lượt `dang_cho`. Người đã vào phòng không cần ưu tiên nữa.

Ngưỡng đọc từ `QUEUE_AGING_PHUT`, mặc định 60.

---

## 4. Chặn gọi người đến sớm trước đầu khung

Ràng buộc trong `PATCH /doctor/queue/:id/call`: nếu bệnh nhân **chưa tới khung** của mình và **còn người khác đã tới lượt đang chờ** → 409.

Ngoại lệ đúng như rule: bác sĩ rảnh và không còn ai thuộc khung hiện tại thì gọi được. `so_lan_goi > 0` (đã gọi rồi) cũng bỏ qua kiểm tra — gọi lại luôn được.

Thông báo nói rõ tình huống thay vì mã lỗi:
> *Bệnh nhân này đến sớm, khung 09:00 chưa tới. Còn 3 người đã tới lượt đang chờ — gọi họ trước, hoặc chờ tới khung của bệnh nhân này.*

---

## 5. Overflow control — hai nấc

Bán tiếp khi ca đang trễ là cách chắc chắn nhất để biến một buổi chiều muộn 30 phút thành một buổi tối muộn 2 tiếng.

| Độ trễ | Hành động |
|---|---|
| ≥ 30′ (1 khung) | Ngừng bán slot **walk-in** cho các khung còn lại + cảnh báo lễ tân |
| ≥ 60′ (2 khung) | Chặn cả **đặt online** vào các khung còn lại |

### Đo độ trễ thế nào

Bằng **người đang chờ có khung sớm nhất**: bệnh nhân khung 09:00 mà 09:35 vẫn chưa được gọi → ca trễ 35 phút.

Đây là con số bệnh nhân *thực sự cảm nhận*, khác với cảnh báo "dự kiến xong lúc mấy giờ" đã có sẵn (`tinhCanhBaoQuaTai`) — cái đó là ước lượng tương lai. Hai cảnh báo nay được gộp lại trả về cùng nhau khi check-in.

Người đến sớm cho ra số âm → kẹp về 0: chưa tới khung của họ thì chưa ai trễ cả. Người đã vào phòng không tính.

Chỉ áp cho lịch **hôm nay** — độ trễ hôm nay không nói lên gì về ca ngày mai.

Ngưỡng đọc từ `OVERFLOW_NGUNG_WALKIN_PHUT` / `OVERFLOW_CHAN_ONLINE_PHUT` (rule yêu cầu ngưỡng là cấu hình, không hardcode).

---

## 6. Đã làm

| File | Thay đổi |
|---|---|
| `models/HangDoi.js` | `tinhBacUuTienDong()`, `daToiKhungCuaMinh()`, `soSanhThuTuHangDoi()`, `NGUONG_AGING_PHUT`; `tinhMucUuTien()` đánh dấu deprecated |
| `services/queueOverflow.service.js` | **MỚI** — `tinhDoTreCa()`, `kiemTraQuaTai()` |
| `controllers/doctor/queue.controller.js` | Sắp xếp bằng bậc động; chặn gọi trước khung; cảnh báo gộp; response thêm `muc_uu_tien_luc_checkin`, `gio_hen_goc`, `da_toi_khung` |
| `controllers/doctor/appointments.controller.js` | Sắp xếp + hiển thị bằng bậc động |
| `controllers/patient/booking.controller.js` | Chặn đặt online khi ca trễ ≥ 60′ |
| `controllers/receptionist/booking.controller.js` | Chặn nhận khách quầy khi ca trễ ≥ 30′ |

---

## 7. Kiểm chứng

```
Bậc động (khung T = 09:00):
  check-in T-45, xét lúc T-40  → online_thuong  (đến sớm)          ✓
  CÙNG người, xét lúc T        → online_uu_tien (tự lên bậc)       ✓
  check-in T+10 (trong grace)  → online_uu_tien                    ✓
  check-in T+16 (quá grace)    → offline                           ✓

Aging 60':
  vãng lai chờ 59'  → offline           ✓
  vãng lai chờ 60'  → online_thuong     ✓
  đến sớm chờ 90'   → online_thuong (KHÔNG lên uu_tien)  ✓
  đã vào phòng      → không aging       ✓

Overflow:
  trễ 10' → không chặn gì                        ✓
  trễ 30' → ngừng walk-in, vẫn cho đặt online    ✓
  trễ 65' → chặn cả hai                          ✓
  chỉ có người đến sớm → trễ 0                   ✓
  người đã vào phòng   → không tính              ✓
```

Test suite 58/58 pass. Frontend `tsc --noEmit`: 43 lỗi, đúng bằng baseline có sẵn.

---

## 8. Ảnh hưởng sang khu vực thành viên khác

| Khu vực | Mức độ |
|---|---|
| **Bác sĩ** | Thứ tự hàng đợi **đổi** (đúng hơn). Không gọi được người đến sớm khi còn người đã tới lượt |
| **Client** | Không đặt được khi bác sĩ đó đang trễ ≥ 60′ trong ngày hôm nay → 409 kèm gợi ý chọn bác sĩ/ngày khác |
| **Lễ tân** | Không nhận được khách tới quầy khi ca trễ ≥ 30′ |
| **Admin** | Không đổi |

FE **không cần sửa**: trường `muc_uu_tien` giữ nguyên tên và kiểu, chỉ là giá trị nay đúng. Ba trường mới (`muc_uu_tien_luc_checkin`, `gio_hen_goc`, `da_toi_khung`) là bổ sung, không phá gì.

---

## 9. Chưa làm

- Bậc `khan_cap` (rule mục 6 xếp trên cùng) — **chưa có cơ chế nào đánh dấu ca khẩn cấp** trong hệ thống, nên chưa cài đặt được
- Trạng thái `cho_dich_vu` trong vòng đời hàng đợi (enum đã mở, chưa có endpoint)
- Mục 12 (tự gán bác sĩ + giá theo chuyên khoa), 13 (chặn lễ tân đặt hộ), 14/15 (bác sĩ nghỉ / bận một khung)
