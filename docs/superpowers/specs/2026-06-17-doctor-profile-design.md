# Spec: Hồ sơ Bác sĩ — B1

> **Ngày:** 2026-06-17
> **Actor:** Bác sĩ đã đăng nhập (role ban đầu = `user`, sau khi duyệt = `doctor`)
> **Route:** `/doctor/profile`
> **Chức năng:** B1 — Quản lý hồ sơ hành nghề bác sĩ
> **Nguồn tham khảo:** `docs/features.md`, `docs/database.md`, `frontend/src/pages/doctor/DoctorProfile.tsx`, HL7 FHIR Practitioner Resource, healthcare onboarding UX research

---

## 1. Mục tiêu tính năng

Trang `/doctor/profile` là **trung tâm quản lý danh tính nghề nghiệp** của bác sĩ. Nó phục vụ 2 mục đích song song:

1. **Bác sĩ tự quản lý:** Cập nhật thông tin chuyên môn, kiểm soát khả năng hiển thị trên nền tảng
2. **Admin xét duyệt:** Hồ sơ nộp qua đây → Admin duyệt/từ chối → bác sĩ chính thức hoạt động

**Quy tắc vàng:** Thông tin trên trang này **không ảnh hưởng ngược** đến lịch hẹn đã có.
- Đổi `phi_tu_van` → chỉ áp dụng cho lịch đặt *sau* khi thay đổi (snapshot lúc đặt)
- Ẩn `la_hien` → bệnh nhân không tìm thấy nhưng lịch cũ vẫn giữ nguyên

---

## 2. State Machine — Trạng thái Duyệt Hồ sơ

### 2.1 Sơ đồ trạng thái

```
[Bác sĩ đăng ký lần đầu]
           │
           ▼
        PENDING ──────── Admin từ chối (kèm lý do) ────────────────┐
           │               → Bác sĩ nhận email với lý do            │
           │               → so_lan_nop tăng 1                       │
      Admin duyệt                                                    ▼
           │               Bác sĩ nộp lại ──────────────────► REJECTED
           ▼               (so_lan_nop < 5) ──────────────────────┐
        APPROVED                                                    │
           │               Nộp lại lần 5 → thông báo "lần cuối"   │
           │                                                        │
           ├──── Admin tạm ngưng ──────────────────────────► SUSPENDED
           │         ↓ (thông báo bác sĩ)                          │
           │     Admin mở khóa ────────────────────────────────────┘
           │                                                       (→ APPROVED)
           └──── [Hoạt động bình thường]
```

### 2.2 Bảng chuyển trạng thái

| Từ | Sang | Actor | Điều kiện | Hệ quả kèm theo |
|---|---|---|---|---|
| *(mới)* | `pending` | Bác sĩ | Đăng ký + nộp hồ sơ lần đầu | `users.role = 'user'` vẫn giữ; email xác nhận gửi Admin |
| `pending` | `approved` | Admin | — | `users.role → 'doctor'` (cùng transaction); bác sĩ nhận email chào mừng |
| `pending` | `rejected` | Admin | Nhập lý do từ chối | `so_lan_nop` không tăng (lần đầu); email kèm lý do |
| `rejected` | `pending` | Bác sĩ | `so_lan_nop < 5`; bác sĩ có thể cập nhật trước khi nộp | `so_lan_nop += 1`; Admin nhận thông báo mới |
| `approved` | `suspended` | Admin | — | Bác sĩ nhận email; `la_hien → false` tự động |
| `suspended` | `approved` | Admin | — | `la_hien` giữ nguyên (không tự bật lại — bác sĩ chọn) |

> ⚠️ `approved` và `suspended` có thể qua lại nhiều lần. Không có giới hạn số lần suspend.
>
> ⚠️ Sau khi `rejected → pending` lần thứ 5: nút "Nộp lại" bị ẩn vĩnh viễn — bác sĩ phải liên hệ Admin trực tiếp.

### 2.3 Quyền theo trạng thái

| Trạng thái | Chỉnh sửa hồ sơ | Nộp lại | Tạo slot | Xem lịch hẹn | Nhận đặt lịch mới |
|---|---|---|---|---|---|
| `pending` | ✅ (nhưng không áp dụng cho duyệt hiện tại) | ❌ | ❌ | ❌ | ❌ |
| `approved` | ✅ | ❌ | ✅ | ✅ | ✅ (nếu `la_hien=true`) |
| `rejected` | ✅ | ✅ (nếu `so_lan_nop < 5`) | ❌ | ❌ | ❌ |
| `suspended` | ❌ readonly | ❌ | ❌ | ✅ (lịch cũ) | ❌ |

> **Lưu ý implement:** Chỉnh sửa khi `pending` là cho phép UX (sửa cho lần nộp sau), nhưng không thay đổi hồ sơ đang xét duyệt. Admin thấy snapshot lúc nộp.

