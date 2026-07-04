# Luồng Đặt Dịch Vụ — VitaFamily

> Tạo: 2026-06-25
> Tham chiếu: BookingCare UX pattern (chuyên khoa → bác sĩ → đặt lịch)
> Mục đích: Ghi lại toàn bộ phân tích kiến trúc, các thay đổi cần thực hiện về DB, chức năng, UI

---

## 1. Luồng nghiệp vụ tổng thể

```
Bệnh nhân chọn Chuyên khoa (VD: Tim mạch)
        │
        ▼
Danh sách Bác sĩ thuộc chuyên khoa đó  ← lọc BacSi.specialties[] = specialty._id
        │
        ▼
Card mỗi Bác sĩ (2 cột):
┌─────────────────────────┬────────────────────────────────────┐
│  TRÁI: Hồ sơ bác sĩ    │  PHẢI: Thông tin đặt lịch          │
│  - Ảnh đại diện         │  - Lịch T2–T7 (slot còn trống)     │
│  - Tên + Học hàm        │  - Các khung giờ có thể đặt        │
│  - Chuyên khoa          │  - Giá khám / slot (30 phút)       │
│  - Số năm kinh nghiệm   │  - Dịch vụ liên quan (khi BS yêu   │
│  - Bằng cấp             │    cầu — xét nghiệm, X-quang...)   │
│  - Điểm đánh giá        │  - Loại bảo hiểm được chấp nhận    │
└─────────────────────────┴────────────────────────────────────┘
        │
        ▼
BN chọn ngày + giờ → Đặt lịch → Luồng thanh toán (đã có)
```

---

## 2. Tách 3 chức năng quản lý tương ứng

| Phần hiển thị cho BN | Chức năng Admin quản lý | Mã chức năng | Trạng thái |
|---|---|---|---|
| Hồ sơ bác sĩ (ảnh, tên, bằng cấp, kinh nghiệm) | Quản lý / duyệt hồ sơ bác sĩ | C2 | Có sẵn (cần mở rộng) |
| Lịch T2–T7, khung giờ trống | Lịch làm việc bác sĩ | B2 | Đã xây dựng |
| Dịch vụ liên quan theo chuyên khoa | Quản lý dịch vụ (loai='related') | C4 | Đã xây dựng |
| Giá khám, bảo hiểm, dịch vụ BS đảm nhận | **Cài đặt bác sĩ** (mở rộng C2) | C2-ext | **Cần thêm mới** |

---

## 3. Thay đổi Database cần thực hiện

### 3.1 BacSi model — cần bổ sung

**File:** `backend/src/models/BacSi.js`

```js
// Hiện tại:
services: [{ type: ObjectId, ref: 'DichVu' }]  // chỉ lưu home services
specialties: [{ type: ObjectId, ref: 'ChuyenKhoa' }]

// Cần thêm:
bao_hiem: {
  nha_nuoc: { type: Boolean, default: false },  // BHYT nhà nước
  bao_lanh:  { type: Boolean, default: false },  // Bảo hiểm bảo lãnh viện phí
},

// services[] cần mở rộng để chứa cả related services (không chỉ home)
// Hoặc tách riêng:
related_services: [{ type: ObjectId, ref: 'DichVu' }]  // dịch vụ related BS này áp dụng
// home_services đã nằm trong services[] hiện tại
```

**Lý do:** Hiện tại `services[]` trong BacSi chỉ ref `DichVu.loai='home'`.
Cần thêm `related_services[]` để lưu các dịch vụ xét nghiệm/chẩn đoán hình ảnh
mà bác sĩ đó có thể chỉ định — Admin tick khi cài đặt bác sĩ.

### 3.2 DichVu model — không cần thay đổi schema

`DichVu.specialty_id` đã đủ để lọc dịch vụ theo chuyên khoa.
`so_bac_si` (computed) = số bác sĩ approved có `related_services` chứa `dich_vu._id`.

### 3.3 Quan hệ dữ liệu sau khi cập nhật

```
ChuyenKhoa (Tim mạch)
    │
    ├── BacSi[] (specialties[] chứa Tim mạch._id)
    │       ├── gia_kham: 350,000
    │       ├── bao_hiem: { nha_nuoc: true, bao_lanh: false }
    │       ├── services[]: [DichVu_home_1, ...]        ← dịch vụ tại nhà BS đảm nhận
    │       └── related_services[]: [DV001, DV002, ...]  ← dịch vụ liên quan BS áp dụng
    │
    └── DichVu[] (loai='related', specialty_id=Tim mạch._id)
            ├── DV001: Siêu âm tim (30ph, 350,000đ tham khảo)
            └── DV002: Điện tâm đồ ECG (30ph, 150,000đ tham khảo)
```

---

## 4. Chức năng cần thêm mới / mở rộng

### 4.1 C2 — Mở rộng: Cài đặt bác sĩ (Admin)

Khi Admin duyệt / quản lý bác sĩ, bổ sung tab **"Cài đặt dịch vụ"**:

```
Tab: Cài đặt dịch vụ & bảo hiểm
┌──────────────────────────────────────────────┐
│  Giá khám (VNĐ/slot 30ph)    [350,000    ]  │
│                                               │
│  Dịch vụ liên quan BS có thể chỉ định:       │
│  (Lọc tự động theo chuyên khoa của BS)        │
│  ✅ DV001 — Siêu âm tim         350,000đ     │
│  ✅ DV002 — Điện tâm đồ ECG     150,000đ     │
│  ☐  DV005 — Xét nghiệm máu      120,000đ     │
│                                               │
│  Bảo hiểm chấp nhận:                         │
│  ✅ BHYT nhà nước                             │
│  ☐  Bảo lãnh viện phí                        │
└──────────────────────────────────────────────┘
```

