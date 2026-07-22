# Audit logic validate thời gian — Lịch làm việc bác sĩ (chống trùng lịch / double-booking / race)

> Ngày: 2026-07-20 · **Read-only** (không sửa code, không sửa DB). Đối chiếu schema + controller thật.
> Vai trò: Solution Architect + Backend + QA + BA. Phạm vi: `LichLamViec` (ca/slot) ↔ `LichHen` (lịch hẹn) ↔ nghỉ phép ↔ phòng ↔ y tá.

---

## 1. Tổng quan kiến trúc xử lý thời gian

**Mô hình = SLOT cố định, KHÔNG phải khoảng thời gian tự do.**
- `LichLamViec`: **1 document / (bác sĩ × ngày)** — ràng buộc bởi **unique compound index `{doctor_id, ngay}`**. Mảng `slots[]` nhúng, mỗi slot có `gio_bat_dau/gio_ket_thuc` (HH:MM), `status` (`active/pending_payment/booked/locked/cancelled/expired`), `phong_kham` (chuỗi), `benh_nhan_id`, `bi_khoa_boi_nghi_phep`.
- **Ai tạo ca:** `scheduleGenerator.service.js` (sinh tự động rolling-window) + **Admin** (`admin/slots.controller.js`: `createSchedule`, `ensureDoctorWorkday`, `updateSlot`, `updateWorkday`). **Bác sĩ KHÔNG tự tạo/sửa ca** (`doctor/schedule.controller.js` chỉ đọc + `request-cancel` slot).
- **Lịch hẹn lấy giờ từ đâu:** `LichHen.gio_kham` được gán = `slot.gio_bat_dau` của slot đã claim (KHÔNG nhận `gio_kham` từ client cho ca clinic). Liên kết THẬT qua `schedule_id` + `slot_id`.
- Luồng: Doctor → LichLamViec(slots) → LichHen(slot_id) → KetQuaKham.

**Mức độ đúng nghiệp vụ & an toàn — TỐT ở lõi**, còn một số lỗ hổng ở **phòng khám (room)**, **overlap slot khi admin sửa tay**, **y tá trùng giờ**, **defense-in-depth ở DB**, và **nghỉ phép không chặn phục vụ lịch cũ**.

### Điểm mạnh đã xác thực (đủ để chống trùng cơ bản)
1. **Unique index `{doctor_id, ngay}`** → không thể có 2 ca cùng bác sĩ/ngày; 2 request tạo đồng thời → request sau lỗi `11000` (create=400, ensure=409). ✅ (trả lời Giai đoạn 9 — race tạo ca).
2. **Model-level:** slot bắt buộc HH:MM hợp lệ + `gio_ket_thuc > gio_bat_dau` (chặn thời lượng 0/âm ngay ở `slotSchema.pre('validate')`). ✅
3. **Claim slot ATOMIC (chống double-booking):** `createBooking` dùng `LichLamViec.findOneAndUpdate` với điều kiện `slots.status='active' & benh_nhan_id=null & bi_khoa_boi_nghi_phep≠true` → `$set pending_payment` (positional `$`), **trong transaction**. 2 request đua chỉ 1 khớp, còn lại `updated=null` → 409. ✅ (trả lời Giai đoạn 9 — race đặt slot).
4. **Không đặt ngoài ca:** `gio_kham` = giờ của slot đã claim; slot phải thuộc `schedule_id` chọn + `trang_thai_ngay='lam_viec'` + `trang_thai_xac_nhan≠'tu_choi'` + không quá khứ. ✅ (Giai đoạn 6).
5. **Không sửa/nghỉ khi có bệnh nhân:** `updateSlot` đổi giờ/phòng/status khi slot có lịch → 409; `updateWorkday` sang nghỉ khi còn booked/lịch → 409. ✅ (Giai đoạn 8).
6. **Nghỉ phép duyệt (transaction):** khóa slot `active` giao khoảng nghỉ → `locked`; nghỉ cả ngày → `trang_thai_ngay='nghi_phep'` ⇒ `getSlots`/`createBooking` loại → **chặn đặt MỚI**. ✅

