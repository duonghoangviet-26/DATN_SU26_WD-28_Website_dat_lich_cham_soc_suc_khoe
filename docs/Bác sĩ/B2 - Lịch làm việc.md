# B2 — Lịch làm việc của bác sĩ

> **Route:** `/doctor/schedule`
> **Actor:** Bác sĩ (đăng nhập + trạng thái duyệt = `approved`)
> **Cập nhật:** 2026-06-24 (v3 — THIẾT KẾ LẠI HOÀN TOÀN)
> **Trạng thái:** ✅ Đã implement (frontend mock) — TBD-1=C, TBD-2=A đã giải đáp và áp dụng

---

## ⚠️ Thay đổi lớn so với v2 (2026-06-23)

| Điểm thay đổi | v2 (cũ) | v3 (mới) |
|---|---|---|
| Ai tạo slot? | Bác sĩ tự thêm | Hệ thống auto-generate |
| Bác sĩ có thể xóa slot? | Có (nút "Xóa") | Không |
| Bác sĩ có thể thêm slot? | Có (nút "Thêm ca mới") | Không |
| Lịch hiển thị | 14 ngày từ hôm nay | Rolling 6 ngày (T2–T7) |
| Slot mỗi ngày | Bác sĩ tự thêm thủ công | Full 8:00–17:30, 30 phút/slot |
| UI layout | Flat list cuộn dài | Accordion: mỗi ngày collapse/expand |
| Quyền bác sĩ | Add, Lock, Unlock, Delete, Edit phòng | Chỉ Lock, Unlock, Yêu cầu hủy, Edit phòng |

---

## 1. Tổng quan nghiệp vụ

Lịch làm việc của bác sĩ là **do hệ thống quản lý**, không phải bác sĩ tự tạo. Mục tiêu:

- **Chuẩn hóa**: mọi bác sĩ đều có lịch đồng nhất T2–T7, 8:00–17:30
- **Chống gian lận**: bác sĩ không thể tự khai khống ngày làm việc để nhận lịch hẹn ảo
- **Trải nghiệm bệnh nhân**: bệnh nhân chỉ thấy 6 ngày tới → không đặt quá xa rồi quên
- **Tự động cập nhật**: hệ thống tự cuộn thêm ngày mới mỗi khi ngày hết hạn

---

## 2. Cơ chế sinh lịch — Rolling Window T2–T7

### 2.1 Nguyên tắc

> **Bệnh nhân luôn thấy đúng 6 ngày làm việc phía trước (T2–T7), cuộn theo ngày.**

```
Hôm nay: T4, 25/6/2026

Window bệnh nhân thấy:
  T4 25/6 ← hôm nay (nếu còn giờ làm việc)
  T5 26/6
  T6 27/6
  T7 28/6
  T2 29/6 ← tự sinh vì T2 tuần này (23/6) đã qua
  T3 30/6 ← tự sinh vì T3 tuần này (24/6) đã qua

Khi T4 25/6 kết thúc (23:59):
  → Hệ thống auto-generate T4 2/7 với đầy đủ slot 8:00–17:30
  → Window mới: T5 26/6, T6 27/6, T7 28/6, T2 29/6, T3 30/6, T4 2/7
```

### 2.2 Quy tắc sinh slot mỗi ngày mới

Mỗi ngày được tạo tự động với **16 slot** — nghỉ trưa 12:00–13:30 **(TBD-1 = C)**:

```
08:00–08:30  08:30–09:00  09:00–09:30  09:30–10:00
10:00–10:30  10:30–11:00  11:00–11:30  11:30–12:00
── nghỉ trưa 12:00–13:30 ──
13:30–14:00  14:00–14:30  14:30–15:00  15:00–15:30
15:30–16:00  16:00–16:30  16:30–17:00  17:00–17:30
```

Tất cả slot sinh ra mặc định: `status = 'active'`, `phong_kham = null`, `benh_nhan_id = null`

