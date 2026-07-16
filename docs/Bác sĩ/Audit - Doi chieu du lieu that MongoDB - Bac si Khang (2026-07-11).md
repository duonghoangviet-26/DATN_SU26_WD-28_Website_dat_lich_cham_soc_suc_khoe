# Audit — Đối chiếu dữ liệu thật MongoDB cho bác sĩ "Khang" (chuẩn bị trang y tá)

> **Chỉ đọc DB** — không sửa/xóa/tạo gì trong lần kiểm tra này, đúng nguyên tắc mục I. Script đọc: `backend/src/scripts/inspect-khang-doctor-data.js` (read-only, không in secret/URI).
> Bác sĩ mục tiêu đã được xác nhận: **BS. Trần Minh Khang (TEST)** — `doctor_id=6a4fba7e001249319b047cae`, `user_id=6a4fba7c001249319b047c7d` (khớp 100% với script có sẵn `backend/src/scripts/seed-doctor-test-data.js`).

---

## 1. Đã đọc những model/schema nào

`NguoiDung`, `BacSi`, `LichLamViec`, `LichHen`, `KetQuaKham`, `SinhHieuKham`, `DonThuoc`, `HoaDon`, `ThanhToan`, `ThanhVien` — đọc trực tiếp từ `backend/src/models/*.js` trước khi viết query (không đoán field).

## 2. Có tìm thấy bác sĩ Khang không

**Có — nhưng có 2 bác sĩ khác nhau khớp từ khóa "Khang"** trong `NguoiDung`:

| | BS. Trần Minh Khang (bản chính) | BS. Trần Minh Khang (TEST) — **mục tiêu đã chọn** |
|---|---|---|
| Vai trò trong hệ thống | "Bác sĩ demo thật" (theo đúng chữ trong comment `seed-doctor-test-data.js:40`) | Bác sĩ test, tạo bởi script có sẵn trong repo |
| Email | @vitafamily.vn | @vitafamily.local |

Đã hỏi và **bạn xác nhận chọn bác sĩ (TEST)** — toàn bộ báo cáo từ đây chỉ nói về bác sĩ này, trừ khi ghi chú khác.

## 3. Thông tin bác sĩ Khang (TEST)

| Field | Giá trị |
|---|---|
| `user_id` | `6a4fba7c001249319b047c7d` |
| `doctor_id` | `6a4fba7e001249319b047cae` |
| Email | `do***@vitafamily.local` (che) |
| Chuyên khoa | Tai Mũi Họng |
| `trang_thai_duyet` | `approved` |
| `status` (NguoiDung) | `active` |
| Phòng mặc định | Phòng 102, Tầng 1, Tòa A |

## 4. Lịch làm việc của bác sĩ Khang (TEST)

8 bản ghi `LichLamViec` (07-08, 09, 10, 12, 13, 14, 15, 16 tháng 7/2026) — **có lịch hôm nay (2026-07-10 lúc chạy script lần đầu; 2026-07-11 hiện tại)**. Ngày 07-15 đã kín toàn bộ 16 slot (đúng thiết kế "ngày test hết chỗ" trong script). Không có field `nurse_id` để kiểm tra (field không tồn tại trong schema).

## 5. Phòng khám liên kết

`Phòng 102, Tầng 1, Tòa A` — String snapshot trên `BacSi.phong_kham_mac_dinh`, không phải ObjectId ref (thiết kế có chủ đích, đã audit trước đó).

## 6. Dịch vụ liên kết

Tất cả 10 lịch hẹn đều `ten_dich_vu: "Khám tổng quát"`, `loai_kham: "clinic"` — không dùng `service_id` riêng (field đó chỉ bắt buộc cho `loai_kham: "home"`).

## 7. Y tá đang liên kết

**Không có.** Có đúng 1 tài khoản y tá trong toàn hệ thống (`NguoiDung.role='nurse'`): **"Điều dưỡng Thanh Hà"** (`_id=6a4f6a2d47db9c9377410bd6`, email `nu***@vitafamily.vn`, `status=active`) — tài khoản này **đã tồn tại sẵn**, chưa gắn với bất kỳ bác sĩ/lịch/lịch hẹn nào (không thể gắn — xem mục 20).

## 8. Số lượng appointment của bác sĩ Khang (TEST)