---

## 2. Danh sách lỗ hổng

### SCH-01 — Không kiểm tra **trùng phòng giữa 2 bác sĩ** (Medium–High)
- **Mô tả:** `phong_kham` chỉ là **chuỗi** trên slot; không có thực thể Room, không ràng buộc. Hai bác sĩ khác nhau có thể có slot cùng `phong_kham` + cùng giờ + cùng ngày mà không hề bị chặn ở bất kỳ đâu (create/update/booking).
- **Tái hiện:** Admin tạo ca BS A và BS B đều "Phòng 101" 08:00–08:15 cùng ngày → 2 bệnh nhân đặt được → **2 bác sĩ 1 phòng cùng lúc**.
- **Hậu quả:** xung đột phòng vật lý khi vận hành. **Không có** room overlap / availability / capacity.

### SCH-02 — Không validate **overlap giữa các slot trong cùng ca** (Medium)
- **Mô tả:** `createSchedule`/`updateSlot` chỉ kiểm HH:MM + start<end **từng slot**, KHÔNG kiểm 2 slot giao nhau. Boundary: `08:00–12:00` và `10:00–11:00` (bao nhau) hoặc `08:00–12:00` và `11:30–13:00` (giao) hoặc trùng khít `08:00–12:00`×2 → **đều được chấp nhận**. `12:00–12:00` (thời lượng 0) bị model chặn; `08:00–12:00` & `12:00–16:00` (kề nhau) hợp lệ đúng.
- **Điều kiện:** chỉ xảy ra khi **Admin tạo/sửa slot thủ công** (generator sinh lưới cố định không chồng). 
- **Hậu quả:** một bác sĩ có 2 slot chồng giờ → 2 lịch hẹn cùng thời điểm cho 1 bác sĩ.

### SCH-03 — Không chặn **1 y tá trực 2 bác sĩ trùng khung giờ** (Medium)
- **Mô tả:** `LichLamViec.nurse_id` gán theo ngày; nurse-scope **cố ý** cho phép y tá hỗ trợ nhiều bác sĩ ("ca nhiều bác sĩ"). Nhưng KHÔNG có kiểm tra **giao giờ**: gán 1 y tá cho 2 bác sĩ có khung giờ chồng nhau vẫn được.
- **Hậu quả:** y tá bị phân công ở 2 phòng cùng thời điểm — bất khả thi vận hành. Không có validate khi gán nurse_id.

### SCH-04 — Thiếu **ràng buộc DB chống đặt trùng slot** (defense-in-depth) (Medium)
- **Mô tả:** Chống double-booking **hoàn toàn ở tầng ứng dụng** (atomic slot flip). `LichHen` **không** có unique index trên `(schedule_id, slot_id)` (hay `(doctor_id, ngay_kham, gio_kham)`) cho các trạng thái còn hiệu lực. Nếu **bất kỳ luồng tạo lịch khác** (receptionist/admin tạo lịch tay, seed, import) tạo `LichHen` với `slot_id` mà **không** đi qua atomic flip, DB **không** chặn → 2 lịch/1 slot.
- **Hậu quả:** double-booking khả dĩ ngoài luồng patient booking. Cần rà mọi đường tạo `LichHen` + thêm backstop ở DB.

### SCH-05 — Nghỉ phép chặn đặt MỚI nhưng **không chặn phục vụ lịch đã đặt** (Medium)
- **Mô tả:** `approveDoctorLeave` khóa slot `active` + đánh dấu ngày nghỉ, nhưng slot **đã booked/pending_payment KHÔNG bị đụng** (admin xử lý tay). Các bước phục vụ lịch cũ trên ngày nghỉ — **check-in (nurse), vào phòng, kết thúc, bác sĩ xác nhận hồ sơ** — **KHÔNG** kiểm tra bác sĩ có đang nghỉ đã duyệt hay không.
- **Tái hiện:** BN đặt slot hôm X → admin duyệt nghỉ cho BS ngày X → y tá vẫn check-in/khám, bác sĩ vẫn xác nhận hồ sơ bình thường.
- **Hậu quả:** phục vụ ca mà bác sĩ đã được duyệt nghỉ; phụ thuộc admin liên hệ tay (`lich_hen_can_xu_ly` chỉ để cảnh báo, không cưỡng chế).