### 2.3 Ai trigger sinh lịch? — **TBD-2 = A (Cron tự động)**

| Phương án | Cơ chế | Ưu điểm | Nhược điểm |
|---|---|---|---|
| **✅ A — Cron tự động** | `node-cron` chạy 23:55 mỗi ngày, sinh slot cho T+7 | Không cần thao tác thủ công | Cần đảm bảo cron không fail |
| B — Admin kích hoạt | Admin nhấn "Kích hoạt lịch" trong C2 | Kiểm soát được | Dễ quên, mất ngày |
| C — Hybrid | Admin approve → sinh lần đầu; cron duy trì | Ổn định + kiểm soát | Phức tạp hơn |

> **Quyết định:** Phương án A. Mỗi ngày 23:55, cron job sinh slot mới cho T+7 đối với tất cả bác sĩ đã được duyệt (`trang_thai_duyet = 'approved'`). Nếu cron fail → Admin có thể trigger thủ công qua `POST /api/admin/slots/generate`.

### 2.4 Bác sĩ mới được duyệt

Khi Admin duyệt bác sĩ (C2):
- Hệ thống sinh lịch cho **6 ngày T2–T7 tiếp theo** với đầy đủ slot
- Bác sĩ vào `/doctor/schedule` thấy ngay lịch đã có sẵn

---

## 3. Data Model

### 3.1 Frontend type — `DoctorSlot` (giữ nguyên)

```ts
interface DoctorSlot {
  id: number                       // int (mock) → MongoDB ObjectId (thật)
  ngay: string                     // 'YYYY-MM-DD'
  gio_bat_dau: string              // 'HH:MM'
  gio_ket_thuc: string             // 'HH:MM'
  phong_kham?: string | null       // null = chưa gán phòng → BN không thấy slot này
  benh_nhan?: string | null        // Tên BN đã đặt; null = chưa ai
  benh_nhan_id?: number | null     // ID BN đã đặt
  status: 'active' | 'booked' | 'locked' | 'cancelled' | 'expired'
}
```

### 3.2 Thay đổi Backend — `LichLamViec.js`

Xem mục 11 — giữ nguyên so với v2, chưa cần thay đổi thêm.

---

## 4. Quyền hạn bác sĩ — CHỈ 3 VIỆC

> **Bác sĩ KHÔNG được tạo slot mới, KHÔNG được xóa slot.**
> Slot do hệ thống sinh ra, hệ thống quản lý vòng đời.

| Thao tác | Bác sĩ được phép? | Điều kiện |
|---|---|---|
| Xem lịch làm việc | ✅ | Luôn |
| **Lock slot** ("Tôi bận giờ này") | ✅ | Slot `active`, chưa có BN, ngày ≥ hôm nay |
| **Unlock slot** ("Mở lại") | ✅ | Slot `locked` |
| **Sửa phòng khám** | ✅ | Slot `active` hoặc `locked`, chưa có BN |
| **Yêu cầu hủy slot booked** | ✅ | Slot `booked` — gửi request lên Admin |
| Thêm slot mới | ❌ | Không bao giờ |
| Xóa slot | ❌ | Không bao giờ |
| Đổi giờ slot | ❌ | Không bao giờ |

---

## 5. Trạng thái Slot — State Machine (v3)

### 5.1 Bảng trạng thái

| Status | Nhãn UI | Màu | Ý nghĩa | BN thấy để đặt? |
|---|---|---|---|---|
| `active` | Còn trống | Xanh lá | Hệ thống sinh ra, chờ đặt | **Có** (khi có `phong_kham`) |
| `booked` | Đã có lịch | Xanh dương | BN đã đặt | Không |
| `locked` | Bác sĩ bận | Vàng cam | BS đánh dấu bận tạm thời | Không |
| `cancelled` | Đã hủy | Đỏ | Admin hủy sau khi xử lý BN | Không |
| `expired` | Hết hạn | Xám | Tính toán frontend — qua ngày chưa ai đặt | Không |

