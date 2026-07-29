# Phân tích trước khi sửa — Cơ chế nhả slot + múi giờ (2026-07-25)

> **Mục đích:** xác định chính xác phạm vi sửa, ai bị ảnh hưởng, rủi ro gì — TRƯỚC khi viết code.
> **Lý do cần bản này:** các file phải sửa nằm ở vùng **Client** và **Lễ tân**, không phải vùng Bác sĩ. Nhóm tách nhánh theo actor nên mọi thay đổi phải kiểm soát được.

---

## 1. ĐÍNH CHÍNH kết luận trước đây về múi giờ

Trong `docs/Phan tich lo hong luong dat lich Online-Offline (2026-07-25).md` mục L16, tôi viết:

> *"`buildSlotDateTime` dùng `setUTCHours`… trong khi `cancelBooking` lại dùng `setHours` (giờ local). Hai nơi hai hệ quy chiếu."*

**Sai.** `backend/src/config/timezone.js` ép `process.env.TZ = 'UTC'` cho **toàn tiến trình**, nên `setHours` và `setUTCHours` là **một**. Đó không phải nguyên nhân.

**Nguyên nhân thật:** chuỗi `"08:00"` trong `slots.gio_bat_dau` là **giờ phòng khám (VN, UTC+7)**. Muốn đổi ra mốc tuyệt đối phải trừ 7.

| File | Cách viết | Đúng? |
|---|---|---|
| `receptionist/booking.controller.js:32` | `setUTCHours(hours - 7, minutes)` | ✅ ĐÚNG |
| `patient/booking.controller.js:45` | `setUTCHours(hours, minutes)` | ❌ SAI, lệch +7h |

Hai file có **cùng tên hàm** `buildSlotDateTime` nhưng hai cách hiện thực khác nhau — bản Lễ tân đã được sửa, bản Client thì chưa. Đây là lỗi phân kỳ do sao chép.

**Kiểm chứng thực nghiệm (đã chạy):** lúc 14:02 giờ VN, API Client chào bán 9 khung đã qua (08:00→14:00) và cho đặt + thanh toán khung 08:00. Đúng với `08:00` bị hiểu thành `08:00Z = 15:00 VN` → vẫn ở tương lai.

### Các chỗ khác mắc cùng lỗi

| File | Dòng | Ảnh hưởng | Vùng |
|---|---|---|---|
| `patient/booking.controller.js` | 45 | `getSlots` + `createBooking` cho đặt khung quá khứ | **Client** |
| `patient/booking.controller.js` | 513 | `cancelBooking` chặn hủy sai thời điểm | **Client** |
| `services/bookingPaymentState.service.js` | 305 | So sánh giờ khám khi hủy/hoàn | **Chung** |
| `doctor/queue.controller.js` | 53, 84 | `gio_hen_goc` sai → **bậc ưu tiên hàng đợi sai** (rule §6) | **Bác sĩ** |

⚠️ `queue.controller.js:53` có comment *"local — KHÔNG dùng setUTCHours (tránh lệch múi giờ)"* — comment này **gây hiểu nhầm**, vì dưới `TZ=UTC` hai hàm giống hệt nhau. Code vẫn lệch 7 tiếng.

---

## 2. Vì sao `pre('validate')` KHÔNG dùng được (đính chính thiết kế đề xuất trước)

Ở lượt trao đổi trước tôi đề xuất "Lớp 3 — chặn tạo giữ chỗ không hạn bằng `pre('validate')` trong `LichLamViec.js`". **Không hiệu quả**, vì:

| Đường ghi | Cách ghi | `pre('validate')` chạy? |
|---|---|---|
| `patient/booking.controller.js:353` — nơi DUY NHẤT tạo `pending_payment` | `findOneAndUpdate` | ❌ **Không** (query middleware bỏ qua document middleware) |
| `admin/slots.controller.js:628` — admin sửa tay | `schedule.save()` | ✅ Có |

Nghĩa là hook chỉ chặn được đường admin, không chặn được đường chính. Và vì đường chính **vốn đã** set cả `status` lẫn `pending_expired_at` cùng lúc (dòng 368–370), 9 slot `pending_expired_at = null` gần như chắc chắn đến từ **admin sửa tay** (`slots.controller.js` cho phép set `status` mà không bắt set `pending_expired_at`) hoặc dữ liệu cũ.

