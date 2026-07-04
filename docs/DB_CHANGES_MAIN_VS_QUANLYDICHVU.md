# DB Changes — So sánh Models `main` ↔ `Quan_ly_dich_vu`

> Ngày: 2026-07-04
> So sánh: `origin/main` (fetch mới nhất) ↔ `Quan_ly_dich_vu` (HEAD, commit `9554251`)
> Phạm vi: toàn bộ `backend/src/models/*.js`
> Mục đích: cho backend biết chính xác field nào đổi/thêm/xóa để chỉnh sửa MongoDB thật (dev DB hiện có theo schema `main`) mà không phải tự dò diff.

---

## 1. Tổng quan — Collection

| Collection (file) | Trạng thái | Ghi chú |
|---|---|---|
| `Counter.js` | 🆕 Mới | Bộ đếm atomic dùng chung (hiện dùng cho `ma_dich_vu`) |
| `PhongKham.js` | 🆕 Mới | Danh sách phòng vật lý trong phòng khám (C3) |
| `HoSoChiTietBacSi.js` | 🆕 Mới | Hồ sơ chi tiết bác sĩ (chức danh, quá trình đào tạo/công tác, giải thưởng...) — 1-1 với `BacSi` |
| `BacSi.js` | ✏️ Sửa | Đổi tên field + thêm nhiều field mới (xem mục 2.1) |
| `DichVu.js` | ✏️ Sửa lớn | Đổi hẳn ý nghĩa `loai` enum, thêm field, đổi default `status` |
| `DonThuoc.js` | ✏️ Sửa nhỏ | Thêm 1 field |
| `LichHen.js` | ✏️ Sửa lớn | `doctor_id/schedule_id/slot_id` không còn bắt buộc, thêm ~12 field |
| `LichLamViec.js` | ✏️ Sửa lớn | Bỏ 2 field, thêm 5 field, mở rộng enum `status` |
| `LichSuLichHen.js` | 📝 Chỉ comment | Không đổi field |
| `NhatKyThaoTac.js` | 📝 Chỉ comment | Đổi tên 2 giá trị enum **trong comment tham khảo**, field thật không đổi |
| `ThanhToan.js` | ✏️ Sửa lớn | Thêm `ma_giao_dich` (auto-gen), ràng buộc enum `phuong_thuc`, thêm gateway fields |
| `ThongTinPhongKham.js` | ✏️ Sửa nhỏ | Thêm object `bao_hiem` |
| `index.js` (barrel) | ✏️ Sửa | Thêm export 3 model mới, 25 → 27 collection |
| Các model còn lại (14 file) | ✅ Không đổi | `NguoiDung`, `DatLaiMatKhau`, `ThongBao`, `ThongBaoHeThong`, `ChuyenKhoa`, `CaiDatThanhToan`, `GiaDinh`, `ThanhVien`, `HoSoYTe`, `KetQuaKham`, `NhacNho`, `DanhGia`, `PhienChat`, `TinNhanChat`, `HoanTien` |

---

## 2. Chi tiết field-level

### 2.1 `BacSi.js`