### 5.2 State machine (v3 — không có nhánh thêm/xóa bởi BS)

```
[Hệ thống sinh slot lúc 23:55]
            ↓
         active
        /       \
  [BN đặt]   [BS lock]
      ↓             ↓
   booked         locked
      |              |
      |         [BS unlock]
      |              ↓
      |           active
      |
  [BS yêu cầu hủy] → Admin xử lý → cancelled
  [Admin hủy]      → cancelled

  active/locked (qua ngày, chưa ai đặt)
      ↓ (frontend computed)
   expired   ← KHÔNG lưu vào DB, chỉ tính toán hiển thị
```

### 5.3 Điều kiện BN thấy slot

```
status = 'active'
AND ngay >= hôm nay
AND phong_kham IS NOT NULL
AND ngay ∈ rolling window T2–T7
```

---

## 6. Tính năng — Luồng chi tiết

### F1: Xem lịch làm việc

```
Vào /doctor/schedule
→ Load tất cả slot của BS đang đăng nhập (rolling window T2–T7)
→ Accordion: mỗi ngày là 1 row có thể expand/collapse
→ Auto-expand ngày hôm nay
→ Header mỗi ngày: tên ngày + số ca + dot indicator (● booked, ◐ locked, ○ active)
→ Khi expand: danh sách slot với Giờ | Phòng | Badge | Tên BN | Nút thao tác
→ Slot phong_kham=null: warning "⚠ Chưa có phòng — BN không thể đặt ca này"
```

### F2: ~~Thêm ca mới~~ — ĐÃ XÓA

> **Bác sĩ không có quyền thêm ca. Lịch do hệ thống sinh tự động.**
> Nút "Thêm ca mới" và modal form bị xóa hoàn toàn khỏi UI.

### F3: Tạm nghỉ (Lock slot)

```
Click "Tạm nghỉ" (chỉ hiện trên slot active + chưa có BN + ngày ≥ hôm nay)
→ Guard: status = 'active' VÀ benh_nhan_id = null
→ lockSlot() → status = 'locked'
→ Badge: "Bác sĩ bận", nút đổi sang "Mở lại"
→ Slot KHÔNG còn hiển thị cho BN
```

### F4: Mở lại (Unlock slot)

```
Click "Mở lại" (chỉ hiện khi locked)
→ Guard: status = 'locked'
→ unlockSlot() → status = 'active'
→ Slot mở lại (BN thấy nếu có phòng)
```

### F5: ~~Xóa slot~~ — ĐÃ XÓA

> **Bác sĩ không có quyền xóa slot.** Slot do hệ thống sinh, hệ thống quản lý.
> Nếu bác sĩ không cần slot nào, dùng "Tạm nghỉ" để lock.

### F6: Sửa phòng khám (inline edit)

```
Click icon bút chì cạnh tên phòng (hoặc "⚠ Chưa có phòng")
→ Inline input thay thế text tĩnh
→ Nhập tên phòng → Enter để lưu, Esc để hủy
→ Guard: status ∈ ['active', 'locked'] VÀ benh_nhan_id = null
→ updatePhongKham(id, phong_kham_moi)
→ Nếu phong_kham_moi = null → warning "BN sẽ không thấy slot này"

⚠ Giới hạn hiện tại (mock): phòng nhập tay tự do
→ Cần cải thiện (xem mục 10 — Roadmap):
   Dropdown chọn từ danh sách phòng Admin quản lý + check conflict theo giờ
```

### F7: Yêu cầu hủy slot đã có bệnh nhân (NEW)

