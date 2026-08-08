# Rà soát sạch logic + dữ liệu trước khi triển khai (2026-07-25)

> Phạm vi: trang Lịch làm việc bác sĩ và dữ liệu nền phục vụ nó.
> Đã sửa toàn bộ phần **frontend/logic**. Phần **dữ liệu DB nhóm** chỉ báo cáo, **chưa thực thi** — cần người dùng quyết vì `DATN_VITAFAMILY` là DB dùng chung.

---

## PHẦN A — Đã sửa (logic + bố cục)

### A1. Ba từ vựng cho cùng một khái niệm "nguồn đặt lịch"

Gốc rễ của chuyện *"nơi thì tại chỗ, nơi thì khác"*. `LichHen.hinh_thuc_dat_lich` khai báo `{ type: String, default: null }` — **không có enum**, nên mỗi nơi ghi một kiểu:

| Giá trị | Ai ghi | Số bản ghi (DB thật) |
|---|---|---|
| `patient` | `patient/booking.controller.js:400` | 2 |
| `receptionist` | `receptionist/booking.controller.js:218,229` | 1 |
| `online` | **không code nào ghi** — giá trị mồ côi | 4 |
| *(thiếu hẳn)* | — | 98 |

Đồng thời `LichHen.nguon` — trường mà rule §10.D quy định **bắt buộc** để phân biệt `online`/`tai_cho` — hiện **null trên toàn bộ 105 bản ghi**. Nghĩa là ở tầng dữ liệu hệ thống *không phân biệt được* khách online với khách tại chỗ; nhãn "tại chỗ" trên giao diện chỉ là suy luận gián tiếp:

```js
// doctor/schedule.controller.js:46
const laKhachVangLai = !!a.khach_vang_lai_id || (!a.user_id && !a.member_id && !!a.ten_khach)
```

**Đã sửa ở FE:** bỏ nhãn "tại chỗ" gắn theo suy luận này khỏi chip bệnh nhân. Bảng phân biệt online/tại chỗ theo `slots.loai_slot` — trường có thật, đúng nghiệp vụ rule §4 — chứ không suy từ việc bản ghi thiếu field nào.

**Còn cần làm (backend, chưa làm):** thêm enum cho `hinh_thuc_dat_lich`, thêm `nguon` bắt buộc, migrate 98 bản ghi thiếu + 4 bản ghi `online`.

### A2. Nhãn trạng thái nghỉ chết (nguồn của "chờ admin duyệt" lung tung)

`LEAVE_STATUS_LABEL` khai 4 trạng thái, nhưng `findCoveringLeave()` (`utils/scheduleWeek.ts`) đã lọc sẵn chỉ `cho_duyet|da_duyet`. Hai nhãn `tu_choi` / `da_huy` **không bao giờ render được** — code chết gây tưởng nhầm là trạng thái có thật.
→ Xoá 2 nhãn chết, rút gọn `"Chờ Admin duyệt"` → `"Chờ duyệt nghỉ"`.

### A3. Hai mẫu số khác nhau cho cùng một chữ "chỗ"

Rule §4: online và walk-in là **hai quota riêng**, không được cộng gộp. Nhưng:

| Chỗ | Trước | Vấn đề |
|---|---|---|
| Đầu cột ca sáng | `4/11 chỗ` | Đếm cả slot walk-in |
| Từng dòng khung | `x/2 chỗ` | Đếm chỉ online |
| Lịch tuần | `4/19` | Đếm tất cả slot |

Cộng các dòng ra `4/9` nhưng đầu cột ghi `4/11` — mâu thuẫn nội bộ do tôi gây ra ở bản trước.
→ Đầu cột đếm cùng mẫu số với các dòng, và ghi rõ **`4/9 chỗ online`** để không lẫn với `4/19` của lịch tuần (lịch tuần là tổng sức chứa ngày, dùng chung với trang Admin nên giữ nguyên).

### A4. Khung `0/0 chỗ`

Khung chỉ có slot walk-in hiện `0/0 chỗ` — vô nghĩa.
→ Hiện `chỉ khách tại chỗ`.

### A5. Bố cục bị chữ dài che khuất

