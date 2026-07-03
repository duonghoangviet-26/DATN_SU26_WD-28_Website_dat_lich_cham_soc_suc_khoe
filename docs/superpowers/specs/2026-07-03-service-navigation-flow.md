# Luồng Điều Hướng Dịch Vụ — 3 Tầng (Client Side)

> Ngày tạo: 2026-07-03
> Trạng thái: **Chờ implement (FE)**
> Mô tả: Ghi lại luồng điều hướng từ trang chủ → danh mục dịch vụ lớn → dịch vụ con → booking

---

## 1. Tổng quan luồng 3 tầng

```
[Trang chủ / Trang Dịch vụ]
        │
        ▼
TẦNG 1 — Danh mục dịch vụ lớn ("Dịch vụ toàn diện")
        │   Khám Chuyên khoa | Xét nghiệm y học | Khám tổng quát | ...
        │
        ▼  (BN nhấn vào 1 danh mục)
TẦNG 2 — Danh sách dịch vụ / chuyên khoa con
        │   VD: Tim mạch, Nhi khoa, Da liễu...   (nếu là Khám Chuyên khoa)
        │   VD: XN máu tại nhà, XN nước tiểu...  (nếu là Xét nghiệm tại nhà)
        │
        ▼  (BN nhấn vào 1 item)
TẦNG 3 — Trang đặt lịch
            → Hiển thị danh sách bác sĩ + slot (với Khám Chuyên khoa)
            → Hiển thị gói dịch vụ + nút "Đặt lịch" (với Xét nghiệm tại nhà)
```

---

## 2. Danh mục Tầng 1 — Phân loại & Scope

| Danh mục | Trạng thái | Map sang |
|---|---|---|
| **Khám Chuyên khoa** | ✅ Trong scope | `ChuyenKhoa` → Bác sĩ → Clinic booking |
| **Xét nghiệm y học** | ✅ Trong scope | `DichVu[loai='home']` → Home booking |
| Khám từ xa | ❌ Ngoài scope | Telemedicine — chưa có |
| Khám tổng quát | ❌ Ngoài scope | Cần gói riêng — chưa xây dựng |
| Sức khỏe tinh thần | ❌ Ngoài scope | Chuyên khoa đặc thù — chưa có BS |
| Khám nha khoa | ❌ Ngoài scope | Chuyên khoa đặc thù |
| Gói Phẫu thuật | ❌ Ngoài scope | Scope quá lớn |
| Sống khỏe Tiểu đường | ❌ Ngoài scope | Cần program quản lý riêng |
| Bài Test Sức khỏe | ❌ Ngoài scope | Tính năng riêng |
| Y tế gần bạn | ❌ Ngoài scope | Location-based search |

> **Nguyên tắc:** Hiển thị đủ danh mục cho đẹp UI; chỉ 2 danh mục hoạt động thật.
> Các danh mục chưa làm → nhấn vào hiện modal "Tính năng đang phát triển" hoặc disabled.

---

## 3. Chi tiết Tầng 2 & 3 — Theo từng danh mục trong scope

### 3.1 Khám Chuyên khoa

**Tầng 2 — Danh sách chuyên khoa:**
- Route: `/dich-vu/chuyen-khoa`
- Nguồn data: `GET /api/specialties` (lọc `status='active'`)
- Hiển thị: Grid card chuyên khoa (icon, tên, số bác sĩ đang hoạt động)
- Đã có trong `ChuyenKhoa` model ✅

**Tầng 3 — Danh sách bác sĩ theo chuyên khoa:**
- Route: `/dich-vu/chuyen-khoa/:slug` (VD: `/dich-vu/chuyen-khoa/tim-mach`)
- Nguồn data: `GET /api/specialties/:slug/doctors`
- Hiển thị: Card 2 cột mỗi bác sĩ (hồ sơ + đặt lịch)
- Chi tiết layout: xem `docs/luong-dat-dich-vu.md` mục 2 & 4.2

**Đặt lịch:**
- BN chọn ngày + slot → đặt lịch clinic → thanh toán → `LichHen { loai_kham:'clinic', status:'confirmed' }`

---

### 3.2 Xét nghiệm y học (Dịch vụ tại nhà)

**Tầng 2 — Danh sách dịch vụ xét nghiệm:**
- Route: `/dich-vu/xet-nghiem`
- Nguồn data: `GET /api/services?loai=home&status=active`
- Hiển thị: Card từng dịch vụ (tên, giá, khu vực phục vụ, thời gian trả kết quả)
- VD items: "Lấy mẫu xét nghiệm máu tại nhà 500k", "Lấy mẫu XN nước tiểu 350k"

**Tầng 3 — Chi tiết gói dịch vụ:**
- Route: `/dich-vu/xet-nghiem/:id` (VD: `/dich-vu/xet-nghiem/mock-svc-003`)
- Hiển thị:
  - Tên + mô tả đầy đủ
  - Giá cố định
  - Khu vực phục vụ (danh sách quận/huyện)
  - Lịch hoạt động (T2–T7, 08:00–17:00)
  - Thời gian trả kết quả (2–4 giờ)
  - Quy trình: nhân viên đến → lấy mẫu → lab xử lý → PDF về app
  - Nút **"Đặt lịch ngay"**