---

## 3. Nhóm thông tin Hồ sơ

Hồ sơ bác sĩ gồm **5 nhóm thông tin** với quy tắc chỉnh sửa khác nhau:

### 3.1 Thông tin Tài khoản (readonly — từ bảng `users`)

| Field | Kiểu | Có thể sửa | Ghi chú |
|---|---|---|---|
| `email` | `string` | ❌ Không bao giờ | Định danh duy nhất hệ thống — đổi email = đổi tài khoản |
| `ho_ten` | `string` | ✅ Qua form | Tên hiển thị cho bệnh nhân |
| `so_dien_thoai` | `string \| null` | ✅ Qua form | Bệnh nhân liên hệ khi cần |
| `anh_dai_dien` | `string \| null` | ✅ Upload ảnh | URL, lưu trên cloud storage; hiển thị ngoài trang tìm kiếm |
| `role` | `'user' \| 'doctor'` | ❌ System only | Chỉ đổi khi Admin duyệt (cùng transaction với `trang_thai_duyet`) |

> `so_dien_thoai` và `anh_dai_dien` nằm trong bảng `users`, không phải `doctors`. API update profile phải PATCH cả 2 bảng.

### 3.2 Thông tin Chuyên môn (từ bảng `doctors`)

| Field | Kiểu | Validation | Ghi chú |
|---|---|---|---|
| `chuyen_khoa` | `ObjectId → string` | Required, từ `specialties` collection | Dropdown chọn từ danh sách — không free text |
| `so_nam_kinh_nghiem` | `number` | min: 0, max: 60 | Hiển thị "X năm kinh nghiệm" ngoài profile |
| `bang_cap` | `string` | Required, ≤200 ký tự | "Thạc sĩ Y khoa — ĐH Y Hà Nội" |
| `kinh_nghiem` | `string \| null` | ≤1000 ký tự | Mô tả ngắn các vị trí đã công tác |
| `tieu_su` | `string \| null` | ≤3000 ký tự | Giới thiệu bản thân hiển thị cho bệnh nhân |
| `phi_tu_van` | `number` | min: 0, step: 10000 | VND; snapshot khi đặt lịch — đổi không ảnh hưởng lịch cũ |

### 3.3 Liên kết Bệnh viện (embed trong `doctors.hospitals[]`)

| Trường | Ghi chú |
|---|---|
| `hospitals[]` | Mảng ObjectId ref đến `hospitals` collection |
| Tối thiểu | 0 (bác sĩ tự do không gắn bệnh viện) |
| Tối đa | Không giới hạn cứng (khuyến nghị ≤ 3) |
| Hiển thị | Tên bệnh viện + địa chỉ — bệnh nhân thấy khi đặt `loai_kham='clinic'` |

Bác sĩ chỉ chọn từ danh sách bệnh viện `status='active'` do Admin quản lý (C3). Không tự thêm bệnh viện mới.

### 3.4 Dịch vụ đã đăng ký (embed trong `doctors.services[]`)

| Trường | Ghi chú |
|---|---|
| `services[]` | Mảng ObjectId ref đến `services` collection |
| Tối thiểu | 0 |
| Ý nghĩa | Bác sĩ đang cung cấp dịch vụ nào (`clinic` và/hoặc `home`) |
| Hiển thị | Bệnh nhân tìm bác sĩ theo dịch vụ — có dịch vụ mới xuất hiện |

### 3.5 Cài đặt Hiển thị

| Field | Kiểu | Mặc định | Ghi chú |
|---|---|---|---|
| `la_hien` | `boolean` | `true` | Toggle ẩn/hiện profile khỏi trang tìm kiếm bệnh nhân |
| Khi `la_hien=false` | — | — | Bệnh nhân không tìm thấy — lịch hẹn đang active vẫn hoạt động |
| Tự động ẩn | — | — | Khi bị `suspended` → `la_hien=false` tự động (không khôi phục khi unsuspend) |

---

## 4. Business Rules chi tiết

### 4.1 Quy trình nộp và duyệt hồ sơ

```
[Bác sĩ chỉnh sửa thông tin]
        │
        ▼
[Bấm "Nộp hồ sơ xét duyệt"]
        │
        ├─ Check: so_lan_nop >= 5 → Block, hiện thông báo "Đã vượt quá số lần nộp"
        │
        ├─ Check: hồ sơ đang ở `pending` → Block, hiện "Đang chờ xét duyệt"
        │
        ├─ Validate: chuyen_khoa, bang_cap (required) → hiện lỗi nếu trống
        │
        └─ OK: POST /api/doctor/profile/submit
               → trang_thai_duyet = 'pending', so_lan_nop += 1
               → Admin nhận notification
               → Bác sĩ nhận email xác nhận "Hồ sơ đã được gửi"
```

