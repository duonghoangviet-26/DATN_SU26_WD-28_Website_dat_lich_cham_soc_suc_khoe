# Design Spec — Soft-lock Slot Thanh Toán (Approach A)

> Ngày tạo: 2026-06-30
> Trạng thái: Đã duyệt
> Phạm vi: Cập nhật luồng thanh toán từ Phương án C — thêm soft-lock slot 15 phút
> Tham chiếu: `docs/superpowers/specs/2026-06-27-booking-flow-design.md` (spec gốc)
>
> ⚠️ **Đã sửa đổi 2026-07-02:** bước 3a (IPN SUCCESS) tạo `LichHen` với `status:'confirmed'` thay vì `status:'pending'` — bỏ bước Admin xác nhận cho clinic. TTL soft-lock 15 phút trong doc này **giữ nguyên, không đổi**. Xem `docs/superpowers/specs/2026-07-02-clinic-auto-confirm-decision.md`.

---

## 1. Vấn đề cần giải quyết

Phương án C (spec 2026-06-27) không lock slot trước khi BN redirect sang VNPay. Hai BN có thể cùng thanh toán cho cùng 1 slot — người thua race condition bị auto-refund sau khi đã chuyển tiền → UX xấu.

**Giải pháp:** Soft-lock slot ngay tại `POST /prepare` với TTL 15 phút (phù hợp VNPay webhook xác nhận tức thì). Slot bị ẩn khỏi lịch trong thời gian giữ.

---

## 2. Phạm vi thay đổi

### Thay đổi so với spec cũ

| Phần | Thay đổi |
|---|---|
| `LichLamViec.slots` schema | Thêm enum `pending_payment` + field `lock_expires_at` |
| `LichHen` schema | Thêm field `pending_booking_id` (audit) |
| `POST /prepare` | Atomic lock slot ngay, TTL 15 phút |
| `POST /payment-callback` | Bỏ race-condition guard (không cần nữa) |
| `GET /available-slots` | Thêm lazy-check lọc `pending_payment` hết hạn |
| `PaymentPage.tsx` | Countdown từ `lock_expires_at` |
| `SlotPicker.tsx` | Polling 30 giây |
| Cron mới | Mỗi 5 phút dọn `pending_payment` hết hạn |

### Giữ nguyên từ spec cũ

- Toàn bộ luồng Admin confirm (Section 6 spec cũ)
- LichHen / ThanhToan state machine
- Cancellation policy (ma trận quyền hủy)
- Cron auto-cancel `confirm_deadline` (Cron 2)
- Tất cả API Admin và Doctor

---

## 3. Thay đổi Database Schema

### 3.1 LichLamViec.slots

```js
// Thêm vào slotSchema:
status: {
  enum: ['active', 'pending_payment', 'booked', 'locked', 'cancelled', 'expired'],
  // pending_payment: slot đang bị BN giữ trong khi thanh toán VNPay
},
lock_expires_at: { type: Date, default: null },
// null khi active / booked / locked / expired
// Set = now + 15min khi status → 'pending_payment'
// Reset = null khi status → 'active' hoặc 'booked'
```

**State machine slot (cập nhật):**

```
active
  │
  └── POST /prepare (atomic)
          ↓
    pending_payment ──── lock_expires_at < now ──→ active (cron/lazy reset)
          │
          ├── VNPay SUCCESS  ──→ booked  (lock_expires_at = null)
          └── VNPay FAIL/HỦY ──→ active  (lock_expires_at = null)

booked ──── hủy lịch ──→ active
       ──── BS hủy khẩn ──→ locked
       ──── quá ngày ──→ expired
```

### 3.2 LichHen

```js
// Thêm:
pending_booking_id: { type: String, default: null },
// UUID token tạo tại /prepare — dùng để match callback VNPay
// Giữ lại sau khi LichHen tạo xong để audit dispute
```

---

## 4. API Changes

### 4.1 POST `/api/patient/bookings/prepare` (thay đổi chính)

**Trước:** Tạo token 5 phút, không lock slot.

**Sau:**