**10 lịch hẹn.**

## 9. Danh sách appointment theo trạng thái

| Trạng thái | Số lượng | Mã lịch hẹn |
|---|---|---|
| `pending` | 1 | TESTAPT001 |
| `confirmed` | 1 | TESTAPT002 |
| `completed` | 4 | TESTAPT003, TESTAPT004, TESTAPT005, TESTAPT008 |
| `checked_in` | 1 | TEST_APT_CHECKED_IN_01 |
| `in_progress` | 1 | TEST_APT_IN_PROGRESS_01 |
| `cancelled` | 1 | TESTAPT006 |
| `no_show` | 1 | TESTAPT007 |

Thanh toán: `paid` 8, `unpaid` 1, `refunded` 1. **Lịch hôm nay: 1** (TESTAPT004, ngày 07-10 lúc kiểm tra — hiện đã là quá khứ so với hôm nay 07-11).

## 10. Danh sách patient liên quan

- **1 bệnh nhân có tài khoản thật**: Nguyễn Thị Hạnh (TEST) — 33 tuổi, nữ, gắn với 2 lịch hẹn `checked_in`/`in_progress`.
- **8 khách vãng lai** (không có tài khoản, chỉ có `ten_khach`): TEST_PATIENT_001 → 008.

## 11. Patient nào thiếu dữ liệu bệnh nền/dị ứng/tiền sử

Nguyễn Thị Hạnh (TEST): **không có** bệnh nền, **không có** dị ứng. Đây là bệnh nhân có tài khoản DUY NHẤT gắn với bác sĩ này — nếu trang y tá cần demo hiển thị "có bệnh nền/dị ứng", dữ liệu hiện tại **chưa đủ** (8 khách vãng lai còn lại không có field này vì không có `ThanhVien`, đây là giới hạn cấu trúc, không phải thiếu sót cần sửa).

## 12. Appointment nào thiếu nurse_id/schedule_id/room_id/service_id

**Toàn bộ 10/10 lịch hẹn "thiếu" `nurse_id`** — nhưng đây là **giới hạn cấu trúc** (field không tồn tại trong schema `LichHen`), không phải lỗi dữ liệu riêng lẻ. `schedule_id`/`slot_id` đều đầy đủ (bắt buộc theo `pre('validate')` của model). Không có `room_id` dạng ObjectId (thiết kế dùng String snapshot).

## 13. MedicalRecord nào đang có

3 hồ sơ khám (`KetQuaKham`), đúng như script seed dự kiến:
- `cho_xac_nhan`: 1 (ứng với TESTAPT003)
- `da_xac_nhan`: 1 (ứng với TESTAPT004)
- `yeu_cau_chinh_sua`: 1 (ứng với TESTAPT005)

## 14. MedicalRecord nào thiếu liên kết

Không có — cả 3 đều có `nguoi_nhap_id` (0 hồ sơ thiếu). Cả 3 đều có `SinhHieuKham` + `DonThuoc` liên kết (3/3 mỗi loại).

## 15. Payment/Invoice liên quan

**0 `HoaDon`, 0 `ThanhToan`** cho toàn bộ 10 lịch hẹn — dù có 8 lịch `payment_status='paid'`. Đúng như audit trước đã kết luận: `payment_status` trên `LichHen` là field snapshot độc lập, **không có chứng từ hóa đơn/giao dịch thật đứng sau** cho bộ dữ liệu test này (khác với bác sĩ Khang bản chính — bác sĩ đó có 4/4 hóa đơn+giao dịch thật).

## 16. Dữ liệu nào đủ để test trang y tá

- Đủ tình huống trạng thái lịch hẹn: pending/confirmed/completed/checked_in/in_progress/cancelled/no_show — bao phủ hầu hết case cần cho hàng đợi.
- Đủ 3 trạng thái hồ sơ khám để test luồng xác nhận/yêu cầu sửa.
- Có sẵn 1 bệnh nhân tài khoản thật + 8 khách vãng lai — đủ đa dạng loại bệnh nhân.
- Có 1 tài khoản y tá sẵn có, không cần tạo mới nếu chỉ cần 1 tài khoản để test đăng nhập.

## 17. Dữ liệu nào chưa đủ để test trang y tá