**Ngưỡng cảnh báo `so_lan_nop`:**
- `so_lan_nop = 4`: Banner vàng "Đây là lần nộp cuối cùng. Vui lòng kiểm tra kỹ trước khi nộp"
- `so_lan_nop = 5`: Nút "Nộp lại" ẩn vĩnh viễn; banner đỏ "Đã vượt giới hạn — liên hệ Admin"

### 4.2 Snapshot phi_tu_van khi đặt lịch

```
Bệnh nhân đặt lịch (ngày N): gia_kham = phi_tu_van = 350,000₫
Bác sĩ tăng phi_tu_van lên 400,000₫ (ngày N+1)

→ Lịch hẹn ngày N vẫn giữ gia_kham = 350,000₫
→ Lịch hẹn mới sau N+1 sẽ có gia_kham = 400,000₫
```

**Lý do:** `appointments.gia_kham` là snapshot lúc tạo — không bao giờ update sau khi đặt.

### 4.3 Quy tắc la_hien (ẩn/hiện profile)

| Hành động | `la_hien` sau | Lịch hẹn hiện có | Slot hiện có |
|---|---|---|---|
| Bác sĩ tự ẩn | `false` | Giữ nguyên — vẫn nhận lịch từ slot đã tồn tại | Slot `active` vẫn có thể đặt qua direct link |
| Bác sĩ tự hiện | `true` | Giữ nguyên | Slot vẫn giữ |
| Admin suspend | `la_hien = false` tự động | Giữ nguyên — không hủy lịch tự động | Slot bị `locked` (cần confirm với team) |
| Admin unsuspend | Không thay đổi (giữ `false`) | Giữ nguyên | Slot `locked` không tự `active` lại |

> **Lý do `la_hien` không tự bật khi unsuspend:** Bác sĩ có thể muốn ẩn tạm thời trong lúc sắp xếp lịch — không nên tự ý bật lại.

### 4.4 Đồng bộ diem_danh_gia

`doctors.diem_danh_gia` là **field computed** — không tự sửa:

```
diem_danh_gia = sum(reviews.diem WHERE status='visible') / count(reviews WHERE status='visible')
```

Cập nhật bởi 3 trigger:
1. Bệnh nhân tạo review mới → tăng `tong_danh_gia`
2. Admin ẩn review (C6) → giảm `tong_danh_gia`
3. Admin xóa review (C6) → giảm `tong_danh_gia`

Bác sĩ **không thể** tự sửa `diem_danh_gia` hay `so_danh_gia`. Trang hồ sơ chỉ hiển thị.

### 4.5 Validate thông tin trước khi hiển thị cho bệnh nhân

Bệnh nhân chỉ thấy hồ sơ bác sĩ khi **tất cả** điều kiện thỏa:

| Điều kiện | Field kiểm tra |
|---|---|
| Được duyệt | `trang_thai_duyet = 'approved'` |
| Đang hiển thị | `la_hien = true` |
| Tài khoản active | `users.status = 'active'` |
| Có ít nhất 1 slot active trong tương lai | `doctor_schedules` có `slots.status='active'` |

Thiếu bất kỳ điều kiện nào → bệnh nhân không thấy bác sĩ trong tìm kiếm.

### 4.6 Completeness Score (đề xuất — chưa implement)

Để khuyến khích bác sĩ điền đầy đủ thông tin:

| Field | Điểm |
|---|---|
| `anh_dai_dien` có ảnh | +20% |
| `tieu_su` ≥ 100 ký tự | +20% |
| `kinh_nghiem` ≥ 50 ký tự | +15% |
| `so_dien_thoai` điền | +15% |
| `hospitals[]` ≥ 1 bệnh viện | +15% |
| `services[]` ≥ 1 dịch vụ | +15% |

Hiển thị progress bar + gợi ý điền. Không ảnh hưởng đến chức năng.

---

## 5. Phân tích gaps giữa code hiện tại và spec đầy đủ

### 5.1 Đã implement ✅

| Tính năng | File |
|---|---|
| Xem thông tin cơ bản (view mode) | `DoctorProfile.tsx` |
| Chỉnh sửa: ho_ten, chuyen_khoa (free text), so_nam_kinh_nghiem, phi_tu_van, bang_cap, tieu_su | `DoctorProfile.tsx` |
| Banner trạng thái: pending / rejected / suspended | `DoctorProfile.tsx` |
| Nút "Nộp lại hồ sơ" khi rejected | `DoctorProfile.tsx` |
| Hiển thị diem_danh_gia + so_danh_gia | `DoctorProfile.tsx` |
| Hiển thị email + trạng thái | `DoctorProfile.tsx` |
| Mock service: get, update, submitForReview | `doctor-profile.service.ts` |

### 5.2 Chưa implement / Bugs cần fix ❌