**Kết luận thiết kế:** phòng vệ phải nằm ở **lúc ĐỌC**, không phải lúc ghi. Bộ quét coi `pending_payment` mà `pending_expired_at = null` là **hỏng → nhả luôn**. Như vậy tự chữa được mọi nguồn gây lỗi, kể cả nguồn chưa biết.

Vẫn giữ `pre('validate')` như lớp phụ để chặn đường admin — rẻ, không hại.

---

## 3. Lỗi phát sinh phát hiện trong lúc phân tích

### F6 — `getSlots` không lọc slot bị khóa bởi nghỉ phép

`patient/booking.controller.js` `getSlots` lọc `status`, `benh_nhan_id`, quá khứ, `loai_slot` — **thiếu `bi_khoa_boi_nghi_phep`**. Trong khi `createBooking` (dòng 343) **có** kiểm tra.

Hệ quả: bác sĩ được duyệt nghỉ một khung → khung đó vẫn hiện cho bệnh nhân đặt → bấm đặt thì lỗi 409. Có **2 test đang fail** chứng minh:

- `not ok 40` — *Duyet nghi theo khung gio… patient khong con thay khung gio do*
- `not ok 43` — *getSlots va createBooking loai slot co bi_khoa_boi_nghi_phep=true du status con active*

Vì tôi phải sửa đúng hàm này, sửa luôn — có test sẵn để kiểm chứng.

### F7 — Mốc test hiện tại: 6/64 test backend đang FAIL trước khi tôi sửa

| Test | Liên quan việc đang làm? |
|---|---|
| 9 — `pending-results` chỉ trả hồ sơ `cho_xac_nhan` | Không |
| 13 — sửa `so_ngay` trong đơn thuốc | Không |
| 14 — `thuoc=[]` xóa hết đơn thuốc | Không |
| 37 — `request-revision` bởi bác sĩ khác → 404 | Không |
| **40 — duyệt nghỉ theo khung giờ** | **Có** — F6 |
| **43 — `getSlots` lọc `bi_khoa_boi_nghi_phep`** | **Có** — F6 |

Ghi lại mốc này để sau khi sửa đối chiếu: **không được vượt quá 4 test fail** (6 hiện tại − 2 cái F6 sẽ sửa được).

---

## 4. Bản đồ tác động theo vùng

| File | Vùng sở hữu | Thay đổi | Rủi ro với người khác |
|---|---|---|---|
| `utils/clinicTime.js` *(mới)* | Chung | Hàm chuẩn đổi giờ phòng khám → mốc tuyệt đối | Không — file mới |
| `services/slotRelease.service.js` *(mới)* | Chung | Bộ quét nhả slot | Không — file mới |
| `patient/booking.controller.js` | **Client** | Dùng hàm chuẩn; thêm quét lazy; thêm lọc `bi_khoa_boi_nghi_phep` | **Trung bình** — giữ nguyên hình dạng response |
| `receptionist/booking.controller.js` | **Lễ tân** | Dùng hàm chuẩn (thay bản `-7` cục bộ); thêm quét lazy | **Thấp** — logic giờ giống hệt bản cũ |
| `doctor/queue.controller.js` | Bác sĩ | Dùng hàm chuẩn cho `gio_hen_goc` | Thấp — vùng của tôi |
| `services/bookingPaymentState.service.js` | Chung | Dùng hàm chuẩn | **Trung bình** — đụng luồng hủy/hoàn |
| `cron/index.js` | Hạ tầng chung | 15′ → 5′, thêm quét từ phía slot | Thấp — thêm việc, không bỏ việc cũ |
| `models/LichLamViec.js` | Model chung | `pre('validate')` phụ | **Thấp** nhưng cần thử kỹ: model dùng bởi mọi actor |

### Nguyên tắc tự ràng buộc khi sửa

1. **Không đổi hình dạng response** của bất kỳ API nào — chỉ đổi *nội dung* (slot quá khứ biến mất, slot khóa biến mất).
2. **Không đổi chữ ký hàm** đang được nơi khác gọi.
3. Bộ quét chỉ chuyển `pending_payment → active`, **không đụng** `booked`, `locked`, `cancelled`, và **không đụng** `LichHen`/`HoaDon`/`ThanhToan`.
4. Mỗi file sửa xong chạy lại **toàn bộ** test backend, đối chiếu mốc 6 fail.

---

## 5. Điều gì sẽ THAY ĐỔI HÀNH VI (cần báo cả nhóm)

Đây là phần quan trọng nhất — sau khi sửa, **hành vi hệ thống khác đi**:

| Trước | Sau | Ai thấy khác |
|---|---|---|
| Khung giờ đã qua trong ngày **vẫn hiện** và đặt được | Biến mất khỏi danh sách | **Client** — số khung trống hôm nay giảm mạnh (thực nghiệm: 15 → 6 lúc 14:02) |
| Khung bị khóa do nghỉ phép vẫn hiện | Biến mất | **Client** |
| Slot giữ chỗ quá hạn khóa vĩnh viễn | Tự nhả khi có người đọc lịch | **Client + Lễ tân** — số khung trống tăng |
| Cron dọn mỗi 15′ | 5′ | Hạ tầng |
| `gio_hen_goc` lệch 7h | Đúng giờ | **Bác sĩ** — thứ tự hàng đợi đổi (đúng rule §6) |

⚠️ **Rủi ro demo:** nếu nhóm đang demo bằng dữ liệu có khung giờ trong quá khứ, sau khi sửa các khung đó **không còn đặt được nữa**. Đó là hành vi ĐÚNG, nhưng phải báo trước để không ai tưởng hỏng.

---

## 6. Việc KHÔNG làm trong đợt này

- **Giữ chỗ co giãn `min(15', T-15' − now)`** (rule §11) — cần múi giờ đúng trước đã. Để đợt sau.
- **Sửa 86 slot `booked` mồ côi** — cần soi từng cái, không gộp vào đây.
- **Enum `hinh_thuc_dat_lich` + `nguon`** — đổi schema, phạm vi rộng, tách riêng.
- **Cutoff `T-30'` đóng đặt online** — nghiệp vụ mới, không phải sửa lỗi.

---

## 7. Kế hoạch kiểm chứng

1. `npm test` backend trước khi sửa → ghi mốc **6 fail** ✅
2. Sửa từng file, chạy lại test sau mỗi file ✅
3. Đích: **≤ 4 fail**, và 2 test F6 phải chuyển sang pass ✅
4. Frontend: `tsc` + `vitest` + `vite build` ✅
5. Chạy thật trên DB test: khung quá khứ **không** còn chào bán ✅
6. Slot giữ chỗ quá hạn tự nhả khi đọc lịch ✅

---

## 8. KẾT QUẢ (2026-07-25)

### Test backend: 6 fail → **4 fail**, ổn định qua 2 lần chạy liên tiếp

| Test | Trước | Sau | Ghi chú |
|---|---|---|---|
| 43 — `getSlots` lọc `bi_khoa_boi_nghi_phep` | ❌ | ✅ | Sửa bằng F6 |
| 40 — duyệt nghỉ theo khung giờ | ❌ | ✅ | **Test viết sai**, không phải code sai — xem dưới |
| 9, 13, 14, 37 | ❌ | ❌ | Có sẵn, không liên quan (đơn thuốc / xác nhận hồ sơ) |

**Test 40 — lỗi nằm ở TEST, không ở code.** Dòng 142 chọn `keepSlot` là *"slot active bất kỳ khác `_id`"*, không đòi khác **khung giờ**. Theo rule §1–§2 một khung 30′ chứa nhiều slot (TMH 2 slot/khung), nên `keepSlot` có thể cùng khung với `targetSlot` → duyệt nghỉ khung đó khóa cả hai là **đúng quy tắc giao giờ**, test lại đòi nó phải `active`. Đã sửa điều kiện chọn thành `s.gio_bat_dau !== targetSlot.gio_bat_dau` — đúng ý định gốc *"slot **không liên quan**"*. Logic overlap trong `admin/doctor-leaves.controller.js:80` **không đụng tới**, vì nó vốn đúng.

Trước khi sửa, test 40/41/43 **dao động** giữa các lần chạy (dùng chung DB, phụ thuộc thứ tự). Sau khi sửa: ổn định.

### Kiểm chứng chạy thật (DB test, lúc 21:52 giờ VN)

| Kiểm tra | Kết quả |
|---|---|
| Khung quá khứ còn chào bán? | **0 khung** — trước đây chào 9 khung đã qua |
| Đặt được khung 08:00 (đã qua 13 tiếng)? | **400 — "Khung giờ đã qua"** — trước đây trả 201 và thu tiền |
| Slot giữ chỗ **quá hạn** tự nhả khi đọc lịch? | ✅ `pending_payment → active`, xóa `benh_nhan_id` |
| Slot giữ chỗ **vô hạn** (`pending_expired_at = null`) tự nhả? | ✅ — đây là nhóm mà cơ chế cũ không bao giờ với tới |