- **Không có cách nào gắn y tá vào bất kỳ lịch/lịch hẹn nào** — vì `nurse_id` không tồn tại trên `LichLamViec` lẫn `LichHen` (chặn cứng ở tầng schema, không phải thiếu dữ liệu).
- Không có lịch hẹn nào ở trạng thái `waiting_record`/`waiting_doctor_confirm` (vì 2 giá trị này chưa có trong enum `LichHen.status`) — nếu trang y tá cần demo đúng luồng "chờ y tá nhập hồ sơ", chưa có sẵn tình huống này.
- Chỉ 1 bệnh nhân có bệnh nền/dị ứng ở TOÀN HỆ THỐNG liên quan bác sĩ này (Nguyễn Thị Hạnh không có) — nếu cần demo "bệnh nhân có bệnh nền" gắn với bác sĩ Khang cụ thể, cần bổ sung.

## 18. Có cần tạo y tá mới không

**Khuyến nghị: KHÔNG cần tạo mới** — đã có sẵn 1 tài khoản y tá thật ("Điều dưỡng Thanh Hà") chưa dùng vào việc gì. Theo đúng nguyên tắc "ưu tiên dùng dữ liệu thật hiện có" (mục XIII), nên **tái sử dụng** tài khoản này thay vì tạo thêm "Nguyễn Thị Lan" mới — trừ khi bạn muốn có riêng 1 tài khoản y tá tên khác để phân biệt rõ với dữ liệu demo chính. Đây là quyết định cần bạn xác nhận (xem câu hỏi cuối báo cáo).

## 19. Có cần gắn y tá vào schedule/appointment của bác sĩ Khang không

**Có, nhưng hiện KHÔNG THỂ làm bằng script update dữ liệu đơn thuần** — xem mục 20, đây là điểm mấu chốt.

## 20. Đề xuất bước sửa tiếp theo — PHÁT HIỆN QUAN TRỌNG

Yêu cầu gốc (mục XI) muốn có script `link-nurse-to-khang-data.js` chỉ "gắn `nurse_id` vào schedule/appointment thiếu". Nhưng khi đối chiếu schema thật:

**`LichLamViec` và `LichHen` hiện KHÔNG có field `nurse_id` trong Mongoose schema.** Một script chỉ "update dữ liệu" (set `{ nurse_id: ... }`) sẽ:
- Nếu dùng `.save()` qua Mongoose document — field lạ **bị Mongoose âm thầm bỏ qua** (không lưu, không báo lỗi), vì schema không khai báo field này.
- Nếu dùng `updateOne`/`findOneAndUpdate` với `strict` mặc định của schema — cũng bị bỏ qua tương tự.

→ **Không thể "chỉ update dữ liệu"** để hoàn thành yêu cầu này. Bắt buộc phải **thêm field `nurse_id` vào 2 model trước** (`LichLamViec.js`, `LichHen.js`) — đây là thay đổi **schema/code** (additive, an toàn, không ảnh hưởng dữ liệu cũ vì field mới sẽ có `default: null`), rồi mới chạy được script update để gắn giá trị thật vào các bản ghi của bác sĩ Khang (TEST).

Đây đúng là bước 2 đã đề xuất trong tài liệu thiết kế trước đó ([[Thiet ke - Trang Y ta - Doi chieu dac ta day du voi code hien tai (2026-07-11)]] mục 20) — không phải việc mới, chỉ là xác nhận lại: **không có đường tắt** để "chỉ gắn dữ liệu" mà bỏ qua bước thêm field.

## 21. Nếu cần sửa, liệt kê chính xác file/script sẽ tạo và field sẽ update

| Bước | File | Thay đổi |
|---|---|---|
| 1 | `backend/src/models/LichLamViec.js` | Thêm `nurse_id: { type: ObjectId, ref: 'NguoiDung', default: null }` vào `doctorScheduleSchema` (cấp document, theo đúng khuyến nghị "1 y tá/ngày" đã chốt trước đó) |
| 2 | `backend/src/models/LichHen.js` | Thêm `nurse_id: { type: ObjectId, ref: 'NguoiDung', default: null }` |
| 3 (chỉ sau khi bước 1-2 xong) | `backend/src/scripts/link-nurse-to-khang-data.js` (mới, read+update, idempotent) | Set `nurse_id = <_id y tá đã chọn>` cho: 8 `LichLamViec` + 10 `LichHen` của `doctor_id=6a4fba7e001249319b047cae`. Không đụng `KetQuaKham` (field `nguoi_nhap_id` đã có sẵn, chỉ cần dùng đúng `_id` y tá khi tạo hồ sơ mới, không cần "gắn lại" hồ sơ cũ). Không đụng bác sĩ khác, không đụng `payment_status`, không tạo appointment/patient mới. |