| Trường | main | Quan_ly_dich_vu | Migration cần làm |
|---|---|---|---|
| `phi_tu_van` → `gia_kham` | `phi_tu_van: Number` (chỉ hiển thị, KHÔNG tính tiền) | **Đổi tên** thành `gia_kham: Number` — giờ **là giá thật**, snapshot vào `LichHen.gia_kham` khi đặt clinic | `db.bac_si.updateMany({}, { $rename: { phi_tu_van: 'gia_kham' } })` |
| `tuoi_nhan_kham_tu` | Không có | **Mới**: `Number, default: 0` (0 = không giới hạn tuổi) | Field mới có default, doc cũ tự nhận `0` khi đọc qua Mongoose — không cần backfill bắt buộc nhưng nên chạy `updateMany({ tuoi_nhan_kham_tu: { $exists: false } }, { $set: { tuoi_nhan_kham_tu: 0 } })` để nhất quán khi query trực tiếp Mongo (không qua Mongoose) |
| `phong_kham_mac_dinh` | Không có | **Mới**: `String, default: null` | Không bắt buộc backfill, Admin gán khi duyệt hồ sơ (C2) |
| `bao_hiem` | Không có | **Mới**: object `{ nha_nuoc: Boolean, bao_lanh: Boolean }` | `updateMany({ bao_hiem: { $exists: false } }, { $set: { bao_hiem: { nha_nuoc: false, bao_lanh: false } } })` |
| `related_services` | Không có | **Mới**: `[ObjectId → DichVu]` | Không bắt buộc backfill (default `[]`) |
| `loai` | Không có | **Mới**: `enum ['specialist','home_staff'], default: 'specialist'` | Cần rà soát dữ liệu cũ: BS nào không có `specialties[]` (nhân viên lấy mẫu) nên set `loai='home_staff'` thủ công |
| Index mới | — | `{ related_services: 1 }`, `{ 'bao_hiem.nha_nuoc': 1 }` | Tạo lại index sau khi thêm field |

### 2.2 `DichVu.js` — thay đổi lớn nhất, cần review thủ công

| Trường | main | Quan_ly_dich_vu | Migration cần làm |
|---|---|---|---|
| `loai` | `enum ['clinic', 'home']` | `enum ['home', 'related']` — **`'clinic' đã bị xóa khỏi enum`** | ⚠️ **Không tự động migrate được** — giá khám clinic (theo slot 30 phút) đã chuyển hẳn sang `BacSi.gia_kham`. Mọi document `DichVu` cũ có `loai='clinic'` sẽ **fail validate** khi save lại. Cần: (1) xác nhận các dịch vụ `clinic` cũ nào nên chuyển thành `related` (X-quang, MRI, xét nghiệm đi kèm khám), (2) dịch vụ nào chỉ là giá khám thuần thì **xóa hẳn** vì giá đã nằm ở `BacSi.gia_kham` |
| `status` default | `'active'` | `'inactive'` | Dịch vụ tạo mới giờ mặc định ẩn, Admin phải duyệt rồi mới bật — không ảnh hưởng data cũ (default chỉ áp dụng lúc tạo mới) |
| `gia` validate | `min: 0` | `min: 1`, `max: 100_000_000`, phải là **số nguyên** | Cần quét data cũ: `db.dich_vu.find({ $or: [{ gia: { $lte: 0 } }, { gia: { $gt: 100000000 } }, { gia: { $not: { $mod: [1, 0] } } }] })` — sửa tay các bản ghi vi phạm trước khi deploy schema mới |
| `thoi_gian_phut` | `required: true` | `default: null` (hook tự set: `related`→`null`, `home`→`60`) | Không cần backfill, hook `pre('validate')` tự set khi save lại |
| `gio_dat_truoc_toi_thieu` default | `2` | `4` | Chỉ áp dụng cho document mới; data cũ giữ giá trị đã lưu |
| `chuan_bi_truoc` | Không có | **Mới**: `String, default: null, maxlength: 1000` (chỉ dùng cho `related`) | Không bắt buộc backfill |
| `ma_dich_vu` auto-gen | Query `findOne().sort()` lấy số lớn nhất | Dùng `Counter.nextSeq('dich_vu')` (atomic, tránh race condition) | **Bắt buộc seed `Counter`** trước khi chạy: `db.counters.insertOne({ _id: 'dich_vu', seq: <số ma_dich_vu lớn nhất hiện có> })` — nếu không seed, counter bắt đầu từ 0 và có thể **trùng `ma_dich_vu`** với dữ liệu cũ |

### 2.3 `DonThuoc.js`

| Trường | main | Quan_ly_dich_vu |
|---|---|---|
| `items[].ghi_chu` | Không có | **Mới**: `String, default: null, maxlength: 500` — ghi chú riêng từng thuốc trong đơn |