| Gap | Mức độ | Mô tả |
|---|---|---|
| `chuyen_khoa` là free text thay vì chọn từ `specialties` | 🔴 Cao | DB lưu `specialties[]` là ObjectId ref — không phải string |
| Thiếu `so_dien_thoai` trong form | 🔴 Cao | Bệnh nhân cần SĐT để liên hệ |
| Thiếu `anh_dai_dien` upload | 🟡 Trung | Ảnh đại diện quan trọng cho UX bệnh nhân |
| Thiếu `kinh_nghiem` field | 🟡 Trung | DB có field này, UI không expose |
| Không kiểm tra `so_lan_nop >= 5` trước "Nộp lại" | 🔴 Cao | Backend chặn nhưng UX không rõ |
| Không có banner "lần cuối" khi `so_lan_nop = 4` | 🟡 Trung | UX quan trọng — bác sĩ cần biết |
| Thiếu quản lý `hospitals[]` | 🟡 Trung | Bác sĩ liên kết bệnh viện trên UI này |
| Thiếu quản lý `services[]` | 🟡 Trung | Bác sĩ đăng ký dịch vụ trên UI này |
| Thiếu toggle `la_hien` | 🔴 Cao | Không có cách nào ẩn profile khỏi tìm kiếm |
| `so_lan_nop` không hiển thị cho bác sĩ | 🟢 Thấp | Bác sĩ không biết còn bao nhiêu lần |
| Không có Completeness Score | 🟢 Thấp | UX tốt nhưng không bắt buộc |
| Khi `suspended`: form vẫn cho edit | 🔴 Cao | Phải readonly khi suspended |

---

## 6. Data Model

### 6.1 `DoctorProfile` extended — (`types/index.ts`)

```ts
export interface DoctorProfile {
  // === Từ bảng users ===
  id: number              // doctors._id
  user_id: number
  ho_ten: string
  email: string           // readonly — không bao giờ đổi
  so_dien_thoai?: string | null
  anh_dai_dien?: string | null

  // === Từ bảng doctors ===
  chuyen_khoa: string            // tên specialty (để hiển thị)
  chuyen_khoa_id?: number | null // ObjectId để link với specialties collection
  so_nam_kinh_nghiem: number
  phi_tu_van: number
  bang_cap: string
  kinh_nghiem?: string | null    // text mô tả kinh nghiệm
  la_hien: boolean               // toggle ẩn/hiện

  // === Trạng thái duyệt ===
  trang_thai_duyet: DoctorApproval  // 'pending'|'approved'|'rejected'|'suspended'
  ly_do_tu_choi?: string | null
  so_lan_nop: number              // 1–5; ≥5 không nộp lại được

  // === Thống kê (computed, readonly) ===
  diem_danh_gia: number           // 0.00–5.00
  so_danh_gia: number             // tổng review visible

  // === Timestamps ===
  ngay_tao: string
}

// Relations (không embed vào DoctorProfile — load riêng)
export interface DoctorHospitalLink {
  hospital_id: number
  ten: string
  dia_chi: string
}

export interface DoctorServiceLink {
  service_id: number
  ten: string
  loai: 'clinic' | 'home'
  gia: number
}
```

### 6.2 `ProfileUpdateData` — payload khi PATCH profile

```ts
export interface ProfileUpdateData {
  // users fields
  ho_ten?: string
  so_dien_thoai?: string | null
  anh_dai_dien?: string | null

  // doctors fields
  chuyen_khoa_id?: number | null
  so_nam_kinh_nghiem?: number
  phi_tu_van?: number
  bang_cap?: string
  kinh_nghiem?: string | null
  tieu_su?: string | null
  la_hien?: boolean
  hospital_ids?: number[]   // PATCH thay thế toàn bộ hospitals[]
  service_ids?: number[]    // PATCH thay thế toàn bộ services[]
}
```

---

## 7. Cấu trúc UI đề xuất

### 7.1 Layout tổng thể (3 cột trên desktop, stack trên mobile)

