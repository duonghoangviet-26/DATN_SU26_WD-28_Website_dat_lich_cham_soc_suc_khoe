# C4 — Quản lý dịch vụ (ManageServices)

> Tài liệu phân tích chi tiết chức năng C4 — Quản lý dịch vụ.
> **Phiên bản 6** — Cập nhật: Kết nối backend MongoDB hoàn tất, đổi id → `string` (ObjectId), thêm `specialty.service.ts`, ghi lại 6 bug tìm & sửa.

---

## 0. Phân tích đúng / sai / cần điều chỉnh từ yêu cầu

### ✅ Đúng — giữ nguyên hoặc đưa vào

| Điểm | Lý do |
|---|---|
| 2 loại dịch vụ: khám tại viện (`clinic`) và khám tại nhà (`home`) | Rõ ràng, phù hợp nghiệp vụ |
| Bệnh nhân thanh toán **100% khi đặt lịch** → không cần phương thức thanh toán trong quản lý dịch vụ | Đúng — payment method nằm ở C8, không ở C4 |
| Bỏ "Cho phép đặt online", "Đặt cọc", "Thanh toán online/offline" | Web mặc định là online, trả đủ 100% |
| Thêm **Mã dịch vụ** (DV001) | Tốt cho tra cứu, in phiếu khám |
| **Lịch áp dụng** (ngày/giờ hoạt động tổng quát) | Hiển thị cho bệnh nhân biết khung giờ nhận lịch |
| Thêm cột **Địa điểm / Khu vực** trong bảng | Phân biệt rõ clinic vs home |
| Thêm cột **Lượt đặt** (computed) | Tốt cho quản lý, không cần cột riêng trong DB |
| Mô tả ngắn + Mô tả chi tiết | Mô tả ngắn cho danh sách, chi tiết cho trang booking |
| Bỏ "Cần xác nhận" khỏi service form | Home luôn cần xác nhận (quy tắc cứng), clinic auto-confirm — không cần admin set |

---

### ⚠️ Đúng ý tưởng nhưng cần điều chỉnh cách làm

| Điểm | Vấn đề | Điều chỉnh |
|---|---|---|
| **Bác sĩ phụ trách** trong bảng dịch vụ | 1 dịch vụ có thể có nhiều bác sĩ (many-to-many). Lưu 1 bác sĩ vào bảng services là sai thiết kế | Hiển thị computed count "X bác sĩ" trong table. Bác sĩ tự đăng ký dịch vụ mình cung cấp (B1) |
| **Số lượt tối đa mỗi khung giờ** (clinic form) | Đây là per-doctor, không per-service. BS A nhận 3 người/slot, BS B nhận 1 người — cùng dịch vụ | Thuộc B2 (Lịch làm việc bác sĩ), không lưu trong services |
| **Số lượt tối đa mỗi ngày** (home form) | Cũng là per-doctor | Thuộc B2, không lưu trong services |
| **Khu vực hỗ trợ** (home) là multi-select | Không thể lưu array vào 1 cột SQL chuẩn hóa | Cần bảng riêng `service_areas (service_id, quan_huyen)` |
| **Phòng khám** (room) trong clinic form | Quản lý phòng quá chi tiết cho phạm vi DATN | Bỏ field room. Bác sĩ làm việc tại bệnh viện (hospital) là đủ |
| **Lịch áp dụng** trong form | Cần phân biệt rõ: đây là thông tin hiển thị tổng quát, KHÔNG thay thế lịch thực tế (B2) | Lưu vào service như gợi ý (`ngay_ap_dung`, `gio_bat_dau`, `gio_ket_thuc`), slot thực tế vẫn do B2 |

---

### ❌ Bỏ hoàn toàn

| Điểm bỏ | Lý do |
|---|---|
| **Phụ phí di chuyển** (home) | Gộp vào giá dịch vụ, ghi rõ trong mô tả: "Giá đã bao gồm phí đi lại" |
| **`doctor.phi_tu_van` là cơ sở tính tiền** | Khi service.gia = giá thực tế, doctor.phi_tu_van chỉ còn là thông tin hiển thị trên profile |
| **`service.gia` = "giá tham khảo"** (quyết định cũ phiên bản 3) | Thay bằng: `service.gia` = giá thực tế bệnh nhân thanh toán |

---

## 1. Quyết định thiết kế đã chốt (Phiên bản 4)

### Quyết định 1: `service.gia` = Giá thực tế bệnh nhân thanh toán

Hệ thống yêu cầu thanh toán trước 100% khi đặt lịch → Admin kiểm soát giá hoàn toàn.

```
service.gia (Admin set)     → Bệnh nhân trả đúng số này khi booking
appointment.gia_kham        → Snapshot của service.gia tại thời điểm đặt (không đổi sau đó)
doctor.phi_tu_van           → Thông tin tham khảo trên profile bác sĩ, không dùng để tính tiền
```

**Hệ quả:**
- Bệnh nhân nhìn thấy giá rõ ràng trước khi đặt, không bị bất ngờ
- Admin toàn quyền điều chỉnh giá dịch vụ
- Nếu admin thay đổi giá sau khi bệnh nhân đã đặt → `appointment.gia_kham` giữ nguyên giá cũ (snapshot)

---

### Quyết định 2: Thêm `ma_dich_vu` — Mã dịch vụ

```sql
ma_dich_vu VARCHAR(20) UNIQUE NOT NULL  -- Auto-generate: DV001, DV002...
```

- Format: `DV` + 3 chữ số tự tăng (`DV001`, `DV002`...)
- Admin không sửa được sau khi tạo
- Dùng để tra cứu nhanh, in trên phiếu khám, log hệ thống

---

### Quyết định 3: Thêm "Lịch áp dụng tổng quát" vào service

3 trường hiển thị tổng quát cho bệnh nhân:

```sql
ngay_ap_dung  VARCHAR(50) NULL   -- "T2–T7", "T2–CN"
gio_bat_dau   TIME        NULL   -- 08:00
gio_ket_thuc  TIME        NULL   -- 17:00
```

**Phân biệt rõ:**
- `ngay_ap_dung / gio_bat_dau / gio_ket_thuc` → Thông tin **hiển thị** cho bệnh nhân biết service này hoạt động khung giờ nào
- Slot thực tế → Vẫn do **B2 (Lịch làm việc bác sĩ)** quản lý
- Nếu service nói "T2–T7, 8:00–17:00" nhưng bác sĩ chỉ mở slot "T2–T4, 9:00–12:00" → hiển thị slot thực tế của bác sĩ khi bệnh nhân chọn

---

### Quyết định 4: Bảng `service_areas` cho home service

Home service cần quản lý khu vực phục vụ → bảng riêng.

```sql
CREATE TABLE service_areas (
  id           INT          NOT NULL AUTO_INCREMENT,
  service_id   INT          NOT NULL,
  quan_huyen   VARCHAR(100) NOT NULL,  -- "Cầu Giấy", "Nam Từ Liêm"
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_area (service_id, quan_huyen),
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
)
```

- Clinic service → `service_areas` rỗng (vị trí cố định tại hospital)
- Home service → có 1–N rows trong `service_areas`
- Khi bệnh nhân đặt home: hệ thống gợi ý kiểm tra khu vực, bác sĩ confirm cuối cùng

---

### Quyết định 5: Bác sĩ ↔ Dịch vụ là many-to-many, không lưu trong services

```
services table   → KHÔNG có doctor_id
doctor_services  → Bảng join: doctor_id, service_id (bác sĩ đăng ký dịch vụ mình cung cấp)
```

- Bác sĩ tự chọn dịch vụ mình cung cấp khi thiết lập hồ sơ (B1)
- Bảng dịch vụ admin chỉ hiển thị số lượng "X bác sĩ" (computed từ `doctor_services`)
- Bệnh nhân tìm bác sĩ theo dịch vụ → lọc từ bảng join này

---

### Quyết định 6 (giữ từ V3): `appointments.hospital_id` nullable

```sql
hospital_id INT NULL  -- NULL khi loai_kham = 'home'
```

---

### Quyết định 7 (giữ từ V3): Thêm `dia_chi_kham` vào appointments

```sql
dia_chi_kham VARCHAR(500) NULL  -- Bắt buộc khi loai_kham='home'
```

---

