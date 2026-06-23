# B3 — Quản lý Lịch hẹn Bác sĩ

> Cập nhật: 2026-06-23
> Files liên quan: `frontend/src/pages/doctor/DoctorAppointments.tsx`, `frontend/src/services/doctor-appointment.service.ts`, `backend/src/models/LichHen.js`

---

## 1. Luồng nghiệp vụ xác nhận — Luồng C (đang áp dụng)

### Tại sao chọn Luồng C

Luồng cũ (A) yêu cầu bệnh nhân thanh toán trước, bác sĩ mới được xác nhận. Điều này khiến bác sĩ phải **polling thủ công** để biết khi nào bệnh nhân trả tiền — không thực tế và mâu thuẫn về UX.

| | Luồng A (cũ) | Luồng B | **Luồng C (hiện tại)** |
|---|---|---|---|
| BS chủ động kiểm soát lịch | Có | Không | **Có** |
| BS phải check thủ công | Có ❌ | Không | **Không ✓** |
| Tránh slot bị chiếm vô thời hạn | Không | Không | **Có (auto-cancel) ✓** |
| BN được phản hồi sớm | Không | Ngay lập tức | **Nhanh ✓** |

### Luồng C — Từng bước

```
1. BN đặt lịch         → status: 'pending',   payment_status: 'unpaid'
2. BS xác nhận slot    → status: 'confirmed',  payment_status: 'unpaid'
                         payment_deadline = thời điểm confirm + 2 giờ
3. Hệ thống thông báo BN: "Bác sĩ chấp nhận — thanh toán trước {deadline}"
4. BN thanh toán       → payment_status: 'paid', payment_deadline: null
5. [Nếu quá deadline]  → cron auto-cancel, hoàn tiền 0% (chưa thanh toán)
```

---

## 2. Thay đổi DB — `LichHen.js`

Thêm 1 field mới (additive — không phá vỡ logic cũ):

```js
payment_deadline: { type: Date, default: null }
```

| Trường hợp | Giá trị |
|---|---|
| Mới tạo lịch | `null` |
| BS confirm + BN đã paid | `null` (không cần deadline) |
| BS confirm + BN chưa paid | `Date.now() + 2h` |
| BN thanh toán xong | Reset về `null` |
| Lịch bị hủy | `null` |

**Cron query auto-cancel:**
```js
LichHen.find({
  status: 'confirmed',
  payment_status: 'unpaid',
  payment_deadline: { $lt: new Date() }
})
```

---

## 3. Thay đổi Service — `doctor-appointment.service.ts`

### `confirm()` — bỏ guard payment, thêm deadline

```ts
// Cũ — chặn nếu chưa paid
if (appt.payment_status !== 'paid') throw new Error(...)

// Mới — Luồng C: set deadline nếu unpaid
const payment_deadline = appt.payment_status === 'unpaid'
  ? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  : null
appointments = appointments.map((a) =>
  a.id === id ? { ...a, status: 'confirmed', payment_deadline } : a,
)
```

---

## 4. Thay đổi UI — `DoctorAppointments.tsx`

### Nút "Xác nhận" — bỏ điều kiện payment

```tsx
// Cũ
{appt.payment_status === 'paid' && !isExpiredPending(appt) && <button>Xác nhận</button>}

// Mới — chỉ chặn khi hết hạn ngày khám
{!isExpiredPending(appt) && <button>Xác nhận</button>}
```

### Warning trong expanded row — `confirmed + unpaid`

Khi BS đã xác nhận nhưng BN chưa thanh toán, hiển thị banner vàng trong expanded row:

```
⏳ Chờ bệnh nhân thanh toán — trước HH:MM ngày DD/MM/YYYY. Nếu quá hạn, hệ thống sẽ tự động hủy.
```

---

## 5. Trạng thái và quy tắc bất biến

### State machine `status`

```
pending  ──[BS confirm]──▶  confirmed  ──[BS/BN hoàn thành]──▶  completed
   │                            │
   └──[BS từ chối / timeout]──▶ cancelled ◀──[BS hủy]──────────────┘
```

