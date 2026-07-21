# Audit — Trạng thái thực tế trang Y tá: chức năng nào chạy hoàn chỉnh & nối dữ liệu với Bác sĩ

> Ngày: 2026-07-18 · Nhánh: `Bac_si` · Phạm vi: toàn bộ module y tá (BE + FE + service) + kiểm chứng DB thật.

## 0. TL;DR

- Trang y tá tồn tại **HAI hệ song song**. Chỉ **hệ cũ** (lọc theo `LichHen.nurse_id`) được nối vào UI. **Hệ mới** (hàng đợi động `HangDoi` + trạng thái phòng) đã code đầy đủ backend + service nhưng **KHÔNG page nào gọi** → chết trong UI.
- Chức năng lõi **nối bác sĩ ĐÃ CHẠY THẬT**: y tá nhập hồ sơ khám → gửi bác sĩ xác nhận → bác sĩ yêu cầu chỉnh sửa → y tá sửa lại. DB có **5 hồ sơ (KetQuaKham) do y tá nhập** — bằng chứng luồng đã chạy end-to-end.
- **Rủi ro hôm nay (2026-07-18):** không có lịch/ca nào gắn `nurse_id` cho hôm nay → mọi trang y tá lọc theo `nurse_id` **hiển thị rỗng**. Dữ liệu chỉ có ở các ngày đã được script backfill (chỉ cho `doctor.test` / BS. Khang).

## 1. Kiểm chứng DB thật (probe chỉ đọc)

| Chỉ số | Giá trị |
|---|---|
| Tài khoản y tá | 1 — "Điều dưỡng Thanh Hà" |
| `LichLamViec` có `nurse_id` | 10 (hôm nay: **0**) |
| `LichHen` tổng / có `nurse_id` | 73 / 13 (hôm nay: **0**) |
| `HangDoi` entries | 28 |
| `KetQuaKham` tổng / do y tá nhập | 7 / **5** |
| `TrangThaiPhongKham` | 3 |

**Đọc số liệu:** 5 hồ sơ do y tá nhập chứng minh luồng nhập→gửi đã chạy. 28 HangDoi + 3 phòng chứng minh backend hệ mới hoạt động — nhưng được tạo qua API/công cụ test, **không phải từ trang y tá** (không page nào gọi checkin). `nurse_id` hôm nay = 0 nên UI rỗng hôm nay.

## 2. Bản đồ FE ↔ Service ↔ BE

| Trang FE | Gọi service | Endpoint BE | Cơ sở phân quyền |
|---|---|---|---|
| `NurseDashboard` | `getDashboard` | `GET /nurse/dashboard` | `LichHen.nurse_id` + `LichLamViec.nurse_id` + `KetQuaKham.nguoi_nhap_id` |
| `NurseQueue` | `getQueue` | `GET /nurse/appointments` | **`LichHen.nurse_id`** (hệ cũ) |
| `NurseAppointmentDetail` (xem) | `getAppointmentById` | `GET /nurse/appointments/:id` | `LichHen.nurse_id` |
| `NurseAppointmentDetail` (lưu/gửi) | `createDraft`/`updateRecord`/`submit`/`resubmit` | `POST/PATCH /nurse/medical-records...` | **`getMyDoctorIdsToday` + `HangDoi`** (hệ mới) |
| `NurseRevisions` | `getRevisions` | `GET /nurse/medical-records/revisions` | `KetQuaKham.nguoi_nhap_id` |

**Service có nhưng KHÔNG page nào gọi** (grep toàn `frontend/src`): `getQueueEntries`, `checkinQueue`, `callQueuePatient`, `intoRoomQueue`, `finishQueue`, `skipQueue`, `cancelQueue`, `getRoomStatus`, `updateRoomStatus` → toàn bộ **hàng đợi động + trạng thái phòng** (Kế hoạch 2) là **dead code trong UI**.

## 3. Phân loại theo yêu cầu "chạy hoàn chỉnh & nối bác sĩ"

