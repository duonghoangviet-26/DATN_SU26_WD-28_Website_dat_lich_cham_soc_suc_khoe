# Thiết kế lại Dịch vụ Tại nhà & Quản lý Dịch vụ (C4)

> Ngày chốt: 2026-07-02
> Trạng thái: **Chờ implement** — toàn bộ quyết định dưới đây đã được xác nhận qua phân tích nghiệp vụ.
> Implement sau khi đọc file này từ đầu đến cuối.

---

## 1. Bối cảnh — Vấn đề trước khi chốt

Trước khi thiết kế lại, hệ thống có 3 vấn đề lẫn lộn:

| Vấn đề | Biểu hiện |
|---|---|
| `DichVu.loai='home'` = bác sĩ đến nhà khám | Sai — home = lấy mẫu xét nghiệm tại nhà |
| Mỗi home service cần gắn 1 "bác sĩ phụ trách" | Rườm rà, tạo màn hình quản lý nhân viên phức tạp |
| Thanh toán home = sau khi CSKH confirm | Sai — giá cố định, không phát sinh → thanh toán ngay |

---

## 2. Quyết định đã xác nhận

### 2.1 Dịch vụ mới luôn ẩn mặc định (inactive)

**Lý do:** Admin cần review nội dung (tên, mô tả, giá) trước khi công khai. Nếu hiện ngay có thể gây xung đột thông tin sai với BN.

**Thay đổi:**
- `services.controller.js → create()`: đổi `status: 'active'` → `status: 'inactive'`
- Áp dụng cho cả `loai='home'` và `loai='related'`
- Mock: `service.service.ts → create()` cũng đổi default status

---

### 2.2 DichVu.loai='home' = Dịch vụ xét nghiệm/lấy mẫu tại nhà

**Không phải** "bác sĩ đến nhà khám bệnh". Mô hình giống Medlatec:
- Nhân viên đến nhà lấy mẫu (máu, nước tiểu...)
- Mẫu đưa về lab phân tích
- Kết quả trả sau 2–24 giờ dưới dạng PDF
- Giá CỐ ĐỊNH (không phát sinh thêm)

**Hậu quả:** BN không chọn bác sĩ cụ thể — `LichHen.doctor_id = null` khi tạo mới cho home.

---

### 2.3 BacSi model — thêm field `loai`

**Lý do:** Nhân viên lấy mẫu tại nhà ≠ bác sĩ chuyên khoa.
Không tạo "Chuyên khoa tại nhà" giả trong bảng `ChuyenKhoa` (gây lẫn lộn với chuyên khoa y khoa).

```javascript
// backend/src/models/BacSi.js — thêm field:
loai: {
  type: String,
  enum: ['specialist', 'home_staff'],
  default: 'specialist',
}
// specialist  = bác sĩ khám clinic, có chuyen_khoa_id, có slot
// home_staff  = nhân viên lấy mẫu tại nhà, chuyen_khoa_id=null
//               KHÔNG hiển thị trong trang "Tìm bác sĩ theo chuyên khoa"
```

---

### 2.4 LichHen model — 2 thay đổi

```javascript
// backend/src/models/LichHen.js

// Thay đổi 1: doctor_id nullable cho home
doctor_id: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'BacSi',
  default: null,   // null khi loai_kham='home' — CSKH gán sau
  // BẮT BUỘC chỉ khi loai_kham='clinic' — validate ở controller
}

// Thay đổi 2: thêm field kết quả xét nghiệm
ket_qua_url: {
  type: String,
  default: null,   // CSKH upload PDF rồi paste URL vào đây
  maxlength: 2000,
}
```

---

### 2.5 Luồng đặt lịch home (upfront payment)

**Trước:** BN đặt → CSKH gọi confirm → sau đó mới thanh toán
**Sau:** BN đặt → thanh toán ngay → CSKH gọi confirm

**Lý do:** Giá cố định, không phát sinh thêm chi phí → có thể thanh toán trước an toàn.

```
Luồng HOME MỚI:
1. BN chọn dịch vụ (loai='home') → chọn khu vực + slot
2. BN điền thông tin (ho_ten, SDT, dia_chi, mo_ta_trieu_chung)
3. BN thanh toán VNPay/MoMo (giống clinic)
4. Hệ thống tạo:
   LichHen {
     loai_kham: 'home',
     doctor_id: null,          ← chưa có, CSKH gán sau
     status: 'pending',
     payment_status: 'paid',   ← đã thanh toán
     ket_qua_url: null         ← chờ lab trả kết quả
   }
5. CSKH xem danh sách home bookings → gọi BN xác nhận → gán nhân viên
   Admin update: LichHen.doctor_id = home_staff_id, status='confirmed'
6. Nhân viên đến lấy mẫu → mang về lab
7. Lab xong → CSKH upload PDF → điền ket_qua_url
   Admin update: LichHen.ket_qua_url = 'https://...', status='completed'
8. Hệ thống gửi notification BN: "Kết quả xét nghiệm của bạn đã có"
9. BN vào app → xem/tải PDF kết quả

Luồng CLINIC giữ nguyên:
Book → auto-confirm → payment_deadline → BN trả → completed → BS nhập KetQuaKham
```

