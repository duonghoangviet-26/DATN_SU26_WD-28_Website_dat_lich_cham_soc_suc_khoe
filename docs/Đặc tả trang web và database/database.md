# VitaFamily — Database Schema (MongoDB / Mongoose)

> Stack: **MongoDB + Mongoose**
> Nguồn gốc: Chuyển đổi từ `Tài liệu dự án/Cơ sở dữ liệu/VitaFamily_Database.sql` (MySQL 27 bảng)
> Sau khi embed một số bảng join và bỏ `hospitals` (phòng khám tư 1 cơ sở) → còn **24 collection**.
> ⚠️ **File này là phiên bản tổng quan — nguồn sự thật là `docs/MODELS_DATABASE.md`.**
> Cập nhật: C4 V4 (services, appointments), bỏ hospitals, thêm lich_su_lich_hen.

---

## Tổng quan — 27 bảng SQL → 23 MongoDB collection

| SQL (27 bảng) | MongoDB | Cách xử lý |
|---|---|---|
| `users` | `nguoi_dung` | Collection riêng |
| `password_resets` | `dat_lai_mat_khau` | Collection riêng + TTL index |
| `hospitals` | ❌ **Bỏ** | Phòng khám tư 1 cơ sở — dùng `thong_tin_phong_kham` singleton |
| `specialties` | `chuyen_khoa` | Collection riêng |
| `services` | `dich_vu` | Collection riêng + embed `khu_vuc[]` (home service) |
| `payment_settings` | `cai_dat_thanh_toan` | Collection riêng (key-value) |
| `families` | `gia_dinh` | Collection riêng |
| `members` | `thanh_vien` | Collection riêng |
| `doctors` | `bac_si` | Collection riêng |
| `doctor_specialties` | *(embed)* | → Array `specialties[]` trong `bac_si` |
| `doctor_hospitals` | ❌ **Bỏ** | Bác sĩ thuộc 1 phòng khám duy nhất |
| `doctor_services` | *(embed)* | → Array `services[]` trong `bac_si` |
| `doctor_schedules` | `lich_lam_viec` | Collection riêng |
| `slots` | *(embed)* | → Array `slots[]` trong `lich_lam_viec` (1 slot = 1 BN, có `phong_kham`) |
| `appointments` | `lich_hen` | Collection riêng |
| `payments` | `thanh_toan` | Collection riêng |
| `refunds` | `hoan_tien` | Collection riêng |
| `medical_records` | `ho_so_y_te` | Collection riêng |
| `examination_results` | `ket_qua_kham` | Collection riêng |
| `prescriptions` | `don_thuoc` | Collection riêng |
| `prescription_items` | *(embed)* | → Array `items[]` trong `don_thuoc` |
| `reminders` | `nhac_nho` | Collection riêng |
| `reviews` | `danh_gia` | Collection riêng |
| `notifications` | `thong_bao` | Collection riêng |
| `system_notifications` | `thong_bao_he_thong` | Collection riêng |
| `chat_sessions` | `phien_chat` | Collection riêng |
| `chat_messages` | `tin_nhan_chat` | Collection riêng |
| `audit_logs` | `nhat_ky_thao_tac` | Collection riêng (bất biến, chỉ insert) |
| *(mới)* | `lich_su_lich_hen` | 🆕 Track lịch sử thay đổi trạng thái lịch hẹn |
| *(mới)* | `thong_tin_phong_kham` | 🆕 Singleton thay thế `hospitals` |

---

## Nguyên tắc Embed vs Reference

| Chọn **Embed** khi | Chọn **Reference** khi |
|---|---|
| Dữ liệu luôn được đọc cùng nhau | Dữ liệu được truy vấn độc lập |
| Số lượng phần tử nhỏ và có giới hạn | Số lượng có thể tăng không giới hạn |
| Dữ liệu thuộc về cha, không tồn tại độc lập | Entity có vòng đời riêng |

**Áp dụng trong VitaFamily:**
- `slots[]` embed trong `doctor_schedules` → luôn load cùng ngày làm việc, tối đa ~20 slot/ngày
- `items[]` embed trong `prescriptions` → luôn đọc cùng đơn thuốc, tối đa 10 thuốc/đơn
- `specialties[]`, `hospitals[]`, `services[]` embed trong `doctors` → chỉ lưu ObjectId ref, ít khi thay đổi
- `khu_vuc[]` embed trong `services` → mảng string đơn giản, không cần join

---

## Sơ đồ quan hệ (MongoDB)

