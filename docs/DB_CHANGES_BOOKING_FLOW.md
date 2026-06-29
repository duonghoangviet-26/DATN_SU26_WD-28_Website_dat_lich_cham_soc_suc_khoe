# DB Changes — Luồng Đặt Lịch Mới (Phương án C)

> Ngày: 2026-06-27  
> Tham chiếu spec: `docs/superpowers/specs/2026-06-27-booking-flow-design.md`

---

## Tóm tắt thay đổi

| File | Loại thay đổi | Fields thêm |
|---|---|---|
| `BacSi.js` | Thêm fields | `bao_hiem`, `related_services[]` |
| `LichHen.js` | Thêm fields + hook | `gioi_tinh_khach`, `email_khach`, `tinh_thanh`, `phuong_xa`, `dia_chi_chi_tiet`, `nguoi_dat_ho_ten`, `nguoi_dat_sdt`, `confirmed_by`, `confirm_deadline`, `admin_missed` |
| `ThanhToan.js` | Thêm fields | `ngay_hoan_tien`, `gateway_transaction_id`, `gateway_response` |
| `LichSuLichHen.js` | Chỉ comment | Cập nhật luồng trạng thái mới |

---

## 1. BacSi.js

### Fields thêm mới

```js
bao_hiem: {
  nha_nuoc: Boolean  // default: false — BHYT nhà nước
  bao_lanh: Boolean  // default: false — Bảo hiểm bảo lãnh viện phí
}

related_services: [ObjectId → DichVu]
// Chỉ gồm DichVu.loai='related'
// Admin tick khi duyệt hồ sơ BS (C2)
// Hiển thị tham khảo "Theo chỉ định bác sĩ" — BN không đặt trực tiếp
```

### Indexes thêm

```js
doctorSchema.index({ related_services: 1 })
doctorSchema.index({ 'bao_hiem.nha_nuoc': 1 })
```

### Tại sao per-doctor thay vì dùng ThongTinPhongKham?

`ThongTinPhongKham.bao_hiem` là mặc định toàn phòng khám. `BacSi.bao_hiem` để Admin có thể set khác nhau cho từng bác sĩ — phục vụ trường hợp đa chi nhánh sau này hoặc BS có hợp đồng bảo hiểm riêng.

---

## 2. LichHen.js

### Fields thêm — Thông tin bệnh nhân khách (mở rộng form)

| Field | Type | Ghi chú |
|---|---|---|
| `gioi_tinh_khach` | String enum `['male','female']` | Giới tính BN (form mới) |
| `email_khach` | String | Email BN |
| `tinh_thanh` | String | Tỉnh/thành phố BN |
| `phuong_xa` | String | Phường/xã BN |
| `dia_chi_chi_tiet` | String | Số nhà, đường (≠ `dia_chi_kham` là địa chỉ home visit) |
| `nguoi_dat_ho_ten` | String | Tên người đặt thay (chỉ khi "Đặt cho người thân") |
| `nguoi_dat_sdt` | String | SĐT người đặt thay |

### Fields thêm — Luồng Admin confirm

| Field | Type | Ghi chú |
|---|---|---|
| `confirmed_by` | ObjectId → NguoiDung | Admin đã confirm, null = chưa confirm |
| `confirm_deadline` | Date | Auto-set = `ngay_kham + gio_kham − 30 phút` |
| `admin_missed` | Boolean | true khi cron auto-cancel vì Admin trễ |

### Hook thêm

```js
// pre-save: auto-set confirm_deadline cho clinic
appointmentSchema.pre('save', function () {
  if (this.isNew && this.loai_kham === 'clinic' && this.ngay_kham && this.gio_kham) {
    const [h, m] = this.gio_kham.split(':').map(Number)
    const deadline = new Date(this.ngay_kham)
    deadline.setHours(h, m - 30, 0, 0)
    this.confirm_deadline = deadline
  }
})
```

### Indexes thêm

```js
appointmentSchema.index({ status: 1, loai_kham: 1, confirm_deadline: 1 }) // cron clinic
appointmentSchema.index({ confirmed_by: 1 })
appointmentSchema.index({ admin_missed: 1 })
```

### Phân biệt 3 chế độ đặt lịch

| Chế độ | `member_id` | `nguoi_dat_ho_ten` | Thông tin BN |
|---|---|---|---|
| Đặt cho mình | `null` | `null` | `ten_khach`, `so_dien_thoai_khach`... |
| Đặt cho người thân (GĐ) | `ThanhVien._id` | điền | Lấy từ ThanhVien |
| Đặt cho người thân (nhập tay) | `null` | điền | `ten_khach`, `so_dien_thoai_khach`... |

### Phân biệt `payment_status` theo loại khám

| `loai_kham` | Tạo với `payment_status` | Có thể chuyển sang |
|---|---|---|
| `clinic` | `'paid'` (tạo sau gateway confirm) | `'refunded'` (khi hủy) |
| `home` | `'unpaid'` (BS confirm trước) | `'paid'` → `'refunded'` |

---

## 3. ThanhToan.js

### Fields thêm

| Field | Type | Ghi chú |
|---|---|---|
| `ngay_hoan_tien` | Date | Set khi status → refunded |
| `gateway_transaction_id` | String | ID từ VNPay/MoMo — dùng gọi refund API |
| `gateway_response` | Mixed | Raw response gateway — audit only |

### Luồng tạo ThanhToan trong Phương án C

```
Gateway callback → Server verify signature
  → Atomic: slot.status = 'booked', benh_nhan_id = user_id
  → Tạo LichHen  { status: 'pending', payment_status: 'paid', ... }
  → Tạo ThanhToan { status: 'paid', gateway_transaction_id: '...', ngay_thanh_toan: now }
  → Notify Admin
```

---

## 4. LichSuLichHen.js

Chỉ cập nhật comment — không thay đổi schema.

Luồng mới được ghi nhận:
- `pending → confirmed` do **Admin** (không còn BS)
- `pending → cancelled` do cron khi `confirm_deadline` hết hạn (clinic)
- `confirmed → completed` do **Admin** mark

---

## Không thay đổi

| Model | Lý do giữ nguyên |
|---|---|
| `LichLamViec.js` | Slot statuses đã đủ: `active/booked/locked/cancelled/expired` |
| `DichVu.js` | `loai='related'` + `specialty_id` đã có từ trước |
| `ThongTinPhongKham.js` | Giữ `bao_hiem` ở đây làm *mặc định clinic* — BacSi.bao_hiem override per-doctor |
| `ChuyenKhoa.js` | Không cần thay đổi |
| `NguoiDung.js` | Không cần thay đổi |
| `ThanhVien.js` | Không cần thay đổi |

---

## Việc cần làm tiếp theo (Backend)

```
1. Cập nhật mock/doctors.ts: thêm bao_hiem + related_services
2. Cập nhật types/index.ts: DoctorProfile, AppointmentItem
3. Viết API GET /api/specialties/:slug/doctors
4. Viết API GET /api/doctors/:id/available-slots (check B2 đã có chưa)
5. Viết API POST /api/patient/bookings/prepare (tạo pending_booking_token)
6. Viết webhook handler /api/patient/bookings/payment-callback (atomic slot lock)
7. Viết API PATCH /api/admin/appointments/:id/confirm
8. Viết API PATCH /api/admin/appointments/:id/cancel
9. Viết Cron: auto-cancel clinic pending quá confirm_deadline
10. Điều chỉnh Doctor B3 API: xóa confirm/reject, thêm emergency-cancel
```