```
Body: {
  doctor_id, schedule_id, slot_id,
  ly_do_kham, patient_info, member_id?
}

Luồng server:
  1. Validate: BN đăng nhập, BS approved, slot status='active'
  2. Atomic findOneAndUpdate:
       filter: { _id: schedule_id,
                 slots: { $elemMatch: { _id: slot_id, status: 'active' } } }
       update: { $set: { 'slots.$.status': 'pending_payment',
                         'slots.$.lock_expires_at': new Date(Date.now() + 15*60*1000) } }
     → Thất bại → 409 "Slot không còn khả dụng, vui lòng chọn giờ khác"
  3. Tạo pending_booking { token: uuid, slot_id, schedule_id, user_id,
                           patient_info, expires_at: lock_expires_at }
  4. Gọi VNPay SDK tạo payment URL

Response 200:
{
  token: "550e8400-e29b-41d4-a716-446655440000",
  vnpay_url: "https://sandbox.vnpayment.vn/paymentv2/...",
  lock_expires_at: "2026-06-30T10:15:00.000Z",
  gia_kham: 350000
}
```

### 4.2 VNPay có 2 callback riêng biệt

VNPay gọi cả hai sau khi BN thanh toán:
- **IPN** (`POST /api/patient/bookings/vnpay-ipn`): Server-to-server. VNPay gọi trực tiếp vào backend. Phải trả JSON `{"RspCode":"00","Message":"Confirm Success"}`.
- **Return URL** (`GET /api/patient/bookings/vnpay-return`): Browser redirect. BN's trình duyệt được redirect về URL này sau khi thanh toán.

**Không nhầm hai endpoint này.** IPN xử lý nghiệp vụ. Return URL chỉ redirect FE.

---

#### POST `/api/patient/bookings/vnpay-ipn` (IPN — server-to-server)

```
Server:
  1. Verify VNPay HMAC signature
     → Sai signature: trả { RspCode: '97', Message: 'Invalid Checksum' } — không xử lý
  2. Lookup pending_booking bằng vnp_TxnRef (token)
     → Không tìm thấy (đã bị cron xóa vì timeout):
        → Gọi VNPay Refund API nếu SUCCESS, hoặc bỏ qua nếu FAIL
        → Trả { RspCode: '01', Message: 'Order not found' }
        → Kết thúc — không crash, không retry
  3a. SUCCESS (vnp_ResponseCode = '00'):
       → Atomic update LichLamViec:
           slot.status='booked', benh_nhan_id=user_id, lock_expires_at=null
       → Tạo LichHen { status:'confirmed', payment_status:'paid',
                        pending_booking_id: token }
       // 2026-07-02: auto-confirm — không còn 'pending' chờ Admin duyệt cho clinic
       → Tạo ThanhToan { status:'paid', gateway_transaction_id: vnp_TransactionNo,
                          ngay_thanh_toan: now }
       → Xóa pending_booking record
       → Notify Admin (push + badge)
       → Trả { RspCode: '00', Message: 'Confirm Success' }

  3b. FAIL / HỦY (vnp_ResponseCode != '00'):
       → slot.status='active', lock_expires_at=null
       → Xóa pending_booking record
       → Không tạo LichHen, không tạo ThanhToan
       → Trả { RspCode: '00', Message: 'Confirm Success' }
       (Vẫn trả '00' để VNPay không retry — nghiệp vụ đã xử lý đúng)
```

#### GET `/api/patient/bookings/vnpay-return` (Return URL — browser redirect)

```
Server:
  1. Verify HMAC signature của query params
  2. Đọc vnp_ResponseCode và vnp_TxnRef
  3a. SUCCESS ('00') AND LichHen tồn tại với pending_booking_id = token:
       → Redirect: /dat-lich-thanh-cong/:lichHenId
  3b. FAIL hoặc LichHen chưa tạo (IPN chưa xử lý xong):
       → Redirect: /dat-lich-kham?error=payment_failed

Lưu ý: Return URL chỉ redirect — không tạo LichHen (IPN đã làm).
Nếu IPN đến sau Return URL (race): Return URL redirect về /dat-lich-kham,
BN thấy lỗi tạm thời nhưng LichHen vẫn được tạo sau đó bởi IPN.
```