```
nguoi_dung ─────────────┬──→ gia_dinh ──→ thanh_vien
  │                     │
  ├──→ dat_lai_mat_khau │
  │                     │
  ├──→ bac_si ───────────┤  (embed: specialties[], services[])
  │     │               │   [hospitals[] ĐÃ BỎ — phòng khám tư 1 cơ sở]
  │     └──→ lich_lam_viec  (embed: slots[]: 1 slot = 1 BN, có phong_kham)
  │               │
  ├───────────────└──→ lich_hen ──→ thanh_toan ──→ hoan_tien
  │                     │    └──→ lich_su_lich_hen (🆕 track thay đổi trạng thái)
  │                     │
  │                     ├──→ ho_so_y_te
  │                     ├──→ ket_qua_kham
  │                     ├──→ danh_gia
  │                     └──→ don_thuoc  (embed: items[])
  │                               └──→ nhac_nho
  │
  ├──→ thong_bao
  ├──→ phien_chat ──→ tin_nhan_chat
  └──→ nhat_ky_thao_tac  (bất biến, chỉ insert)

thong_tin_phong_kham  (🆕 singleton — thay thế hospitals)
chuyen_khoa
dich_vu
cai_dat_thanh_toan
thong_bao_he_thong
```

---

## Chi tiết từng Collection

---

### NHÓM 1 — Tài khoản & Xác thực

#### `users`
```js
{
  _id:            ObjectId,
  email:          String,   // unique, lowercase, không đổi sau đăng ký
  mat_khau:       String,   // bcrypt hash 10 rounds — select: false
  ho_ten:         String,
  so_dien_thoai:  String | null,
  anh_dai_dien:   String | null,  // URL
  role:           'user' | 'doctor' | 'admin',  // default: 'user'
  status:         'active' | 'locked',           // default: 'active'
  ngay_tao:       Date,     // timestamps auto
  ngay_cap_nhat:  Date,
}
// Index: { email: 1 } unique, { role: 1 }, { status: 1 }
// Lưu ý: role chỉ đổi sang 'doctor' khi Admin duyệt hồ sơ (C2) — trong cùng 1 transaction
```

#### `password_resets`
```js
{
  _id:        ObjectId,
  user_id:    ObjectId,  // ref: 'User'
  ma_otp:     String,    // 6 chữ số
  het_han:    Date,      // now + 15 phút
  da_su_dung: Boolean,   // default: false
  ngay_tao:   Date,
}
// Index: { user_id: 1 }, { ma_otp: 1 }
// TTL index: { het_han: 1 } expireAfterSeconds: 3600  → tự xóa sau 1h
// Logic: khi tạo OTP mới → set da_su_dung=true tất cả OTP cũ của user
```

---

### NHÓM 2 — Danh mục

#### `hospitals`
```js
{
  _id:            ObjectId,
  ten:            String,   // unique
  dia_chi:        String | null,
  so_dien_thoai:  String | null,
  email:          String | null,
  gio_lam_viec:   String | null,  // "8:00–17:00 Thứ2–Thứ7"
  mo_ta:          String | null,
  status:         'active' | 'hidden',  // hidden không xóa lịch cũ
  ngay_tao:       Date,
  ngay_cap_nhat:  Date,
}
// Index: { ten: 1 } unique, { status: 1 }
```

#### `specialties`
```js
{
  _id:      ObjectId,
  ten:      String,
  mo_ta:    String | null,
  icon_url: String | null,
  slug:     String,   // unique, URL-friendly, auto-generate từ tên
  thu_tu:   Number,   // default: 0 — thứ tự hiển thị trên trang tìm kiếm
  status:   'active' | 'hidden',
  ngay_tao: Date,
}
// Index: { slug: 1 } unique, { status: 1 }, { thu_tu: 1 }
```

#### `services` ⚙️ (Cập nhật C4 V4)
```js
{
  _id:                      ObjectId,
  ma_dich_vu:               String,   // unique, auto-gen: "DV001", "DV002"
  ten:                      String,
  loai:                     'clinic' | 'home',   // KHÔNG có 'video'
  mo_ta_ngan:               String | null,  // ≤500 ký tự — hiển thị trong danh sách
  mo_ta:                    String | null,  // ≤5000 ký tự — trang chi tiết / booking
  gia:                      Number,   // Giá thực tế bệnh nhân trả (không phải giá tham khảo)
  thoi_gian_phut:           Number,   // bắt buộc, min: 10, max: 480
  gio_dat_truoc_toi_thieu:  Number,   // giờ, default: 2 (clinic) / 4 (home)
  ngay_ap_dung:             String | null,  // "T2–T7" — hiển thị tổng quát cho bệnh nhân
  gio_bat_dau:              String | null,  // "08:00"
  gio_ket_thuc:             String | null,  // "17:00"
  specialty_id:             ObjectId | null,  // ref: 'Specialty'
  khu_vuc:                  [String],  // Home only — ["Cầu Giấy", "Nam Từ Liêm"]
                                       // Clinic → [] rỗng
  status:                   'active' | 'inactive',  // default: 'active'
  ngay_tao:                 Date,
  ngay_cap_nhat:            Date,
}
// Index: { ma_dich_vu: 1 } unique
//        { ten: 1, specialty_id: 1 } unique  → cho phép cùng tên khác chuyên khoa
//        { status: 1, loai: 1 }
// Lưu ý:
//   - ma_dich_vu: backend auto-generate, client không được truyền vào
//   - gia: appointment.gia_kham = snapshot service.gia lúc tạo appointment
//   - khu_vuc: chỉ có ý nghĩa khi loai='home', bác sĩ confirm địa chỉ thủ công
```

