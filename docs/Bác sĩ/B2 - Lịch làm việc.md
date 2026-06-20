# B2 — Lịch làm việc của bác sĩ

> **Route:** `/doctor/schedule`
> **Actor:** Bác sĩ (đăng nhập + trạng thái duyệt = `approved`)
> **Trạng thái:** ✅ **Hoàn chỉnh với mock data** — toàn bộ UI + logic nghiệp vụ đã được triển khai và kiểm thử.

---

## 1. Tổng quan nghiệp vụ

Bác sĩ cần quản lý ca làm việc của mình để:

- Bệnh nhân biết khung giờ nào còn trống để đặt lịch.
- Bác sĩ có thể chủ động khóa giờ khi bận, không cần xóa ca.
- Hệ thống đảm bảo không ai đặt vào slot đã bận hoặc chưa có phòng.

---

## 2. Khái niệm cốt lõi — Slot là gì?

**Slot** = một ca làm việc cụ thể của bác sĩ:

| Trường | Ví dụ |
|---|---|
| Ngày | 20/06/2026 |
| Giờ bắt đầu | 08:00 |
| Giờ kết thúc | 08:30 |
| Phòng | Phòng 201, Tầng 2, Tòa A |

**Quy tắc quan trọng nhất:**

> Mỗi slot = đúng 1 bệnh nhân. Không cho nhiều bệnh nhân vào cùng 1 slot.

Khi bệnh nhân đặt và thanh toán thành công → slot chuyển sang `booked` → không ai khác đặt được nữa.

---

## 3. Data Model

```ts
interface DoctorSlot {
  id: number
  ngay: string              // 'YYYY-MM-DD'
  gio_bat_dau: string       // 'HH:MM'
  gio_ket_thuc: string      // 'HH:MM'
  phong_kham?: string | null  // "Phòng 201, Tầng 2, Tòa A" — để null nếu chưa xác định
  benh_nhan?: string | null   // Tên bệnh nhân đã đặt (null = chưa ai đặt)
  benh_nhan_id?: number | null
  status: 'active' | 'booked' | 'locked' | 'cancelled' | 'expired'
}
```

### So với model cũ — những gì thay đổi

| Field | Cũ | Mới | Lý do |
|---|---|---|---|
| `so_benh_nhan_toi_da` | Có (default 5) | **Bỏ** | Không cần, slot = 1 người |
| `so_benh_nhan_hien_tai` | Có | **Bỏ** | Thay bằng `status === 'booked'` |
| `phong_kham` | Không có | **Thêm** | Bệnh nhân cần biết đến phòng nào |
| `benh_nhan` | Không có | **Thêm** | Bác sĩ cần xem ai đã đặt |
| `status` | 3 giá trị | **5 giá trị** | Đủ để phân biệt mọi trạng thái |

---

## 4. Trạng thái Slot

| Status | Nhãn hiển thị | Màu | Ý nghĩa | Bệnh nhân thấy? |
|---|---|---|---|---|
| `active` | Còn trống | Xanh lá | Mở, bệnh nhân có thể đặt | **Có** (khi có phòng) |
| `booked` | Đã có lịch | Xanh dương | Bệnh nhân đã đặt + thanh toán | Không (đã kín) |
| `locked` | Bác sĩ bận | Vàng cam | Bác sĩ tự đánh dấu bận | Không |
| `cancelled` | Đã hủy | Đỏ | Ca bị hủy | Không |
| `expired` | Hết hạn | Xám | Đã qua ngày, không ai đặt | Không |

### Quy tắc bệnh nhân thấy slot `active`

Bệnh nhân chỉ thấy slot này để đặt khi **đồng thời** thỏa mãn:
```
status = 'active'
AND ngay >= hôm nay
AND phong_kham != null  (đã có phòng)
```

Nếu `phong_kham = null` → slot vẫn active nhưng bệnh nhân không thấy.

---

## 5. Quy tắc nghiệp vụ (Business Rules)

### 5.1 Bác sĩ được làm gì?

| Thao tác | Điều kiện |
|---|---|
| Xem toàn bộ slot của mình | Luôn được |
| Thêm slot mới | `ngay >= hôm nay` |
| Khóa slot (Bác sĩ bận) | `status = 'active'` + `benh_nhan = null` |
| Bỏ khóa | `status = 'locked'` → trở về `active` |
| Xóa slot | `status = 'active'` + `benh_nhan = null` (chưa ai đặt) |
| Hủy slot | Chỉ khi `status ≠ 'booked'` và `status ≠ 'cancelled'` |

### 5.2 Bác sĩ KHÔNG được làm gì?

> **Slot đã có bệnh nhân (`booked`) không được xóa hoặc sửa giờ trực tiếp.**
>
> Lý do: bệnh nhân đã thanh toán 100%. Nếu cần hủy, phải qua Admin để xử lý hoàn tiền.

### 5.3 Slot quá ngày