### Quyết định 8 (giữ từ V3): Home slot luôn max 1, cần bác sĩ confirm thủ công

---

### Quyết định 9 (giữ từ V3): Unique `(ten, specialty_id)` — cho phép cùng tên khác chuyên khoa

---

## 2. Schema chuẩn hóa

### 2.1 Bảng `services`

```sql
CREATE TABLE services (
  id                        INT           NOT NULL AUTO_INCREMENT,
  ma_dich_vu                VARCHAR(20)   NOT NULL,
  ten                       VARCHAR(255)  NOT NULL,
  loai                      ENUM('clinic','home') NOT NULL,
  mo_ta_ngan                VARCHAR(500)  NULL,
  mo_ta                     TEXT          NULL,
  gia                       DECIMAL(10,2) NOT NULL COMMENT 'Giá thực tế bệnh nhân trả',
  thoi_gian_phut            INT           NOT NULL,
  gio_dat_truoc_toi_thieu   INT           NOT NULL DEFAULT 2,
  ngay_ap_dung              VARCHAR(50)   NULL,   -- "T2–T7"
  gio_bat_dau               TIME          NULL,   -- 08:00
  gio_ket_thuc              TIME          NULL,   -- 17:00
  specialty_id              INT           NULL,
  status                    ENUM('active','inactive') NOT NULL DEFAULT 'active',
  ngay_tao                  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ngay_cap_nhat             TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_ma_dich_vu (ma_dich_vu),
  UNIQUE KEY uq_ten_specialty (ten, specialty_id),
  INDEX idx_status_loai (status, loai),

  CONSTRAINT fk_services_specialty
    FOREIGN KEY (specialty_id) REFERENCES specialties(id) ON DELETE SET NULL,
  CONSTRAINT chk_gia        CHECK (gia > 0),
  CONSTRAINT chk_tg         CHECK (thoi_gian_phut >= 10 AND thoi_gian_phut <= 480),
  CONSTRAINT chk_dat_truoc  CHECK (gio_dat_truoc_toi_thieu >= 1 AND gio_dat_truoc_toi_thieu <= 48)
)
```

---

### 2.2 Bảng `service_areas` (MỚI — cho home service)

```sql
CREATE TABLE service_areas (
  id           INT          NOT NULL AUTO_INCREMENT,
  service_id   INT          NOT NULL,
  quan_huyen   VARCHAR(100) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_area (service_id, quan_huyen),
  CONSTRAINT fk_sa_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
)
```

---

### 2.3 Bảng `doctor_services` (MỚI — bác sĩ ↔ dịch vụ)

```sql
CREATE TABLE doctor_services (
  doctor_id   INT NOT NULL,
  service_id  INT NOT NULL,
  PRIMARY KEY (doctor_id, service_id),
  CONSTRAINT fk_ds_doctor  FOREIGN KEY (doctor_id)  REFERENCES doctor_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_ds_service FOREIGN KEY (service_id) REFERENCES services(id)        ON DELETE CASCADE
)
```

---

### 2.4 Thay đổi bảng `appointments`

```sql
-- Các thay đổi so với SQL gốc:

-- 1. Bỏ 'video' khỏi enum
loai_kham  ENUM('clinic','home') NOT NULL

-- 2. hospital_id nullable (home visit = NULL)
hospital_id INT NULL

-- 3. Thêm địa chỉ nhà bệnh nhân
dia_chi_kham VARCHAR(500) NULL

-- 4. Đảm bảo gia_kham = snapshot từ service.gia lúc đặt
-- (xử lý ở tầng ứng dụng khi tạo appointment)
```

---

### 2.5 Mongoose Schema

```js
const serviceSchema = new Schema({
  ma_dich_vu:               { type: String, required: true, unique: true, trim: true, maxlength: 20 },
  ten:                      { type: String, required: true, trim: true, maxlength: 255 },
  loai:                     { type: String, enum: ['clinic', 'home'], required: true },
  mo_ta_ngan:               { type: String, default: null, maxlength: 500 },
  mo_ta:                    { type: String, default: null, maxlength: 5000 },
  gia:                      { type: Number, required: true, min: 1 },
  thoi_gian_phut:           { type: Number, required: true, min: 10, max: 480 },
  gio_dat_truoc_toi_thieu:  { type: Number, required: true, min: 1, max: 48, default: 2 },
  ngay_ap_dung:             { type: String, default: null },   // "T2–T7"
  gio_bat_dau:              { type: String, default: null },   // "08:00"
  gio_ket_thuc:             { type: String, default: null },   // "17:00"
  specialty_id:             { type: Schema.Types.ObjectId, ref: 'Specialty', default: null },
  status:                   { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' } })

serviceSchema.index({ ma_dich_vu: 1 }, { unique: true })
serviceSchema.index({ ten: 1, specialty_id: 1 }, { unique: true })
serviceSchema.index({ status: 1, loai: 1 })

const serviceAreaSchema = new Schema({
  service_id:  { type: Schema.Types.ObjectId, ref: 'Service', required: true },
  quan_huyen:  { type: String, required: true, trim: true },
})
serviceAreaSchema.index({ service_id: 1, quan_huyen: 1 }, { unique: true })

const doctorServiceSchema = new Schema({
  doctor_id:   { type: Schema.Types.ObjectId, ref: 'DoctorProfile', required: true },
  service_id:  { type: Schema.Types.ObjectId, ref: 'Service',       required: true },
})
doctorServiceSchema.index({ doctor_id: 1, service_id: 1 }, { unique: true })
```

---

## 3. TypeScript Types (cập nhật V5)

```ts
export type ServiceType   = 'clinic' | 'home'
export type ServiceStatus = 'active' | 'inactive'

// ─── Lịch sử thay đổi ─────────────────────────────────────────
export interface ServiceChangeLog {
  id: string                                            // MongoDB ObjectId (đổi từ number V6)
  thoi_gian: string                                     // ISO datetime
  hanh_dong: 'tao_moi' | 'cap_nhat' | 'an' | 'hien'  // loại thao tác
  nguoi_thay_doi: string                                // tên admin thực hiện
  mo_ta?: string                                        // mô tả nội dung thay đổi
}

export interface ServiceItem {
  id: string                           // MongoDB ObjectId — KHÔNG phải number (V6)
  ma_dich_vu: string                   // "DV001" — BE auto-gen
  ten: string
  loai: ServiceType
  gia: number                          // giá thực tế bệnh nhân trả
  mo_ta_ngan?: string | null           // mô tả ngắn (hiển thị trong list)
  mo_ta?: string | null                // mô tả chi tiết
  thoi_gian_phut: number
  gio_dat_truoc_toi_thieu: number
  ngay_ap_dung?: string | null         // "T2–T7" — null khi để trống (không phải "")
  gio_bat_dau?: string | null          // "08:00" — null khi để trống
  gio_ket_thuc?: string | null         // "17:00" — null khi để trống
  specialty_id?: string | null         // ObjectId string hoặc null (V6)
  specialty_ten?: string | null        // joined từ ChuyenKhoa.ten
  khu_vuc?: string[]                   // home only — ["Cầu Giấy", "Nam Từ Liêm"]
  so_bac_si?: number                   // computed — số bác sĩ cung cấp dịch vụ này
  so_luot_dat?: number                 // computed — tổng lượt đặt
  status: ServiceStatus
  ngay_tao?: string
  ngay_cap_nhat?: string
  lich_su_thay_doi?: ServiceChangeLog[]  // audit log
}

export interface ServiceFormData {
  ten: string
  loai: ServiceType
  gia: number
  mo_ta_ngan?: string
  mo_ta?: string
  thoi_gian_phut: number
  gio_dat_truoc_toi_thieu: number
  ngay_ap_dung?: string
  gio_bat_dau?: string
  gio_ket_thuc?: string
  specialty_id?: string | null         // ObjectId string hoặc null (V6)
  khu_vuc?: string[]                   // home only
}

// Appointment — cập nhật
export interface Appointment {
  // ... trường cũ
  loai_kham:    'clinic' | 'home'
  hospital_id:  number | null          // NULL khi home
  dia_chi_kham?: string | null         // bắt buộc khi home
  gia_kham:     number                 // = snapshot service.gia lúc đặt
}
```

---

## 4. Mock Data chuẩn hóa (V5)

Mỗi dịch vụ có thêm `lich_su_thay_doi` để minh họa audit log.