#### `payment_settings`
```js
{
  _id:          ObjectId,
  ten_cai_dat:  String,  // unique key — "hoan_tien_tu_24h_tro_len"
  gia_tri:      String,  // lưu dạng string, convert khi dùng — "100", "15"
  mo_ta:        String | null,
  ngay_cap_nhat: Date,
}
// Index: { ten_cai_dat: 1 } unique
// Seed data — các key mặc định:
//   hoan_tien_tu_24h_tro_len    = "100"
//   hoan_tien_12_den_24h        = "80"
//   hoan_tien_6_den_12h         = "50"
//   hoan_tien_duoi_6h           = "0"
//   hoan_tien_bac_si_tu_choi    = "100"
//   hoan_tien_admin_huy_khan_cap= "100"
//   timeout_thanh_toan_phut     = "15"
//   hoa_hong_phan_tram          = "15"
```

---

### NHÓM 3 — Gia đình

#### `families`
```js
{
  _id:      ObjectId,
  user_id:  ObjectId,  // ref: 'User', unique — 1 tài khoản 1 nhóm gia đình
  ten_nhom: String,    // "Gia đình Nguyễn"
  ngay_tao: Date,
}
// Index: { user_id: 1 } unique
```

#### `members`
```js
{
  _id:           ObjectId,
  family_id:     ObjectId,  // ref: 'Family'
  ho_ten:        String,
  ngay_sinh:     Date,      // phải là ngày trong quá khứ
  gioi_tinh:     'nam' | 'nu' | 'khac',
  nhom_mau:      'A' | 'B' | 'AB' | 'O' | null,
  di_ung:        String | null,  // bác sĩ đọc trước khi khám
  benh_nen:      String | null,  // tiền sử bệnh
  la_chu_ho:     Boolean,   // default: false — chủ hộ không xóa được
  ngay_xoa:      Date | null,  // soft delete: null=còn tồn tại, có giá trị=đã xóa
  ngay_tao:      Date,
  ngay_cap_nhat: Date,
}
// Index: { family_id: 1 }, { ngay_xoa: 1 }, { la_chu_ho: 1 }
// Tối đa 10 thành viên/nhóm — kiểm tra ở tầng ứng dụng
// Soft delete: KHÔNG xóa vật lý, giu lại hồ sơ y tế liên quan
```

---

### NHÓM 4 — Hồ sơ Bác sĩ

#### `bac_si` (doctors)
> Embed 2 mảng ObjectId thay thế 2 bảng join SQL. `hospitals[]` đã bỏ (phòng khám tư 1 cơ sở).

```js
{
  _id:                ObjectId,
  user_id:            ObjectId,  // ref: 'NguoiDung', unique — 1 tài khoản 1 hồ sơ
  tieu_su:            String | null,
  bang_cap:           String | null,
  kinh_nghiem:        String | null,
  so_nam_kinh_nghiem: Number,    // default: 0
  phi_tu_van:         Number,    // default: 0 — thông tin trên profile, KHÔNG dùng để tính tiền
  trang_thai_duyet:   'pending' | 'approved' | 'rejected' | 'rejected_final' | 'suspended',
                                 // rejected_final: đã từ chối 5 lần, không nộp lại được
  ly_do_tu_choi:      String | null,   // lý do từ chối gần nhất
  lich_su_tu_choi:    Array,           // [{lan, ly_do, ngay}] — lưu toàn bộ lịch sử
  so_lan_nop:         Number,    // default: 1, max: 5
  la_hien:            Boolean,   // default: false — true khi admin duyệt; hook: false nếu chưa approved
  diem_danh_gia:      Number,    // 0.00–5.00, cập nhật khi review visible thay đổi
  tong_danh_gia:      Number,    // default: 0 — số review visible

  // === EMBED thay thế 2 bảng join (hospitals[] đã bỏ) ===
  specialties: [{ type: ObjectId, ref: 'ChuyenKhoa' }],  // doctor_specialties
  services:    [{ type: ObjectId, ref: 'DichVu'     }],  // doctor_services

  ngay_tao:      Date,
  ngay_cap_nhat: Date,
}
// Index: { user_id: 1 } unique
//        { trang_thai_duyet: 1, la_hien: 1, specialties: 1 }  compound
//        { la_hien: 1, trang_thai_duyet: 1, diem_danh_gia: -1 } compound
//        { services: 1 }
//
// ⚠️ Khi duyệt bác sĩ (transaction):
//   doctors.trang_thai_duyet = 'approved'
//   doctors.la_hien = true          ← BẮT BUỘC set cùng lúc
//   users.role = 'doctor'
//   audit_log INSERT
```