Không cần migrate, field optional.

### 2.4 `LichHen.js` — thay đổi lớn, ảnh hưởng ràng buộc bắt buộc

| Trường | main | Quan_ly_dich_vu | Ghi chú |
|---|---|---|---|
| `doctor_id` | `required: true` | `default: null` | Home: null lúc đầu, CSKH gán `home_staff` sau |
| `schedule_id` | `required: true` | `default: null` | Chỉ bắt buộc khi `loai_kham='clinic'` (validate ở hook, không phải ở schema) |
| `slot_id` | `required: true` | `default: null` | Tương tự trên |
| `phong_kham` | Không có | **Mới**: `String, default: null` — snapshot từ `slots[].phong_kham` lúc đặt (clinic only) | |
| `ten_dich_vu` | Không có | **Mới**: `String, default: null, maxlength: 255` — snapshot tên hiển thị | |
| `gioi_tinh_khach` | Không có | **Mới**: `enum ['male','female'], default: null` | |
| `email_khach` | Không có | **Mới**: `String, default: null` | |
| `tinh_thanh` / `phuong_xa` / `dia_chi_chi_tiet` | Không có | **Mới** — địa chỉ khách vãng lai (3 field tách nhỏ) | |
| `nguoi_dat_ho_ten` / `nguoi_dat_sdt` | Không có | **Mới** — chỉ có khi "Đặt cho người thân" | |
| `payment_deadline` | Không có | **Mới**: `Date, default: null` — luồng Home: BS confirm → deadline thanh toán | |
| `pending_booking_id` | Không có | **Mới**: `String, default: null` — audit token VNPay soft-lock | |
| `ket_qua_url` | Không có | **Mới**: `String, default: null, maxlength: 2000` — chỉ dùng khi `loai_kham='home'` | |

⚠️ **Quan trọng khi migrate:** vì `doctor_id/schedule_id/slot_id` đổi từ `required` sang `default: null`, các document `LichHen` cũ (nếu có) không bị ảnh hưởng khi đọc, nhưng **code cũ dựa vào "luôn có doctor_id" sẽ phải kiểm tra null trước khi dùng.** Ràng buộc bắt buộc giờ nằm trong `appointmentSchema.pre('validate')` (theo `loai_kham`), không còn ở khai báo field.

### 2.5 `LichLamViec.js` (slot embed)

| Trường | main | Quan_ly_dich_vu | Migration |
|---|---|---|---|
| `so_benh_nhan_toi_da` | Có, `required` | **Xóa** | `db.lich_lam_viec.updateMany({}, { $unset: { 'slots.$[].so_benh_nhan_toi_da': '' } })` |
| `so_benh_nhan_hien_tai` | Có | **Xóa** | `$unset` tương tự cho `so_benh_nhan_hien_tai` |
| `benh_nhan_id` | Không có | **Mới**: `ObjectId → NguoiDung, default: null` | Cần backfill nếu có data cũ: slot nào đang có `so_benh_nhan_hien_tai >= 1` phải tra `LichHen` tương ứng để set `benh_nhan_id` thủ công trước khi xóa 2 field cũ, **nếu không sẽ mất thông tin ai đã đặt slot đó** |
| `phong_kham` | Không có | **Mới**: `String, default: null` | |
| `status` enum | `['active','locked','cancelled']` | `['active','pending_payment','booked','locked','cancelled','expired']` | Data cũ với `status='active'` + đã có bệnh nhân (theo `so_benh_nhan_hien_tai`) cần chuyển thành `'booked'` khi migrate `benh_nhan_id` (xem trên) |
| `lock_expires_at` | Không có | **Mới**: `Date, default: null` — soft-lock VNPay 15 phút | |
| `cancel_requested` / `cancel_reason` | Không có | **Mới**: `Boolean, default: false` / `String, default: null` — F7 yêu cầu hủy slot | |
| Validate hook | Check `so_benh_nhan_hien_tai > so_benh_nhan_toi_da` | **Xóa** (field không còn tồn tại) | |

