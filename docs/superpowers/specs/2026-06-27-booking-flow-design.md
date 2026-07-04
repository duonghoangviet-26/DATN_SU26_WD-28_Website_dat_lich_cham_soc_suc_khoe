# Design Spec — Luồng Đặt Lịch Khám Bệnh Nhân (Phương án C)

> Ngày tạo: 2026-06-27  
> Trạng thái: Chờ review  
> Phạm vi: A-new (Trang chuyên khoa) + trang bác sĩ + trang đặt lịch + trang thanh toán  
> Tham chiếu: `docs/luong-dat-dich-vu.md`, `backend/src/models/LichHen.js`, `backend/src/models/BacSi.js`
>
> ⚠️ **Đã sửa đổi 2026-07-02:** bước "Admin xác nhận" (Bước 6, mục 4.1, 6.2, 6.3-Cron 1, 8.3, 9.2) cho lịch **clinic** đã bị BỎ — clinic giờ auto-confirm ngay khi thanh toán thành công. Xem chi tiết + lý do tại `docs/superpowers/specs/2026-07-02-clinic-auto-confirm-decision.md`. Các phần khác của spec này (luồng home, cancellation policy nói chung, pages/API không liên quan tới confirm) vẫn còn hiệu lực.

---

## 1. Tổng quan

**Nguyên tắc cốt lõi:**
- Bác sĩ không làm việc hành chính — chỉ nhận thông báo khi lịch đã chốt.
- Admin/Lễ tân là người xác nhận cuối cùng về mặt vận hành.
- Slot **chỉ bị lock sau khi payment gateway xác nhận thanh toán thành công** — không bao giờ lock trước.
- Thanh toán phí khám hoàn toàn online trước khi khám, không thu tại cơ sở.

**Luồng tóm tắt:**
```
BN chọn chuyên khoa → chọn bác sĩ → chọn slot → điền form
→ Trang thanh toán (VNPay/MoMo)
→ [Tại đây: atomic slot lock + tạo LichHen]
→ Admin xác nhận → BS notify → BN đến khám → Admin mark completed
```

---

## 2. Actors & Vai trò

| Actor | Hành động trong luồng |
|---|---|
| **Bệnh nhân (BN)** | Chọn slot, điền form, thanh toán, có thể hủy (theo policy) |
| **Admin/Lễ tân** | Xác nhận hoặc từ chối lịch đã thanh toán, mark completed, xử lý hoàn tiền |
| **Bác sĩ (BS)** | Chỉ nhận thông báo khi lịch confirmed; có thể hủy khẩn cấp |
| **System/Cron** | Auto-cancel lịch pending+paid nếu qua giờ khám mà Admin chưa confirm |
| **Payment Gateway** | VNPay/MoMo — xác nhận transaction; DATN dùng mock/sandbox |

---

## 3. Luồng chi tiết theo bước

### Bước 1 — Trang chuyên khoa `/chuyen-khoa/:slug`

- Hiển thị danh sách bác sĩ thuộc chuyên khoa đó.
- Mỗi card bác sĩ hiển thị: avatar, tên, học hàm/học vị, số năm kinh nghiệm, giá khám, điểm đánh giá, slot gần nhất còn trống.
- Chỉ hiển thị bác sĩ có `trang_thai_duyet = 'approved'` và `la_hien = true`.
- Guard: nếu không có bác sĩ nào → "Chuyên khoa này hiện chưa có bác sĩ."

### Bước 2 — Trang bác sĩ `/bac-si/:id?specialtyId=xxx`

Bố cục 2 cột (như ảnh tham chiếu BookingCare):

**Cột trái — Thông tin bác sĩ:**
- Avatar, tên, học hàm, mô tả ngắn (kinh nghiệm, bằng cấp)
- Độ tuổi nhận khám (`tuoi_nhan_kham_tu`)
- Nút "Tư vấn sâu" (nếu có chatbot)