- Quá ngày + chưa có ai đặt (`status = 'active'`) → tự động hiển thị là `expired`
- Quá ngày + có bệnh nhân (`status = 'booked'`) → giữ nguyên, thuộc lịch sử

---

## 6. Luồng chính (User Flows)

### F1: Xem lịch làm việc
```
Vào /doctor/schedule
→ Load danh sách slot của bác sĩ (7 ngày tới + các ngày đã qua có slot)
→ Nhóm theo ngày
→ Mỗi slot hiển thị: Giờ | Phòng | Trạng thái | Tên bệnh nhân (nếu booked)
→ Slot quá ngày → mờ đi, không hiển thị nút thao tác
```

### F2: Thêm ca mới
```
Click "Thêm ca mới"
→ Modal: chọn Ngày, Giờ bắt đầu, Giờ kết thúc, điền Phòng khám (tuỳ chọn)
→ Validate:
   - Ngày >= hôm nay
   - Giờ kết thúc > giờ bắt đầu
→ Tạo slot mới với status = 'active'
→ Nếu phong_kham = null → hiển thị warning "Bệnh nhân chưa thể đặt"
```

### F3: Khóa ca
```
Click "Khóa" trên slot active + chưa có bệnh nhân
→ Xác nhận: "Đánh dấu bận ca này?"
→ status → 'locked'
→ Badge chuyển "Bác sĩ bận", nút "Bỏ khóa" xuất hiện
→ Slot không còn hiển thị cho bệnh nhân
```

### F4: Bỏ khóa
```
Click "Bỏ khóa" trên slot locked
→ status → 'active'
→ Slot mở lại (bệnh nhân có thể đặt nếu có phòng)
```

### F5: Xóa ca
```
Click "Xóa" trên slot active + chưa có bệnh nhân
→ Xác nhận
→ Xóa slot khỏi danh sách
```

---

## 7. UI Layout chi tiết

### 7.1 Trang chính

```
┌──────────────────────────────────────────────────────────┐
│  Lịch làm việc                           [+ Thêm ca mới] │
│  Quản lý ca làm việc trong 7 ngày tới                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [20] 20/06 Thứ Sáu   Hôm nay                   3 ca   │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 🕐 08:00 – 08:30  📍 Phòng 201, T2, Tòa A        │  │
│  │                    [Đã có lịch]  Nguyễn Văn An    │  │
│  ├────────────────────────────────────────────────────┤  │
│  │ 🕐 08:30 – 09:00  📍 Phòng 201, T2, Tòa A        │  │
│  │                    [Còn trống]   [🔒 Khóa] [🗑 Xóa]│ │
│  ├────────────────────────────────────────────────────┤  │
│  │ 🕐 09:00 – 09:30  ⚠️ Chưa có phòng               │  │
│  │                    [Còn trống]   [🔒 Khóa] [🗑 Xóa]│ │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  [21] 21/06 Thứ Bảy                              2 ca   │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 🕐 14:00 – 14:30  📍 Phòng 305, T3, Tòa B        │  │
│  │                    [Bác sĩ bận]  [Bỏ khóa]       │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 7.2 Màu sắc và badge

| Status | Badge | Màu nền badge |
|---|---|---|
| `active` | Còn trống | Xanh lá (`green`) |
| `booked` | Đã có lịch | Xanh dương (`blue`) |
| `locked` | Bác sĩ bận | Vàng cam (`yellow`) |
| `cancelled` | Đã hủy | Đỏ (`red`) |
| `expired` | Hết hạn | Xám (`gray`) |

### 7.3 Nút thao tác theo trạng thái

| Status | Nút hiển thị |
|---|---|
| `active` + chưa có BN + ngày tương lai | `🔒 Khóa` + `🗑 Xóa` |
| `booked` | _(không có nút — không được sửa)_ |
| `locked` | `Bỏ khóa` |
| `cancelled` hoặc `expired` | _(không có nút)_ |
| Ngày đã qua | _(không có nút — dù status nào)_ |

### 7.4 Form thêm ca mới

```
Ngày làm việc    [date picker, min = hôm nay]
Giờ bắt đầu     [select: 07:00, 07:30 ... 17:00]
Giờ kết thúc    [select: 07:30, 08:00 ... 17:30]
Phòng khám      [text: "VD: Phòng 201, Tầng 2, Tòa A"]  ← tuỳ chọn