### State machine `payment_status`

```
unpaid  ──[BN thanh toán]──▶  paid  ──[hủy sau khi paid]──▶  refunded
```

### Quy tắc KHÔNG được vi phạm

| # | Quy tắc |
|---|---|
| 1 | `pending + ngay_kham < today` → KHÔNG có nút "Xác nhận" (hết hạn) |
| 2 | `confirm()` PHẢI set `payment_deadline` khi BN chưa paid |
| 3 | `reject()` → nếu `paid` thì `payment_status → refunded` |
| 4 | `cancelConfirmed()` → `payment_status: refunded` luôn 100% |
| 5 | `complete()` KHÔNG set `da_co_ket_qua: true` — chỉ `examinationService.save()` mới set |
| 6 | `cancelled` và `completed` là trạng thái cuối — không đổi ngược lại |
| 7 | `tabCount()` KHÔNG bị ảnh hưởng bởi search hay status filter |

---

## 6. Mock data hiện có (id 1–16)

| ID | Bệnh nhân | Ngày | Status | Payment | Mục đích test |
|---|---|---|---|---|---|
| 1 | Nguyễn Văn An | Hôm nay | confirmed | paid | TC thông thường, có kết quả |
| 2 | Trần Thị Bình | Hôm nay | confirmed | paid | confirmed chưa có kết quả |
| 3 | Hoàng Văn Em | Hôm nay | pending | unpaid | Luồng C: BS confirm → gửi deadline |
| 4 | Võ Thị Hoa | Hôm nay | pending | unpaid | Luồng C: BS confirm → gửi deadline |
| 5 | Phạm Minh Quân | +1 ngày | confirmed | paid | Sắp tới bình thường |
| 6 | Lê Thị Lan | +1 ngày | confirmed | paid | Khám tại nhà |
| 7 | Đặng Văn Quân | +2 ngày | confirmed | paid | Sắp tới |
| 8 | Ngô Thị Tú | -1 ngày | completed | paid | Đã qua, có kết quả |
| 9 | Lý Minh Tuấn | -2 ngày | completed | paid | Đã qua, có kết quả |
| 10 | Phan Văn Hải | -3 ngày | cancelled | refunded | Đã hủy + lý do |
| 11 | Bùi Thị Cẩm | Hôm nay | pending | paid | Test nút "Xác nhận" hiện ngay |
| 12 | Trương Văn Bình | -4 ngày | pending | unpaid | Badge "Hết hạn" |
| 13 | Hoàng Thị Dung | -1 ngày | completed | paid | "Nhập kết quả" (`da_co_ket_qua=false`) |
| 14 | Vũ Thị Mai | +3 ngày | pending | paid | Confirm trước ngày khám |
| 15 | Đinh Văn Sơn | -1 ngày | confirmed | paid | confirmed đã qua, chưa hoàn thành |
| **16** | **Nguyễn Thị Phương** | **+1 ngày** | **confirmed** | **unpaid** | **Luồng C: warning + deadline** |

---

## 7. Backend — việc cần làm khi gắn DB thật

- [ ] `appointmentController.confirm()`: set `payment_deadline = Date.now() + config.PAYMENT_TIMEOUT_HOURS * 3600000` khi `payment_status = 'unpaid'`
- [ ] `paymentController.pay()`: sau khi `payment_status → paid`, reset `payment_deadline = null`
- [ ] Thêm cron job: mỗi 15 phút chạy query `{ status:'confirmed', payment_status:'unpaid', payment_deadline: { $lt: new Date() } }` → auto-cancel + ghi `LichSuLichHen` với `vai_tro: 'system'`
- [ ] Sau khi BS confirm → gửi `ThongBao` cho BN với `tieu_de: "Bác sĩ đã xác nhận lịch hẹn"`, `noi_dung` có deadline
- [ ] `config/appointment.js`: export `PAYMENT_TIMEOUT_HOURS = 2` để dễ điều chỉnh