```ts
// frontend/src/mock/services.ts
export const mockServices: ServiceItem[] = [
  {
    id: 1, ma_dich_vu: 'DV001',
    ten: 'Khám tổng quát tại viện',
    loai: 'clinic', gia: 200000,
    mo_ta_ngan: 'Khám sức khỏe tổng quát tại cơ sở y tế.',
    mo_ta: 'Khám sức khỏe tổng quát với bác sĩ. Đầy đủ thiết bị: XQ, siêu âm, xét nghiệm máu.',
    thoi_gian_phut: 30, gio_dat_truoc_toi_thieu: 2,
    ngay_ap_dung: 'T2–T7', gio_bat_dau: '07:00', gio_ket_thuc: '17:00',
    specialty_id: null, specialty_ten: null, khu_vuc: [],
    so_bac_si: 3, so_luot_dat: 128, status: 'active',
    ngay_tao: '2026-01-10T00:00:00', ngay_cap_nhat: '2026-03-15T14:00:00',
    lich_su_thay_doi: [
      { id: 1, thoi_gian: '2026-01-10T08:00:00', hanh_dong: 'tao_moi',  nguoi_thay_doi: 'Nguyễn Văn Admin', mo_ta: 'Tạo dịch vụ' },
      { id: 2, thoi_gian: '2026-02-05T10:30:00', hanh_dong: 'cap_nhat', nguoi_thay_doi: 'Nguyễn Văn Admin', mo_ta: 'Cập nhật giá và mô tả dịch vụ' },
      { id: 3, thoi_gian: '2026-03-15T14:00:00', hanh_dong: 'cap_nhat', nguoi_thay_doi: 'Trần Thị Admin',   mo_ta: 'Điều chỉnh thời gian áp dụng' },
    ],
  },
  // DV002, DV003 tương tự — mỗi dịch vụ 2–3 log entries
  {
    id: 4, ma_dich_vu: 'DV004',
    ten: 'Khám chuyên khoa tại nhà',
    loai: 'home', gia: 700000,
    // ... các trường khác ...
    status: 'inactive',
    ngay_tao: '2026-01-20T00:00:00', ngay_cap_nhat: '2026-04-01T11:00:00',
    lich_su_thay_doi: [
      { id: 8,  thoi_gian: '2026-01-20T09:00:00', hanh_dong: 'tao_moi',  nguoi_thay_doi: 'Nguyễn Văn Admin', mo_ta: 'Tạo dịch vụ' },
      { id: 9,  thoi_gian: '2026-03-01T14:30:00', hanh_dong: 'cap_nhat', nguoi_thay_doi: 'Trần Thị Admin',   mo_ta: 'Thu hẹp khu vực phục vụ' },
      { id: 10, thoi_gian: '2026-04-01T11:00:00', hanh_dong: 'an',       nguoi_thay_doi: 'Nguyễn Văn Admin', mo_ta: 'Ẩn tạm thời do chưa có bác sĩ đảm nhận' },
    ],
  },
]
```

**Quy tắc ID log:** Mock data dùng id 1–10. Service layer bắt đầu `nextLogId = 11` và tăng dần mỗi khi có thao tác.

---

## 5. Thiết kế UI — Bảng danh sách

### 5.1 Cấu trúc bảng (12 cột)

| Cột | Nguồn | Ghi chú |
|---|---|---|
| Mã DV | `ma_dich_vu` | VD: DV001 |
| Tên dịch vụ | `ten` | Kèm mô tả ngắn bên dưới |
| Loại | `loai` | Badge: Phòng khám / Tại nhà |
| Chuyên khoa | `specialty_ten` | "—" nếu chưa gắn |
| Giá | `gia` | Giá bệnh nhân trả, highlight rõ |
| Thời lượng | `thoi_gian_phut` | "30 phút" |
| Địa điểm / Khu vực | computed | Clinic → tên bệnh viện; Home → danh sách quận |
| Lịch áp dụng | `ngay_ap_dung + gio_bat_dau + gio_ket_thuc` | "T2–T7, 8:00–17:00" |
| Bác sĩ | `so_bac_si` | "3 bác sĩ" |
| Lượt đặt | `so_luot_dat` | Computed từ appointments |
| Trạng thái | `status` | Badge: Hoạt động / Đã ẩn |
| Hành động | — | **Xem** / Sửa / Ẩn / Hiện |

### 5.2 Wireframe bảng

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ Quản lý dịch vụ                                              [+ Thêm dịch vụ]       │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ [Tổng: 4] [Hoạt động: 3] [Đã ẩn: 1] [Tại viện: 2] [Tại nhà: 1]                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ [Tất cả] [Tại viện] [Tại nhà]         🔍 Tìm theo tên dịch vụ...                   │
├────┬──────────────────┬──────────┬────────┬────────┬────────┬────────┬─────────────┤
│Mã  │Tên dịch vụ       │Loại      │Chuyên  │  Giá   │T.lượng │B.sĩ    │ TT  │ Action│
├────┼──────────────────┼──────────┼────────┼────────┼────────┼────────┼─────┼───────┤
│DV01│Khám tổng quát... │[Tại viện]│   —    │200.000₫│ 30 ph  │3 bác sĩ│[●] │[X][S][Ẩ]│
│DV02│Khám chuyên khoa..│[Tại viện]│   —    │350.000₫│ 45 ph  │5 bác sĩ│[●] │[X][S][Ẩ]│
│DV03│Khám tại nhà...   │[Tại nhà] │   —    │500.000₫│ 60 ph  │2 bác sĩ│[●] │[X][S][Ẩ]│
│DV04│Khám CK tại nhà.. │[Tại nhà] │   —    │700.000₫│ 90 ph  │1 bác sĩ│[Ẩn]│[X][S][H]│

