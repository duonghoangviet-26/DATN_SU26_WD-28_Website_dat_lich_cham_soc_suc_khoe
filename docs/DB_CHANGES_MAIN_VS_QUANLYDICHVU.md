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