**Cột phải — Chi tiết đặt lịch:**
- **Lịch khám:** Date picker 7 ngày (bắt đầu từ hôm nay). Mỗi ngày hiển thị các slot active. Slot ẩn nếu `gio_bat_dau < now + 3h`.
- **Địa chỉ khám:** `ThongTinPhongKham.ten` + `ThongTinPhongKham.dia_chi`. Phòng cụ thể (slot.phong_kham) hiển thị sau khi BN chọn slot.
- **Giá khám:** `BacSi.gia_kham` (realtime, fetch khi load trang). Ghi chú: "Giá chưa bao gồm dịch vụ chẩn đoán nếu có".
- **Giá dịch vụ liên quan:** `BacSi.related_services[]` lọc theo `specialtyId`. Ẩn section nếu array rỗng. Label mỗi item: "Theo chỉ định bác sĩ". Nút "Ẩn/Hiện bảng giá".
- **Loại bảo hiểm áp dụng:** `BacSi.bao_hiem.nha_nuoc` + `BacSi.bao_hiem.bao_lanh`. Hiển thị cả 2 row dù false — ghi rõ "Chưa áp dụng" để BN biết.

**Khi BN click chọn slot:**
- Nếu chưa đăng nhập → lưu `sessionStorage.intended_booking = {doctor_id, schedule_id, slot_id, specialtyId}` → redirect `/login?redirect=/bac-si/:id`
- Nếu đã đăng nhập → navigate `/dat-lich-kham` với state: `{doctor, slot, schedule, specialtyId}`

### Bước 3 — Trang đặt lịch `/dat-lich-kham`

Không nhận params URL — nhận state từ React Router. Nếu state null (BN vào thẳng URL) → redirect về trang chủ.

**Header tóm tắt slot đã chọn:** Avatar bác sĩ, tên, slot (giờ - ngày), phòng khám (từ slot.phong_kham, fallback về ThongTinPhongKham).

**Giá khám:** Re-fetch `BacSi.gia_kham` tại thời điểm load trang này (không dùng cache từ trang trước).

**Radio "Đặt cho mình / Đặt cho người thân":**

*Chế độ "Đặt cho mình":*
- Auto-fill từ profile NguoiDung: họ tên, SĐT, email, năm sinh, địa chỉ.
- BN có thể sửa trước khi submit.
- `member_id = null` trong LichHen.

*Chế độ "Đặt cho người thân":*
- Hiển thị thêm section "Thông tin người đặt lịch" (người dùng đang đăng nhập): họ tên, SĐT.
- Dropdown chọn từ nhóm gia đình (GiaDinh/ThanhVien) → auto-fill form bệnh nhân.
- Nếu nhóm gia đình rỗng → ẩn dropdown, chỉ hiện form nhập tay + link "Quản lý nhóm gia đình".
- Nếu chọn từ nhóm gia đình → `member_id = ThanhVien._id`.
- Nếu nhập tay người không có trong nhóm → `member_id = null`, dùng `ten_khach`, `so_dien_thoai_khach`, `nam_sinh_khach`.

**Validate client-side trước khi submit:**
- Họ tên bệnh nhân: bắt buộc, viết hoa chữ đầu.
- Giới tính: bắt buộc.
- SĐT liên hệ: bắt buộc, đúng định dạng VN.
- Năm sinh: bắt buộc, hợp lệ.
- Tỉnh/thành phố: bắt buộc.
- Kiểm tra `tuoi_nhan_kham_tu`: `(current_year - nam_sinh) >= BS.tuoi_nhan_kham_tu` → warning ngay khi chọn member.

**Hình thức thanh toán:** Radio duy nhất "Thanh toán trực tuyến" (không có option khác — thông tin chỉ đọc).

**Tóm tắt giá:** Giá khám + Phí đặt lịch: Miễn phí + Tổng cộng.

**Nút "XÁC NHẬN ĐẶT KHÁM":**
- Disable sau click 1 lần (prevent double-submit).
- Loading state trong khi gọi API.
- Submit → server tạo `pending_booking_token` (không lock slot) → redirect trang thanh toán.

### Bước 4 — Trang thanh toán (Payment Gateway)

- Server tạo `pending_booking` record tạm thời (không phải LichHen, không lock slot).
- BN được redirect sang VNPay/MoMo với `pending_booking_token`.
- Gateway callback về server:
  - **Thành công:** Server thực hiện atomic slot lock + tạo LichHen + tạo ThanhToan → redirect `/dat-lich-thanh-cong/:lichHenId`.
  - **Thất bại/hủy:** Không có gì thay đổi trong DB → redirect `/dat-lich-kham` với thông báo lỗi. Slot vẫn active.