> [X] = Xem chi tiết + lịch sử  [S] = Sửa  [Ẩ/H] = Ẩn / Hiện
└────┴──────────────────┴──────────┴────────┴────────┴────────┴────────┴─────┴───────┘
```

> **Lưu ý:** Dòng bị ẩn (`inactive`) → các cột dữ liệu mờ đi 40%, **cột Hành động giữ nguyên màu sắc** để dễ thao tác.

---

## 6. Thiết kế UI — Form Thêm / Sửa

### 6.1 Trường chung (cả clinic và home)

| Trường | Bắt buộc | Kiểu | Validation |
|---|---|---|---|
| Tên dịch vụ | ✅ | Text | ≤ 255 ký tự |
| Loại hình | ✅ | Radio: Tại viện / Tại nhà | — |
| Chuyên khoa | ❌ | Select (từ bảng specialties active) | — |
| Giá dịch vụ (VNĐ) | ✅ | Number | > 0, ≤ 100,000,000, số nguyên |
| Thời lượng dự kiến (phút) | ✅ | Number | ≥ 10, ≤ 480 |
| Mô tả ngắn | ❌ | Text | ≤ 500 ký tự |
| Mô tả chi tiết | ❌ | Textarea | ≤ 5000 ký tự |
| Ngày áp dụng | ❌ | Text | VD: "T2–T7", "Hàng ngày" |
| Giờ bắt đầu | ❌ | Time | HH:MM |
| Giờ kết thúc | ❌ | Time | HH:MM, sau giờ bắt đầu |

### 6.2 Trường riêng — Khám tại viện

Hiển thị thêm sau khi chọn loại "Tại viện":

| Trường | Ghi chú |
|---|---|
| Đặt trước tối thiểu | Auto-fill: **2 giờ** |
| *(Bác sĩ phụ trách)* | Xem trong B1 — bác sĩ tự đăng ký |
| *(Cơ sở khám)* | Hiển thị trong booking (A5) — không lưu trong service |

> ℹ️ Hint: "Bác sĩ và cơ sở khám được gắn tự động khi bác sĩ đăng ký cung cấp dịch vụ này."

### 6.3 Trường riêng — Khám tại nhà

Hiển thị thêm sau khi chọn loại "Tại nhà":

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| Đặt trước tối thiểu | ✅ | Auto-fill: **4 giờ** |
| Khu vực hỗ trợ | ❌ | Multi-checkbox: Quận/Huyện (lưu vào `service_areas`) |

> ℹ️ Hint: "Giá nên bao gồm phí đi lại. Slot khám tại nhà tối đa 1 bệnh nhân mỗi lần. Bác sĩ cần xác nhận thủ công trước khi lịch được chốt."

### 6.4 Trường riêng chỉ hiện khi Sửa (không hiện khi Thêm mới)

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| Mô tả cập nhật | ❌ | Nội dung ghi vào lịch sử thay đổi. Để trống → ghi mặc định "Cập nhật thông tin dịch vụ" |

```
┌─── Mô tả cập nhật (ghi vào lịch sử thay đổi) ─────────────┐
│ VD: Tăng giá từ 200.000đ lên 250.000đ, thêm khu vực...    │
│                                              0/300          │
│ Để trống → ghi mặc định "Cập nhật thông tin dịch vụ"      │
└─────────────────────────────────────────────────────────────┘
```

> Trường này xuất hiện ở cuối form sửa, trong khung màu xanh để phân biệt với các trường dữ liệu dịch vụ.

---

### 6.5 Wireframe Modal
│                                         │
│ Loại hình *                             │
│ ┌──────────────────┐ ┌───────────────┐  │
│ │ ● Tại viện       │ │ ○ Tại nhà     │  │
│ │ Bệnh nhân đến    │ │ Bác sĩ đến    │  │
│ │ cơ sở. Đầy đủ   │ │ nhà. Slot     │  │
│ │ thiết bị.        │ │ max 1 người.  │  │
│ └──────────────────┘ └───────────────┘  │
│                                         │
│ Chuyên khoa liên quan                   │
│ [Không chọn ▾]                          │
│                                         │
│ Giá dịch vụ (VNĐ) *                    │
│ [___________]  ← Bệnh nhân trả đúng số  │
│                   này khi đặt lịch      │
│                                         │
│ Thời lượng *      Đặt trước tối thiểu * │
│ [___ phút]        [___ giờ]            │
│                                         │
│ Lịch áp dụng (tổng quát)               │
│ Ngày: [T2–T7]  Từ: [08:00] Đến:[17:00]│
│                                         │
│ [--- Chỉ hiện khi chọn "Tại nhà" ---]  │
│ Khu vực hỗ trợ                          │
│ ☑ Cầu Giấy  ☑ Nam Từ Liêm  ☐ Đống Đa  │
│ ☐ Ba Đình   ☐ Tây Hồ      ☐ Hoàn Kiếm │
│                                         │
│ Mô tả ngắn (hiển thị trong danh sách)  │
│ [_________________________________]     │
│                                         │
│ Mô tả chi tiết                          │
│ [_________________________________]     │
│ [_________________________________]     │
│                                         │
│             [Hủy]  [Thêm dịch vụ]     │
└─────────────────────────────────────────┘
```

---

## 7. Nghiệp vụ Admin — Luồng xử lý

### 7.1 Tạo dịch vụ mới

```
Admin điền form
    ↓
FE validate (bắt buộc, range)
    ↓
POST /api/admin/services
    ↓
BE validate + generate ma_dich_vu (DV001...)
    ↓
Lưu services + service_areas (nếu home)
    ↓
Trả về ServiceItem đã có ma_dich_vu
```

**Unique check:** `(ten + specialty_id)` — 409 nếu trùng

---

### 7.2 Sửa dịch vụ

**Cho phép sửa:** Tất cả trường trừ `ma_dich_vu`, `id`, `ngay_tao`

**Sửa `loai`:** Nếu còn lịch hẹn `pending/confirmed` → lỗi 422

**Sửa `gia`:**
- Không ảnh hưởng lịch hẹn cũ (đã snapshot vào `appointment.gia_kham`)
- Toast: *"Giá đã cập nhật. Các lịch hẹn đã đặt không thay đổi."*

**Sửa `khu_vuc` (home):**
- DELETE cũ + INSERT mới vào `service_areas`
- Nếu bệnh nhân đang pending ở khu vực bị xóa → cần thông báo (V2)

**Ghi lịch sử thay đổi (V5):**
- Admin điền "Mô tả cập nhật" ở cuối form trước khi bấm lưu
- Nếu để trống → ghi mặc định `"Cập nhật thông tin dịch vụ"`
- Mỗi lần sửa → thêm 1 entry vào `lich_su_thay_doi` với `hanh_dong = 'cap_nhat'`
- `nguoi_thay_doi` = tên admin đăng nhập (lấy từ JWT token khi gắn backend)

---

### 7.3 Ẩn / Hiện dịch vụ

**Ẩn (active → inactive):**
1. BE trả số lịch hẹn `pending/confirmed` còn dùng service này
2. ConfirmDialog: *"Dịch vụ sẽ ẩn. Có N lịch hẹn đang chờ — các lịch đó không bị hủy."*
3. `status = 'inactive'` — bệnh nhân không thấy nữa trên trang đặt lịch

**Hiện (inactive → active):** Không cần confirm thêm

---

### 7.4 Xóa dịch vụ — KHÔNG hỗ trợ

Dùng `inactive` thay thế. `service_id` trong `appointments` dùng để tra lịch sử khám.

---

## 8. Phân biệt nghiệp vụ Clinic vs Home (cập nhật V4)

| Khía cạnh | Tại viện (`clinic`) | Tại nhà (`home`) |
|---|---|---|
| Địa điểm khám | Bệnh viện / Phòng khám (cố định) | Địa chỉ bệnh nhân (biến đổi theo lịch) |
| `hospital_id` trong appointment | Bắt buộc | NULL |
| `dia_chi_kham` trong appointment | NULL | Bắt buộc |
| Khu vực phục vụ | Cố định tại cơ sở | Danh sách quận/huyện trong `service_areas` |
| `gio_dat_truoc_toi_thieu` mặc định | **2 giờ** | **4 giờ** |
| Số bệnh nhân / slot | 1–N (bác sĩ tự set trong B2) | Luôn = 1 (hệ thống ép) |
| Xác nhận lịch hẹn | Auto-confirm sau thanh toán | Bác sĩ phải confirm thủ công |
| Thiết bị y tế | Đầy đủ (XQ, siêu âm, xét nghiệm...) | Chỉ thiết bị di động |
| Chỉ định xét nghiệm | Làm ngay tại chỗ | Chỉ chỉ định, bệnh nhân đến cơ sở khác |
| Giá tham chiếu | 150.000 – 500.000 VNĐ | 400.000 – 1.200.000 VNĐ |
| Ghi chú giá | — | Nên ghi: "Đã bao gồm phí đi lại" trong `mo_ta` |
| Booking flow (A5) | Chọn bệnh viện → bác sĩ → slot → thanh toán | Chọn bác sĩ → slot → nhập địa chỉ → thanh toán |
| Bác sĩ từ chối | Hoàn tiền 100% | Hoàn tiền 100% |

---

## 9. API Contract

### `GET /api/admin/services`
```json
Query: ?loai=home&search=khám&status=active
Response: {
  "success": true,
  "data": [ServiceItem],
  "total": 4,
  "active_count": 3,
  "inactive_count": 1
}
```

### `GET /api/services` (public — bệnh nhân, không cần auth)
```json
Query: ?loai=clinic&specialty_id=1
Response: { "success": true, "data": [ServiceItem] }
// Chỉ trả status='active', không có so_luot_dat/so_bac_si nhạy cảm
```

### `POST /api/admin/services`
```json
Body: ServiceFormData (bao gồm khu_vuc[] nếu home)
Response 201: { "success": true, "data": ServiceItem }
Error 409: "Tên dịch vụ đã tồn tại với chuyên khoa này"
```

### `PUT /api/admin/services/:id`
```json
Body: Partial<ServiceFormData>
Response 200: { "success": true, "data": ServiceItem }
Error 422: "Không thể đổi loại hình khi còn N lịch hẹn đang chờ"
```

### `PATCH /api/admin/services/:id/toggle`
```json
Response: {
  "success": true,
  "data": { "id": 1, "status": "inactive", "active_appointments": 3 }
}
```

**Middleware:** `verifyToken → requireRole('admin') → controller`

---

## 10. Validation Rules

### Frontend (UX)