⚠️ Đây là thay đổi rủi ro nhất nếu đã có dữ liệu thật — cần chạy migration theo đúng thứ tự: (1) đọc `so_benh_nhan_hien_tai`/tra `LichHen` để backfill `benh_nhan_id` + `status='booked'`, (2) sau đó mới `$unset` 2 field cũ.

### 2.6 `LichSuLichHen.js`

Chỉ đổi comment mô tả luồng trạng thái (phân biệt rõ CLINIC/HOME). **Không có thay đổi field/schema.** Không cần migrate.

### 2.7 `NhatKyThaoTac.js`

Comment tham khảo đổi `ACTIVATE_SERVICE|DEACTIVATE_SERVICE` → `HIDE_SERVICE|SHOW_SERVICE`. Đây chỉ là comment liệt kê giá trị gợi ý cho `hanh_dong` (field kiểu `String` tự do, không phải `enum` cứng trong schema) — **không có ràng buộc DB nào đổi**, nhưng nếu code ghi log dùng đúng 2 string cũ (`ACTIVATE_SERVICE`/`DEACTIVATE_SERVICE`) thì cần cập nhật để khớp comment mới, tránh log không nhất quán.

### 2.8 `ThanhToan.js`

| Trường | main | Quan_ly_dich_vu | Migration |
|---|---|---|---|
| `ma_giao_dich` | Không có | **Mới**: `String, unique, sparse` — auto-gen `"TXN0001"` qua `pre('validate')` | Data cũ không có field này → `sparse` index cho phép nhiều `null` cùng lúc, không lỗi unique. Nhưng nếu muốn tra cứu theo mã cho data cũ, cần chạy script backfill gán `TXNxxxx` tăng dần cho từng bản ghi cũ theo thứ tự `ngay_tao` |
| `phuong_thuc` | `String, default: 'mock'` (tự do, không enum) | `enum ['momo','vnpay','cash','bank','mock']` | ⚠️ Cần quét data cũ: `db.thanh_toan.distinct('phuong_thuc')` — bất kỳ giá trị nào ngoài 5 giá trị trên sẽ **fail validate** khi save lại document đó |
| `ngay_hoan_tien` | Không có | **Mới**: `Date, default: null` | |
| `gateway_transaction_id` | Không có | **Mới**: `String, default: null` | |
| `gateway_response` | Không có | **Mới**: `Mixed, default: null` | |

### 2.9 `ThongTinPhongKham.js`

| Trường | main | Quan_ly_dich_vu | Migration |
|---|---|---|---|
| `bao_hiem` | Không có | **Mới**: `{ nha_nuoc: Boolean, bao_lanh: Boolean }` | Vì collection này là **singleton** (`ma='MAIN'`), chỉ cần update 1 document: `db.thong_tin_phong_kham.updateOne({ ma: 'MAIN' }, { $set: { bao_hiem: { nha_nuoc: false, bao_lanh: false } } })` |

### 2.10 Model mới hoàn toàn

**`Counter.js`** — bộ đếm atomic dùng `findByIdAndUpdate + $inc`, hiện chỉ dùng cho `dich_vu` (sinh `ma_dich_vu`). Seed bắt buộc trước khi go-live nếu đã có `DichVu` cũ (xem mục 2.2).

**`PhongKham.js`** — danh sách phòng vật lý (`ten`, `tang`, `toa`, `loai`, `trang_thai`), có virtual `full_name`. `LichLamViec.slots[].phong_kham` và `LichHen.phong_kham` lưu **String snapshot** của `full_name`, không phải `ObjectId` ref — để lịch cũ không bị ảnh hưởng nếu phòng đổi tên/xóa sau này. Cần seed danh sách phòng ban đầu.