**Race condition tại bước này:**
- 2 BN cùng thanh toán thành công cho cùng slot → atomic findOneAndUpdate với filter `slot.status='active' AND slot.benh_nhan_id=null`.
- BN thắng: tạo LichHen bình thường.
- BN thua: Gateway đã thu tiền → server trả lỗi → phải hoàn tiền tự động qua gateway refund API → notify BN "Slot vừa được đặt bởi người khác, đã hoàn tiền".

### Bước 5 — Trang xác nhận thành công `/dat-lich-thanh-cong/:lichHenId`

- Hiển thị: thông tin slot, bác sĩ, mã lịch hẹn, trạng thái "Đang chờ xác nhận".
- Thông báo: "Lịch hẹn của bạn đã được ghi nhận và đang chờ Admin xác nhận. Bạn sẽ nhận thông báo qua email/push trong vòng vài giờ."
- Link: "Xem danh sách lịch hẹn của tôi".

### Bước 6 — Admin xác nhận

- Admin C5 nhận push notification + badge số lịch pending.
- Màn hình C5 sort pending theo `ngay_kham + gio_bat_dau` tăng dần (urgent first).
- Admin xem thông tin: BN, BS, slot, phòng, lý do khám, đã thanh toán.
- **Confirm:** `LichHen.status = 'confirmed'`, `confirmed_by = admin_id` → notify BS + notify BN.
- **Cancel (hiếm):** Admin bắt buộc nhập lý do → `status = 'cancelled'`, `payment_status = 'refunded'`, slot freed → notify BN với lý do + thông tin hoàn tiền → notify BS.

### Bước 7 — Bác sĩ nhận thông báo

- BS nhận push: "Bạn có ca khám lúc [giờ] ngày [ngày]. Bệnh nhân: [tên]. Lý do: [lý_do_kham]."
- BS xem lịch trong trang lịch hẹn (B3) — chế độ read-only. BS không có action confirm/reject.

### Bước 8 — Hoàn tất

- BN đến khám → BS khám xong.
- Admin/Lễ tân mark `LichHen.status = 'completed'`.
- BN nhận thông báo nhắc đánh giá bác sĩ sau 24h.

---

## 4. State Machines

### 4.1 LichHen.status

```
pending ──── Admin cancel ──────→ cancelled
   │
   ├──── System cron (qua giờ, chưa confirm) → cancelled (flag: admin_missed)
   │
Admin confirm
   │
confirmed ──── BN cancel (>24h) ──→ cancelled
   │       ──── Admin cancel ──────→ cancelled
   │       ──── BS cancel khẩn ────→ cancelled
   │
completed (Admin mark)
```

### 4.2 LichHen.payment_status

```
paid (ngay từ đầu — slot chỉ lock sau payment)
   │
   └──── Nếu LichHen bị cancel → refunded
```

> Không có trạng thái `unpaid` trong LichHen nữa — slot chỉ tồn tại sau khi đã paid.

### 4.3 LichLamViec.slots[].status

```
active ──── BN thanh toán thành công → booked
   │
booked ──── LichHen cancelled (BN/Admin/System) → active
        ──── BS cancel khẩn → locked
        ──── Ngày khám qua → expired
```

---

## 5. Thay đổi Database

### 5.1 BacSi model — cần bổ sung

```js
// Thêm vào BacSi schema:
bao_hiem: {
  nha_nuoc: { type: Boolean, default: false },
  bao_lanh:  { type: Boolean, default: false },
},
related_services: [{ type: ObjectId, ref: 'DichVu' }],
// related_services: Admin tick khi cài đặt BS, chỉ gồm DichVu.loai='related'
// specialty_id của DichVu phải nằm trong BacSi.specialties[]
```

### 5.2 LichHen model — điều chỉnh

```js
// Xóa: không còn dùng payment_deadline cho auto-cancel 2h
// (vì slot chỉ lock sau payment — không có trạng thái unpaid)
// Giữ nguyên payment_deadline nhưng dùng cho trường hợp Admin miss:
//   payment_deadline → đổi tên thành confirm_deadline
//   = ngay_kham + gio_kham - 30 phút (Admin phải confirm trước đó)

// Thêm:
confirmed_by: { type: ObjectId, ref: 'NguoiDung', default: null },
// Admin ID đã confirm lịch này

admin_missed: { type: Boolean, default: false },
// true khi System cron auto-cancel vì Admin không confirm kịp — dùng audit SLA

// payment_status: giữ nguyên enum ['unpaid','paid','refunded']
// Với clinic flow mới: LichHen được tạo với payment_status='paid' ngay từ đầu
// 'unpaid' vẫn giữ cho home service (luồng khác) + backward compat
```