Chip tên bệnh nhân là `inline-flex` **không giới hạn chiều rộng**, `truncate` bên trong không có tác dụng vì thiếu `min-w-0` ở nút con và `max-w` ở nút cha. DB thật có tên **36 ký tự** (`TEST_PATIENT_TODAY_01 Trịnh Bảo Long`) → chip giãn ra, đẩy nút hành động tràn khỏi dòng.
→ `max-w-[15rem]` + `min-w-0` + `shrink-0` cho phần tử phụ. Kiểm chứng bằng chính tên 36 ký tự đó: cắt gọn thành `TEST_PATIENT_TODAY_0…`, có `title` để xem đầy đủ khi trỏ chuột.
→ Cột hành động cố định `w-[104px]`, nút rút còn `"Xin nghỉ"` (tooltip ghi rõ khung giờ).

### A6. Placeholder che lấp dữ liệu lỗi

Slot `booked` không join được `LichHen` thì trước đây hiện `"Bệnh nhân"` — trông như dữ liệu bình thường. DB thật có **86 slot** như vậy.
→ Hiện `"Thiếu dữ liệu lịch hẹn"` màu đỏ + banner cảnh báo đếm số chỗ ở đầu bảng. Không bịa placeholder lên dữ liệu sai.

### A7. Câu tuyên bố sai ở chân bảng

Trước ghi *"Bảng này chỉ hiển thị khách đặt online"* — **sai**, vì bảng vẫn hiện slot walk-in và lễ tân vẫn đặt được vào slot.
→ Viết lại đúng: tỷ lệ chỗ tính theo quota online, quota tại chỗ ghi tách, danh sách bệnh nhân thực đến nằm ở Hồ sơ chờ khám sau check-in.

### A8. Tài khoản demo sai vai trò (đã sửa ở lượt trước)

`haiv5634@gmail.com` mang `role='user'` dù tên là "BS. Trần Minh Khang" → đăng nhập bị đẩy về trang client. Đổi sang `doctor.bao@vitafamily.vn`. Bỏ luôn `{password}` render từ trường không tồn tại.

---

## PHẦN B — Dữ liệu DB cần dọn (CHƯA THỰC THI — cần bạn quyết)

Kết quả quét `DATN_VITAFAMILY` (chỉ đọc):

| # | Vấn đề | Số lượng | Hệ quả |
|---|---|---|---|
| B1 | Slot thiếu `loai_slot` | **4522 / 4762** (95%) | FE mặc định coi là `online` → quota 70/30 không tồn tại trên dữ liệu cũ |
| B2 | Slot `walk_in` | chỉ 72 | Migration mới chạy một phần |
| B3 | `lich_hen.nguon` = null | **105 / 105** | Không phân biệt online / tại chỗ ở tầng dữ liệu (rule §10.D) |
| B4 | `hinh_thuc_dat_lich` thiếu | 98 / 105 | Không biết lượt nào do ai tạo |
| B5 | `hinh_thuc_dat_lich = 'online'` | 4 | Giá trị mồ côi, không code nào ghi |
| B6 | Slot `booked` **không có** `LichHen` | **86** | Bảng ca hiện "đã đặt" nhưng không biết ai; chỗ bị chiếm vô cớ |
| B7 | Slot `pending_payment` bị kẹt vĩnh viễn | **20** ✅ ĐÃ SỬA | Chỗ khoá vĩnh viễn, không ai đặt được (lỗ hổng L1/L19) |
| B8 | Cặp `(bác sĩ, ngày)` có >1 bản ghi lịch | **18** | Unique index `{doctor_id, ngay}` không bắt được vì 2 Date instant khác nhau cùng ngày lịch |
| B9 | Rác test trong DB thật | tên `TEST_PATIENT_TODAY_*`, `Nguyễn Thị Hạnh (TEST)`, 2 tài khoản `*.test@vitafamily.local` | Dữ liệu demo lẫn dữ liệu test |

### B7 — ĐÃ THỰC THI 2026-07-25

**Đếm lại: 20 slot, không phải 11.** Báo cáo đầu thiếu 9 slot có `pending_expired_at = null` — giữ chỗ **không hạn**, không bao giờ hết hạn nên cũng không bao giờ được nhả. Cùng loại lỗi, nặng hơn nhóm quá hạn.