**`HoSoChiTietBacSi.js`** — hồ sơ chi tiết bác sĩ (1-1 qua `doctor_id`), gồm `chuc_danh`, `chuc_vu`, `benh_ly_dieu_tri[]`, `qua_trinh_cong_tac[]`, `qua_trinh_dao_tao[]`, `thanh_vien_hoi[]`, `giai_thuong[]`. Tách khỏi `BacSi` để giữ query danh sách/đặt lịch nhẹ. Không cần seed — bác sĩ tự điền qua `PUT /api/doctor/profile`, mặc định rỗng.

---

## 3. Checklist migrate MongoDB thật (nếu dev DB đã có data theo schema `main`)

Thứ tự khuyến nghị — **làm đúng thứ tự để không mất dữ liệu**:

1. [ ] Backup toàn bộ database trước khi migrate (`mongodump`)
2. [ ] Seed `Counter`: `db.counters.insertOne({ _id: 'dich_vu', seq: <max ma_dich_vu hiện có> })`
3. [ ] `BacSi`: rename `phi_tu_van` → `gia_kham`; backfill `bao_hiem` mặc định; rà soát `loai` cho các BS home-staff
4. [ ] `LichLamViec`: backfill `benh_nhan_id` + `status='booked'` từ `so_benh_nhan_hien_tai`/tra `LichHen` **trước khi** xóa `so_benh_nhan_toi_da`/`so_benh_nhan_hien_tai`
5. [ ] `DichVu`: rà soát toàn bộ document `loai='clinic'` — quyết định chuyển `related` hay xóa hẳn; kiểm tra `gia` (số nguyên, 1–100 triệu)
6. [ ] `ThanhToan`: kiểm tra `distinct('phuong_thuc')` khớp enum mới; backfill `ma_giao_dich` cho data cũ nếu cần tra cứu
7. [ ] `ThongTinPhongKham`: update document singleton thêm `bao_hiem`
8. [ ] Seed `PhongKham` (danh sách phòng ban đầu)
9. [ ] Tạo lại index mới cho `BacSi` (`related_services`, `bao_hiem.nha_nuoc`)
10. [ ] `HoSoChiTietBacSi` không cần seed — để trống, bác sĩ tự điền

> **Lưu ý:** dự án đang ở giai đoạn frontend-first với mock data (xem `CLAUDE.md`) — nếu chưa có MongoDB thật nào được seed theo schema `main`, checklist trên **không cần áp dụng**, chỉ cần deploy schema mới trực tiếp. Checklist này dành cho trường hợp đã có dev/staging DB cũ cần nâng cấp.

---

## 4. File tham khảo khác (lịch sử, một phần đã lỗi thời)

- `docs/DB_CHANGES_BOOKING_FLOW.md` — ghi lại thay đổi tại thời điểm 2026-06-27, đã có phần bị thay thế bởi quyết định 2026-07-02 (bỏ `confirmed_by`/`confirm_deadline`/`admin_missed`). Dùng file này (`DB_CHANGES_MAIN_VS_QUANLYDICHVU.md`) làm nguồn tổng hợp mới nhất so với `main`.
- `docs/DB_GAP_ANALYSIS.md` — gap giữa frontend TypeScript types và schema backend, không phải so sánh giữa 2 nhánh git.
- `docs/MODELS_DATABASE.md` — mô tả tổng quan model, nên cập nhật lại theo bảng ở mục 1–2 file này sau khi merge.

---

## 5. Cập nhật 2026-07-04 — Phân tích luồng B2 ↔ B3 (Lịch làm việc ↔ Lịch hẹn)

Không đổi model/schema nào ở mục này. Ghi lại 1 endpoint mới (B2) + 1 bug đang sống phát hiện ngoài phạm vi (C5), để backend/người phụ trách C5 biết mà không cần tự dò lại.