### SCH-06 — `createSchedule` (admin) thiếu validate ngày (Low–Medium)
- **Mô tả:** `createSchedule` không chặn **ngày quá khứ**, **Chủ nhật** (nếu nghiệp vụ cấm), **quá xa tương lai**, và **slot trùng khít**. (`ensureDoctorWorkday` có validate định dạng `YYYY-MM-DD` nhưng không chặn quá khứ/Chủ nhật; `getDoctorWorkdays` giới hạn đọc 42 ngày.)
- **Hậu quả:** admin có thể tạo ca ngày đã qua / Chủ nhật ngoài ý muốn.

### SCH-07 — Không đồng nhất cách lưu `ngay` (timezone) (Medium — dễ vỡ)
- **Mô tả:** `ngay` được ghi bằng `setHours(0,0,0,0)` (generator/seed) vs `setUTCHours(0,0,0,0)` (`toDateOnly` của admin) vs `parseDateOnly` (booking, UTC). Chính `doctor/schedule.controller.js` ghi chú **lệch 1 ngày** khi đọc `toISOString().slice(0,10)` và phải bù bằng `localStartOfDay`. Dưới `TZ=UTC` các cách trùng nhau, nhưng nếu môi trường đổi TZ hoặc dữ liệu cũ lệch → **truy vấn slot theo ngày trượt 1 ngày** → "không tìm thấy slot"/đặt nhầm ngày. (Trùng hướng với BUG-03 ở audit trước.)
- **Hậu quả:** rủi ro lệch ngày giữa ghi và đọc/đặt lịch; phụ thuộc `TZ=UTC` cố định.

### SCH-08 — `getSlots` không loại slot `bi_khoa_boi_nghi_phep` (Low)
- **Mô tả:** `getSlots` lọc `status==='active'` nhưng không loại `bi_khoa_boi_nghi_phep=true`. Bình thường nghỉ phép set `status='locked'` (đã bị lọc) nên ít lộ; nhưng nếu slot bị khóa mà status vẫn 'active' (dữ liệu lệch) → hiện là "đặt được" rồi 409 ở bước booking. UX.

### SCH-09 — Admin `updateSlot/updateWorkday` dùng read-modify-`save()` (không atomic/optimistic-lock) (Medium)
- **Mô tả:** khác luồng booking (atomic `findOneAndUpdate`), admin sửa slot bằng `schedule.save()` — **ghi đè cả mảng slots**. Không có version/optimistic-lock. 
- **Tái hiện:** admin mở ca (đọc slots) → trong lúc đó 1 bệnh nhân claim slot (flip `pending_payment`) → admin `save()` ghi đè lại slot về giá trị cũ (`active`) → **mất cập nhật claim** → slot có thể bị đặt lại lần 2. Hoặc 2 admin sửa cùng ca → last-write-wins.
- **Hậu quả:** lost update / khả năng double-booking qua khe admin×booking.

---

## 3. Phân tích nguy cơ trùng lịch (tổng hợp)