```
Click "Yêu cầu hủy" (chỉ hiện trên slot booked + ngày ≥ hôm nay)
→ Dialog: nhập lý do hủy (bắt buộc)
→ requestCancelSlot(id, ly_do) → tạo notification cho Admin
→ Slot giữ nguyên status 'booked' cho đến khi Admin xử lý xong
→ Admin xử lý: thông báo BN + hoàn tiền → slot → 'cancelled'

Luồng Admin xử lý (C5):
  Admin nhận request → liên hệ BN → BN chọn:
    ├── Dời sang bác sĩ khác → Admin assign lại
    ├── Dời sang ngày khác → Admin tạo slot mới
    └── Hoàn tiền hoàn toàn → Admin refund → slot 'cancelled'
```

---

## 7. UI Layout — Accordion (v3)

### 7.1 Trang chính

```
┌──────────────────────────────────────────────────────────┐
│  Lịch làm việc                                           │
│  Hệ thống tự sinh lịch T2–T7, cập nhật hàng ngày.       │
│                                                          │
│  ┌─ T4 25/6/2026  Hôm nay  ●●○○○○○○○○○○○○○○○○○ ──── ▼ ┐│
│  │ 08:00–08:30  Phòng 201, T2, Tòa A [Đã có lịch]      ││
│  │              👤 Trần Thị Bình                         ││
│  ├───────────────────────────────────────────────────────┤│
│  │ 08:30–09:00  Phòng 201, T2, Tòa A ✏  [Còn trống]    ││
│  │                                [Tạm nghỉ]            ││
│  ├───────────────────────────────────────────────────────┤│
│  │ 09:00–09:30  ⚠ Chưa có phòng ✏    [Còn trống]       ││
│  │                                [Tạm nghỉ]            ││
│  ├───────────────────────────────────────────────────────┤│
│  │ 09:30–10:00  Phòng 305, T3, Tòa B  [Bác sĩ bận]     ││
│  │                                [Mở lại]              ││
│  │ ... (thêm 15 slot nữa)                               ││
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─ T5 26/6/2026          ○○○○○○○○○○○○○○○○○○○ ─────  ▶ ┐│  ← collapsed
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  ┌─ T6 27/6/2026          ○○○○○○○○○○○○○○○○○○○ ─────  ▶ ┐│  ← collapsed
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  (T7 28/6, T2 29/6, T3 30/6 tương tự)                   │
└──────────────────────────────────────────────────────────┘
```

### 7.2 Dot indicator (header mỗi ngày)

```
● xanh = booked  ◑ vàng = locked  ○ xám = active/expired
Ví dụ: ●●○○○○○○○○○○○○○○○○○ = 2 booked, 17 active/trống
```

→ Nhìn một cái biết ngay ngày đó bận thế nào, không cần expand.

### 7.3 Nút thao tác theo trạng thái (v3)

| Status | Ngày | Nút hiển thị |
|---|---|---|
| `active` + BN=null | Hôm nay / Tương lai | `✏ (sửa phòng)` + `[Tạm nghỉ]` |
| `booked` | Hôm nay / Tương lai | `[Yêu cầu hủy]` (màu cam) |
| `booked` | Đã qua | _(không có nút — lịch sử)_ |
| `locked` | Hôm nay / Tương lai | `✏ (sửa phòng)` + `[Mở lại]` |
| `cancelled` | Bất kỳ | _(không có nút)_ |
| `expired` | Bất kỳ | _(không có nút)_ |
| Bất kỳ | Đã qua | _(không có nút)_ |

---

## 8. Service API — v3