| Trường | Rule | Thông báo |
|---|---|---|
| `ten` | Không rỗng | "Vui lòng nhập tên dịch vụ" |
| `ten` | ≤ 255 ký tự | "Tên không vượt quá 255 ký tự" |
| `loai` | Phải chọn | "Vui lòng chọn loại hình" |
| `gia` | > 0 | "Giá phải lớn hơn 0" |
| `gia` | Số nguyên | "Giá phải là số nguyên (VNĐ)" |
| `gia` | ≤ 100,000,000 | "Giá không vượt quá 100 triệu" |
| `thoi_gian_phut` | ≥ 10 | "Thời lượng tối thiểu 10 phút" |
| `thoi_gian_phut` | ≤ 480 | "Thời lượng tối đa 8 giờ (480 phút)" |
| `gio_dat_truoc_toi_thieu` | ≥ 1 | "Tối thiểu đặt trước 1 giờ" |
| `gio_dat_truoc_toi_thieu` | ≤ 48 | "Tối đa đặt trước 48 giờ" |
| `gio_ket_thuc` | > `gio_bat_dau` | "Giờ kết thúc phải sau giờ bắt đầu" |
| `mo_ta_ngan` | ≤ 500 ký tự | "Mô tả ngắn không vượt 500 ký tự" |
| `mo_ta` | ≤ 5000 ký tự | "Mô tả không vượt 5000 ký tự" |

### Backend (Security)
- Validate lại toàn bộ
- Kiểm tra unique `(ten + specialty_id)` — 409
- Kiểm tra `specialty_id` tồn tại và `active`
- Kiểm tra lịch hẹn active trước khi sửa `loai` — 422
- Sanitize `ten`, `mo_ta_ngan`, `mo_ta`
- Auto-generate `ma_dich_vu` — không cho client truyền vào

---

## 11. Edge Cases

| EC | Tình huống | Xử lý |
|---|---|---|
| EC-01 | Tạo 2 dịch vụ cùng tên, cùng chuyên khoa | 409 — trùng unique constraint |
| EC-02 | Tạo 2 dịch vụ cùng tên, khác chuyên khoa | OK |
| EC-03 | Tắt dịch vụ đang có N lịch pending | Hiện N trong dialog, cho tắt. Lịch cũ không bị hủy |
| EC-04 | Sửa `thoi_gian_phut` → slot tương lai không đổi | Slot cũ giữ nguyên, slot mới dùng giá trị mới |
| EC-05 | Sửa giá → lịch đã đặt không đổi | `appointment.gia_kham` là snapshot, không thay đổi |
| EC-06 | Xóa khu vực home đang có lịch pending | Cảnh báo admin, cho phép xóa, bác sĩ tự xử lý khi confirm |
| EC-07 | Specialty bị ẩn sau khi gắn với service | Service vẫn hoạt động, hiển thị tên kèm *(đã ẩn)* |
| EC-08 | Home service có 0 khu vực trong `service_areas` | Vẫn hợp lệ — bác sĩ confirm địa chỉ thủ công |

---

## 12. Integration Points

| Chức năng | Tác động |
|---|---|
| **A5 — Đặt lịch** | Bệnh nhân chọn loại → lọc service theo `loai`. `appointment.gia_kham = service.gia`. Home: thêm bước nhập địa chỉ |
| **B1 — Hồ sơ bác sĩ** | Bác sĩ chọn dịch vụ mình cung cấp → ghi vào `doctor_services`. Chỉ home-doctor không cần gắn bệnh viện |
| **B2 — Lịch làm việc** | Slot của bác sĩ phải khớp `loai` của service. Home slot auto-set max=1. Cảnh báo buffer < 30 phút giữa 2 home slot |
| **B3 — Xác nhận lịch** | Clinic có thể auto-confirm. Home luôn pending chờ bác sĩ xem `dia_chi_kham` rồi confirm/từ chối |
| **C5 — Lịch hẹn admin** | Filter `loai_kham` chỉ còn clinic/home (bỏ video) |
| **C8 — Thanh toán** | `appointment.gia_kham = service.gia` lúc đặt. Hoàn tiền 100% khi bác sĩ từ chối |
| **Dashboard admin** | Hiển thị số dịch vụ active theo loại, top dịch vụ theo `so_luot_dat` |

---

## 13. Kế hoạch triển khai

### Giai đoạn 1 — Types & Mock ✅ Hoàn thành
- [x] `ServiceType = 'clinic' | 'home'`
- [x] Cập nhật `ServiceItem` (thêm `ma_dich_vu`, `mo_ta_ngan`, `ngay_ap_dung`, `gio_bat_dau`, `gio_ket_thuc`, `khu_vuc`, `so_bac_si`, `so_luot_dat`)
- [x] Thêm `ServiceFormData` mới
- [x] Thêm `ServiceChangeLog` interface (V5)
- [x] Thêm `lich_su_thay_doi: ServiceChangeLog[]` vào `ServiceItem` (V5)
- [x] Cập nhật `Appointment` (nullable `hospital_id`, thêm `dia_chi_kham`, bỏ `'video'`)
- [x] Mock data 4 dịch vụ với lịch sử thay đổi mẫu (V5)

### Giai đoạn 2 — UI Hoàn thiện ✅ Hoàn thành
- [x] Stats bar (Total / Active / Inactive / Clinic / Home)
- [x] Tab filter + search
- [x] Bảng 12 cột (thêm Mã DV, Chuyên khoa, Địa điểm, Lịch áp dụng, Bác sĩ, Lượt đặt)
- [x] Modal Thêm/Sửa với validation đầy đủ
- [x] Form: `ma_dich_vu` readonly auto-gen, `mo_ta_ngan`, `ngay_ap_dung`, giờ
- [x] Form home: multi-checkbox khu vực (13 quận/huyện Hà Nội)
- [x] Toggle ẩn/hiện + ConfirmDialog
- [x] Nút thao tác không bị mờ khi dịch vụ inactive
- [x] Nút **Xem chi tiết** — mở modal xem toàn bộ thông tin (V5)
- [x] Modal Xem: 2 phần — Thông tin dịch vụ + Lịch sử thay đổi (V5)
- [x] Trường **Mô tả cập nhật** trong form Sửa → ghi vào audit log (V5)
- [x] Service tự động ghi log khi create / update / toggle (V5)

### Giai đoạn 3 — Backend & Database ✅ Hoàn thành (V6)
- [x] **MongoDB** (thay SQL): Mongoose Schema `DichVu` với `ma_dich_vu` auto-gen, index `{ten, specialty_id}` unique
- [x] **Bảng `NhatKyThaoTac`** (audit log toàn hệ thống) — dùng chung, không tạo bảng riêng cho service
- [x] **`khu_vuc[]`** lưu thẳng vào mảng trong document `DichVu` (MongoDB linh hoạt hơn SQL)
- [x] **API CRUD**: `GET /` · `GET /:id` · `POST /` · `PUT /:id` · `PATCH /:id/toggle`
- [x] **Logic auto-gen** `ma_dich_vu`: hook `pre('validate')` tìm số lớn nhất + 1, pad 3 chữ số
- [x] **`appointment.gia_kham`**: snapshot khi tạo appointment — xử lý tầng ứng dụng
- [x] **Audit log** `nguoi_thay_doi` lấy từ `req.user` (JWT token thật)
- [x] **`specialty.service.ts`** + `GET /api/admin/specialties` — dropdown chuyên khoa từ DB thật
- [ ] `doctor_services` — chờ B1 bác sĩ đăng ký dịch vụ
- [ ] `so_bac_si` computed từ `doctor_services` — chờ B1
- [ ] `so_luot_dat` computed từ `appointments` — chờ A5

---

## 14. Tính năng Xem chi tiết & Lịch sử thay đổi (V5)

### 14.1 Mục đích

Audit log giúp admin truy vết khi xảy ra sự cố:
- **Ai** đã thay đổi dịch vụ?
- **Khi nào** thay đổi?
- **Thay đổi gì** (qua mô tả admin nhập)?

Không cần vào database để điều tra — chỉ cần mở modal "Xem chi tiết".

### 14.2 Các loại hành động được ghi log

| `hanh_dong` | Khi nào | Badge màu |
|---|---|---|
| `tao_moi` | Admin tạo dịch vụ mới | Xanh lá |
| `cap_nhat` | Admin sửa bất kỳ trường nào | Xanh dương |
| `an` | Admin ẩn dịch vụ (`active → inactive`) | Đỏ |
| `hien` | Admin hiện lại dịch vụ (`inactive → active`) | Xanh lá |