### 5.3 ThanhToan model — điều chỉnh nhỏ

```js
// Thêm field:
gateway_transaction_id: { type: String, default: null }, // ID từ VNPay/MoMo
gateway_response: { type: mongoose.Schema.Types.Mixed, default: null }, // Raw response
```

### 5.4 Quan hệ dữ liệu tổng thể

```
ChuyenKhoa (Tim mạch)
    │
    ├── BacSi[]
    │       ├── gia_kham: 350,000
    │       ├── bao_hiem: { nha_nuoc: true, bao_lanh: false }
    │       ├── services[]: [DichVu_home...]        ← khám tại nhà
    │       └── related_services[]: [DV001, DV002]  ← xét nghiệm, chẩn đoán hình ảnh
    │
    └── DichVu[] (loai='related', specialty_id=Tim_mach._id)
            DV001: Siêu âm tim — 350,000đ tham khảo
            DV002: Điện tâm đồ ECG — 150,000đ tham khảo

ThongTinPhongKham (singleton)
    └── ten, dia_chi, so_dien_thoai, gio_lam_viec

LichLamViec (BacSi × ngay)
    └── slots[]: { gio_bat_dau, gio_ket_thuc, status, phong_kham, benh_nhan_id }

LichHen (sau payment confirm)
    ├── doctor_id, schedule_id, slot_id
    ├── user_id, member_id (null nếu đặt cho mình)
    ├── ten_khach, so_dien_thoai_khach, nam_sinh_khach (nếu member_id null)
    ├── gia_kham (snapshot tại thời điểm payment)
    ├── status: pending → confirmed → completed | cancelled
    ├── payment_status: paid | refunded
    └── confirmed_by: Admin._id (sau khi confirm)
```

---

## 6. Time Cutoff Rules

### 6.1 Slot visibility cho BN

```
Slot hiển thị KHI ĐỒNG THỜI:
  1. slot.status = 'active'
  2. ngay_kham + gio_bat_dau >= now + 3 giờ

Ví dụ (BN xem lúc 13:00):
  Slot 15:59 → ẩn  (< 3h)
  Slot 16:00 → hiển thị
  Slot ngày mai bất kỳ → hiển thị (nếu active)
```

> **Lý do chọn 3h:** Payment processing ~10 phút + Admin cần tối thiểu 2h xử lý + buffer 50 phút.

### 6.2 Admin SLA

- Admin phải confirm trước `ngay_kham + gio_bat_dau - 30 phút`.
- C5 hiển thị countdown cho mỗi pending appointment.
- Nếu Admin không confirm kịp → System cron tự cancel + refund + flag `admin_missed=true`.

### 6.3 Cron jobs

```
Cron 1 — Mỗi 15 phút:
  SELECT LichHen WHERE status='pending'
    AND ngay_kham + gio_kham < now
  → auto-cancel, slot=expired, payment_status=refunded
  → notify BN: "Rất tiếc, lịch hẹn đã bị hủy do chưa được xác nhận kịp."
  → notify Admin: flag admin_missed

Cron 2 — Mỗi ngày 00:05:
  SELECT LichLamViec.slots WHERE status='active' AND ngay < today
  → batch update status='expired'
```

---

## 7. Cancellation Policy

### 7.1 Ma trận quyền hủy

| Actor | status='pending'+paid | status='confirmed'+paid (>24h) | status='confirmed'+paid (≤24h) |
|---|---|---|---|
| BN | ✅ Hủy tự do | ✅ Hủy, hoàn 100% | ❌ Không tự hủy — gọi lễ tân |
| Admin | ✅ Hủy + ghi lý do bắt buộc | ✅ Hủy + ghi lý do | ✅ Hủy + ghi lý do |
| BS | ✅ Khẩn cấp | ✅ Khẩn cấp | ✅ Khẩn cấp |
| System | ✅ Auto-cancel nếu qua giờ | ❌ | ❌ |

### 7.2 Hậu quả khi hủy