#### `lich_lam_viec` (doctor_schedules)
> Embed `slots[]` thay thế bảng `slots` SQL riêng.

```js
{
  _id:          ObjectId,
  doctor_id:    ObjectId,  // ref: 'BacSi'
  ngay:         Date,      // ngày làm việc (date only, không có time)
  ngay_tao:     Date,
  ngay_cap_nhat: Date,

  // === EMBED thay thế bảng slots ===
  slots: [
    {
      _id:         ObjectId,  // dùng làm lich_hen.slot_id
      gio_bat_dau: String,    // "08:00" — HH:MM
      gio_ket_thuc: String,   // "08:30" — phải sau gio_bat_dau
      phong_kham:  String | null,  // "Phòng 201, Tầng 2, Tòa A" — null = chưa thể đặt
      status:      'active' | 'booked' | 'locked' | 'cancelled' | 'expired',
    }
  ]
}
// Index: { doctor_id: 1, ngay: 1 } unique
//        { ngay: 1 }
//
// 1 slot = 1 bệnh nhân. Không dùng cơ chế đếm.
// Khi đặt lịch: atomic findOneAndUpdate với điều kiện status='active' → set status='booked'
// Khi hủy lịch: post('save') hook gọi releaseSlot → status='booked' → 'active'
// Cron: slot status='active' + ngay < hôm nay → status='expired'
//
// Bệnh nhân thấy slot khi: status='active' AND ngay >= hôm nay
//   AND (phong_kham != null  -- clinic
//        OR loai_kham='home' -- home không cần phòng)
// Cảnh báo buffer: 2 home slot cách nhau < 30 phút → warn (không chặn)
```

---

### NHÓM 5 — Lịch hẹn & Thanh toán

#### `lich_hen` (appointments)
```js
{
  _id:          ObjectId,
  user_id:      ObjectId,  // ref: 'NguoiDung' — bệnh nhân đặt lịch
  member_id:    ObjectId | null,  // ref: 'ThanhVien' — null nếu là khách vãng lai
  doctor_id:    ObjectId,  // ref: 'BacSi'
  // hospital_id đã BỎ — phòng khám tư 1 cơ sở, không cần tham chiếu bệnh viện
  schedule_id:  ObjectId,  // ref: 'LichLamViec'
  slot_id:      ObjectId,  // _id của subdoc slots trong LichLamViec
  service_id:   ObjectId | null,  // ref: 'DichVu'
  loai_kham:    'clinic' | 'home',  // video đã bỏ
  ngay_kham:    Date,
  gio_kham:     String,   // "08:30"
  ly_do_kham:   String | null,    // ≤500 ký tự
  dia_chi_kham: String | null,    // BẮT BUỘC khi loai_kham='home'; null khi 'clinic'
  status:       'pending' | 'confirmed' | 'completed' | 'cancelled',
  payment_status: 'unpaid' | 'paid' | 'refunded',
  gia_kham:     Number,   // Snapshot service.gia lúc đặt — KHÔNG thay đổi sau này

  // Thông tin khách vãng lai (chỉ khi member_id = null)
  ten_khach:            String | null,
  so_dien_thoai_khach:  String | null,
  nam_sinh_khach:       Number | null,

  ly_do_huy:    String | null,   // bắt buộc khi status → 'cancelled'
  ngay_tao:     Date,
  ngay_cap_nhat: Date,
}
// Index: { user_id: 1 }, { member_id: 1 }, { status: 1 }, { payment_status: 1 }
//        { ngay_kham: 1 }, { schedule_id: 1 }
//        { doctor_id: 1, status: 1, ngay_kham: 1 }  compound — màn hình bác sĩ
//
// Validation (hook pre-validate):
//   loai_kham='clinic' → dia_chi_kham = null (hook tự xóa)
//   loai_kham='home'   → dia_chi_kham BẮT BUỘC
//   member_id = null   → ten_khach BẮT BUỘC
//
// Cron: unpaid quá N phút (đọc thoi_gian_het_han_thanh_toan từ cai_dat_thanh_toan) → hủy
// Clinic: auto-confirm sau thanh toán thành công
// Home:   luôn status='pending' → bác sĩ confirm thủ công sau khi xem dia_chi_kham
//
// Khi tạo: service layer gọi LichLamViec.bookSlot() (atomic) trong cùng transaction
// Khi hủy: post('save') hook gọi LichLamViec.releaseSlot() → slot về 'active'
```