### 14.3 Cấu trúc Service Layer

```ts
// service.service.ts
let nextLogId = 11  // mock data đã dùng id 1–10

function makeLog(hanh_dong, mo_ta): ServiceChangeLog {
  return { id: nextLogId++, thoi_gian: new Date().toISOString(), hanh_dong, nguoi_thay_doi: 'Admin', mo_ta }
}

// Mỗi hàm tự động append log:
create()  → makeLog('tao_moi',  'Tạo dịch vụ mới')
update()  → makeLog('cap_nhat', mo_ta_thay_doi || 'Cập nhật thông tin dịch vụ')
toggle()  → makeLog('an' | 'hien', mô tả tự động)
```

### 14.4 UI Modal "Xem chi tiết"

```
┌─────────────────────────────────────────────┐
│ Chi tiết dịch vụ  [DV001]           [Close] │
├─────────────────────────────────────────────┤
│ THÔNG TIN DỊCH VỤ                          │
│                                             │
│ Khám tổng quát tại viện  [Tại viện] [●]   │
│                                             │
│ Giá            Thời lượng  Đặt trước        │
│ 200.000 ₫      30 phút     2 giờ           │
│                                             │
│ Chuyên khoa    Số bác sĩ   Lượt đặt        │
│ —              3           128              │
│                                             │
│ Lịch áp dụng: T2–T7, 07:00–17:00          │
│ Mô tả: Khám sức khỏe tổng quát...          │
│                                             │
│ Ngày tạo: 10/01/2026  Cập nhật: 15/03/2026 │
├─────────────────────────────────────────────┤
│ LỊCH SỬ THAY ĐỔI                          │
│                                             │
│ [Cập nhật] Trần Thị Admin  15/03/2026 14:00│
│  Điều chỉnh thời gian áp dụng              │
│                                             │
│ [Cập nhật] Nguyễn Văn Admin 05/02/2026     │
│  Cập nhật giá và mô tả dịch vụ            │
│                                             │
│ [Tạo mới]  Nguyễn Văn Admin 10/01/2026     │
│  Tạo dịch vụ                               │
├─────────────────────────────────────────────┤
│             [Đóng]  [✏ Sửa dịch vụ này]   │
└─────────────────────────────────────────────┘
```

> Lịch sử được sắp xếp **mới nhất lên trên**. Nút "Sửa dịch vụ này" ở footer đóng modal xem và mở ngay modal sửa.

---

## 15. Tổng kết Quyết định

| # | Quyết định | Lý do |
|---|---|---|
| 1 | Chỉ 2 loại: clinic và home | Video bỏ, 2 loại còn lại đủ phức tạp |
| 2 | `service.gia` = giá thực tế bệnh nhân trả | Thanh toán 100% upfront, admin kiểm soát giá |
| 3 | `appointment.gia_kham` = snapshot `service.gia` | Giá cũ bảo toàn sau khi admin sửa giá mới |
| 4 | Thêm `ma_dich_vu` auto-gen | Tra cứu, in phiếu, log |
| 5 | Thêm lịch áp dụng tổng quát (ngày/giờ) vào service | Hiển thị cho bệnh nhân, không thay thế B2 |
| 6 | `service_areas` cho home — bảng riêng | Multi-value không lưu vào cột đơn |
| 7 | `doctor_services` — bảng join | Bác sĩ nhiều dịch vụ, dịch vụ nhiều bác sĩ |
| 8 | `appointments.hospital_id` nullable | Home không có bệnh viện |
| 9 | Thêm `appointments.dia_chi_kham` | Home cần địa chỉ bệnh nhân |
| 10 | Home slot max 1 + bác sĩ confirm thủ công | Bác sĩ verify địa chỉ trước khi chốt |
| 11 | Unique `(ten + specialty_id)` | Cho phép cùng tên khác chuyên khoa |
| 12 | Không xóa vật lý — dùng `inactive` | Bảo toàn lịch sử lịch hẹn |
| 13 | Phí đi lại gộp vào `gia` — ghi trong `mo_ta` | Đơn giản hóa, tránh field thừa |
| 14 | Nút thao tác không mờ khi dịch vụ inactive | UX — vẫn phải thao tác được |
| 15 | Thêm `ServiceChangeLog` + modal Xem chi tiết (V5) | Admin truy vết ai sửa gì khi có sự cố |
| 16 | Trường "Mô tả cập nhật" trong form sửa (V5) | Log có nội dung rõ ràng, không chỉ "Cập nhật dịch vụ" |
| 17 | Log tự động ghi khi create / update / toggle (V5) | Không bỏ sót sự kiện, không cần nhớ ghi thủ công |

---

## 16. Thực tế đã triển khai — Frontend với Mock Data

> **Ngày hoàn thành:** 20/06/2026
> Ghi lại chính xác những gì đã build để phục vụ viết báo cáo và bàn giao backend.

---

### 16.1 Danh sách file đã tạo / sửa

| File | Hành động | Mô tả |
|---|---|---|
| `frontend/src/types/index.ts` | **Sửa** | Thêm `ServiceChangeLog`, `ServiceFormData`, cập nhật `ServiceItem` đầy đủ 16 trường, bỏ `'video'` và `'hidden'` |
| `frontend/src/utils/constants.ts` | **Sửa** | Bỏ `video` khỏi `SERVICE_TYPE_LABEL`, chỉ còn `clinic` và `home` |
| `frontend/src/mock/services.ts` | **Viết lại** | 4 dịch vụ đúng chuẩn (2 clinic + 2 home), audit log mẫu id 1–10 |
| `frontend/src/services/service.service.ts` | **Viết lại** | 5 hàm: `getAll`, `getById`, `create`, `update`, `toggle` — mỗi hàm có comment endpoint BE |
| `frontend/src/components/admin/services/ServiceFormModal.tsx` | **Tạo mới** | Modal Thêm/Sửa với validation 13 rule, radio card loại, checkbox 13 quận/huyện |
| `frontend/src/components/admin/services/ServiceViewModal.tsx` | **Tạo mới** | Modal xem chi tiết + audit log timeline với badge màu |
| `frontend/src/pages/admin/ManageServices.tsx` | **Viết lại** | Trang chính: stats bar, debounce search, bảng 10 cột, 3 modal, ConfirmDialog |

---

### 16.2 Kiến trúc component

```
ManageServices.tsx          ← Trang chính, quản lý toàn bộ state
├── Stats bar               ← 5 thẻ: Tổng / Hoạt động / Đã ẩn / Phòng khám / Tại nhà
├── Filter + Search + Add   ← Tab (Tất cả / Phòng khám / Tại nhà) + debounce 300ms + nút thêm
├── Table (10 cột)          ← Mã DV / Tên / Loại / Chuyên khoa / Giá / Thời lượng /
│                               Lịch áp dụng / Bác sĩ / Trạng thái / Hành động
│   └── Row logic           ← data-cells mờ 40% khi inactive, cột action giữ nguyên
├── ServiceFormModal.tsx    ← Modal Thêm mới & Sửa (1 component dùng chung)
│   ├── Mã DV               ← "Tự động" khi Thêm, mã thật khi Sửa (readonly)
│   ├── Radio card loại     ← Phòng khám / Tại nhà — auto-set đặt trước (2h/4h)
│   ├── Checkbox khu vực    ← Chỉ hiện khi loại = "Tại nhà" (13 quận/huyện Hà Nội)
│   ├── Mô tả cập nhật      ← Chỉ hiện khi Sửa — ghi vào audit log
│   └── Validation 13 rule  ← Hiển thị lỗi inline, xóa lỗi ngay khi user sửa
├── ServiceViewModal.tsx    ← Modal xem chi tiết
│   ├── Section 1           ← Grid thông số + lịch áp dụng + khu vực + mô tả
│   └── Section 2           ← Audit log timeline (mới nhất lên trên, badge màu)
│       └── Footer          ← Nút "Sửa dịch vụ này" → chuyển sang ServiceFormModal
└── ConfirmDialog           ← Xác nhận ẩn/hiện, message giải thích rõ lịch cũ không bị hủy
```

---

### 16.3 Service Layer — API Contract

File `frontend/src/services/service.service.ts` là **điểm duy nhất** chạm vào dữ liệu. UI không import mock trực tiếp.