**Nguyên nhân gốc:** cơ chế nhả slot chạy **từ phía lịch hẹn** — cron `autoCancelExpiredHomeAppointments` tìm `LichHen` có `payment_deadline < now` rồi gọi `releaseAppointmentSlot({ appointment })`. Slot không còn `LichHen` trỏ tới thì **không có đường nào** để nhả:

| Tình trạng lịch hẹn | Số slot |
|---|---|
| Không tồn tại `LichHen` | 18 |
| `LichHen` đã `cancelled`, `payment_deadline = null` | 2 |

Luồng hủy **hiện tại đã đúng** (`cancelAppointmentWithPaymentSync` có gọi `releaseAppointmentSlot`) — 2 slot kia là di sản từ đường ghi thô cũ, vẫn còn dấu vết ở đoạn comment trong `patient/booking.controller.js` `cancelBooking`.

**Đã làm:** `backend/src/scripts/release-stuck-pending-slots.js` — mặc định dry-run, phải `--apply` mới ghi; sao lưu document bị ảnh hưởng ra `backend/backups/*.json` trước khi ghi; **bỏ qua** slot đang giữ chỗ hợp lệ (`pending_expired_at` còn ở tương lai) và slot có lịch hẹn còn hạn (để cron xử lý đúng luồng); ghi `NhatKyThaoTac` cho từng lịch bị tác động.

Kiểm chứng: chạy thử trên DB test với 3 slot dựng sẵn (quá hạn / vô hạn / còn hạn) → nhả đúng 2, bỏ đúng 1. Trên DB thật: nhả 20/20, sao lưu 15 document, quét lại còn **0** slot `pending_payment` kẹt.

⚠️ **Còn thiếu (chưa làm):** cơ chế **quét từ phía slot** + nhả lazy lúc đọc lịch theo rule §11. Không có nó, slot vẫn kẹt lại nếu giao dịch vỡ giữa đường hoặc `LichHen` bị xoá thủ công — script này chỉ dọn hậu quả, không chặn nguyên nhân.

### Thứ tự dọn còn lại

1. **B6** (86 slot mồ côi) — cần soi từng cái: là lỗi ghi dở, hay `LichHen` bị xoá thủ công? **Không nên xoá hàng loạt.**
3. **B8** (18 ngày trùng) — chọn bản ghi giữ lại theo bản có lịch hẹn thật; đồng thời sửa index thành `(doctor_id, ngay, ca)` như rule §10.C.
4. **B1/B2** — backfill `loai_slot` cho slot tương lai chưa ai đặt, đi kèm việc khôi phục cấu hình `ChuyenKhoa` (lỗ hổng L14). Slot quá khứ để nguyên.
5. **B3/B4/B5** — thêm enum + `nguon`, migrate theo `hinh_thuc_dat_lich` hiện có (`patient`→`online`, `receptionist`→`tai_cho`), 98 bản thiếu suy từ `khach_vang_lai_id`.
6. **B9** — xoá rác test, nhưng cần bạn xác nhận từng tài khoản không phải dữ liệu demo đang dùng.

⚠️ **Chưa chạy bất kỳ thao tác ghi nào lên `DATN_VITAFAMILY`.** Mọi kiểm thử thực hiện trên `DATN_VITAFAMILY_CLAUDE_TEST`.

---

## PHẦN C — Kiểm chứng đã chạy

- `tsc --noEmit`: sạch trên `DayShiftBoard.tsx`, `DoctorSchedule.tsx`, `ScheduleCalendarGrid.tsx`, `Login.tsx`
- `vitest run`: 51/51 qua, 13 file
- `vite build`: thành công
- Xem trực tiếp trên trình duyệt với **dữ liệu xấu nhất cố ý tạo**: tên 36 ký tự, slot walk-in, slot `booked` mồ côi, khung chỉ có walk-in → không tràn bố cục, không placeholder giả, số liệu nhất quán giữa đầu cột và các dòng.

**Chưa kiểm được:** hiển thị trên màn hình hẹp (mobile) — mới xem ở 1568px. Bố cục dùng `lg:grid-cols-2` nên dưới 1024px hai ca xếp dọc, nhưng chưa xem tận mắt.