```ts
scheduleService = {
  // ✅ Giữ
  getAll(): Promise<DoctorSlot[]>
  // → rolling window T2–T7, sort ngay ASC + gio_bat_dau ASC

  // ✅ Giữ
  lockSlot(id): Promise<DoctorSlot>
  // Guard: status = 'active'          → reject 'Chỉ tạm nghỉ slot đang active'
  // Guard: benh_nhan_id = null        → reject 'Không thể khóa slot đã có BN'
  // → status: 'active' → 'locked'

  // ✅ Giữ
  unlockSlot(id): Promise<DoctorSlot>
  // Guard: status = 'locked'          → reject 'Chỉ mở lại slot đang bị khóa'
  // → status: 'locked' → 'active'

  // ✅ Giữ
  updatePhongKham(id, phong_kham: string | null): Promise<DoctorSlot>
  // Guard: benh_nhan_id = null        → reject 'Không sửa phòng khi đã có BN'
  // Guard: status ∈ ['active','locked'] → reject 'Chỉ sửa phòng khi active/locked'
  // → cập nhật phong_kham

  // 🆕 MỚI — thay thế cancelSlot() expose trực tiếp
  requestCancelSlot(id, ly_do: string): Promise<void>
  // Guard: status = 'booked'          → chỉ slot booked mới cần request
  // Guard: ly_do không được rỗng     → reject 'Bắt buộc nhập lý do'
  // → tạo CancelRequest cho Admin, slot giữ nguyên 'booked'

  // ❌ XÓA — bác sĩ không được thêm slot
  // addSlot(...)  → REMOVED từ doctor service

  // ❌ XÓA — bác sĩ không được xóa slot
  // deleteSlot(id)  → REMOVED từ doctor service

  // 🔒 Internal only — Admin dùng sau khi xử lý xong request hủy
  // cancelSlot(id)  → chỉ gọi từ Admin flow, không expose trong doctor service
}
```

---

## 9. Mock Data — Cần viết lại

### 9.1 Cấu trúc mock mới

```ts
// Tính rolling window: 6 ngày T2–T7 phía trước
function getRollingWindow(): string[] {
  // → trả về mảng 6 ngày YYYY-MM-DD gần nhất (T2–T7)
  // Ví dụ hôm nay T4 25/6: ['2026-06-25','2026-06-26','2026-06-27','2026-06-28','2026-06-29','2026-06-30']
}

// Sinh full slots cho 1 ngày
function generateDaySlots(ngay: string, startId: number): DoctorSlot[] {
  // → 19 slot (hoặc 17 nếu bỏ trưa) mỗi slot status='active', phong_kham=null
}

// mockSlots = toàn bộ 6 ngày × 19 slot = ~114 slot
// Vài slot được set thủ công: booked (có BN), locked, phong_kham có sẵn
```

### 9.2 Slots điển hình cần có trong mock để test UI

| Ngày | Giờ | Status | Phòng | BN | Mục đích test |
|---|---|---|---|---|---|
| Hôm nay | 08:00–08:30 | `booked` | Phòng 201 | Trần Thị Bình | Nút "Yêu cầu hủy" |
| Hôm nay | 09:00–09:30 | `locked` | Phòng 201 | — | Nút "Mở lại" |
| Hôm nay | 10:00–10:30 | `active` | null | — | Warning chưa có phòng |
| Ngày mai | 08:00–08:30 | `booked` | Phòng 305 | Phạm Minh Quân | Lịch sử |
| +2 ngày | all | `active` | null | — | Ngày chưa có gì |

---

## 10. Roadmap — Cần làm thêm (không block MVP)

### P1 — Phòng khám từ dropdown (thay free-text)

**Vấn đề hiện tại:** Bác sĩ tự nhập tên phòng → có thể sai, trùng với bác sĩ khác cùng giờ.

**Giải pháp:**
```
Admin (C3 — Quản lý bệnh viện) → quản lý danh sách phòng:
  [{ id, ten_phong: 'Phòng 201', tang: 2, toa: 'A', loai: 'Khám thông thường' }]

Bác sĩ chọn phòng → dropdown → hệ thống check xem phòng đó đã bị slot khác chiếm chưa:
  Điều kiện conflict: cùng phòng + trùng giờ + status ∈ ['active','booked','locked']
```

### P2 — Undo khi lock nhầm

Hiện tại lock nhầm → bấm "Mở lại" để undo. Đủ dùng cho MVP.

### P3 — Thống kê ngày làm việc