```typescript
// Signature 5 hàm — KHÔNG thay đổi khi swap sang backend
export const serviceService = {
  getAll(loai?: ServiceType | '', search?: string): Promise<ServiceItem[]>
  // Khi gắn BE: GET /api/admin/services?loai=clinic&search=khám

  getById(id: number): Promise<ServiceItem>
  // Khi gắn BE: GET /api/admin/services/:id

  create(data: ServiceFormData): Promise<ServiceItem>
  // Khi gắn BE: POST /api/admin/services — body: ServiceFormData (không có ma_dich_vu)

  update(id: number, data: ServiceFormData, mo_ta_thay_doi?: string): Promise<ServiceItem>
  // Khi gắn BE: PUT /api/admin/services/:id — body: { ...ServiceFormData, mo_ta_thay_doi? }

  toggle(id: number): Promise<ServiceItem>
  // Khi gắn BE: PATCH /api/admin/services/:id/toggle
}
```

**Cách swap sang backend:** Giữ nguyên signature, chỉ đổi phần thân hàm:
```typescript
// Thay dòng mock:
await delay(400)
_store = [...]

// Bằng axios call:
const { data } = await axiosInstance.post('/api/admin/services', data)
return data.data
```

---

### 16.4 Dữ liệu Mock — Cấu trúc thực tế

**File:** `frontend/src/mock/services.ts`

| ID | Mã | Tên | Loại | Giá | Trạng thái |
|---|---|---|---|---|---|
| 1 | DV001 | Khám tổng quát tại viện | clinic | 200.000₫ | active |
| 2 | DV002 | Khám chuyên khoa tại viện | clinic | 350.000₫ | active |
| 3 | DV003 | Khám sức khỏe tại nhà | home | 500.000₫ | active |
| 4 | DV004 | Khám chuyên khoa tại nhà | home | 700.000₫ | inactive |

Mỗi dịch vụ có `lich_su_thay_doi` với 2–3 entry mẫu. Tổng 10 log entries dùng id 1–10.
`service.service.ts` bắt đầu `nextLogId = 11` để tránh trùng khi tạo mới trong session.

---

### 16.5 Validation đã triển khai (Frontend)

| Trường | Rule | Thông báo lỗi hiển thị |
|---|---|---|
| `ten` | Không rỗng | "Vui lòng nhập tên dịch vụ" |
| `ten` | ≤ 255 ký tự | "Tên không vượt quá 255 ký tự" |
| `gia` | > 0 | "Giá phải lớn hơn 0" |
| `gia` | Số nguyên | "Giá phải là số nguyên (VNĐ)" |
| `gia` | ≤ 100.000.000 | "Giá không vượt quá 100 triệu" |
| `thoi_gian_phut` | ≥ 10 | "Thời lượng tối thiểu 10 phút" |
| `thoi_gian_phut` | ≤ 480 | "Thời lượng tối đa 8 giờ (480 phút)" |
| `gio_dat_truoc_toi_thieu` | ≥ 1 | "Tối thiểu đặt trước 1 giờ" |
| `gio_dat_truoc_toi_thieu` | ≤ 48 | "Tối đa đặt trước 48 giờ" |
| `gio_ket_thuc` | > `gio_bat_dau` | "Giờ kết thúc phải sau giờ bắt đầu" |
| `mo_ta_ngan` | ≤ 500 ký tự | "Mô tả ngắn không vượt 500 ký tự" |
| `mo_ta` | ≤ 5000 ký tự | "Mô tả không vượt 5000 ký tự" |

Lỗi hiển thị **inline dưới trường** và **tự xóa ngay khi user bắt đầu sửa** trường đó.

---

### 16.6 UX chi tiết đã triển khai

| Tính năng UX | Mô tả |
|---|---|
| Debounce search 300ms | Không gọi API liên tục khi gõ — chờ 300ms sau gõ cuối mới filter |
| Auto-set đặt trước | Chọn "Phòng khám" → tự điền 2 giờ; "Tại nhà" → tự điền 4 giờ |
| Row inactive mờ | Data cells `opacity-40`, cột Hành động giữ nguyên để vẫn thao tác được |
| Xóa lỗi khi sửa | Error message biến mất ngay khi user chỉnh trường lỗi — không cần submit lại |
| Chuyển tiếp modal | Nút "Sửa dịch vụ này" trong modal Xem → đóng modal Xem, mở modal Sửa |
| Stats cập nhật tức thì | Sau mỗi create/toggle → stats bar tự refresh không cần reload trang |
| Audit log sort | Lịch sử thay đổi trong modal Xem luôn sắp xếp mới nhất lên trên |
| Badge màu log | `tao_moi` = xanh lá, `cap_nhat` = xanh dương, `an` = đỏ, `hien` = xanh lá |
| Mã DV auto-gen | Khi Thêm hiển thị "Tự động"; khi Sửa hiển thị mã thật (readonly cả 2 trường hợp) |
| ConfirmDialog ẩn | Giải thích rõ: "Các lịch hẹn đang chờ không bị hủy" — tránh admin hiểu nhầm |

---

### 16.7 Những gì CHƯA làm (chờ Backend)

| Hạng mục | Ghi chú |
|---|---|
| Kiểm tra unique `(ten + specialty_id)` | Hiện mock không check — BE trả 409, FE cần xử lý toast lỗi |
| `nguoi_thay_doi` lấy từ JWT thật | Hiện hardcode `'Admin'` — BE ghi tên admin đang đăng nhập |
| `so_bac_si` computed từ `doctor_services` | Hiện là số trong mock — BE join bảng tính |
| `so_luot_dat` computed từ `appointments` | Hiện là số trong mock — BE aggregate từ appointments |
| `specialty_ten` join từ `specialties` | Hiện mock hardcode `null` — BE join trả về tên |
| Specialties list trong form | Hiện là danh sách hardcode 8 chuyên khoa — BE fetch từ `/api/specialties` |
| Số lịch hẹn pending khi ẩn dịch vụ | ConfirmDialog chưa hiện con số thật — BE PATCH trả `active_appointments` |
| Ghi audit log riêng bảng DB | Hiện log lưu trong `services.lich_su_thay_doi` array — cần quyết định dùng array hay bảng riêng |

---

### 16.8 Hướng dẫn gắn Backend

**Bước 1:** Cài `axios` và tạo `axiosInstance` (đã có sẵn tại `frontend/src/services/axiosInstance.ts`).

**Bước 2:** Sửa `frontend/src/services/service.service.ts` — chỉ đổi phần thân 5 hàm:

```typescript
// getAll
const { data } = await axiosInstance.get('/api/admin/services', { params: { loai, search } })
return data.data

// getById
const { data } = await axiosInstance.get(`/api/admin/services/${id}`)
return data.data

// create
const { data } = await axiosInstance.post('/api/admin/services', formData)
return data.data

// update
const { data } = await axiosInstance.put(`/api/admin/services/${id}`, { ...formData, mo_ta_thay_doi })
return data.data

// toggle
const { data } = await axiosInstance.patch(`/api/admin/services/${id}/toggle`)
return data.data
```

**Bước 3:** Xóa `frontend/src/mock/services.ts` và block `// In-memory store` trong `service.service.ts`.

**Bước 4:** Cập nhật `SPECIALTIES` trong `ServiceFormModal.tsx` thành fetch từ API:
```typescript
// Thay hardcode bằng:
const [specialties, setSpecialties] = useState([])
useEffect(() => {
  axiosInstance.get('/api/specialties?status=active').then(r => setSpecialties(r.data.data))
}, [])
```

**UI không cần sửa gì thêm.**

---

## 17. Kết nối Backend — Phiên bản 6 (20/06/2026)

> Ghi lại chính xác những gì đã thực hiện khi chuyển từ mock data sang MongoDB thật.

---

### 17.1 Danh sách file đã tạo / sửa (V6)