### 4.3 GET `/api/doctors/:id/available-slots` (thêm lazy check)

```js
// Chỉ trả về slot status='active' — KHÔNG bao gồm pending_payment dù đã hết hạn.
// Lý do: nếu trả về slot pending_payment (hết hạn) như 'active', BN click book → /prepare
// filter status='active' → 409 (UX bug: slot trông available nhưng book không được).
const now = new Date()
const visibleSlots = schedule.slots.filter(slot => slot.status === 'active')

// Lazy reset (fire-and-forget): dọn các pending_payment hết hạn để slot
// trở thành 'active' cho lần poll tiếp theo (tối đa 30s sau với polling FE).
// Cron 1 (5 phút) là cơ chế chính — lazy reset chỉ giúp phản hồi nhanh hơn.
const hasExpired = schedule.slots.some(
  s => s.status === 'pending_payment' && s.lock_expires_at < now
)
if (hasExpired) {
  LichLamViec.updateOne(
    { _id: schedule._id },
    { $set: { 'slots.$[el].status': 'active', 'slots.$[el].lock_expires_at': null } },
    { arrayFilters: [{ 'el.status': 'pending_payment', 'el.lock_expires_at': { $lt: now } }] }
  ).catch(() => {}) // fire-and-forget
}
```

---

## 5. Frontend Changes

### 5.1 SlotPicker.tsx — polling 30 giây

```tsx
useEffect(() => {
  fetchSlots()
  const interval = setInterval(fetchSlots, 30_000)
  return () => clearInterval(interval)
}, [doctorId, selectedDate])

// Slot pending_payment → không hiển thị (server đã lọc)
// Sau tối đa 30s, slot được giải phóng sẽ tự xuất hiện lại
```

### 5.2 BookingForm.tsx — xử lý 409

```tsx
try {
  const res = await bookingService.prepare(payload)
  navigate('/thanh-toan/' + res.token, {
    state: { vnpay_url: res.vnpay_url, lock_expires_at: res.lock_expires_at, doctorId }
  })
} catch (err) {
  if (err.status === 409) {
    toast.error('Slot vừa được người khác giữ. Vui lòng chọn giờ khác.')
    navigate('/bac-si/' + doctorId)
  }
}
```

### 5.3 PaymentPage.tsx — loading + redirect (route: `/thanh-toan/:token`)

```tsx
// Nhận từ navigate state: { vnpay_url, lock_expires_at, doctorId }
// Guard: nếu state null (BN vào thẳng URL) → redirect về /

useEffect(() => {
  if (!vnpay_url) { navigate('/'); return }
  // Delay 1.5s để BN đọc thông báo, sau đó redirect sang VNPay
  const timer = setTimeout(() => {
    window.location.href = vnpay_url
  }, 1500)
  return () => clearTimeout(timer)
}, [vnpay_url])

// UI hiển thị trong 1.5 giây:
// Spinner + "Đang chuyển đến trang thanh toán VNPay..."
// "Slot đã được giữ trong 15 phút. Vui lòng hoàn tất thanh toán."
// (Không dùng MM:SS countdown — VNPay đã có timer riêng trên trang của họ.
//  Countdown MM:SS sẽ gây nhầm lẫn vì sau redirect user không còn ở trang này.)
```

**Lý do không countdown MM:SS:**
- Sau `window.location.href = vnpay_url`, trình duyệt rời khỏi trang → setInterval bị kill.
- VNPay đã hiển thị countdown của riêng họ (thường 15 phút).
- Return URL của VNPay sẽ redirect BN sang trang kết quả (success/fail) — không quay lại PaymentPage.

---

## 6. Cron Jobs (cập nhật)