Admin xem được bác sĩ trong tháng có bao nhiêu slot booked/locked/expired → dùng cho đánh giá hiệu suất.

---

## 11. Backend — Thay đổi khi gắn DB thật

### 11.1 `LichLamViec.js` — giữ nguyên từ v2

```js
// Đã xóa so_benh_nhan_toi_da, so_benh_nhan_hien_tai
// Đã thêm benh_nhan_id: ObjectId ref NguoiDung
```

### 11.2 Endpoint bổ sung cho v3

| Method | Endpoint | Mô tả | Role |
|---|---|---|---|
| `GET` | `/api/doctor/slots` | Rolling window T2–T7 của BS | Doctor |
| `PATCH` | `/api/doctor/slots/:id/lock` | Tạm nghỉ | Doctor |
| `PATCH` | `/api/doctor/slots/:id/unlock` | Mở lại | Doctor |
| `PATCH` | `/api/doctor/slots/:id/phong-kham` | Sửa phòng | Doctor |
| `POST` | `/api/doctor/slots/:id/request-cancel` | Yêu cầu hủy slot booked | Doctor |
| `POST` | `/api/admin/slots/generate` | Sinh lịch thủ công | Admin |
| — | node-cron 23:55 | Auto-sinh slot ngày mới | System |

### 11.3 Endpoint bị xóa (bác sĩ không còn dùng)

| Method | Endpoint cũ | Lý do xóa |
|---|---|---|
| `POST` | `/api/doctor/slots` | Bác sĩ không được tạo slot |
| `DELETE` | `/api/doctor/slots/:id` | Bác sĩ không được xóa slot |

### 11.4 Atomic slot booking (giữ nguyên từ v2)

```js
LichLamViec.findOneAndUpdate(
  { _id: schedule_id, 'slots._id': slot_id, 'slots.status': 'active', 'slots.benh_nhan_id': null },
  { $set: { 'slots.$.status': 'booked', 'slots.$.benh_nhan_id': user_id } },
  { new: true }
)
```

---

## 12. Quyết định thiết kế — Đã giải đáp

### [TBD-1] Giờ nghỉ trưa → **C: Nghỉ 12:00–13:30 (16 slot/ngày)**

| Phương án | Số slot/ngày | Tổng thời gian làm | Kết quả |
|---|---|---|---|
| A — Không nghỉ | 19 slot | 9.5h (8:00–17:30) | |
| B — Nghỉ 12:00–13:00 | 17 slot | 8.5h | |
| **C — Nghỉ 12:00–13:30** | **16 slot** | **8h** | **✅ Đã chọn** |

Áp dụng: mock data, service test (count=96), backend cron job.

### [TBD-2] Cơ chế trigger sinh lịch → **A: Cron job 23:55**

Xem chi tiết tại mục 2.3. Áp dụng: backend `node-cron`, endpoint `/api/admin/slots/generate`.

---

## 13. Checklist implement

- [x] **1.** Viết lại `frontend/src/mock/doctor-schedule.ts` — rolling window 6 ngày, 16 slot/ngày (96 slot)
- [x] **2.** Cập nhật `frontend/src/services/schedule.service.ts` — xóa `addSlot`, `deleteSlot`; thêm `requestCancelSlot`
- [x] **3.** Viết lại `frontend/src/pages/doctor/DoctorSchedule.tsx` — accordion UI, xóa modal/nút thêm, thêm F7 "Yêu cầu hủy"
- [x] **4.** Cập nhật `frontend/src/__tests__/services/schedule.service.test.ts` — 50 tests, xóa addSlot/deleteSlot, thêm requestCancelSlot
- [ ] **5.** Cập nhật `docs/DB_GAP_ANALYSIS.md` — bổ sung endpoint mới, endpoint xóa
- [ ] **6.** Backend: cron job `node-cron` 23:55 sinh slot + endpoint `POST /api/admin/slots/generate`