#### `payments`
```js
{
  _id:              ObjectId,
  appointment_id:   ObjectId,  // ref: 'Appointment', unique — 1 lịch 1 payment
  benh_nhan_id:     ObjectId,  // ref: 'User'
  so_tien:          Number,    // = appointment.gia_kham
  status:           'pending' | 'paid' | 'failed' | 'refunded',
  phuong_thuc:      String,    // default: 'mock' (VitaPay)
  ngay_thanh_toan:  Date | null,
  ngay_tao:         Date,
}
// Index: { appointment_id: 1 } unique
//        { benh_nhan_id: 1 }, { status: 1 }
```

#### `refunds`
```js
{
  _id:            ObjectId,
  payment_id:     ObjectId,     // ref: 'Payment'
  appointment_id: ObjectId,     // ref: 'Appointment', unique — 1 lịch 1 refund
  so_tien_hoan:   Number,
  phan_tram_hoan: Number,  // 0–100 — tính từ cai_dat_thanh_toan (không hardcode enum)
  ly_do:          String | null,
  status:         'pending' | 'completed' | 'rejected',
  ly_do_tu_choi:  String | null,   // bắt buộc khi rejected
  xu_ly_boi:      ObjectId | null, // ref: 'User' (Admin)
  ngay_yeu_cau:   Date,
  ngay_xu_ly:     Date | null,
}
// Index: { appointment_id: 1 } unique  → 1 lịch chỉ 1 refund, rejected không tạo lại
//        { status: 1 }, { payment_id: 1 }
```

---

### NHÓM 6 — Hồ sơ Y tế

#### `medical_records`
```js
{
  _id:            ObjectId,
  member_id:      ObjectId | null,  // ref: 'Member' — null nếu là lịch khách
  appointment_id: ObjectId | null,  // ref: 'Appointment' — null nếu bệnh nhân tự nhập
  ten_khach:      String | null,    // tên người khám nếu member_id = null
  ngay_kham:      Date,             // không được là ngày tương lai
  ten_benh_vien:  String | null,
  ten_bac_si:     String | null,
  ly_do_kham:     String | null,
  chan_doan:       String | null,
  ghi_chu:         String | null,
  nguon:          'tu_kham' | 'thu_cong',  // default: 'tu_kham'
  ngay_tao:       Date,
  ngay_cap_nhat:  Date,
}
// Index: { member_id: 1 }, { appointment_id: 1 }, { ngay_kham: -1 }
// nguon='tu_kham': bệnh nhân KHÔNG được sửa/xóa
```

#### `examination_results`
```js
{
  _id:                  ObjectId,
  appointment_id:       ObjectId,  // ref: 'Appointment', unique — 1 lịch 1 kết quả
  chan_doan:             String,    // bắt buộc, không để trống
  huong_dan_dieu_tri:   String | null,
  ghi_chu:               String | null,
  ngay_tai_kham:        Date | null,
  co_the_sua:           Boolean,   // default: true → false sau 24h (cron/check khi update)
  ngay_tao:             Date,
  ngay_cap_nhat:        Date,
}
// Index: { appointment_id: 1 } unique
// co_the_sua: khóa sau 24h — xử lý ở tầng ứng dụng
//   Cron hoặc kiểm tra khi update: if (Date.now() - ngay_tao > 24h) → reject
```

---

### NHÓM 7 — Đơn thuốc & Nhắc nhở

#### `prescriptions`
> Embed `items[]` thay thế bảng `prescription_items` SQL.

```js
{
  _id:               ObjectId,
  medical_record_id: ObjectId | null,  // ref: 'MedicalRecord' — null nếu đơn độc lập
  member_id:         ObjectId,         // ref: 'Member', bắt buộc
  doctor_id:         ObjectId | null,  // ref: 'Doctor' — null nếu tự nhập
  nguon:             'bac_si' | 'tu_nhap',  // default: 'tu_nhap'
  ghi_chu:            String | null,
  ngay_tao:          Date,

  // === EMBED thay thế bảng prescription_items ===
  items: [
    {
      _id:            ObjectId,
      ten_thuoc:      String,     // tên thuốc
      lieu_luong:     String | null,  // "1 viên", "5ml"
      tan_suat:       String | null,  // "2 lần/ngày"
      gio_uong:       [String],   // ["07:00", "12:00", "19:00"]
      ngay_bat_dau:   Date,
      ngay_ket_thuc:  Date,       // tối đa 90 ngày sau ngay_bat_dau
    }
  ]
  // Tối đa 10 items — kiểm tra ở tầng ứng dụng
}
// Index: { member_id: 1 }, { medical_record_id: 1 }
// nguon='bac_si': bệnh nhân KHÔNG được xóa
```