```
┌─────────────────────────────────────────────────────────────────┐
│  PageHeader: "Hồ sơ bác sĩ"                    [Chỉnh sửa ▶]   │
├─────────────────────────────────────────────────────────────────┤
│  [Banner trạng thái — hiện khi ≠ approved]                      │
│  ┌─────────────────────────────────────┐  ┌───────────────────┐ │
│  │  Card: Thông tin hành nghề          │  │ Card: Ảnh + Badge │ │
│  │  (chiếm 2/3 width)                  │  │ diem_danh_gia     │ │
│  │  · Họ tên · Chuyên khoa (dropdown)  │  │ so_danh_gia       │ │
│  │  · Kinh nghiệm · Phí tư vấn        │  │ Tài khoản info    │ │
│  │  · Bằng cấp · SĐT                  │  │ Completeness bar  │ │
│  │  · Mô tả kinh nghiệm               │  └───────────────────┘ │
│  │  · Tiểu sử                         │                         │
│  └─────────────────────────────────────┘                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Card: Bệnh viện liên kết           [+ Thêm bệnh viện]     │ │
│  │  [BV Đa khoa VitaFamily ✕]  [BV Việt Đức ✕]               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Card: Dịch vụ đã đăng ký           [+ Thêm dịch vụ]      │ │
│  │  [Khám tại phòng ✕]  [Khám tại nhà ✕]                     │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Card: Cài đặt hiển thị                                    │ │
│  │  ⚙ Hiển thị trên trang tìm kiếm  [Toggle ON/OFF]          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Banner trạng thái (theo trang_thai_duyet)

| Trạng thái | Màu | Nội dung | CTA |
|---|---|---|---|
| `pending` | 🟡 Amber | "Hồ sơ đang chờ Admin xét duyệt. Vui lòng đợi thông báo qua email." | Không có |
| `rejected` | 🔴 Red | "Hồ sơ bị từ chối — Lý do: {ly_do_tu_choi}" | "Nộp lại" (ẩn khi `so_lan_nop >= 5`) |
| `rejected` + `so_lan_nop = 4` | 🟡 Amber (phụ) | Banner thứ 2: "Đây là lần nộp cuối — kiểm tra kỹ trước khi gửi" | — |
| `rejected` + `so_lan_nop >= 5` | 🔴 Red | "Đã vượt quá số lần nộp. Vui lòng liên hệ Admin." | Link "Liên hệ hỗ trợ" |
| `suspended` | ⬛ Gray | "Tài khoản đang bị tạm ngưng. Liên hệ Admin để biết thêm." | — |
| `approved` | *(không hiện banner)* | — | — |

### 7.3 Form chỉnh sửa — quy tắc hiển thị

| Điều kiện | Form |
|---|---|
| `trang_thai_duyet = 'suspended'` | Tất cả input `readOnly` — không thể sửa |
| Tất cả trạng thái khác | Editable bình thường |

**Input types:**
- `chuyen_khoa`: `<select>` chọn từ `specialties` collection (`status='active'`)
- `so_nam_kinh_nghiem`: `<input type="number" min="0" max="60">`
- `phi_tu_van`: `<input type="number" min="0" step="10000">` + hiển thị preview `"350.000 ₫"`
- `bang_cap`: `<input>` max 200 ký tự
- `kinh_nghiem`: `<textarea>` rows=3, max 1000 ký tự + counter
- `tieu_su`: `<textarea>` rows=5, max 3000 ký tự + counter
- `anh_dai_dien`: file upload (JPEG/PNG ≤ 5MB) + preview
- `so_dien_thoai`: `<input type="tel">` validate format

### 7.4 Quản lý Bệnh viện & Dịch vụ

**Pattern: Multi-select từ danh sách có sẵn (không tạo mới)**

```
Bệnh viện liên kết
├── Danh sách đã chọn: chip/tag có nút ✕ để xóa
├── Nút "+ Thêm bệnh viện" → mở dropdown search hoặc modal
│     └── Danh sách hospitals status='active' chưa được chọn
└── Lưu ngay (auto-save) hoặc kèm với lưu form chính
```

Tương tự cho Dịch vụ (`services` collection, `status='active'`).

### 7.5 Toggle la_hien

```
┌────────────────────────────────────────────────────────────┐
│ 🔍 Hiển thị trên trang tìm kiếm bệnh nhân                 │
│ Khi tắt, bệnh nhân sẽ không tìm thấy bạn. Lịch hẹn hiện  │
│ có không bị ảnh hưởng.                              [●  ] │
└────────────────────────────────────────────────────────────┘
```

Toggle bị disabled (không thể bật) khi `trang_thai_duyet ≠ 'approved'`.

---

## 8. Service Layer

### 8.1 `doctorProfileService` — methods đầy đủ

| Method | HTTP Endpoint | Mô tả | Payload |
|---|---|---|---|
| `get()` | `GET /api/doctor/profile` | Lấy profile đầy đủ + hospitals + services liên kết | — |
| `update(data)` | `PATCH /api/doctor/profile` | Cập nhật profile; PATCH cả `users` + `doctors` | `ProfileUpdateData` |
| `submitForReview()` | `POST /api/doctor/profile/submit` | Nộp hồ sơ; validate `so_lan_nop < 5` + `trang_thai_duyet ≠ 'pending'` | — |
| `toggleVisibility(la_hien)` | `PATCH /api/doctor/profile/visibility` | Bật/tắt `la_hien` | `{ la_hien: boolean }` |
| `uploadAvatar(file)` | `POST /api/doctor/profile/avatar` | Upload ảnh → cloud → update `anh_dai_dien` URL | `FormData` |
| `getSpecialties()` | `GET /api/specialties?status=active` | Danh sách chuyên khoa để điền dropdown | — |
| `getHospitals()` | `GET /api/hospitals?status=active` | Danh sách bệnh viện để chọn liên kết | — |
| `getServices()` | `GET /api/services?status=active` | Danh sách dịch vụ để đăng ký | — |

### 8.2 Backend validation (không trust frontend)

```js
// PATCH /api/doctor/profile
if (req.body.phi_tu_van !== undefined) {
  if (req.body.phi_tu_van < 0) return error('Phí tư vấn không được âm')
}
if (req.body.bang_cap?.length > 200) return error('Bằng cấp tối đa 200 ký tự')
if (req.body.tieu_su?.length > 3000) return error('Tiểu sử tối đa 3000 ký tự')
if (req.body.kinh_nghiem?.length > 1000) return error('Kinh nghiệm tối đa 1000 ký tự')