| Loại trùng | Có chặn? | Cơ chế / lỗ hổng |
|---|---|---|
| **Trùng ca cùng bác sĩ (cùng ngày)** | ✅ | unique index `{doctor_id, ngay}` — 1 doc/ngày, race → 11000 |
| **Trùng giờ/slot cùng bác sĩ** | ⚠️ | Booking atomic OK; nhưng **overlap slot admin tạo tay** (SCH-02) + **thiếu backstop DB** (SCH-04) |
| **Double booking 1 slot** | ✅ (luồng patient) | atomic `findOneAndUpdate`; ⚠️ luồng khác/không-DB-constraint (SCH-04), race admin×booking (SCH-09) |
| **Trùng phòng 2 bác sĩ** | ❌ | Không có kiểm tra room (SCH-01) |
| **Trùng y tá (2 bác sĩ cùng giờ)** | ❌ | Không validate overlap khi gán nurse_id (SCH-03) |
| **Lịch hẹn ngoài ca / vượt giờ** | ✅ | `gio_kham` lấy từ slot, phải thuộc schedule; không nhận giờ tự do (clinic) |
| **Trùng khi cập nhật** | ⚠️ | updateSlot chặn khi slot có lịch; nhưng không re-validate overlap (SCH-02) + không atomic (SCH-09) |
| **Trùng khi tạo đồng thời (race)** | ✅ | unique index (ca) + atomic flip (slot) |
| **Do thiếu ràng buộc DB** | ⚠️ | Chỉ unique `{doctor_id,ngay}`; **thiếu** unique cho slot đã đặt (SCH-04) |

---

## 4. Đề xuất cải thiện (không sửa code — chỉ khuyến nghị, theo thứ tự ưu tiên)

**P1 — Chống double-booking triệt để & phòng:**
1. **SCH-04:** thêm **unique partial index** ở `LichHen` trên `(schedule_id, slot_id)` (partial: chỉ các status còn hiệu lực `pending/confirmed/checked_in/in_progress/...`) làm backstop DB; rà **mọi** đường tạo `LichHen` (receptionist/admin/seed) đều phải đi qua atomic slot-claim.
2. **SCH-01 (room):** thêm kiểm tra xung đột phòng khi tạo/sửa ca & khi booking: không cho 2 bác sĩ dùng cùng `phong_kham` ở khung giờ giao nhau (lý tưởng: tách thực thể Room + index `(room, ngay, khung_gio)`).
3. **SCH-09:** chuyển admin `updateSlot` sang cập nhật **atomic theo positional** (như booking) hoặc thêm **optimistic locking** (`versionKey`/`__v` điều kiện) để không ghi đè claim đang chạy.

**P2 — Toàn vẹn nghiệp vụ:**
4. **SCH-05:** khi bác sĩ có nghỉ **đã duyệt** phủ ngày/giờ của lịch, chặn (hoặc cảnh báo cứng) các thao tác check-in / vào phòng / kết thúc / xác nhận hồ sơ cho lịch đó — không chỉ chặn đặt mới.
5. **SCH-02:** validate **overlap giữa các slot** trong `createSchedule`/`updateSlot` (sort theo giờ, đảm bảo `slot[i].gio_ket_thuc ≤ slot[i+1].gio_bat_dau`).
6. **SCH-03:** khi gán `nurse_id`, kiểm tra y tá chưa được gán cho bác sĩ khác có **khung giờ giao nhau** cùng ngày.

**P3 — Đầu vào & đồng nhất:**
7. **SCH-06:** chặn ngày quá khứ / Chủ nhật (nếu nghiệp vụ) / quá xa tương lai + slot trùng khít ở `createSchedule`.
8. **SCH-07:** thống nhất **một** hàm chuẩn hoá `ngay` (khuyến nghị UTC-midnight nhất quán ở generator/seed/admin/booking) để loại rủi ro lệch 1 ngày; tránh phụ thuộc ngầm `TZ=UTC`.
9. **SCH-08:** `getSlots` loại thêm `bi_khoa_boi_nghi_phep=true` cho nhất quán.

**Kết luận:** Lõi chống trùng (unique index ngày + atomic slot-claim trong transaction) **vững** cho luồng đặt lịch bệnh nhân. Rủi ro trùng còn lại tập trung ở: **phòng khám (SCH-01)**, **thiếu backstop DB + đường tạo lịch khác (SCH-04)**, **khe race admin×booking (SCH-09)**, và **nghỉ phép không chặn phục vụ lịch cũ (SCH-05)** — nên ưu tiên xử lý trước khi vận hành thật/nghiệm thu.

> Read-only: không thay đổi code hay dữ liệu. Các mã lỗi SCH-01..09 để tiện tham chiếu khi lên kế hoạch sửa.