#### `reminders`
```js
{
  _id:                   ObjectId,
  prescription_item_id:  ObjectId,  // ref subdoc item._id trong prescriptions
  user_id:               ObjectId,  // ref: 'User' — người nhận nhắc (gửi email)
  gio_nhac:              Date,      // thời điểm nhắc chính xác
  status:                'pending' | 'sent' | 'taken' | 'missed',
  ngay_gui:              Date | null,
  ngay_tao:              Date,
}
// Index: { status: 1, gio_nhac: 1 }   → cron job 5 phút: lấy pending sắp đến
//        { status: 1, ngay_gui: 1 }   → cron job: sent > 2h → missed
//        { user_id: 1 }, { prescription_item_id: 1 }
// Cron 5 phút: pending → sent (gửi email/FCM)
// Cron 5 phút: sent + (now - ngay_gui > 2h) → missed
// Bệnh nhân xác nhận uống: sent → taken
```

---

### NHÓM 8 — Đánh giá

#### `reviews`
```js
{
  _id:            ObjectId,
  appointment_id: ObjectId,  // ref: 'Appointment', unique — 1 lịch 1 đánh giá
  user_id:        ObjectId,  // ref: 'User'
  doctor_id:      ObjectId,  // ref: 'Doctor'
  so_sao:         Number,    // 1–5
  noi_dung:       String | null,  // ≤500 ký tự
  status:         'visible' | 'hidden',  // default: 'visible'
  ngay_tao:       Date,
}
// Index: { appointment_id: 1 } unique
//        { doctor_id: 1, status: 1, so_sao: 1 }
//        { status: 1 }
//
// Khi status đổi (hidden/visible): trigger cập nhật doctors.diem_danh_gia
//   diem_danh_gia = avg(so_sao) của tất cả review visible của bác sĩ đó
//   tong_danh_gia = count(review visible)
// Bác sĩ KHÔNG thấy review có status='hidden'
```

---

### NHÓM 9 — Thông báo

#### `notifications`
```js
{
  _id:          ObjectId,
  user_id:      ObjectId,  // ref: 'User' — người nhận
  tieu_de:      String,    // ≤255 ký tự
  noi_dung:     String,
  loai:         'appointment' | 'medicine' | 'system',
  related_id:   ObjectId | null,  // ID entity liên quan
  related_type: String | null,    // 'appointment' | 'medical_record' | 'reminder'
  da_doc:       Boolean,   // default: false
  ngay_tao:     Date,
}
// Index: { user_id: 1, da_doc: 1 }  → unread count query
//        { ngay_tao: 1 }
// ⚠️ KHÔNG dùng TTL index — TTL xóa tất cả bất kể da_doc, sẽ xóa cả thông báo chưa đọc
// Dùng cron: xóa { da_doc: true, ngay_tao: { $lt: now - 90 ngày } }
// related_id + related_type: điều hướng đến đúng trang khi click
```

#### `thong_bao_he_thong` (system_notifications)
```js
{
  _id:           ObjectId,
  tieu_de:       String,    // ≤60 ký tự
  noi_dung:      String,
  url:           String | null,  // link điều hướng khi click
  doi_tuong:     'tat_ca' | 'benh_nhan' | 'bac_si',
  tao_boi:       ObjectId,  // ref: 'NguoiDung' (Admin)
  ngay_gui:      Date | null,
  so_nguoi_nhan: Number,    // default: 0
  status:        'draft' | 'sending' | 'sent' | 'failed',  // default: 'draft'
  loi_gui:       String | null,  // ghi lỗi khi status='failed'
  ngay_tao:      Date,
}
// Index: { tao_boi: 1 }, { ngay_gui: -1 }, { status: 1 }
// Batch insert 100 records/lần vào thong_bao để tránh quá tải
// Không thu hồi sau khi gửi (status='sent')
```

---

### NHÓM 10 — AI Chatbot

#### `chat_sessions`
```js
{
  _id:            ObjectId,
  user_id:        ObjectId,  // ref: 'User'
  ngay_bat_dau:   Date,
  ngay_ket_thuc:  Date | null,  // null=đang mở; có giá trị=đã đóng
}
// Index: { user_id: 1 }
// TTL: tự đóng sau 24h không có tin nhắn mới
//   Logic ở tầng ứng dụng: khi gửi tin → cập nhật ngay_ket_thuc = now + 24h
```