### 5.1 Endpoint mới — B2 "Nghỉ cả ngày"
`PATCH /api/doctor/schedule/day-off` (`backend/src/controllers/doctor/schedule.controller.js::setDayOff`, route trong `backend/src/routes/doctor/schedule.routes.js`).
Body: `{ ngay: "YYYY-MM-DD" }`. Khóa 1 lần toàn bộ slot `status='active'` trong ngày đó sang `'locked'` (không đụng slot `'booked'`). Không cần field DB mới — chỉ dùng lại enum `status` sẵn có của `LichLamViec.slots`.
Mock tương ứng: `scheduleService.lockDay()` trong `frontend/src/services/schedule.service.ts`.

### 5.2 ⚠️ Bug đang sống (ngoài phạm vi B2/B3) — `admin/appointment.controller.js::cancelAppointment`
File `backend/src/controllers/admin/appointment.controller.js` (mount tại `/api/admin/appointments` — C5 "Lịch hẹn hệ thống", **không thuộc 3 chức năng Dịch vụ/B2/B3**) vẫn còn:
```js
await LichLamViec.findOneAndUpdate(
  { _id: appointment.schedule_id, 'slots._id': appointment.slot_id, 'slots.so_benh_nhan_hien_tai': { $gt: 0 } },
  { $inc: { 'slots.$.so_benh_nhan_hien_tai': -1 } },
  { session }
)
```
`so_benh_nhan_hien_tai` **đã bị xóa khỏi schema `LichLamViec`** hiện tại (xem mục 2, checklist mục 4 — thay bằng `benh_nhan_id`/`status` per-slot). Điều kiện filter `'slots.so_benh_nhan_hien_tai': { $gt: 0 }` sẽ **không bao giờ match** trên schema mới → `findOneAndUpdate` luôn no-op → **Admin hủy lịch hẹn clinic qua C5 không giải phóng slot**, slot vẫn kẹt ở `status='booked'` dù `LichHen` đã `cancelled`. Đối chiếu: `doctor/appointments.controller.js::cancel()` (B3, đã đúng) dùng `'slots.$.status'` + `benh_nhan_id`.
→ Không sửa file này (thuộc phạm vi người khác), chỉ ghi lại để tránh conflict khi người phụ trách C5 merge — cần đổi sang cùng cơ chế `slots.$.status`/`benh_nhan_id` như B3.

### 5.3 Đồng bộ mock B2 ↔ B3 (trong phạm vi, đã sửa)
Mock `doctor-appointment.service.ts::cancelConfirmed()` trước đây không cập nhật `mock/doctor-schedule.ts` khi bác sĩ hủy khẩn cấp 1 lịch `clinic confirmed` — slot vẫn hiện "Còn trống"/"Đã đặt" sai lệch so với lịch hẹn đã hủy. Đã thêm `syncSlotOnAppointmentCancel()` (export từ `schedule.service.ts`, khớp `(ngay_kham, gio_kham)`) để khóa slot (`'locked'`) đúng như rule thật ở `doctor/appointments.controller.js:150-152`.

### 5.4 Đã bỏ qua (ngoài phạm vi B2/B3, không đụng để tránh conflict)
- Chặn đặt slot quá giờ trong ngày ở phía đặt lịch (`patient/booking.controller.js::getSlots` — thuộc A5) — chỉ sửa được phần hiển thị phía bác sĩ (`DoctorSchedule.tsx::effectiveStatus`, B2).
- Lọc `la_hien` trong `patient/booking.controller.js::getSlots` (A5).
- Propagate `phong_kham_mac_dinh` khi Admin đổi ở `doctor.service.js::updateDoctorInfo` (C2).

---

## 6. Cập nhật 2026-07-04 (tiếp) — 3 quyết định nghiệp vụ B3, đã triển khai cả mock lẫn backend thật

Không đổi schema. Chỉ đổi logic controller/mock, ghi lại để backend biết rule đã đổi khi nối API thật.