// POST /api/doctor/profile/submit
const doctor = await Doctor.findOne({ user_id: req.user.id })
if (doctor.so_lan_nop >= 5) return error('Đã vượt số lần nộp tối đa (5 lần)')
if (doctor.trang_thai_duyet === 'pending') return error('Hồ sơ đang được xét duyệt')
if (!doctor.chuyen_khoa_id || !doctor.bang_cap) return error('Vui lòng điền đủ thông tin bắt buộc')

// PATCH /api/doctor/profile/visibility
if (doctor.trang_thai_duyet !== 'approved') return error('Chỉ bác sĩ đã duyệt mới thay đổi được')
```

---

## 9. Test Cases

> **Môi trường:** Mock data (frontend-first)
> **Mức độ:** P0 = blocker · P1 = cao · P2 = trung · P3 = thấp

---

### 9.1 TC-VIEW — Hiển thị thông tin

| ID | Tên | Điều kiện | Kết quả mong đợi | Mức |
|---|---|---|---|---|
| TC-V01 | View mode hiển thị đủ fields | Load trang | Thấy: ho_ten, chuyen_khoa, kinh_nghiem, phi_tu_van, bang_cap, tieu_su, so_dien_thoai | P0 |
| TC-V02 | Không hiển thị email edit | `approved` doctor | Email hiện ở card phụ, không có input chỉnh sửa | P0 |
| TC-V03 | diem_danh_gia format đúng | `diem_danh_gia = 4.8` | Hiện "4.8" không phải "4.80000001" | P1 |
| TC-V04 | Stars render đúng | `diem_danh_gia = 4.2` | 4 sao đầy, 1 sao rỗng (round xuống) | P1 |
| TC-V05 | `anh_dai_dien = null` | Profile không có ảnh | Hiện avatar mặc định (initials hoặc placeholder) | P1 |
| TC-V06 | `so_danh_gia = 0` | Bác sĩ mới | Hiện "0 lượt đánh giá", stars tất cả rỗng | P1 |
| TC-V07 | Completeness bar | Form còn thiếu ảnh + tiểu sử | Progress bar < 100%, gợi ý điền | P2 |
| TC-V08 | Loading state | Mock delay | Spinner, không flash content trống | P2 |

---

### 9.2 TC-BANNER — Banner trạng thái

| ID | Tên | Điều kiện | Kết quả mong đợi | Mức |
|---|---|---|---|---|
| TC-B01 | Không có banner khi approved | `trang_thai_duyet = 'approved'` | Không có banner nào | P0 |
| TC-B02 | Banner pending | `pending` | Banner vàng, không có CTA | P0 |
| TC-B03 | Banner rejected có lý do | `rejected`, `ly_do_tu_choi = 'Thiếu công chứng'` | Hiện lý do + nút "Nộp lại" | P0 |
| TC-B04 | Banner rejected không có lý do | `rejected`, `ly_do_tu_choi = null` | Banner đỏ mà không hiện dòng lý do | P1 |
| TC-B05 | Nút Nộp lại ẩn khi đủ 5 lần | `rejected`, `so_lan_nop = 5` | Nút "Nộp lại" không hiện; banner "liên hệ Admin" | P0 |
| TC-B06 | Cảnh báo lần cuối | `rejected`, `so_lan_nop = 4` | Banner phụ màu vàng: "lần nộp cuối cùng" | P1 |
| TC-B07 | Banner suspended | `suspended` | Banner xám, không có CTA | P0 |
| TC-B08 | Banner saved thành công | Sau save form | Banner xanh "Đã lưu" tự tắt sau 3 giây | P1 |

---

### 9.3 TC-EDIT — Chỉnh sửa thông tin

| ID | Tên | Điều kiện | Kết quả mong đợi | Mức |
|---|---|---|---|---|
| TC-E01 | Mở form edit | Click "Chỉnh sửa" | Form hiện với giá trị hiện tại | P0 |
| TC-E02 | Lưu thành công | Sửa ho_ten → Lưu | View mode cập nhật; banner "Đã lưu" | P0 |
| TC-E03 | Hủy chỉnh sửa | Click "Hủy" | Form đóng; dữ liệu không đổi | P1 |
| TC-E04 | Validate bang_cap bắt buộc | Xóa bang_cap → Lưu | Lỗi "Bằng cấp không được để trống" | P0 |
| TC-E05 | Validate phi_tu_van không âm | Nhập `-100000` → Lưu | Lỗi validation | P0 |
| TC-E06 | phi_tu_van hiển thị đúng format | `phi_tu_van = 350000` | Input hiện `350000`, preview "350.000 ₫" | P1 |
| TC-E07 | chuyen_khoa là dropdown | Mở form | `<select>` với options từ specialties list | P0 |
| TC-E08 | Không sửa được email | Bất kỳ trạng thái | Không có input email trong form | P0 |
| TC-E09 | Suspended = readonly | `trang_thai_duyet = 'suspended'` | Tất cả input `readOnly`; không có nút Lưu | P0 |
| TC-E10 | Counter ký tự tieu_su | Nhập 2500/3000 ký tự | Hiện "2500/3000" | P1 |
| TC-E11 | Lưu khi đang save | Double-click Lưu | Nút disabled, chỉ 1 request | P1 |
| TC-E12 | Validate so_nam_kinh_nghiem | Nhập `61` | HTML5 `max=60` hoặc validate message | P2 |

---

### 9.4 TC-SUBMIT — Nộp hồ sơ xét duyệt

| ID | Tên | Điều kiện | Kết quả mong đợi | Mức |
|---|---|---|---|---|
| TC-S01 | Nộp lần đầu từ rejected | `rejected`, `so_lan_nop = 1` | `trang_thai_duyet → 'pending'`; banner đổi màu vàng | P0 |
| TC-S02 | Không nộp khi đang pending | `pending` | Nút "Nộp lại" không xuất hiện | P0 |
| TC-S03 | Không nộp khi so_lan_nop = 5 | `rejected`, `so_lan_nop = 5` | Nút ẩn, banner "đã vượt giới hạn" | P0 |
| TC-S04 | Cảnh báo lần cuối | `rejected`, `so_lan_nop = 4` | Banner vàng "đây là lần cuối" | P1 |
| TC-S05 | so_lan_nop tăng sau nộp | Nộp lại từ `so_lan_nop = 2` | Sau nộp `so_lan_nop = 3` (hiển thị "3/5") | P1 |
| TC-S06 | Validate trước khi nộp | `bang_cap = ''` → nộp | Lỗi "Vui lòng điền đủ thông tin bắt buộc" | P0 |

---

### 9.5 TC-VISIBILITY — Toggle la_hien

| ID | Tên | Điều kiện | Kết quả mong đợi | Mức |
|---|---|---|---|---|
| TC-VIS01 | Toggle ẩn profile | `approved`, `la_hien=true` → toggle OFF | `la_hien=false`; tooltip "Bệnh nhân không tìm thấy bạn" | P0 |
| TC-VIS02 | Toggle hiện lại | `approved`, `la_hien=false` → toggle ON | `la_hien=true` | P0 |
| TC-VIS03 | Toggle disabled khi không approved | `pending` doctor | Toggle hiện nhưng disabled, tooltip giải thích | P1 |
| TC-VIS04 | Auto ẩn khi suspended | Mock `suspended` profile | Toggle hiện OFF và disabled (không thể bật) | P0 |
| TC-VIS05 | Confirm trước khi ẩn | Toggle OFF → | Confirm dialog: "Bệnh nhân sẽ không tìm thấy bạn. Xác nhận?" | P2 |

---

### 9.6 TC-HOSPITALS — Quản lý bệnh viện liên kết

| ID | Tên | Điều kiện | Kết quả mong đợi | Mức |
|---|---|---|---|---|
| TC-H01 | Hiển thị bệnh viện đã liên kết | Profile có 2 bệnh viện | 2 chip/tag với tên + nút ✕ | P0 |
| TC-H02 | Xóa bệnh viện | Click ✕ trên chip | Chip biến mất; cập nhật ngay (auto-save) | P0 |
| TC-H03 | Thêm bệnh viện | Click "+ Thêm" → chọn từ dropdown | Chip mới xuất hiện | P0 |
| TC-H04 | Không trùng bệnh viện | Dropdown không hiện bệnh viện đã chọn | BV đã liên kết không xuất hiện trong dropdown | P1 |
| TC-H05 | Bệnh viện hidden không hiện | BV `status='hidden'` | Không xuất hiện trong dropdown thêm mới | P0 |
| TC-H06 | Không có bệnh viện | Profile `hospitals = []` | Hiện "Chưa liên kết bệnh viện nào" + CTA thêm | P1 |

---

### 9.7 TC-SERVICES — Quản lý dịch vụ đã đăng ký

| ID | Tên | Điều kiện | Kết quả mong đợi | Mức |
|---|---|---|---|---|
| TC-SRV01 | Hiển thị dịch vụ đã đăng ký | Profile có dịch vụ | Chip với tên + loại (clinic/home) + nút ✕ | P0 |
| TC-SRV02 | Xóa dịch vụ | Click ✕ | Chip biến mất; auto-save | P0 |
| TC-SRV03 | Thêm dịch vụ | Click "+ Thêm" | Dropdown dịch vụ `status='active'` chưa đăng ký | P0 |
| TC-SRV04 | Dịch vụ inactive không hiện | `service.status='inactive'` | Không xuất hiện trong dropdown | P0 |

---

### 9.8 TC-EDGE — Edge Cases & Negative

| ID | Tên | Điều kiện | Kết quả mong đợi | Mức |
|---|---|---|---|---|
| TC-EDG01 | XSS trong tieu_su | Nhập `<script>alert(1)</script>` | Hiện dạng text thuần — không execute | P0 |
| TC-EDG02 | Tên rất dài | `ho_ten` = 100 ký tự | Truncate với "..." trong view, không vỡ layout | P2 |
| TC-EDG03 | phi_tu_van = 0 | Bác sĩ miễn phí | Hiện "0 ₫" không ẩn field | P2 |
| TC-EDG04 | Mất mạng khi save | Tắt mạng → save | Lỗi toast "Lưu thất bại — thử lại" | P1 |
| TC-EDG05 | Upload ảnh quá 5MB | File 6MB | Lỗi "Ảnh tối đa 5MB" — không upload | P1 |
| TC-EDG06 | Upload định dạng sai | File `.pdf` | Lỗi "Chỉ chấp nhận JPEG/PNG" | P1 |
| TC-EDG07 | API submitForReview timeout | Slow network | Nút disabled; loading spinner; không double-submit | P1 |
| TC-EDG08 | Profile của bác sĩ khác | Request với `doctor_id` khác | Backend 403 Forbidden | P0 |

---

### 9.9 TC-INTEGRATION — Integration Tests (khi gắn MongoDB)

| ID | Tên | Điều kiện | Kết quả mong đợi | Mức |
|---|---|---|---|---|
| TC-INT01 | Submit → Admin nhận notification | `submitForReview()` | `notifications` row tạo cho `user_id` admin | P0 |
| TC-INT02 | Submit → Email xác nhận | `submitForReview()` | Nodemailer gửi email "Hồ sơ đã được gửi" | P0 |
| TC-INT03 | Update profile → PATCH cả 2 bảng | PATCH `ho_ten` | `users.ho_ten` VÀ `doctors` cập nhật trong 1 request | P0 |
| TC-INT04 | Submit → so_lan_nop tăng | Nộp lần 2 | `doctors.so_lan_nop = 2` trong DB | P0 |
| TC-INT05 | Ẩn profile không ảnh hưởng lịch hẹn | Toggle `la_hien=false` | `appointments` giữ nguyên status | P1 |
| TC-INT06 | diem_danh_gia tự cập nhật | Admin ẩn review | `doctors.diem_danh_gia` recalculate | P0 |
| TC-INT07 | Role đổi khi approved | Admin approve | `users.role = 'doctor'` trong cùng transaction | P0 |

---

## 10. Tóm tắt Nghiệp vụ Không được Sai

| # | Quy tắc | Hậu quả nếu sai |
|---|---|---|
| 1 | `so_lan_nop ≥ 5` → chặn nộp lại — kiểm tra cả FE lẫn BE | Bác sĩ nộp vô tận — spam Admin |
| 2 | Duyệt `pending→approved` phải đổi `users.role='doctor'` trong cùng transaction | Role không đổi → bác sĩ bị approved nhưng không vào được panel |
| 3 | Email không bao giờ được sửa | Gây nhầm lẫn định danh; ảnh hưởng auth JWT |
| 4 | `phi_tu_van` thay đổi không ảnh hưởng lịch hẹn cũ | Bệnh nhân bị tính giá khác với lúc đặt |
| 5 | `trang_thai_duyet = 'suspended'` → tất cả form readonly | Bác sĩ bị suspended vẫn cập nhật profile = lỗ hổng |
| 6 | `la_hien` toggle chỉ cho `approved` doctor | Doctor `pending` / `rejected` không nên có toggle này |
| 7 | `diem_danh_gia` là computed — không cho bác sĩ sửa trực tiếp | Bác sĩ tự inflate điểm |
| 8 | `chuyen_khoa` phải từ `specialties` collection, không free text | Typo / inconsistency trong dữ liệu → tìm kiếm không match |
| 9 | Bác sĩ chỉ edit profile của chính mình — check `user_id` ở BE | Bác sĩ sửa profile người khác |
| 10 | XSS escape tieu_su, kinh_nghiem, ly_do_tu_choi khi render | Stored XSS qua text fields |