#### `chat_messages`
```js
{
  _id:        ObjectId,
  session_id: ObjectId,  // ref: 'ChatSession'
  vai_tro:    'user' | 'ai',  // user=bệnh nhân gửi, ai=Gemini trả lời
  noi_dung:   String,   // ≤1000 ký tự
  thoi_diem:  Date,
}
// Index: { session_id: 1, thoi_diem: 1 }
// Không embed trong session vì số tin nhắn không giới hạn
```

---

### NHÓM 11 — Nhật ký & Lịch sử

#### `nhat_ky_thao_tac` (audit_logs)
```js
{
  _id:                ObjectId,
  nguoi_thuc_hien_id: ObjectId | null,  // ref: 'NguoiDung'; null khi vai_tro='system'
  vai_tro:            'admin' | 'doctor' | 'user' | 'system',
  hanh_dong:          String,  // 'LOCK_USER' | 'APPROVE_DOCTOR' | 'REJECT_DOCTOR'
                               // 'SUSPEND_DOCTOR' | 'CANCEL_APPOINTMENT'
                               // 'HIDE_REVIEW' | 'APPROVE_REFUND' | 'REJECT_REFUND'
                               // 'CREATE_SERVICE' | 'UPDATE_SERVICE' | ...
  loai_doi_tuong:     String,  // 'NguoiDung' | 'BacSi' | 'LichHen' | 'DanhGia' | ...
  doi_tuong_id:       ObjectId,
  ly_do:              String | null,
  du_lieu_cu:         Mixed | null,  // JSON snapshot trước khi đổi
  du_lieu_moi:        Mixed | null,  // JSON snapshot sau khi đổi
  ngay_tao:           Date,
}
// Index: { nguoi_thuc_hien_id: 1 }, { vai_tro: 1 }, { hanh_dong: 1 }
//        { loai_doi_tuong: 1, doi_tuong_id: 1 }
//        { ngay_tao: -1 }
// Bất biến: KHÔNG update, KHÔNG delete — chỉ insert

#### `lich_su_lich_hen` (appointment_status_history) 🆕
```js
{
  _id:                ObjectId,
  appointment_id:     ObjectId,  // ref: 'LichHen'
  tu_trang_thai:      String | null,   // null khi mới tạo
  den_trang_thai:     String,
  tu_payment_status:  String | null,
  den_payment_status: String | null,
  nguoi_thuc_hien_id: ObjectId | null, // null khi vai_tro='system'
  vai_tro:            'admin' | 'doctor' | 'user' | 'system',
  ly_do:              String | null,
  thoi_diem:          Date,
}
// Index: { appointment_id: 1, thoi_diem: 1 }
//        { nguoi_thuc_hien_id: 1 }
//        { vai_tro: 1, thoi_diem: -1 }
// timestamps: false — dùng thoi_diem thay thế
```

---

## Điểm thiết kế quan trọng khi viết code

### 1. Atomic update đặt slot (status-based, 1 slot = 1 BN)
```js
// Thay thế SELECT FOR UPDATE của MySQL — dùng findOneAndUpdate atomic:
const schedule = await LichLamViec.findOneAndUpdate(
  {
    _id: scheduleId,
    'slots._id': slotId,
    'slots.$.status': 'active',          // chỉ đặt được khi active
    'slots.$.phong_kham': { $ne: null }, // clinic: phải có phòng (home bỏ điều kiện này)
  },
  { $set: { 'slots.$.status': 'booked' } },
  { new: true, arrayFilters: [{ 'elem._id': slotId }] }
)
if (!schedule) throw new Error('Slot không còn trống hoặc chưa có phòng')
```

### 2. Soft delete members
```js
// Không dùng deleteOne — dùng soft delete:
await Member.findByIdAndUpdate(id, { ngay_xoa: new Date() })
// Query members còn hoạt động:
Member.find({ family_id, ngay_xoa: null })
```

### 3. Snapshot giá khi tạo appointment
```js
// Lấy giá từ service tại thời điểm đặt, không lấy từ doctor.phi_tu_van
const service = await Service.findById(serviceId)
appointment.gia_kham = service.gia  // snapshot, không đổi sau này
```

### 4. Cập nhật điểm đánh giá bác sĩ
```js
// Trigger khi review.status thay đổi (hide/show):
const stats = await Review.aggregate([
  { $match: { doctor_id: doctorId, status: 'visible' } },
  { $group: { _id: null, avg: { $avg: '$so_sao' }, count: { $sum: 1 } } }
])
await Doctor.findByIdAndUpdate(doctorId, {
  diem_danh_gia: stats[0]?.avg ?? 0,
  tong_danh_gia: stats[0]?.count ?? 0,
})
```

### 5. Khóa kết quả khám sau 24h
```js
// Khi bác sĩ update examination_result:
const result = await ExaminationResult.findById(id)
const elapsed = Date.now() - result.ngay_tao.getTime()
if (elapsed > 24 * 60 * 60 * 1000) {
  await ExaminationResult.findByIdAndUpdate(id, { co_the_sua: false })
  throw new Error('Kết quả đã bị khóa sau 24 giờ')
}
```

### 6. Cron jobs cần thiết
| Cron | Tần suất | Việc làm |
|---|---|---|
| Hủy unpaid appointment | Mỗi 5 phút | `payment_status=unpaid, ngay_tao < now-N phút` (N từ `thoi_gian_het_han_thanh_toan`) → hủy |
| Gửi reminder thuốc | Mỗi 5 phút | `status=pending, gio_nhac <= now` → gửi email/FCM → `sent` |
| Đánh dấu missed | Mỗi 5 phút | `status=sent, ngay_gui < now-2h` → `missed` |
| Khóa kết quả khám | Mỗi 1 giờ | `co_the_sua=true, ngay_tao < now-24h` → `co_the_sua=false` |
| Đóng chat session | Mỗi 1 giờ | `ngay_ket_thuc < now` → closed |
| Expire slots | Mỗi ngày 00:05 | `slots.status=active, ngay < hôm nay` → `expired` (xem `LichLamViec.expireSlots`) |
| Xóa thông báo cũ | Mỗi ngày | `da_doc=true, ngay_tao < now-90 ngày` → xóa (KHÔNG dùng TTL index) |

### 7. Home appointment — luồng đặc biệt
```
Bệnh nhân thanh toán
  → appointment.status = 'pending'  (KHÔNG auto-confirm)
  → Bác sĩ nhận notification: "Lịch tại nhà cần xác nhận — [dia_chi_kham]"
  → Bác sĩ confirm → status = 'confirmed'
  → Bác sĩ từ chối → status = 'cancelled' → hoàn tiền 100%
  → Nếu bác sĩ không phản hồi trong 2h → cron nhắc lại