| File | Hành động | Mô tả |
|---|---|---|
| `backend/src/controllers/auth.controller.js` | **Viết lại** | Real login: `findOne().select('+mat_khau')` → `bcrypt.compare` → `jwt.sign` 7 ngày |
| `backend/src/controllers/admin/services.controller.js` | **Tạo mới** | 5 hàm: `list`, `getById`, `create`, `update`, `toggle` + helper `formatService`, `getAuditLogs` |
| `backend/src/controllers/admin/specialties.controller.js` | **Tạo mới** | `list` — trả `[{ id, ten }]` từ collection `ChuyenKhoa` |
| `backend/src/routes/admin/services.routes.js` | **Tạo mới** | 5 route, middleware `verifyToken → requireRole('admin')` |
| `backend/src/routes/admin/specialties.routes.js` | **Tạo mới** | 1 route GET `/`, cùng middleware |
| `backend/src/routes/admin/index.js` | **Sửa** | Mount `servicesRoutes` tại `/services`, `specialtiesRoutes` tại `/specialties` |
| `frontend/src/services/auth.service.ts` | **Viết lại** | Bỏ DEMO_ACCOUNTS, gọi thật `axiosInstance.post('/auth/login', ...)` |
| `frontend/src/services/service.service.ts` | **Viết lại** | 5 hàm dùng `axiosInstance`, trả `res.data.data` |
| `frontend/src/services/specialty.service.ts` | **Tạo mới** | `getAll()` — GET `/admin/specialties`, trả `SpecialtyOption[]` |
| `frontend/src/services/axiosInstance.ts` | **Sửa** | Bật lại `window.location.href = '/login'` khi nhận 401 |
| `frontend/src/types/index.ts` | **Sửa** | `id: string`, `specialty_id: string \| null` (tất cả ObjectId dùng string) |
| `frontend/src/components/admin/services/ServiceFormModal.tsx` | **Sửa** | Bỏ mock SPECIALTIES array, dùng `specialtyService.getAll()` |
| `frontend/src/pages/admin/ManageServices.tsx` | **Sửa** | Toast state, `viewLoading`, `handleView` async, fix filter logic |

---

### 17.2 Kiến trúc data flow (sau V6)

```
[Login] ─→ auth.service.ts ─→ POST /auth/login
             ─→ JWT token → localStorage
                  ↓
[ManageServices]
   ↓
serviceService.getAll(loai, search)
   ↓ axiosInstance (tự đính Bearer token từ localStorage)
   ↓ GET /api/admin/services?loai=clinic&search=khám
   ↓ verifyToken (giải mã JWT, gắn req.user)
   ↓ requireRole('admin')
   ↓ services.controller.list()
      └─ DichVu.find(filter).populate('specialty_id', 'ten').lean()
      └─ map: { ...s, id: s._id, specialty_ten, specialty_id: _id }
   ↓ { success: true, data: ServiceItem[] }
   ↓ res.data.data → setServices([...])
```

---

### 17.3 Pipeline Audit Log

```
Admin sửa dịch vụ → POST /api/admin/services/:id
   ↓ controller update()
   ↓ service.save()   ← nếu fail ở đây → 500, audit log không chạy
   ↓ NhatKyThaoTac.create({  ← isolated try-catch, fail không ảnh hưởng response
       nguoi_thuc_hien_id: req.user.id,
       vai_tro: 'admin',
       hanh_dong: 'UPDATE_SERVICE',
       loai_doi_tuong: 'service',
       doi_tuong_id: service._id,
       ly_do: req.body.mo_ta_thay_doi || 'Cập nhật dịch vụ "..."'
     })
   ↓ formatService(service)  ← re-fetch + populate specialty
   ↓ 200 OK { success: true, data: ServiceItem }
```

**Mapping hanh_dong:**

| NhatKyThaoTac (lưu DB) | ServiceChangeLog (FE hiển thị) | Badge |
|---|---|---|
| `CREATE_SERVICE` | `tao_moi` | Xanh lá |
| `UPDATE_SERVICE` | `cap_nhat` | Xanh dương |
| `HIDE_SERVICE` | `an` | Đỏ |
| `SHOW_SERVICE` | `hien` | Xanh lá |

---

### 17.4 Lý do đổi `id` từ `number` → `string`

MongoDB không dùng auto-increment integer. `_id` là BSON ObjectId — 12 bytes, biểu diễn dưới dạng 24-ký-tự hex string (VD: `"6856b2f9c3d1a4e0b8f12345"`).

**Hệ quả kỹ thuật:**
- Tất cả `id` trong TypeScript types phải là `string`
- So sánh dùng `===` (string equality) — không dùng `==` hay cast số
- `axiosInstance` URL: `\`/admin/services/${id}\`` — id là string, không phải number
- Mongoose: dùng `mongoose.Types.ObjectId.isValid(id)` để kiểm tra trước khi query

**Files đã sửa:** `types/index.ts` — `User.id`, `ServiceItem.id`, `ServiceChangeLog.id`, `ServiceItem.specialty_id`, `ServiceFormData.specialty_id` đều đổi sang `string`.

---

### 17.5 Vấn đề `specialty_id` CastError — Nguyên nhân & Fix

**Nguyên nhân gốc:** Form mock dùng `SPECIALTIES = [{ id: 1 }, { id: 2 }]` (integer). Khi người dùng chọn, form gửi `specialty_id: "1"` lên backend. Mongoose cố cast `"1"` sang ObjectId → **CastError** → `service.save()` throw → toàn bộ create/update fail, audit log không được tạo.

**Fix:**
```js
// Backend: helper validate trước khi lưu
const isValidId = (id) => id && mongoose.Types.ObjectId.isValid(id)

// Dùng trong create:
specialty_id: isValidId(specialty_id) ? specialty_id : null

// Dùng trong update:
if (req.body.specialty_id !== undefined) {
  service.specialty_id = isValidId(req.body.specialty_id) ? req.body.specialty_id : null
}
```

```ts
// Frontend: fetch real ObjectId từ API thay vì hardcode integer
useEffect(() => {
  specialtyService.getAll().then(setSpecialties).catch(() => {})
}, [])
// Form onChange: e.target.value || null  (string, KHÔNG Number(e.target.value))
```

---

### 17.6 Sáu bug tìm và sửa (V6 — sau khi kiểm tra kỹ)

| # | Mức độ | File | Vấn đề | Fix |
|---|---|---|---|---|
| 1 | Critical | `ManageServices.tsx` | `handleToggleConfirm` không có try-catch → lỗi API bị nuốt im lặng, user không biết | Wrap trong `try { } catch { showToast(error, 'error') }` |
| 2 | Critical | `ManageServices.tsx` | Create thêm dịch vụ vào list bất kể tab đang lọc → tạo "Tại nhà" khi đang xem tab "Phòng khám" thì item xuất hiện sai tab | Kiểm tra `activeType && created.loai !== activeType` trước khi `setServices` |
| 3 | Critical | `ManageServices.tsx` | Update không xóa khỏi list khi `loai` thay đổi → sửa từ "Phòng khám" sang "Tại nhà" vẫn thấy trong tab "Phòng khám" | `prev.filter(s => s.id !== updated.id)` nếu loai không khớp `activeType` |
| 4 | Medium | `ManageServices.tsx` | `handleView` bắt lỗi `getById` nhưng không thông báo → spinner tắt, hiện "Chưa có lịch sử" thay vì báo lỗi | Thêm `catch { showToast('Không thể tải lịch sử', 'error') }` |
| 5 | Medium | `services.controller.js` | `formatService()` không null-check `s` sau `findById` → crash `s._id` nếu doc bị xóa đồng thời | Thêm `if (!s) throw new Error('Không tìm thấy dịch vụ sau khi lưu')` |
| 6 | Medium | `services.controller.js` | `create` và `update` lưu empty string `""` vào MongoDB cho `ngay_ap_dung`, `gio_bat_dau`, `gio_ket_thuc`, `mo_ta_ngan`, `mo_ta` | Chuẩn hóa: `value?.trim() \|\| null` trong cả 2 hàm |

---

### 17.7 Những gì vẫn CHƯA làm (còn lại sau V6)

| Hạng mục | Ghi chú |
|---|---|
| `so_bac_si` computed từ `doctor_services` | Chờ B1 — bác sĩ tự đăng ký dịch vụ |
| `so_luot_dat` computed từ `appointments` | Chờ A5 — flow đặt lịch |
| Kiểm tra active appointments trước khi ẩn | ConfirmDialog chưa hiện con số thật — chờ `appointments` collection có data |
| Số lượt đặt trong modal Xem hiện là 0 | `so_luot_dat` chưa có dữ liệu thật |
| Public endpoint `GET /api/services` | Cho bệnh nhân xem danh sách — chưa cần trong giai đoạn Admin |