---

## Nguyên tắc kết luận (mục XIII)

- **Dữ liệu hiện tại (bác sĩ Khang TEST): đủ về số lượng/đa dạng trạng thái, nhưng chưa đủ về liên kết y tá** — vì lý do cấu trúc (thiếu field), không phải thiếu dữ liệu.
- **Trang y tá CHƯA thể lấy dữ liệu từ bác sĩ Khang** — vì (a) trang y tá chưa tồn tại (đã audit trước), (b) dù có trang, cũng chưa có field để join đúng "y tá nào phụ trách ca nào".
- **Thiếu do model/schema, không phải do dữ liệu seed** — dữ liệu seed đã đủ tốt, đúng như bạn yêu cầu "không fake thêm".
- **Không phát hiện sai `doctor_id`/`user_id`** — mọi lịch hẹn/lịch làm việc đều trỏ đúng `doctor_id=6a4fba7e001249319b047cae` của bác sĩ Khang (TEST), không lẫn với bác sĩ Khang bản chính hay bác sĩ khác.
- **Không có appointment mồ côi** (tất cả đều có `schedule_id`/`slot_id` hợp lệ trỏ về 1 trong 8 `LichLamViec` đã tìm thấy).
- **Không có patient nào không liên kết appointment** — cả 1 tài khoản thật (Nguyễn Thị Hạnh) và 8 khách vãng lai đều có ít nhất 1 lịch hẹn (chính là cách chúng được tìm ra).
- **Có schedule không liên kết nurse — nhưng là TOÀN BỘ 8/8**, vì lý do cấu trúc đã nêu, không phải lỗi từng bản ghi riêng lẻ.

---
## 22. Kết quả thực thi (2026-07-11, sau khi bạn xác nhận)

Bạn đã chọn: **tái sử dụng y tá "Điều dưỡng Thanh Hà"** có sẵn (không tạo mới), và **đồng ý thêm field `nurse_id`**.

Đã thực hiện:
1. Thêm `nurse_id: { type: ObjectId, ref: 'NguoiDung', default: null }` vào `LichLamViec.js` (cấp document) và `LichHen.js` — additive, không ảnh hưởng bản ghi cũ.
2. Tạo script `backend/src/scripts/link-nurse-to-khang-data.js` (idempotent — chỉ set khi `nurse_id: null`, tự tra lại bác sĩ/y tá theo email/role thay vì tin ID hard-code).
3. Chạy script — kết quả thật:
   - `LichLamViec`: gắn `nurse_id` cho **8/8** bản ghi của bác sĩ Khang (TEST).
   - `LichHen`: gắn `nurse_id` cho **10/10** lịch hẹn của bác sĩ Khang (TEST).
   - Kiểm tra an toàn: **0** lịch hẹn của bác sĩ khác bị ảnh hưởng.
4. Không tạo bệnh nhân/lịch hẹn/y tá mới. Không đụng `payment_status`/`doctor_id`. Không sửa dữ liệu của bác sĩ Khang bản chính (không hậu tố).

**Trạng thái sau khi sửa**: bác sĩ Khang (TEST) và toàn bộ 8 lịch làm việc + 10 lịch hẹn hiện đã liên kết với y tá "Điều dưỡng Thanh Hà" (`nurse_id=6a4f6a2d47db9c9377410bd6`) — dữ liệu đã sẵn sàng ở tầng DB cho bước tiếp theo (xây route/controller/frontend `/nurse/*` theo kế hoạch ở [[Thiet ke - Trang Y ta - Doi chieu dac ta day du voi code hien tai (2026-07-11)]]). Lưu ý: **trang y tá vẫn chưa tồn tại** — việc gắn `nurse_id` chỉ chuẩn bị dữ liệu, chưa tạo được chức năng đăng nhập/xem việc cho y tá.