### ✅ Chạy hoàn chỉnh + nối bác sĩ (đã kiểm chứng bằng dữ liệu)
1. **Nhập / sửa hồ sơ khám → gửi bác sĩ xác nhận** — `createDraft`/`update`/`submit`/`resubmit`.
   Khi `submit`: `KetQuaKham.status = cho_xac_nhan` **và** `LichHen.status = waiting_doctor_confirm` → bác sĩ thấy ở trang "Hồ sơ chờ xác nhận". 5 hồ sơ thật đã đi qua luồng này.
2. **Vòng lặp yêu cầu chỉnh sửa** (`NurseRevisions`) — bác sĩ set `yeu_cau_chinh_sua` + `doctor_revision_note` → y tá thấy ở `/nurse/revisions` → sửa → `resubmit`. Nối hai đầu đầy đủ.
3. **Dashboard: đếm hồ sơ theo trạng thái** (`ho_so_cho_xac_nhan`/`can_sua`/`da_xac_nhan`) — theo `nguoi_nhap_id`, không phụ thuộc `nurse_id`, ổn định.

### ⚠️ Có code + nối bác sĩ, nhưng phụ thuộc backfill & rỗng hôm nay
4. **Hàng đợi bệnh nhân** (`NurseQueue`) + **Dashboard: đếm lịch hẹn** + **Xem chi tiết bệnh nhân/lịch hẹn** (`NurseAppointmentDetail`): join đúng thông tin bệnh nhân (tuổi/giới/bệnh nền/dị ứng) và bác sĩ/chuyên khoa **khi có dữ liệu**, nhưng lọc theo `LichHen.nurse_id`. Booking online/lễ tân **không set `nurse_id`** → chỉ có dữ liệu khi chạy script `link-nurse-to-khang-data.js`. **Hôm nay = 0 → rỗng.**

### ❌ Có backend + service, KHÔNG nối UI (không dùng được từ trang y tá)
5. **Hàng đợi động** (`checkin`/`call`/`into-room`/`finish`/`skip`/`cancel`) — không nút, không trang.
6. **Trạng thái phòng khám** (`room-status` list + update) — không nút, không trang.

## 4. Mâu thuẫn kiến trúc cần lưu ý

- **Hai cơ sở phân quyền khác nhau trên CÙNG một màn hình:** mở lịch từ `NurseQueue` dùng gate `LichHen.nurse_id` (hệ cũ), nhưng khi bấm "Lưu nháp" thì `createDraft` dùng gate `getMyDoctorIdsToday` + `HangDoi` (hệ mới). Nếu lịch có `nurse_id` nhưng **chưa có HangDoi entry** → xem được nhưng **lưu hồ sơ trả 409 "Bệnh nhân chưa được check-in vào hàng đợi"**.
- **Deadlock tiềm ẩn trong UI thuần:** `createDraft` bắt buộc có `HangDoi` entry, mà entry chỉ tạo qua `POST /nurse/queue/checkin` — endpoint **không page nào gọi**. 5 hồ sơ hiện có chạy được vì 28 HangDoi entry đã được tạo sẵn ngoài luồng UI (test tooling).
- **Onboarding `nurse_id`:** không được gán lúc đặt lịch (cả `patient/booking` lẫn `receptionist/booking` đều không set). Chỉ backfill thủ công cho 1 bác sĩ test → không dùng được ngoài demo.

## 5. Khuyến nghị (không nằm trong phạm vi sửa lần này)

1. **Chốt một hệ duy nhất.** Nếu dùng hàng đợi động: nối các nút checkin/gọi/vào phòng/kết thúc + trang trạng thái phòng vào UI, và chuyển `NurseQueue` sang `GET /nurse/queue`. Nếu bỏ hệ mới: gỡ service/endpoint HangDoi khỏi phạm vi để tránh hiểu nhầm "đã xong".
2. **Set `nurse_id` khi đặt lịch** (copy từ `LichLamViec.nurse_id` đúng như comment ở model) để trang y tá tự có dữ liệu, không cần script.
3. **Thống nhất gate xem & lưu** trên `NurseAppointmentDetail` để không còn tình huống xem được mà lưu 409.

---
*Audit chỉ đọc, không sửa code, không đổi dữ liệu. File probe tạm đã xóa sau khi chạy.*