**Đặt lịch:**
- BN chọn ngày + giờ + nhập địa chỉ → thanh toán ngay (giá cố định)
- Tạo `LichHen { loai_kham:'home', doctor_id:null, status:'pending', payment_status:'paid' }`
- Chi tiết luồng: xem `docs/superpowers/specs/2026-07-02-home-service-redesign.md` mục 2.5

---

## 4. Routes FE cần tạo

| Route | Component | Mô tả |
|---|---|---|
| `/dich-vu` | `ServicesHome.tsx` | Trang tổng quan — grid tất cả danh mục lớn |
| `/dich-vu/chuyen-khoa` | `SpecialtyList.tsx` | Danh sách chuyên khoa (Tầng 2 của "Khám Chuyên khoa") |
| `/dich-vu/chuyen-khoa/:slug` | `SpecialtyDoctors.tsx` | Danh sách bác sĩ theo chuyên khoa (Tầng 3) |
| `/dich-vu/xet-nghiem` | `HomeServiceList.tsx` | Danh sách xét nghiệm tại nhà (Tầng 2) |
| `/dich-vu/xet-nghiem/:id` | `HomeServiceDetail.tsx` | Chi tiết gói + đặt lịch (Tầng 3) |

---

## 5. Data model hiện tại — đủ dùng chưa?

| Nhu cầu | Model hiện có | Đủ? |
|---|---|---|
| Danh sách chuyên khoa | `ChuyenKhoa { id, ten, icon_url, slug, status }` | ✅ Đủ |
| Bác sĩ theo chuyên khoa | `BacSi.specialties[]` | ✅ Đủ |
| Slot bác sĩ | `LichLamViec.slots[]` | ✅ Đủ |
| Dịch vụ xét nghiệm tại nhà | `DichVu { loai:'home', khu_vuc[], gio_bat_dau, gio_ket_thuc }` | ✅ Đủ |
| Khu vực phục vụ | `DichVu.khu_vuc: string[]` | ✅ Đủ |
| Dịch vụ liên quan (hiển thị trong card BS) | `DichVu { loai:'related', specialty_id }` | ✅ Đủ |

> **Kết luận:** Không cần thêm model mới. Luồng 3 tầng chỉ cần FE đọc đúng API từ models hiện có.

---

## 6. API cần có (Backend)

| Endpoint | Mô tả | Trạng thái |
|---|---|---|
| `GET /api/specialties` | Danh sách chuyên khoa active | Cần tạo |
| `GET /api/specialties/:slug/doctors` | Bác sĩ theo chuyên khoa (với slot, dịch vụ, bảo hiểm) | Cần tạo — xem `docs/luong-dat-dich-vu.md` mục 4.2 |
| `GET /api/services?loai=home&status=active` | Dịch vụ xét nghiệm tại nhà đang hoạt động | Cần tạo (client endpoint) |
| `GET /api/services/:id` | Chi tiết 1 dịch vụ | Cần tạo (client endpoint) |
| `GET /api/doctors/:id/available-slots?date=YYYY-MM-DD` | Slot còn trống của bác sĩ | Đã có (B2) |

---

## 7. Out of scope — Lý do & cách trả lời giám khảo

Các danh mục hiển thị nhưng chưa hoạt động:

| Danh mục | Lý do chưa làm |
|---|---|
| Khám từ xa | Cần tích hợp video call (Agora/Twilio) — ngoài scope DATN |
| Khám tổng quát | Cần xây "Gói khám" riêng biệt với nhiều DichVu con — phức tạp |
| Sức khỏe tinh thần, Nha khoa | Chuyên khoa chưa có dữ liệu bác sĩ trong hệ thống demo |
| Gói Phẫu thuật, Tiểu đường | Feature riêng biệt, cần quản lý phác đồ điều trị |

**Câu trả lời giám khảo:**
> "Giao diện hiển thị đầy đủ các danh mục dịch vụ theo hướng mở rộng của hệ thống.
> Trong phạm vi DATN, hệ thống triển khai đầy đủ 2 luồng chính: Khám Chuyên khoa (clinic)
> và Xét nghiệm tại nhà (home). Các danh mục còn lại là roadmap cho phiên bản tiếp theo."

---

## 8. Thứ tự implement đề xuất

```
Bước 1 — ServicesHome.tsx
└── Grid 10 danh mục, 2 cái active / 8 cái hiện "Đang phát triển"

Bước 2 — Luồng Khám Chuyên khoa
├── API: GET /api/specialties
├── SpecialtyList.tsx
├── API: GET /api/specialties/:slug/doctors  
└── SpecialtyDoctors.tsx + DoctorCard.tsx

Bước 3 — Luồng Xét nghiệm tại nhà
├── API: GET /api/services?loai=home
├── HomeServiceList.tsx
├── API: GET /api/services/:id
└── HomeServiceDetail.tsx + booking form

Bước 4 — Tích hợp thanh toán
└── Nối vào luồng VNPay/MoMo hiện có
```