**BN hủy (pending hoặc confirmed >24h):**
```
1. slot.status = 'active', benh_nhan_id = null
2. LichHen.status = 'cancelled', payment_status = 'refunded'
3. ThanhToan: tạo HoanTien record
4. Log LichSuLichHen: { action:'cancel', by:'patient' }
5. Notify Admin (pending list cập nhật)
6. Notify BS nếu status='confirmed'
```

**Admin hủy:**
```
1. Bắt buộc nhập lý do (ly_do_huy — min 10 ký tự)
2. slot.status = 'active', benh_nhan_id = null
3. LichHen.status = 'cancelled', payment_status = 'refunded'
4. Log LichSuLichHen: { action:'cancel', by:'admin', ly_do }
5. Notify BN: Push + Email — "Lịch hẹn bị hủy: [lý_do]. Hoàn tiền trong 3-5 ngày làm việc."
6. Notify BS nếu đã confirmed
```

**BS hủy khẩn:**
```
1. Bắt buộc nhập lý do khẩn cấp
2. slot.status = 'locked' (không về active — BS không thể nhận ca đó)
3. LichHen.status = 'cancelled', payment_status = 'refunded'
4. Notify BN: PRIORITY — Push + Email + SMS nếu có
5. Notify Admin: "Cần reschedule cho BN [tên]"
```

**System auto-cancel:**
```
1. slot.status = 'expired'
2. LichHen.status = 'cancelled', payment_status = 'refunded'
3. LichHen: admin_missed = true (field mới — dùng cho audit)
4. Notify BN: xin lỗi + hoàn tiền
5. Notify Admin: warning + SLA breach report
```

### 7.3 Thông báo "không tự hủy được" cho BN (≤24h)

```
UI: Ẩn nút "Hủy lịch"
Hiển thị: "Lịch hẹn trong vòng 24 giờ tới không thể tự hủy.
           Vui lòng liên hệ phòng khám: [ThongTinPhongKham.so_dien_thoai]"
Server: Validate thêm — trả 403 nếu BN cố gọi API cancel trực tiếp
```

---

## 8. Pages & Components cần xây dựng

### 8.1 Pages mới (Frontend)

| File | Route | Mô tả |
|---|---|---|
| `pages/client/SpecialtyDoctors.tsx` | `/chuyen-khoa/:slug` | Danh sách BS theo chuyên khoa |
| `pages/client/DoctorDetail.tsx` | `/bac-si/:id` | Profile BS + lịch 7 ngày + thông tin |
| `pages/client/BookingForm.tsx` | `/dat-lich-kham` | Form đặt lịch (nhận state từ router) |
| `pages/client/PaymentPage.tsx` | `/thanh-toan/:token` | Trang trung gian payment (redirect gateway) |
| `pages/client/BookingSuccess.tsx` | `/dat-lich-thanh-cong/:id` | Xác nhận đặt thành công |
| `pages/client/MyAppointments.tsx` | `/lich-hen-cua-toi` | Danh sách lịch hẹn BN |

### 8.2 Components mới

| File | Dùng ở |
|---|---|
| `components/client/DoctorCard.tsx` | SpecialtyDoctors — card compact |
| `components/client/SlotPicker.tsx` | DoctorDetail — date picker + slot grid |
| `components/client/RelatedServices.tsx` | DoctorDetail — bảng giá DV liên quan |
| `components/client/InsuranceBadge.tsx` | DoctorDetail — hiển thị 2 loại BH |
| `components/client/BookingFormPatient.tsx` | BookingForm — form thông tin BN |
| `components/client/FamilyMemberPicker.tsx` | BookingForm — chọn từ nhóm GĐ |
| `components/client/BookingSummary.tsx` | BookingForm — tóm tắt giá + nút submit |

### 8.3 Pages Admin cần mở rộng (C5)

| Thay đổi | Mô tả |
|---|---|
| Sort pending theo `ngay_kham` tăng dần | Urgent first |
| Countdown timer cho mỗi pending | Còn X giờ trước khi auto-cancel |
| Nút "Xác nhận" + "Từ chối (kèm lý do)" | Action chính |
| Badge số lịch pending trên menu | Realtime hoặc polling 30s |
| Mark completed button | Sau khi BN đã khám xong |
| Filter: pending / confirmed / completed / cancelled | Mặc định filter pending |

### 8.4 Pages BS cần điều chỉnh (B3)