```
Cron 1 — Mỗi 5 phút (MỚI):
  Mục đích: Giải phóng slot pending_payment đã hết hạn
  Query:
    LichLamViec.find({
      slots: { $elemMatch: { status: 'pending_payment', lock_expires_at: { $lt: now } } }
    })
  Action per document:
    LichLamViec.updateMany(
      { 'slots.status': 'pending_payment', 'slots.lock_expires_at': { $lt: now } },
      { $set: { 'slots.$[el].status': 'active', 'slots.$[el].lock_expires_at': null } },
      { arrayFilters: [{ 'el.status': 'pending_payment', 'el.lock_expires_at': { $lt: now } }] }
    )
    // Sau đó xóa các pending_booking record đã hết hạn:
    PendingBooking.deleteMany({ expires_at: { $lt: now } })
  Lưu ý: KHÔNG reset benh_nhan_id — benh_nhan_id không được set trong /prepare
          (chỉ set khi slot → 'booked' ở IPN callback)

Cron 2 — Mỗi 15 phút (GIỮ từ spec cũ):
  Mục đích: Auto-cancel LichHen pending Admin không confirm kịp
  Query: LichHen WHERE status='pending'
                   AND loai_kham='clinic'
                   AND confirm_deadline < now
  Action: status='cancelled', payment_status='refunded',
          admin_missed=true + refund VNPay + notify BN/Admin

Cron 3 — Mỗi ngày 00:05 (GIỮ từ spec cũ):
  Mục đích: Đánh dấu slot quá ngày
  Query: LichLamViec.slots WHERE status='active' AND ngay < today
  Action: batch update status='expired'
```

---

## 7. Edge Cases

| Scenario | Xử lý |
|---|---|
| BN submit form 2 lần nhanh | Nút disable sau click 1 lần; lần 2 atomic lock fail (slot đã `pending_payment`) → 409 ngay, không tạo token |
| BN đóng tab sau khi redirect VNPay | Cron 5 phút reset slot → active. VNPay sẽ gọi IPN (nếu BN đã trả) hoặc không gọi (nếu BN bỏ) |
| IPN đến sau khi cron đã xóa pending_booking | Step 2 IPN: pending_booking not found → nếu SUCCESS gọi VNPay Refund API → trả RspCode '01' (không crash, không retry) |
| Return URL đến trước IPN (race) | Return URL redirect về `/dat-lich-kham?error=payment_failed` tạm thời. IPN xử lý xong → LichHen được tạo. BN vào `/lich-hen-cua-toi` sẽ thấy lịch. Đây là edge case hiếm với VNPay sandbox. |
| BN vào thẳng `/thanh-toan/:token` không có state | `location.state` null → redirect về `/` |
| 2 Admin confirm cùng lúc 1 pending LichHen | Giữ nguyên guard từ spec cũ: `findOneAndUpdate filter status='pending'` |
| Slot `pending_payment` chưa được cron dọn, lazy reset chưa chạy | Slot ẩn khỏi lịch (server trả `status='active'` only). BN phải đợi tối đa 30s (1 poll cycle) để slot hiện lại sau khi lazy reset xong |

---

## 8. Thứ tự Implementation

```
1. [DB] Thêm enum pending_payment + field lock_expires_at vào LichLamViec.slots
2. [DB] Thêm pending_booking_id vào LichHen schema
3. [BE] Tạo PendingBooking model (collection tạm: token, slot_id, schedule_id, user_id, patient_info, expires_at)
4. [BE] Cập nhật POST /api/patient/bookings/prepare (atomic slot lock + tạo pending_booking)
5. [BE] Viết POST /api/patient/bookings/vnpay-ipn (IPN handler: verify → tạo LichHen + ThanhToan)
6. [BE] Viết GET /api/patient/bookings/vnpay-return (Return URL: verify → redirect FE)
7. [BE] Cập nhật GET /api/doctors/:id/available-slots (chỉ active + lazy reset)
8. [BE] Cron 1: giải phóng pending_payment hết hạn + xóa pending_booking hết hạn (mỗi 5 phút)
9. [FE] SlotPicker.tsx: thêm polling 30 giây
10. [FE] BookingForm.tsx: xử lý 409 → toast + redirect chọn lại slot
11. [FE] PaymentPage.tsx: loading spinner + setTimeout redirect (bỏ MM:SS countdown)
```

---

## 9. Out of Scope

- Thanh toán MoMo / chuyển khoản (chỉ VNPay trong DATN)
- Đặt cọc một phần
- SMS notification
- WebSocket real-time (dùng polling 30s thay thế)