```

### 8. Đổi role khi duyệt bác sĩ
```js
// Dùng session transaction để đảm bảo tính nhất quán:
const session = await mongoose.startSession()
await session.withTransaction(async () => {
  await Doctor.findByIdAndUpdate(doctorId, { trang_thai_duyet: 'approved' }, { session })
  await User.findByIdAndUpdate(userId, { role: 'doctor' }, { session })
  await AuditLog.create([{ hanh_dong: 'APPROVE_DOCTOR', ... }], { session })
})
```

---

## Seed Data — cai_dat_thanh_toan (payment_settings)
```js
await CaiDatThanhToan.insertMany([
  { ten_cai_dat: 'hoan_tien_tu_24h_tro_len', gia_tri: '100', mo_ta: 'Hủy ≥ 24h trước: hoàn 100%' },
  { ten_cai_dat: 'hoan_tien_12_24h',         gia_tri: '80',  mo_ta: 'Hủy 12–24h trước: hoàn 80%' },
  { ten_cai_dat: 'hoan_tien_6_12h',          gia_tri: '50',  mo_ta: 'Hủy 6–12h trước: hoàn 50%' },
  { ten_cai_dat: 'hoan_tien_duoi_6h',        gia_tri: '0',   mo_ta: 'Hủy < 6h: không hoàn' },
  { ten_cai_dat: 'hoan_tien_bac_si_huy',     gia_tri: '100', mo_ta: 'Bác sĩ chủ động hủy: hoàn 100%' },
  { ten_cai_dat: 'hoan_tien_admin_huy',      gia_tri: '100', mo_ta: 'Admin hủy khẩn cấp: hoàn 100%' },
  { ten_cai_dat: 'thoi_gian_het_han_thanh_toan', gia_tri: '15', mo_ta: 'Unpaid quá N phút → cron tự hủy' },
  // hoa_hong_phan_tram đã BỎ — phòng khám tư không chia hoa hồng
])
```

**Mapping với chính sách hoàn tiền (features.md):**
```
diff = ngay_kham - thoi_diem_huy

diff >= 24h  → hoan_tien_tu_24h_tro_len  = 100%
diff >= 12h  → hoan_tien_12_24h          = 80%
diff >= 6h   → hoan_tien_6_12h           = 50%
diff < 6h    → hoan_tien_duoi_6h         = 0%
bác sĩ hủy  → hoan_tien_bac_si_huy      = 100% (bất kể thời gian)
admin hủy    → hoan_tien_admin_huy       = 100%
```