- **Xóa:** Nút "Xác nhận" / "Từ chối" lịch hẹn — BS không còn confirm.
- **Giữ:** Xem danh sách lịch đã confirmed + completed + cancelled.
- **Thêm:** Nút "Hủy khẩn cấp" (với confirm dialog + nhập lý do).
- **Thêm:** Hiển thị lý do khám (ly_do_kham) trong detail lịch hẹn.

---

## 9. API Endpoints cần xây dựng

### 9.1 Public / Patient

```
GET  /api/specialties/:slug/doctors
     → Danh sách BS theo chuyên khoa (approved, la_hien=true)
     → Response: [{ bac_si_id, ho_ten, bang_cap, so_nam_kinh_nghiem, gia_kham,
                    diem_danh_gia, bao_hiem, related_services, slot_gan_nhat }]

GET  /api/doctors/:id/profile?specialtyId=xxx
     → Thông tin đầy đủ BS + related_services lọc theo specialtyId

GET  /api/doctors/:id/available-slots?startDate=YYYY-MM-DD&days=7
     → Slots active trong 7 ngày, filter gio_bat_dau >= now+3h
     → Response: { [date]: [{ slot_id, schedule_id, gio_bat_dau, gio_ket_thuc, phong_kham }] }

POST /api/patient/bookings/prepare
     → Tạo pending_booking_token (5 phút TTL, không lock slot)
     → Body: { doctor_id, schedule_id, slot_id, ly_do_kham, patient_info, member_id? }
     → Response: { token, payment_url, gia_kham }

POST /api/patient/bookings/payment-callback   ← Webhook từ gateway
     → Xác nhận payment → atomic slot lock → tạo LichHen + ThanhToan
     → Nếu slot đã bị lock: refund tự động qua gateway → trả lỗi

GET  /api/patient/appointments
     → Danh sách lịch hẹn của BN đang đăng nhập

DELETE /api/patient/appointments/:id
     → BN hủy lịch (validate: status pending/confirmed, thời gian >24h)
```

### 9.2 Admin

```
GET    /api/admin/appointments?status=pending&sort=ngay_kham
       → Danh sách lịch hẹn với filter

PATCH  /api/admin/appointments/:id/confirm
       → confirmed_by = req.user._id, status = 'confirmed'
       → Notify BS + BN

PATCH  /api/admin/appointments/:id/cancel
       → Body: { ly_do_huy } (bắt buộc)
       → status = 'cancelled', payment_status = 'refunded'
       → Trigger refund, notify BN

PATCH  /api/admin/appointments/:id/complete
       → status = 'completed'

GET    /api/admin/clinic-info
PATCH  /api/admin/clinic-info       ← Update ThongTinPhongKham
```

### 9.3 Doctor

```
GET   /api/doctor/appointments?status=confirmed
      → Chỉ xem, không confirm/reject nữa

PATCH /api/doctor/appointments/:id/emergency-cancel
      → Body: { ly_do_khan_cap } (bắt buộc)
      → slot → locked, status → cancelled, payment_status → refunded
      → Priority notify BN + notify Admin
```

---

## 10. Edge Cases & Guards

### 10.1 Race conditions

| Scenario | Guard |
|---|---|
| 2 BN cùng payment callback cho cùng slot | Atomic findOneAndUpdate với filter `slot.status='active'`. Người thua → auto-refund qua gateway |
| 2 Admin cùng confirm 1 pending | findOneAndUpdate với filter `status='pending'`. Người thứ 2 nhận "đã được xác nhận" |
| Admin confirm lịch BN vừa cancel | findOneAndUpdate với filter `status='pending'` → fail gracefully |

### 10.2 Data guards

| Scenario | Guard |
|---|---|
| BN đặt lịch cho trẻ < tuoi_nhan_kham_tu | Client warning khi chọn member + Server 400 khi submit |
| BS suspend giữa session | Server validate `BacSi.trang_thai_duyet='approved'` trong /prepare |
| Slot đã booked khi BN vào payment | Gateway callback: atomic check → fail → refund |
| BN nhập thẳng `/dat-lich-kham` URL | Check `location.state` null → redirect về `/` |
| BN gọi API cancel lịch ≤24h trực tiếp | Server validate thời gian → 403 |
| `phong_kham` slot = null | Fallback: BacSi.phong_kham_mac_dinh → ThongTinPhongKham.dia_chi |
| `related_services[]` rỗng | Ẩn hoàn toàn section trên UI |
| BN chưa đăng nhập click slot | Lưu sessionStorage → redirect login → restore |