Ghi chú dưới form:
⚠️ Nếu chưa điền phòng, bệnh nhân sẽ chưa thể đặt lịch vào ca này.
```

---

## 8. Hiện trạng code — ✅ Hoàn chỉnh

### 8.1 Đã triển khai đầy đủ

| Thành phần | File | Chi tiết |
|---|---|---|
| `DoctorSlot` type đầy đủ | `types/index.ts` | `id, ngay, gio_bat_dau, gio_ket_thuc, phong_kham, benh_nhan, benh_nhan_id, status` |
| 5 trạng thái slot | `types/index.ts` | `active \| booked \| locked \| cancelled \| expired` |
| Mock data 18 slot | `mock/doctor-schedule.ts` | Span -1 đến +4 ngày (hôm qua, hôm nay, 5 ngày tới), đủ mọi trạng thái |
| Service CRUD đầy đủ | `services/schedule.service.ts` | `getAll, addSlot, lockSlot, unlockSlot, cancelSlot, deleteSlot` |
| Layout nhóm theo ngày | `DoctorSchedule.tsx` | 7 ngày tới + các ngày quá khứ có slot |
| Header ngày nổi bật | `DoctorSchedule.tsx` | Badge số ngày, highlight "Hôm nay", mờ ngày đã qua |
| Hiển thị giờ + phòng + bệnh nhân | `DoctorSchedule.tsx` (SlotRow) | Icon clock, icon hospital, warning "Chưa có phòng" |
| Badge trạng thái màu | `DoctorSchedule.tsx` | `SLOT_STATUS_COLOR` + `SLOT_STATUS_LABEL` map |
| Hiển thị tên bệnh nhân (booked) | `DoctorSchedule.tsx` (SlotRow) | Badge xanh dương với icon user |
| Nút Khóa / Bỏ khóa / Xóa | `DoctorSchedule.tsx` (SlotRow) | Ẩn nút khi ngày đã qua hoặc slot có BN |
| Form thêm ca | `DoctorSchedule.tsx` | Ngày (date picker min=today), giờ BĐ/KT (select), phòng (text tùy chọn) |
| Validation form | `DoctorSchedule.tsx` | `gio_bat_dau >= gio_ket_thuc` → lỗi inline |
| Warning thiếu phòng | `DoctorSchedule.tsx` | Trong form + trong SlotRow nếu `phong_kham = null` |
| Reset form khi mở modal | `DoctorSchedule.tsx` | `setForm(EMPTY_FORM)` + `setFormError('')` trong onClick |
| Error handling đầy đủ | `DoctorSchedule.tsx` | `formError` (trong modal) + `actionError` (thanh đỏ trên trang) |
| Icon lock, trash, user | `components/admin/icons.tsx` | Đã thêm vào ICONS dictionary |
| Guard slot có BN | `schedule.service.ts` | `lockSlot`, `deleteSlot` throw Error nếu `benh_nhan != null` |
| Helper `canModify(slot)` | `DoctorSchedule.tsx` | Kiểm tra ngày tương lai + status không phải booked/cancelled/expired |

### 8.2 Lưu ý kỹ thuật đã giải quyết

| Vấn đề | Giải pháp |
|---|---|
| `handleAdd` không có `catch` block | Đã thêm — nếu service throw, hiển thị `formError` |
| Modal không reset khi mở lại | `onClick={() => { setForm(EMPTY_FORM); setFormError(''); setShowModal(true) }}` |
| Icon `lock`, `trash`, `user` hiển thị sai (fallback dashboard) | Đã thêm 3 SVG path vào `icons.tsx` |
| Ngày đã qua nhưng có slot `active` | `isPast(ngay)` → hiển thị mờ, không có nút thao tác |
| `cancelSlot` tồn tại trong service nhưng chưa dùng ở UI | Giữ để sẵn sàng khi cần — UI dùng `deleteSlot` thay |

---

## 9. Gắn backend — Chỉ cần đổi thân hàm trong service

Toàn bộ UI giữ nguyên. Khi gắn MongoDB, chỉ thay nội dung từng hàm trong `schedule.service.ts`:

```ts
// Hiện tại — mock in-memory
async getAll(): Promise<DoctorSlot[]> {
  await delay()
  return [...slots].sort(...)
}

// Sau khi gắn backend — chỉ đổi phần thân
async getAll(): Promise<DoctorSlot[]> {
  const res = await axiosInstance.get('/api/doctor/slots')
  return res.data.data
}
```

Mapping đầy đủ các hàm:

| Hàm service hiện tại | Endpoint backend |
|---|---|
| `getAll()` | `GET /api/doctor/slots` |
| `addSlot(data)` | `POST /api/doctor/slots` |
| `lockSlot(id)` | `PATCH /api/doctor/slots/:id/lock` |
| `unlockSlot(id)` | `PATCH /api/doctor/slots/:id/unlock` |
| `deleteSlot(id)` | `DELETE /api/doctor/slots/:id` |
| `cancelSlot(id)` | `PATCH /api/doctor/slots/:id/cancel` _(dùng khi cần)_ |

**Quy tắc bảo mật backend:**
- `verifyToken` → lấy `doctor_id` từ JWT
- Tất cả endpoint chỉ trả slot của bác sĩ đang đăng nhập (không trả slot người khác)
- Backend kiểm tra lại guard: không cho xóa/khóa slot có `benh_nhan_id != null`