**API cần thêm:**
```
PUT /api/admin/doctors/:id/settings
Body: {
  gia_kham: number,
  related_services: string[],   // ObjectId[]
  bao_hiem: { nha_nuoc: boolean, bao_lanh: boolean }
}
```

### 4.2 Client — Trang danh sách bác sĩ theo chuyên khoa (A-new)

**Route:** `/chuyen-khoa/:slug` (VD: `/chuyen-khoa/tim-mach`)

**API cần:**
```
GET /api/specialties/:slug/doctors
Response: [
  {
    bac_si_id, ho_ten, anh_dai_dien, bang_cap,
    so_nam_kinh_nghiem, gia_kham, diem_danh_gia,
    bao_hiem: { nha_nuoc, bao_lanh },
    related_services: [{ id, ten, gia }],
    // lịch: lấy riêng từ B2 API khi BN click vào bác sĩ
  }
]
```

**API lịch trống (đã có từ B2):**
```
GET /api/doctors/:id/available-slots?date=YYYY-MM-DD
```

### 4.3 so_bac_si trong DichVu — cách tính đúng

Thay vì lưu cố định, tính động khi cần:
```js
// Khi GET /api/admin/services — populate so_bac_si
const count = await BacSi.countDocuments({
  related_services: service._id,
  trang_thai_duyet: 'approved',
  la_hien: true,
})
```

---

## 5. Thứ tự implementation đề xuất

```
Bước 1 — DB (Backend)
├── Thêm bao_hiem{} vào BacSi schema
└── Thêm related_services[] vào BacSi schema

Bước 2 — Admin C2 mở rộng (Backend + Frontend)
├── API PUT /api/admin/doctors/:id/settings
├── UI tab "Cài đặt dịch vụ & bảo hiểm" trong trang quản lý bác sĩ
└── Dropdown/checklist dịch vụ lọc theo specialty của bác sĩ đó

Bước 3 — Tính so_bac_si động (Backend)
└── Sửa GET /api/admin/services → populate so_bac_si từ BacSi.related_services

Bước 4 — Client trang chuyên khoa (Frontend)
├── API GET /api/specialties/:slug/doctors
├── Trang /chuyen-khoa/:slug — danh sách bác sĩ
└── Card bác sĩ: 2 cột (hồ sơ + đặt lịch/dịch vụ/bảo hiểm)

Bước 5 — Tích hợp đặt lịch
└── BN chọn ngày/giờ → đặt lịch → luồng thanh toán (đã có)
```

---

## 6. Các điểm cần lưu ý khi implement

### Dịch vụ liên quan — bác sĩ KHÔNG thực hiện, chỉ CHỈ ĐỊNH

- KTV / điều dưỡng thực hiện, bác sĩ đọc kết quả
- Hiển thị cho BN với label: **"Các dịch vụ có thể được bác sĩ chỉ định"**
- Giá trong DichVu là **tham khảo**, không snapshot vào LichHen
- BN không đặt lịch riêng cho dịch vụ này — nó đi kèm khám clinic

### Bảo hiểm — 2 loại

| Loại | Mô tả | Field |
|---|---|---|
| BHYT nhà nước | Giảm % theo quy định nhà nước | `bao_hiem.nha_nuoc` |
| Bảo lãnh viện phí | Công ty bảo hiểm tư thanh toán thay | `bao_hiem.bao_lanh` |

### Snapshot khi đặt lịch

Khi BN đặt lịch clinic, snapshot vào LichHen:
- `gia_kham` ← BacSi.gia_kham (tại thời điểm đặt)
- `ten_dich_vu` ← ChuyenKhoa.ten (tên chuyên khoa của BS)
- Dịch vụ related KHÔNG snapshot vào LichHen — bác sĩ chỉ định sau khi khám

### related_services[] trong BacSi — lọc thông minh

Khi Admin cài đặt bác sĩ, chỉ hiển thị các DichVu:
```
loai = 'related'
AND specialty_id IN BacSi.specialties[]
AND status = 'active'
```

---

## 7. Files cần thay đổi

### Backend
| File | Thay đổi |
|---|---|
| `models/BacSi.js` | Thêm `bao_hiem{}` + `related_services[]` |
| `controllers/admin/doctors.controller.js` | Thêm action `updateSettings()` |
| `controllers/admin/services.controller.js` | Tính `so_bac_si` động từ BacSi |
| `routes/admin/doctors.routes.js` | Thêm `PUT /:id/settings` |
| `routes/index.js` | Thêm `GET /specialties/:slug/doctors` |
| *(mới)* `controllers/specialties.controller.js` | Action `getDoctors()` cho client |

### Frontend
| File | Thay đổi |
|---|---|
| `mock/doctors.ts` | Thêm `bao_hiem`, `related_services[]` vào mock data |
| `types/index.ts` | Thêm `BaoHiem`, cập nhật `DoctorProfile` |
| `services/doctor.service.ts` | Thêm `updateSettings()`, `getBySpecialty()` |
| *(mới)* `pages/admin/ManageDoctors.tsx` | Tab cài đặt dịch vụ & bảo hiểm |
| *(mới)* `pages/client/SpecialtyDoctors.tsx` | Trang BN xem BS theo chuyên khoa |
| *(mới)* `components/client/DoctorCard.tsx` | Card 2 cột (hồ sơ + đặt lịch) |