---

### 2.6 Kết quả dịch vụ: Home vs Clinic

| | Clinic | Home (xét nghiệm) |
|---|---|---|
| Model kết quả | `KetQuaKham` (đã có) | `LichHen.ket_qua_url` (URL PDF) |
| Ai nhập | Bác sĩ — trong hệ thống | CSKH/lab — upload file rồi paste URL |
| Nội dung | Chẩn đoán + đơn thuốc + ngày tái khám | File báo cáo số liệu từ lab |
| Thời điểm | Ngay sau khám | 2–24 giờ sau lấy mẫu |
| Đơn thuốc | Có (`DonThuoc`) | Không |
| Nhắc tái khám | Có | Không |

---

### 2.7 Dịch vụ liên quan (related) — quản lý theo chuyên khoa

Không thay đổi model. Chỉ cần FE đọc đúng:

```
Admin thêm DichVu { loai:'related', specialty_id:'tim_mach', ... }
→ Tất cả BS Tim mạch tự động hiển thị list này dưới phần "Giá dịch vụ liên quan"
→ Admin KHÔNG cần gắn tay từng dịch vụ vào từng bác sĩ
```

**FE cần làm:** trang booking clinic → fetch `DichVu?loai=related&specialty_id={doctor.specialty_id}` → hiển thị section "Giá dịch vụ liên quan" (như ảnh BookingCare).

---

## 3. Out of scope — Ghi nhận để trả lời giám khảo

| Feature | Lý do chưa làm |
|---|---|
| Quản lý nhân viên lấy mẫu (home_staff) | Cần màn hình riêng, lịch làm việc riêng — scope lớn, thời gian có hạn |
| Bảng chỉ số xét nghiệm chi tiết (ngưỡng bình thường, cờ bất thường) | Cần data y tế chuẩn, phức tạp về hiển thị — không thuộc scope DATN |
| Bác sĩ tư vấn kết quả online | Tính năng riêng biệt, cần chat/video call |
| Auto-dispatch nhân viên lấy mẫu | Cần thuật toán phân công theo khu vực + lịch trống |
| Refund khi CSKH không thể phục vụ | Xử lý ngoài hệ thống (liên hệ trực tiếp) |

**Câu trả lời giám khảo:**
> "Dịch vụ xét nghiệm tại nhà trong hệ thống hỗ trợ đặt lịch và thanh toán trước. Kết quả được CSKH upload và thông báo tự động tới bệnh nhân qua notification. Phân công nhân viên lấy mẫu và hiển thị bảng chỉ số chi tiết là 2 tính năng nằm ngoài phạm vi đề tài do giới hạn thời gian."

---

## 4. Danh sách file cần chỉnh sửa

### Backend
| File | Thay đổi |
|---|---|
| `backend/src/models/BacSi.js` | Thêm field `loai: 'specialist' \| 'home_staff'` |
| `backend/src/models/LichHen.js` | `doctor_id` nullable + thêm `ket_qua_url` |
| `backend/src/controllers/admin/services.controller.js` | `create()`: default `status='inactive'` |
| `backend/src/controllers/patient/booking.controller.js` | Home booking: `doctor_id=null`, trigger payment, không set deadline |
| `backend/src/controllers/admin/appointments.controller.js` | Thêm action `assignHomeStaff()` — update `doctor_id` cho home booking |

### Frontend
| File | Thay đổi |
|---|---|
| `frontend/src/services/service.service.ts` | `create()`: default `status='inactive'` |
| `frontend/src/mock/services.ts` | Đổi status mới tạo = `'inactive'` |
| `frontend/src/types/index.ts` | Thêm `ket_qua_url?: string \| null` vào `Appointment` + `DoctorAppointmentDetail` |

### Docs cần cập nhật
| File | Thay đổi |
|---|---|
| `docs/superpowers/specs/2026-06-27-booking-flow-design.md` | Thêm section home flow mới |
| `docs/superpowers/specs/2026-07-02-known-issues-out-of-scope.md` | Thêm home_staff management vào out of scope |

---

## 5. Checklist implement (theo thứ tự)

- [ ] `BacSi.js` — thêm field `loai`
- [ ] `LichHen.js` — `doctor_id` nullable + `ket_qua_url`
- [ ] `services.controller.js` — default `status='inactive'`
- [ ] `service.service.ts` (FE mock) — default `status='inactive'`
- [ ] `types/index.ts` — thêm `ket_qua_url`
- [ ] `booking.controller.js` — home flow upfront payment, doctor_id=null
- [ ] `appointments.controller.js` (admin) — action `assignHomeStaff()`
- [ ] FE booking page home — bỏ chọn BS, thêm chọn khu vực
- [ ] FE trang booking clinic BS — thêm section "Dịch vụ liên quan" từ `DichVu.related`
- [ ] Notification khi `ket_qua_url` được điền