### 6.1 "Hủy khẩn cấp" (clinic, confirmed) giới hạn trong 24h tới giờ hẹn
Trước đây `doctor/appointments.controller.js::cancel()` cho phép bác sĩ tự hủy tức thời + hoàn tiền 100% (không cần Admin duyệt) cho MỌI lịch hẹn clinic đã confirmed, bất kể còn bao lâu tới giờ hẹn — khiến cơ chế "Yêu cầu hủy" (F7, cần Admin duyệt, ở B2) trở nên vô nghĩa vì bác sĩ luôn có thể né qua "Hủy khẩn cấp".
**Quyết định 2026-07-04:** chỉ cho phép "Hủy khẩn cấp" (không cần duyệt) khi lịch hẹn còn **dưới 24h** (`EMERGENCY_CANCEL_WINDOW_HOURS`, hằng số trong cả `doctor/appointments.controller.js` và mock `doctor-appointment.service.ts`). Còn hơn 24h → trả lỗi 403, bác sĩ bắt buộc dùng "Yêu cầu hủy" (`request-cancel`, cần Admin duyệt/chuyển bác sĩ khác). Chỉ áp dụng cho `loai_kham='clinic'` — home không có ràng buộc này (không dùng slot system).

### 6.2 Ẩn hẳn lịch hẹn pending+unpaid khỏi danh sách bác sĩ xem
`confirm()` (chỉ áp dụng cho HOME — clinic auto-confirm khi thanh toán) trước đây có nhánh xử lý `payment_status='unpaid'` (set `payment_deadline`, "Luồng C" — BS xác nhận trước, BN trả sau). Nhưng từ quyết định 2026-07-02, **mọi lịch hẹn mới đều tạo với `payment_status='paid'` ngay lúc đặt** (`createBooking()`) — nên nhánh unpaid chưa bao giờ thật sự được kích hoạt qua flow đặt lịch, chỉ còn ý nghĩa nếu có dữ liệu cũ/CSKH tạo tay.
**Quyết định 2026-07-04 (2 bước):**
1. `confirm()` trả lỗi 409 nếu `payment_status !== 'paid'` — đã xóa nhánh set `payment_deadline` cho unpaid (dead code sau khi thêm guard).
2. Theo yêu cầu tiếp theo: **ẩn hẳn** (không chỉ chặn nút) — `GET /api/doctor/appointments` (`list()`) và mock `getAll()` giờ loại bỏ mọi bản ghi `status='pending' && payment_status!=='paid'` khỏi kết quả trả về, ở MỌI tab/filter. Lịch sử đã hủy/hoàn tiền (`refunded`) vẫn hiển thị bình thường — chỉ ẩn nhánh pending+unpaid đang chờ xử lý.

**Hệ quả cần lưu ý:** cron `autoCancelExpiredHomeAppointments()` (`appointmentAutoCancel.service.js`) query `{status:'confirmed', payment_status:'unpaid', payment_deadline:{$lt:now}}` — điều kiện này giờ **không bao giờ match** nữa vì không còn đường nào tạo ra `confirmed+unpaid`. Cron vẫn chạy an toàn (chỉ luôn trả 0), nhưng về bản chất đã thành dead code — cân nhắc dọn dẹp khi có thời gian (ngoài phạm vi hôm nay).

### 6.4 Khóa kết quả khám sau 24h chưa từng có hiệu lực (B3/B4)
`KetQuaKham.co_the_sua` (comment model: "sửa được trong 24h đầu; sau 24h → false qua cron/check") default `true` lúc tạo — nhưng **không có cron nào, không có chỗ nào khác từng set field này về `false`**. Kết quả: bác sĩ có thể sửa chẩn đoán/đơn thuốc vô thời hạn, khóa 24h chưa bao giờ thực sự hoạt động. Test mock (`examination.service.test.ts`) đã có sẵn 2 case kỳ vọng bị khóa nhưng luôn fail vì bug này — không phải do thay đổi hôm nay.
**Đã sửa:** `updateResult()` (backend thật) tính trực tiếp `Date.now() - ngay_tao > 24h` thay vì dựa field tĩnh; mock `examination.service.ts::save()` (nhánh update) check `co_the_sua` của bản ghi cũ trước khi ghi đè. Không cần cron.