### 10.3 Payment edge cases

| Scenario | Xử lý |
|---|---|
| Gateway timeout (BN ngồi chờ mãi) | pending_booking_token hết hạn 5 phút → redirect về form với thông báo |
| BN double-click "Xác nhận đặt khám" | Nút disable sau click 1 lần; server idempotent token |
| Payment success nhưng response không về (mạng mất) | BN vào `/lich-hen-cua-toi` sẽ thấy lịch đã tạo; gateway webhook đã xử lý |
| Gateway báo success nhưng thực ra failed | Signature verify webhook; reject nếu sai |

---

## 11. Mock Data cần cập nhật

### `mock/doctors.ts` — thêm fields mới

```ts
// Thêm vào mỗi doctor object:
bao_hiem: {
  nha_nuoc: false,
  bao_lanh: true,
},
related_services: [
  { id: 'DV001', ten: 'Siêu âm tim', gia: 350000 },
  { id: 'DV002', ten: 'Điện tâm đồ ECG', gia: 150000 },
],
```

### `mock/doctor-schedule.ts` — phải có data 7 ngày tới

Đảm bảo mock slots có `gio_bat_dau >= now + 3h` để visible cho BN.

### `mock/clinic-info.ts` — tạo mới

```ts
export const mockClinicInfo = {
  ten: 'Phòng khám VitaFamily',
  dia_chi: '123 Đường ABC, Phường XYZ, Quận 1, TP.HCM',
  so_dien_thoai: '028 1234 5678',
  gio_lam_viec: '08:00–17:00 Thứ 2 – Thứ 7',
}
```

---

## 12. Impact lên tính năng đã xây dựng

### B3/B4 — Doctor Appointment Management

| Thay đổi | Chi tiết |
|---|---|
| **Xóa** confirm/reject action của BS | BS không còn là người xác nhận |
| **Giữ** cancel khẩn cấp | BS vẫn có quyền hủy với lý do |
| **Giữ** xem danh sách lịch | Chỉ xem confirmed+completed+cancelled |
| **Thêm** emergency-cancel endpoint | Riêng cho BS, slot → locked |
| **Bỏ** payment_deadline auto-cancel cron (đối với clinic) | Slot chỉ lock sau payment, không cần |

### C5 — Admin Appointment Management

| Thay đổi | Chi tiết |
|---|---|
| **Mở rộng** thành màn hình chính | C5 nay là màn hình vận hành cốt lõi |
| **Thêm** confirm/cancel actions | Với countdown + sort urgent first |
| **Thêm** refund tracking | HoanTien records khi cancel |
| **Thêm** mark-completed | Admin đánh dấu sau khi BN khám xong |

---

## 13. Out of Scope (giai đoạn này)

- Online payment gateway thực tế (VNPay/MoMo) — dùng mock/sandbox
- SMS notification — chỉ push + email
- Đặt lịch cho khách vãng lai (chưa đăng nhập) — yêu cầu đăng nhập
- Multi-branch support — chỉ 1 cơ sở (ThongTinPhongKham singleton)
- Reschedule (đổi lịch) — BN phải hủy + đặt lại
- Waitlist khi hết slot — không scope

---

## 14. Thứ tự implementation đề xuất

```
1. [DB] Thêm BacSi.bao_hiem + related_services → migrate mock data + types
2. [BE] GET /api/specialties/:slug/doctors
3. [BE] GET /api/doctors/:id/available-slots (kiểm tra đã có từ B2)
4. [FE] SpecialtyDoctors.tsx + DoctorCard.tsx
5. [FE] DoctorDetail.tsx (SlotPicker + RelatedServices + InsuranceBadge)
6. [FE] BookingForm.tsx + FamilyMemberPicker.tsx
7. [BE] POST /api/patient/bookings/prepare + payment callback (mock)
8. [FE] PaymentPage.tsx + BookingSuccess.tsx
9. [BE] Admin C5 mở rộng (confirm/cancel/complete)
10. [FE] Admin C5 UI mới
11. [BE] Doctor B3 điều chỉnh (xóa confirm, thêm emergency-cancel)
12. [FE] Doctor B3 UI điều chỉnh
13. [BE] Cron jobs (auto-cancel pending qua giờ)
14. [FE] MyAppointments.tsx + cancel flow
```