### Frontend

`tsc` sạch trên các file liên quan · `vitest` 50/50 qua, 13 file · so với **cây sạch cũng 50** (dùng `git stash` đối chiếu) → không hồi quy.

---

## 9. LỖI TỰ GÂY RA — phát hiện ở lượt rà soát sau khi sửa

### Hook `pre('validate')` chặn nhầm mọi luồng khác — ĐÃ SỬA

Bản đầu tôi viết:

```js
if (this.status === 'pending_payment' && !this.pending_expired_at) throw ...
```

Mongoose kiểm **mọi subdocument** khi `.save()` lịch cha. Nên chỉ cần trong `slots[]` còn **một** slot xấu sót lại (dữ liệu cũ, admin sửa tay) là **toàn bộ** các luồng gọi `schedule.save()` trên lịch đó vỡ theo:

| Đường `.save()` | Hậu quả nếu vỡ |
|---|---|
| `bookingPaymentState.service.js:102` `releaseAppointmentSlot` | **Khách không hủy được lịch hẹn** |
| `bookingPaymentState.service.js:120` `markAppointmentSlotBooked` | Thanh toán xong không chốt được slot |
| `admin/doctor-leaves.controller.js:95` | Admin không duyệt được nghỉ phép |
| `admin/slots.controller.js:628, 683` | Admin không sửa được slot khác cùng ngày |

**Kiểm chứng thực nghiệm:** ghi thô một slot xấu → sửa slot **khác** rồi `.save()` → `❌ LichLamViec validation failed`. Đúng như lo ngại.

**Sửa:** chỉ kiểm slot **thực sự bị đụng** trong lần lưu đó — `this.isModified() && ...`. Ba kịch bản sau khi sửa:

| Kịch bản | Kết quả |
|---|---|
| Luồng vô can sửa slot khác trong lịch có slot xấu | ✅ `save()` thành công |
| Kẻ tạo ra slot xấu (set `pending_payment` không hạn) | ✅ bị chặn đúng |
| Giữ chỗ hợp lệ (có hạn) | ✅ cho qua |

**Bài học:** hook validate cấp subdocument có bán kính ảnh hưởng bằng **cả mảng**, không chỉ phần tử đang sửa. Thêm ràng buộc mới vào schema có sẵn dữ liệu bẩn thì phải giới hạn bằng `isModified()`.

### Kiểm tra bổ sung sau khi sửa

| Hạng mục | Kết quả |
|---|---|
| Luồng đầy đủ đặt → hủy → nhả slot | ✅ 15 khung → đặt còn 14 → hủy về lại 15 |
| Ghi khi đọc có tạo tải vô ích? | ✅ Không — thoát sớm khi không có slot hỏng |
| Hai request đọc đồng thời ghi đè nhau? | ✅ Không — `arrayFilters` kèm `status: 'pending_payment'` |
| Hình dạng response API | ✅ Không đổi (bỏ `.lean()` nhưng vẫn `.map()` ra object thuần) |
| Test backend | ✅ 4 fail (mốc 6), ổn định |
| Frontend | ✅ `tsc` 0 lỗi · 50/50 test · `vite build` thành công |

### Còn tồn — không phải lỗi, nhưng nên biết

- **Bản ghi `HangDoi` cũ** mang `gio_hen_goc` lệch 7 tiếng (tạo trước khi sửa). Không migrate vì hàng đợi là dữ liệu trong ngày, tự hết sau khi đóng ca.
- **`doctor/schedule.controller.js` chưa quét lazy** — bác sĩ có thể thấy "Giữ chỗ" thêm tối đa 5 phút cho tới khi cron chạy hoặc có ai đọc qua đường đặt lịch. Cố ý: trang bác sĩ là đường *xem*, không phải đường *đặt*; không mở rộng bề mặt ghi ở nơi không cần.

### Chưa làm — cần đợt sau

- **Giữ chỗ co giãn `min(15', T-15' − now)`** (rule §11). Giờ đã có nền múi giờ đúng nên làm được, nhưng là **nghiệp vụ mới**, không phải sửa lỗi.
- **Cutoff `T-30'`** đóng đặt online + chuyển slot online dư sang walk-in.
- 4 test fail còn lại (9, 13, 14, 37) — thuộc luồng đơn thuốc / xác nhận hồ sơ, chưa điều tra.