### 6.5 Sửa slot đã hết hạn — backend thật không có rào chắn, chỉ FE ẩn nút
`updateSlot()`/`requestCancelSlot()` (B2) trước đây chỉ chặn theo `status` (booked/cancel_requested), không kiểm tra ngày/giờ — gọi thẳng API (bỏ qua UI) vẫn sửa/yêu cầu hủy được slot đã qua ngày/giờ. **Đã thêm** `isSlotInPast()` ở cả 2 endpoint (schedule.controller.js) làm rào chắn phía server, không phụ thuộc hoàn toàn vào việc FE ẩn nút (đã sửa ở `DoctorSchedule.tsx` lượt trước).

### 6.6 ⚠️ Luồng "Yêu cầu hủy" (F7) là một ngõ cụt — CHƯA SỬA, cần quyết định phạm vi
Bác sĩ gửi yêu cầu hủy → `slot.cancel_requested = true` + `cancel_reason` lưu vào DB, dialog nói rõ "Admin sẽ liên hệ bệnh nhân và xử lý". Nhưng grep toàn bộ backend + frontend admin: **không có bất kỳ endpoint hay trang Admin nào đọc/hiển thị/xử lý `cancel_requested`**. Yêu cầu hủy hiện tại chỉ hiện "Chờ Admin duyệt" trên trang bác sĩ mãi mãi, không ai bao giờ thấy hay xử lý nó. Đây là 1 luồng nghiệp vụ được thiết kế 2 chiều (bác sĩ gửi → Admin xử lý) nhưng chỉ có nửa đầu được xây — nửa Admin chưa tồn tại.
→ Chưa sửa vì xây trang xử lý là tính năng mới (không phải fix bug có sẵn), và nhiều khả năng thuộc phạm vi C5 (Lịch hẹn hệ thống, Admin) chứ không phải B2/B3.

### 6.7 ⚠️ Phát hiện mở rộng — `admin/appointment.controller.js` (C5) sai TOÀN BỘ, không chỉ 1 hàm
Lượt trước chỉ ghi nhận `cancelAppointment()` dùng field chết `so_benh_nhan_hien_tai`. Rà lại kỹ hơn: **`createAppointment()`, `rescheduleAppointment()`, và `getDoctorSchedules()` (dùng cho UI Admin chọn slot) đều dùng cùng field chết `so_benh_nhan_toi_da`/`so_benh_nhan_hien_tai`** — field này không tồn tại trong schema `LichLamViec` hiện tại (đã đổi sang `benh_nhan_id`/`status` per-slot). Hệ quả nghiêm trọng hơn đã ghi nhận trước: mọi so sánh `so_benh_nhan_hien_tai >= so_benh_nhan_toi_da` đều là `undefined >= undefined` → luôn `false` → **Admin có thể đặt/dời lịch đè lên đúng slot đã có bệnh nhân đặt online, gây double-booking thật sự** (không phải giả định — logic luôn coi mọi slot là "còn chỗ"). Toàn bộ file cần viết lại theo model 1-slot-1-bệnh-nhân (`benh_nhan_id`/`status`) giống `doctor/appointments.controller.js` đã làm đúng.

### 6.3 Buffer 2 giờ trước giờ hẹn — thuộc A5, chưa làm
Theo yêu cầu: chỉ ẩn trên web (slot trong vòng 2h tới không hiển thị/không đặt được qua online), KHÔNG áp dụng cho lễ tân — khách đến trực tiếp trong ca vẫn được lễ tân đẩy lịch vào cho bác sĩ bình thường (không qua slot-claim online). Việc này thuộc `patient/booking.controller.js::getSlots()` (A5) — ngoài 3 chức năng B2/B3/C4 của phiên làm việc này, chưa triển khai, cần người phụ trách A5 thêm điều kiện lọc theo giờ hiện tại + buffer tương tự `gio_dat_truoc_toi_thieu` đã có ở `DichVu` (home).
