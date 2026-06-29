# Design Spec — Soft-lock Slot Thanh Toán (Approach A)

> Ngày tạo: 2026-06-30
> Trạng thái: Đã duyệt
> Phạm vi: Cập nhật luồng thanh toán từ Phương án C — thêm soft-lock slot 15 phút
> Tham chiếu: `docs/superpowers/specs/2026-06-27-booking-flow-design.md` (spec gốc)

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

### 4.2 POST `/api/patient/bookings/payment-callback` (webhook VNPay)

Không còn atomic race-condition guard — slot đã được lock từ bước /prepare.

```
Server:
  1. Verify VNPay HMAC signature → 400 nếu sai
  2. Lookup pending_booking bằng token trong vnp_TxnRef
  3a. SUCCESS (vnp_ResponseCode = '00'):
       → Atomic update: slot.status='booked', benh_nhan_id=user_id,
                        lock_expires_at=null
       → Tạo LichHen { status:'pending', payment_status:'paid',
                        pending_booking_id: token, ... }
       → Tạo ThanhToan { status:'paid', gateway_transaction_id: vnp_TransactionNo,
                          ngay_thanh_toan: now }
       → Xóa pending_booking record
       → Notify Admin (push + badge)
       → Redirect: /dat-lich-thanh-cong/:lichHenId

  3b. FAIL / HỦY / TIMEOUT:
       → slot.status='active', lock_expires_at=null
       → Xóa pending_booking record
       → Không tạo LichHen, không tạo ThanhToan
       → Redirect: /dat-lich-kham?error=payment_failed
```

### 4.3 GET `/api/doctors/:id/available-slots` (thêm lazy check)

```js
// Filter slot trả về FE:
const now = new Date()
const visibleSlots = schedule.slots.filter(slot =>
  slot.status === 'active' ||
  (slot.status === 'pending_payment' && slot.lock_expires_at < now)
)

// Lazy reset (fire-and-forget, không block response):
// Dùng arrayFilters thay vì index-based để tránh race khi array thay đổi giữa chừng
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

### 5.3 PaymentPage.tsx — countdown (route: `/thanh-toan/:token`)

```tsx
// Nhận từ navigate state: { vnpay_url, lock_expires_at, doctorId }

const [timeLeft, setTimeLeft] = useState<number>(0) // giây còn lại

useEffect(() => {
  // Redirect sang VNPay ngay khi load trang
  window.location.href = vnpay_url

  // Countdown cho khi BN quay lại tab này
  const end = new Date(lock_expires_at).getTime()
  const tick = setInterval(() => {
    const left = Math.max(0, Math.floor((end - Date.now()) / 1000))
    setTimeLeft(left)
    if (left === 0) {
      clearInterval(tick)
      toast.error('Thời gian giữ slot đã hết. Vui lòng đặt lại.')
      navigate('/bac-si/' + doctorId)
    }
  }, 1_000)
  return () => clearInterval(tick)
}, [])

// UI:
// "Đang chuyển đến trang thanh toán VNPay..."
// "Vui lòng hoàn tất trong: MM:SS"
// Progress bar giảm dần (width = timeLeft / 900 * 100%)
```

---

## 6. Cron Jobs (cập nhật)

```
Cron 1 — Mỗi 5 phút (MỚI):
  Mục đích: Giải phóng slot pending_payment đã hết hạn
  Query: LichLamViec.slots WHERE status='pending_payment'
                               AND lock_expires_at < now
  Action: status='active', lock_expires_at=null, benh_nhan_id=null
          + Xóa pending_booking record tương ứng

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
| BN submit form 2 lần nhanh | Nút disable sau click 1 lần (BookingForm); server idempotent — lần 2 tạo token mới nhưng atomic lock đã có → 409 |
| BN đóng tab sau khi redirect VNPay | Cron 5 phút tự giải phóng slot sau khi lock_expires_at hết hạn |
| VNPay webhook đến chậm hơn 15 phút | Cron có thể đã reset slot về active. Webhook đến: slot đã active → thực hiện lại atomic lock trước khi booked. Nếu slot đã booked bởi người khác → rollback + refund gateway |
| BN vào thẳng `/thanh-toan/:token` không có state | `location.state` null → redirect về `/` |
| 2 admin confirm cùng lúc 1 pending LichHen | Giữ nguyên guard từ spec cũ: `findOneAndUpdate filter status='pending'` |

---

## 8. Thứ tự Implementation

```
1. [DB] Thêm pending_payment + lock_expires_at vào LichLamViec.slots
2. [DB] Thêm pending_booking_id vào LichHen
3. [BE] Cập nhật POST /api/patient/bookings/prepare (atomic lock)
4. [BE] Cập nhật POST /api/patient/bookings/payment-callback (bỏ race guard)
5. [BE] Cập nhật GET /api/doctors/:id/available-slots (lazy check)
6. [BE] Cron 1: giải phóng pending_payment hết hạn (mỗi 5 phút)
7. [FE] SlotPicker.tsx: thêm polling 30 giây
8. [FE] BookingForm.tsx: xử lý 409 → redirect chọn lại slot
9. [FE] PaymentPage.tsx: countdown từ lock_expires_at
```

---

## 9. Out of Scope

- Thanh toán MoMo / chuyển khoản (chỉ VNPay trong DATN)
- Đặt cọc một phần
- SMS notification
- WebSocket real-time (dùng polling 30s thay thế)
