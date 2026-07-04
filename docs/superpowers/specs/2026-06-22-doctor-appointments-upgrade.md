# Spec: Nâng cấp Quản lý Lịch hẹn Bác sĩ — B3 + B4

> **Ngày:** 2026-06-22
> **Dựa trên:** spec cũ `2026-06-17-doctor-appointments-design.md` + kiểm tra code thực tế
> **Mục tiêu:** Fix 4 bugs + implement 4 gap features + đủ mock data cho mọi test case
> **Scope:** Chỉ fix bugs ưu tiên Cao/Trung — KHÔNG làm date range picker, export PDF

---

## 1. Danh sách Bug thực tế (đối chiếu code ↔ spec)

### BUG-1 — `complete()` set `da_co_ket_qua: true` sai chỗ

| | |
|---|---|
| **File** | `frontend/src/services/doctor-appointment.service.ts:46` |
| **Code lỗi** | `{ ...a, status: 'completed', da_co_ket_qua: true }` |
| **Spec yêu cầu** | `da_co_ket_qua` chỉ được set `true` khi `examinationService.save()` thành công |
| **Hậu quả** | Sau khi click "Hoàn thành", nút hiện "Xem kết quả" (icon eye) thay vì "Nhập kết quả" (icon edit). Bệnh nhân nhìn thấy "đã có kết quả" nhưng DB trống. |
| **Fix** | Bỏ `da_co_ket_qua: true` trong `complete()` — chỉ update `status: 'completed'` |

### BUG-2 — Nút "Xác nhận" hiển thị cho cả lịch chưa thanh toán

| | |
|---|---|
| **File** | `frontend/src/pages/doctor/DoctorAppointments.tsx:380–390` |
| **Code lỗi** | `{appt.status === 'pending' && (<>[Xác nhận][Từ chối]</>)}` — không check `payment_status` |
| **Spec yêu cầu** | Nút "Xác nhận" chỉ hiện khi `payment_status === 'paid'` |
| **Hậu quả** | Bác sĩ xác nhận lịch chưa thu tiền → thực hiện khám mà không nhận được thanh toán |
| **Fix** | Thêm điều kiện `&& appt.payment_status === 'paid'` trước khi render nút "Xác nhận" |

### BUG-3 — `reject()` không cập nhật `payment_status → refunded`

| | |
|---|---|
| **File** | `frontend/src/services/doctor-appointment.service.ts:35–38` |
| **Code lỗi** | Chỉ set `status: 'cancelled', ly_do_huy: ly_do` — không đổi `payment_status` |
| **Spec yêu cầu** | Khi từ chối lịch `paid`: `payment_status → refunded` trong cùng transaction |
| **Hậu quả** | Bệnh nhân đã thanh toán bị từ chối nhưng không được hoàn tiền trong mock state |
| **Fix** | Thêm `payment_status: a.payment_status === 'paid' ? 'refunded' : a.payment_status` |

### BUG-4 — Icon `edit` và `trash` không tồn tại trong `icons.tsx`

| | |
|---|---|
| **File** | `frontend/src/components/admin/icons.tsx` |
| **Code lỗi** | `ICONS` dict không có key `edit`, `trash`, `lock`, `user` — fallback về `dashboard` (nhà) |
| **Ảnh hưởng** | `DoctorAppointments.tsx:411` dùng `edit` → hiển thị icon nhà; tương tự `DoctorSchedule.tsx` |
| **Fix** | Thêm 4 SVG path cho `edit`, `trash`, `lock`, `user` vào `ICONS` |

### BUG-5 — `DoctorSlot` type không khớp với B2 doc

| | |
|---|---|
| **File** | `frontend/src/types/index.ts:239–247` |
| **Code lỗi** | Có `so_benh_nhan_toi_da`, `so_benh_nhan_hien_tai`; `status` chỉ có 3 giá trị |
| **Spec yêu cầu (B2)** | Bỏ 2 field đó, thêm `phong_kham`, `benh_nhan`, `benh_nhan_id`; `status` 5 giá trị |
| **Fix** | Update interface `DoctorSlot` cho đúng B2 |

### BUG-6 — Mock data thiếu — Nhiều test case không thể test được

| Test case | Lý do không test được |
|---|---|
| TC-C01 Xác nhận lịch — happy path | Không có `pending + paid` nào trong hôm nay → nút "Xác nhận" chưa bao giờ hiện |
| TC-EDG09 Lịch pending đã quá ngày | Không có `pending` nào với `ngay_kham < today` |
| TC-CO03 `da_co_ket_qua = false` sau complete | Sau khi fix BUG-1 mới test được — cần `completed + da_co_ket_qua: false` |
| TC-CC01 Bác sĩ hủy confirmed | Gap feature chưa có |

**Cần thêm 3 mock appointment:**

```
id 11: TODAY, pending, paid → test "Xác nhận" happy path
id 12: d(-4), pending, unpaid → test "Hết hạn" badge
id 13: d(-1), completed, paid, da_co_ket_qua: false → test "Nhập kết quả"
```

---

## 2. Gap Features cần thêm

### GAP-1 — Tìm kiếm theo tên bệnh nhân (Ưu tiên 🔴 Cao)

**Vị trí:** Search input nằm giữa PageHeader và Tabs

**Hành vi:**
- Input type text, placeholder "Tìm bệnh nhân..."
- Realtime filter — lọc ngay khi gõ, không cần bấm Enter
- Search scope: chỉ `benh_nhan` (không search SĐT, lý do khám)
- Case-insensitive, partial match
- Filter kết hợp với cả tab lẫn statusFilter
- **Badge count trên tabs KHÔNG bị ảnh hưởng** bởi search (chỉ bị ảnh hưởng bởi filter ngày)

**State:** `const [searchText, setSearchText] = useState('')`

### GAP-2 — Badge "Hết hạn" + disable "Xác nhận" khi pending quá ngày (Ưu tiên 🔴 Cao)

**Điều kiện:** `appt.status === 'pending' && appt.ngay_kham < todayStr`

**Hành vi:**
- Badge màu xám "Hết hạn" thay thế hoặc bổ sung bên cạnh badge status "Chờ xác nhận"
- Nút "Xác nhận" bị ẩn hoàn toàn (không phải disabled)
- Nút "Từ chối" vẫn hiển thị — bác sĩ cần từ chối để release slot + hoàn tiền

**Helper function trong component:**
```ts
const isExpiredPending = (a: DoctorAppointmentDetail) =>
  a.status === 'pending' && a.ngay_kham < todayStr
```

### GAP-3 — Bác sĩ hủy lịch đã `confirmed` (Ưu tiên 🟡 Trung)

**Service method mới:** `cancelConfirmed(id: number, ly_do: string)`
- Chuyển `confirmed → cancelled`
- Set `payment_status: 'refunded'` (luôn 100%, không theo bảng thời gian)
- Set `ly_do_huy: ly_do`

**UI:**
- Nút "Hủy" (màu đỏ) trong cột thao tác của row `confirmed`
- Mở `CancelModal` — giống `RejectModal` nhưng tiêu đề "Hủy lịch đã xác nhận", mô tả khác
- Validate: `ly_do.trim()` không được trống

**CancelModal props:**
```ts
interface CancelModalProps {
  onConfirm: (ly_do: string) => void
  onClose: () => void
}
```

### GAP-4 — Banner cảnh báo urgent (Ưu tiên 🟡 Trung)

**Điều kiện hiển thị:** Có ít nhất 1 lịch hôm nay với `status === 'pending'` (kể cả unpaid)

**Tính toán:**
```ts
const urgentCount = all.filter(
  (a) => a.ngay_kham === todayStr && a.status === 'pending'
).length
```

**Vị trí:** Giữa PageHeader và Search input

**Nội dung:** `"Có {urgentCount} lịch hôm nay chưa xác nhận — vui lòng xử lý."`

**Style:** `border border-amber-200 bg-amber-50 text-amber-700` — icon `alert-circle`

**Behavior:**
- Chỉ hiện khi `urgentCount > 0`
- Tự ẩn khi tất cả pending hôm nay đã được xử lý (confirmed/cancelled)
- Tính lại realtime mỗi khi `all` thay đổi

---

## 3. Thay đổi Data Model

### 3.1 `types/index.ts` — Fix `DoctorSlot`

**Xóa:**
```ts
so_benh_nhan_toi_da: number
so_benh_nhan_hien_tai: number
```

**Thêm:**
```ts
phong_kham?: string | null
benh_nhan?: string | null
benh_nhan_id?: number | null
```

**Sửa status:**
```ts
// Cũ:
status: 'active' | 'locked' | 'cancelled'
// Mới:
status: 'active' | 'booked' | 'locked' | 'cancelled' | 'expired'
```

### 3.2 `mock/doctor-appointments.ts` — Thêm 3 record

```ts
// id 11 — test TC-C01: pending + paid → có thể xác nhận
{
  id: 11, benh_nhan: 'Bùi Thị Cẩm', benh_nhan_id: 11,
  so_dien_thoai: '0911111111',
  ngay_kham: TODAY, gio_kham: '10:00',
  loai_kham: 'clinic', status: 'pending', payment_status: 'paid', gia_kham: 400000,
  ly_do_kham: 'Đau đầu kéo dài, chóng mặt.',
  tuoi: 35, gioi_tinh: 'Nữ', di_ung: null, benh_nen: 'Migraine mãn tính',
  da_co_ket_qua: false,
}

// id 12 — test TC-EDG09: pending đã qua ngày → "Hết hạn"
{
  id: 12, benh_nhan: 'Trương Văn Bình', benh_nhan_id: 12,
  so_dien_thoai: '0912222222',
  ngay_kham: d(-4), gio_kham: '14:00',
  loai_kham: 'home', status: 'pending', payment_status: 'unpaid', gia_kham: 600000,
  ly_do_kham: 'Kiểm tra sau phẫu thuật.',
  tuoi: 67, gioi_tinh: 'Nam', di_ung: 'Ibuprofen', benh_nen: 'Sau phẫu thuật tim',
  da_co_ket_qua: false,
}

// id 13 — test TC-CO03: completed chưa có kết quả → [Nhập kết quả]
{
  id: 13, benh_nhan: 'Hoàng Thị Dung', benh_nhan_id: 13,
  so_dien_thoai: '0913333333',
  ngay_kham: d(-1), gio_kham: '11:00',
  loai_kham: 'video', status: 'completed', payment_status: 'paid', gia_kham: 250000,
  ly_do_kham: 'Hỏi về kết quả xét nghiệm máu.',
  tuoi: 44, gioi_tinh: 'Nữ', di_ung: null, benh_nen: null,
  da_co_ket_qua: false,
}
```

---

## 4. Thay đổi `icons.tsx`

Thêm 4 icon vào `ICONS` dict. Dùng Feather Icons / Heroicons SVG paths:

```ts
edit: [
  'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
  'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
],
trash: [
  'M3 6h18',
  'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  'M10 11v6',
  'M14 11v6',
  'M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
],
lock: [
  'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z',
  'M7 11V7a5 5 0 0 1 10 0v4',
],
user: [
  'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2',
  'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
],
```

---

## 5. Thay đổi Service Layer

### 5.1 `doctor-appointment.service.ts`

**Sửa `complete()`:**
```ts
async complete(id: number): Promise<DoctorAppointmentDetail> {
  await delay(200)
  appointments = appointments.map((a) =>
    a.id === id ? { ...a, status: 'completed' } : a  // BỎ da_co_ket_qua: true
  )
  return findOrThrow(appointments, id, 'Lịch hẹn')
},
```

**Sửa `reject()`:**
```ts
async reject(id: number, ly_do: string): Promise<DoctorAppointmentDetail> {
  await delay(200)
  appointments = appointments.map((a) =>
    a.id === id
      ? {
          ...a,
          status: 'cancelled',
          ly_do_huy: ly_do,
          payment_status: a.payment_status === 'paid' ? 'refunded' : a.payment_status,
        }
      : a
  )
  return findOrThrow(appointments, id, 'Lịch hẹn')
},
```

**Thêm `cancelConfirmed()`:**
```ts
async cancelConfirmed(id: number, ly_do: string): Promise<DoctorAppointmentDetail> {
  await delay(200)
  appointments = appointments.map((a) =>
    a.id === id
      ? { ...a, status: 'cancelled', payment_status: 'refunded', ly_do_huy: ly_do }
      : a
  )
  return findOrThrow(appointments, id, 'Lịch hẹn')
},
```

---

## 6. Thay đổi UI — `DoctorAppointments.tsx`

### 6.1 State mới

```ts
const [searchText, setSearchText] = useState('')          // GAP-1
const [cancelId, setCancelId] = useState<number | null>(null)  // GAP-3
const [actionLoading, setActionLoading] = useState<number | null>(null)  // chống double-click
```

### 6.2 Constants mới trong file

```ts
const PAYMENT_STATUS_COLOR: Record<string, 'green' | 'red' | 'blue' | 'yellow' | 'gray'> = {
  unpaid: 'yellow', paid: 'blue', refunded: 'gray',
}
```

### 6.3 Hàm lọc — cập nhật `getByTab()`

```ts
function getByTab(t: Tab): DoctorAppointmentDetail[] {
  let list = [...all]
  if (t === 'today')    list = list.filter((a) => a.ngay_kham === todayStr)
  else if (t === 'upcoming') list = list.filter((a) => a.ngay_kham > todayStr)
  else if (t === 'past')     list = list.filter((a) => a.ngay_kham < todayStr)
  if (statusFilter) list = list.filter((a) => a.status === statusFilter)
  if (searchText.trim()) {
    const q = searchText.trim().toLowerCase()
    list = list.filter((a) => a.benh_nhan.toLowerCase().includes(q))
  }
  return list.sort(
    (a, b) => a.ngay_kham.localeCompare(b.ngay_kham) || a.gio_kham.localeCompare(b.gio_kham)
  )
}
```

> **Quan trọng:** `tabCount()` KHÔNG áp dụng `searchText` và KHÔNG áp dụng `statusFilter` — chỉ đếm theo ngày.

### 6.4 Urgent count

```ts
const urgentCount = useMemo(
  () => all.filter((a) => a.ngay_kham === todayStr && a.status === 'pending').length,
  [all, todayStr]
)
```

### 6.5 Action handlers — cập nhật

```ts
async function handleConfirm(id: number) {
  if (actionLoading !== null) return           // chống double-click
  setActionLoading(id)
  try {
    const updated = await doctorAppointmentService.confirm(id)
    updateAppt(id, { status: updated.status })
  } finally {
    setActionLoading(null)
  }
}

async function handleComplete(id: number) {
  if (actionLoading !== null) return
  setActionLoading(id)
  try {
    const updated = await doctorAppointmentService.complete(id)
    updateAppt(id, { status: updated.status, da_co_ket_qua: updated.da_co_ket_qua })
  } finally {
    setActionLoading(null)
  }
}

async function handleReject(id: number, ly_do: string) {
  const updated = await doctorAppointmentService.reject(id, ly_do)
  updateAppt(id, {
    status: 'cancelled',
    ly_do_huy: ly_do,
    payment_status: updated.payment_status,  // nhận refunded từ service
  })
  setRejectId(null)
}

async function handleCancelConfirmed(id: number, ly_do: string) {
  await doctorAppointmentService.cancelConfirmed(id, ly_do)
  updateAppt(id, { status: 'cancelled', payment_status: 'refunded', ly_do_huy: ly_do })
  setCancelId(null)
}
```

### 6.6 Layout tổng thể (thứ tự từ trên xuống)

```
1. <PageHeader title="Lịch hẹn của tôi" />
2. [UrgentBanner] — chỉ hiện khi urgentCount > 0
3. [SearchInput] — text filter
4. [Tabs] — Hôm nay / Sắp tới / Đã qua / Tất cả (badge count)
5. [StatusFilter dropdown]
6. [Table | EmptyState | Loading]
7. [RejectModal] — khi rejectId !== null
8. [CancelModal] — khi cancelId !== null
9. [ExamModal] — khi examAppt !== null
```

### 6.7 Cột "Trạng thái" trong table

Thêm badge payment_status nhỏ dưới badge status chính:

```tsx
<td className="px-4 py-3">
  <div className="flex flex-col gap-1">
    <Badge color={STATUS_COLOR[appt.status]}>
      {APPOINTMENT_STATUS_LABEL[appt.status]}
    </Badge>
    {/* Hết hạn badge nếu pending quá ngày */}
    {isExpiredPending(appt) && (
      <Badge color="gray">Hết hạn</Badge>
    )}
    {/* Payment status badge nhỏ */}
    <span className={`text-[10px] font-medium ${
      appt.payment_status === 'paid' ? 'text-blue-600' :
      appt.payment_status === 'refunded' ? 'text-gray-500' : 'text-amber-600'
    }`}>
      {PAYMENT_STATUS_LABEL[appt.payment_status]}
    </span>
  </div>
</td>
```

### 6.8 Cột "Thao tác" — logic đầy đủ

```tsx
<div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>

  {/* ── PENDING ── */}
  {appt.status === 'pending' && (
    <>
      {/* Xác nhận: CHỈ khi paid VÀ ngày chưa qua */}
      {appt.payment_status === 'paid' && !isExpiredPending(appt) && (
        <button
          onClick={() => handleConfirm(appt.id)}
          disabled={actionLoading === appt.id}
          className="btn-action-green disabled:opacity-50">
          <Icon name="check" className="h-3 w-3" /> Xác nhận
        </button>
      )}

      {/* Từ chối: luôn hiện cho pending (kể cả hết hạn, unpaid) */}
      <button onClick={() => setRejectId(appt.id)} className="btn-action-red">
        <Icon name="x" className="h-3 w-3" /> Từ chối
      </button>
    </>
  )}

  {/* ── CONFIRMED ── */}
  {appt.status === 'confirmed' && (
    <>
      <button
        onClick={() => handleComplete(appt.id)}
        disabled={actionLoading === appt.id}
        className="btn-action-brand disabled:opacity-50">
        <Icon name="check" className="h-3 w-3" /> Hoàn thành
      </button>

      <button onClick={() => setExamAppt(appt)} className="btn-action-slate">
        <Icon name="edit" className="h-3 w-3" /> Kết quả
      </button>

      <button onClick={() => setCancelId(appt.id)} className="btn-action-red">
        <Icon name="x" className="h-3 w-3" /> Hủy
      </button>
    </>
  )}

  {/* ── COMPLETED ── */}
  {appt.status === 'completed' && (
    <button
      onClick={() => setExamAppt(appt)}
      className={appt.da_co_ket_qua ? 'btn-action-green' : 'btn-action-brand'}>
      <Icon name={appt.da_co_ket_qua ? 'eye' : 'edit'} className="h-3 w-3" />
      {appt.da_co_ket_qua ? 'Xem kết quả' : 'Nhập kết quả'}
    </button>
  )}

  {/* ── CANCELLED — không có nút nào ── */}
</div>
```

> **Lưu ý class names:** Thay `btn-action-green`, `btn-action-red`, etc. bằng inline Tailwind classes thực tế như đang dùng. Dùng hằng số để tránh lặp code.

### 6.9 CancelModal component (mới)

```tsx
function CancelModal({ onConfirm, onClose }: { onConfirm: (ly_do: string) => void; onClose: () => void }) {
  const [ly_do, setLyDo] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <p className="font-semibold text-slate-800">Hủy lịch đã xác nhận</p>
        <p className="mt-1 text-sm text-slate-500">
          Bác sĩ hủy → bệnh nhân được hoàn tiền <strong>100%</strong> bất kể thời điểm.
        </p>
        <textarea
          className="input mt-3 resize-none"
          rows={3}
          placeholder="Lý do hủy..."
          value={ly_do}
          onChange={(e) => setLyDo(e.target.value)}
        />
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Đóng</button>
          <button
            onClick={() => { if (ly_do.trim()) onConfirm(ly_do) }}
            disabled={!ly_do.trim()}
            className="btn-primary disabled:opacity-40">
            Xác nhận hủy
          </button>
        </div>
      </div>
    </div>
  )
}
```

### 6.10 Expanded row — thêm payment_status

Trong detail row, bổ sung ô "Thanh toán" sau "Số điện thoại":

```tsx
<div>
  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Thanh toán</p>
  <p className="mt-0.5">
    <Badge color={PAYMENT_STATUS_COLOR[appt.payment_status]}>
      {PAYMENT_STATUS_LABEL[appt.payment_status]}
    </Badge>
  </p>
</div>
```

---

## 7. Import cần thêm vào `DoctorAppointments.tsx`

```ts
import { useMemo } from 'react'  // cho urgentCount
import { APPOINTMENT_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '@/utils/constants'
```

---

## 8. Test Cases đầy đủ

### TC-VIEW — Hiển thị & Navigation

| ID | Tình huống | Input | Kết quả mong đợi | P |
|---|---|---|---|---|
| V01 | Tab "Hôm nay" active mặc định | Truy cập trang | Tab "Hôm nay" được chọn, chỉ hiện lịch `ngay_kham = today` | P0 |
| V02 | Badge count tab KHÔNG phụ thuộc search | Gõ tên vào search | Badge count tabs không đổi | P0 |
| V03 | Badge count tab KHÔNG phụ thuộc status filter | Chọn filter "Hoàn thành" | Badge count tabs không đổi | P0 |
| V04 | Tab "Sắp tới" đúng | Click "Sắp tới" | Chỉ hiện `ngay_kham > today`, sort tăng dần | P0 |
| V05 | Tab "Đã qua" đúng | Click "Đã qua" | Chỉ hiện `ngay_kham < today`, sort giảm dần | P0 |
| V06 | Tab + filter kết hợp | Tab "Hôm nay" + filter "Đã xác nhận" | Giao của 2 điều kiện | P0 |
| V07 | Tab + search kết hợp | Tab "Hôm nay" + gõ tên | Giao của tab + search | P0 |
| V08 | Expand row | Click row bất kỳ | Sub-row mở với SĐT, tuổi/giới, dị ứng(🔴), bệnh nền, lý do khám, **thanh toán** | P0 |
| V09 | Collapse row | Click row đang mở | Sub-row đóng | P1 |
| V10 | Dị ứng màu đỏ | `di_ung = 'Penicillin'` | `text-red-600 font-medium` | P0 |
| V11 | Field null không render | `di_ung = null` | Label "Dị ứng" không xuất hiện | P1 |
| V12 | Empty state | Không có lịch trong tab/filter | Icon calendar + "Không có lịch hẹn nào." | P1 |
| V13 | Loading state | Lần đầu load | Spinner/text thay vì bảng trống | P2 |
| V14 | Sort đúng | Nhiều lịch cùng ngày khác giờ | `ngay_kham ASC` rồi `gio_kham ASC` | P1 |
| V15 | Payment badge trong expanded row | Lịch `paid` | Badge "Đã thanh toán" màu xanh dương | P1 |

### TC-SEARCH — Tìm kiếm

| ID | Tình huống | Input | Kết quả mong đợi | P |
|---|---|---|---|---|
| S01 | Tìm chính xác | Gõ "Nguyễn Văn An" | Chỉ hiện lịch của bệnh nhân đó | P0 |
| S02 | Tìm một phần (partial) | Gõ "nguyễn" | Hiện tất cả bệnh nhân tên có "nguyễn" | P0 |
| S03 | Không phân biệt hoa thường | Gõ "NGUYỄN" | Kết quả giống S02 | P0 |
| S04 | Không có kết quả | Gõ "xyz123" | Empty state "Không có lịch hẹn nào." | P1 |
| S05 | Xóa search → về toàn bộ | Xóa nội dung input | Danh sách trở về ban đầu (theo tab) | P0 |
| S06 | Search không ảnh hưởng badge tab | Gõ tên → 0 kết quả trên tab | Badge count tab vẫn giữ số cũ | P0 |

### TC-URGENT-BANNER — Banner cảnh báo

| ID | Tình huống | Input | Kết quả mong đợi | P |
|---|---|---|---|---|
| U01 | Banner hiện khi có pending hôm nay | Mock có id 3, 4, 11 (pending today) | Banner "Có 3 lịch hôm nay chưa xác nhận" | P0 |
| U02 | Banner tự ẩn khi xử lý hết | Xác nhận / từ chối tất cả pending hôm nay | Banner biến mất | P1 |
| U03 | Banner không hiện khi không có pending | Tab "Hôm nay" không có pending | Không có banner | P1 |
| U04 | Count chính xác | 2 pending hôm nay | Banner nói "2 lịch" | P0 |

### TC-CONFIRM — Xác nhận lịch

| ID | Tình huống | Input | Kết quả mong đợi | P |
|---|---|---|---|---|
| C01 | Happy path | `pending + paid + ngay >= today` (id 11) | Badge "Đã xác nhận", nút đổi → [Hoàn thành][Kết quả][Hủy] | P0 |
| C02 | Không confirm khi unpaid | `pending + unpaid` (id 3, 4) | Nút "Xác nhận" không xuất hiện — chỉ có "Từ chối" | P0 |
| C03 | Không confirm khi hết hạn | `pending + ngay < today` (id 12) | Nút "Xác nhận" không xuất hiện dù payment bất kỳ | P0 |
| C04 | Confirmed không có nút Xác nhận | `confirmed` | Nút "Xác nhận" không xuất hiện | P0 |
| C05 | Double-click ngăn duplicate | Click nhanh 2 lần | Chỉ 1 action gửi đi (disabled trong khi loading) | P1 |

### TC-REJECT — Từ chối lịch

| ID | Tình huống | Input | Kết quả mong đợi | P |
|---|---|---|---|---|
| R01 | Happy path | Click "Từ chối" → nhập lý do → Xác nhận | Modal đóng; badge "Đã hủy"; lý do hiện trong expanded row | P0 |
| R02 | Payment refunded sau từ chối | `pending + paid` → từ chối | Badge thanh toán → "Đã hoàn tiền" | P0 |
| R03 | Unpaid → không đổi payment status | `pending + unpaid` → từ chối | `payment_status` vẫn `unpaid` | P1 |
| R04 | Lý do trống | Không nhập → click | Nút disabled, không submit | P0 |
| R05 | Lý do khoảng trắng | `"   "` | Trim validation → vẫn disabled | P1 |
| R06 | Đóng modal không lưu | Click "Hủy" | Modal đóng, lịch không đổi | P1 |
| R07 | Hết hạn cũng có thể từ chối | `pending + ngay < today` (id 12) | Nút "Từ chối" vẫn xuất hiện và hoạt động | P0 |

### TC-EXPIRE — Lịch hết hạn

| ID | Tình huống | Input | Kết quả mong đợi | P |
|---|---|---|---|---|
| E01 | Badge "Hết hạn" xuất hiện | `pending + ngay_kham < today` (id 12) | Badge xám "Hết hạn" bên cạnh badge "Chờ xác nhận" | P0 |
| E02 | Không có nút "Xác nhận" | `pending + hết hạn` | Chỉ có nút "Từ chối" | P0 |
| E03 | Lịch hôm nay không bị "Hết hạn" | `ngay_kham = today` | Không có badge "Hết hạn" | P0 |
| E04 | Lịch ngày mai không bị "Hết hạn" | `ngay_kham > today` | Không có badge "Hết hạn" | P0 |

### TC-COMPLETE — Hoàn thành lịch

| ID | Tình huống | Input | Kết quả mong đợi | P |
|---|---|---|---|---|
| CO01 | Happy path | `confirmed` → click "Hoàn thành" | Badge "Hoàn thành"; nút → [Nhập kết quả] (icon edit, màu brand) | P0 |
| CO02 | `da_co_ket_qua = false` sau complete | Click Hoàn thành (sau khi fix BUG-1) | Nút hiển thị "Nhập kết quả" chứ không phải "Xem kết quả" | P0 |
| CO03 | Pending không có nút Hoàn thành | `pending` | Không hiện nút "Hoàn thành" | P0 |
| CO04 | Double-click ngăn | Click nhanh 2 lần | Chỉ 1 action | P1 |

### TC-CANCEL-CONFIRMED — Bác sĩ hủy lịch confirmed

| ID | Tình huống | Input | Kết quả mong đợi | P |
|---|---|---|---|---|
| CC01 | Happy path | `confirmed` → click "Hủy" → nhập lý do | Modal đóng; badge "Đã hủy"; payment → "Đã hoàn tiền" | P0 |
| CC02 | Lý do bắt buộc | Textarea trống → click | Nút disabled | P0 |
| CC03 | Hoàn 100% bất kể | Hủy lịch 30 phút trước | `payment_status = 'refunded'` | P0 |
| CC04 | Lý do hiện expanded row | Sau khi hủy, expand row | Lý do hủy hiện màu đỏ | P1 |
| CC05 | Đóng modal không lưu | Click "Đóng" | Modal đóng, lịch không đổi | P1 |
| CC06 | Pending không có nút Hủy (confirmed only) | `pending` | Không có nút "Hủy" kiểu này | P0 |

### TC-EXAM — Kết quả khám (giữ nguyên từ spec cũ, không thay đổi)

| ID | Tình huống | Input | Kết quả mong đợi | P |
|---|---|---|---|---|
| EX01 | Mở modal lần đầu (chưa có kết quả) | `completed + da_co_ket_qua=false` (id 13) | Modal rỗng, editable, nút "Lưu kết quả" | P0 |
| EX02 | Lưu kết quả — happy path | Nhập chẩn đoán → Lưu | Modal đóng; nút → icon eye "Xem kết quả"; `da_co_ket_qua=true` | P0 |
| EX03 | Thiếu chẩn đoán | `chan_doan` trống → Submit | HTML5 required validation, không submit | P0 |
| EX04 | Mở modal đã có kết quả <24h | `co_the_sua=true` (id 2 từ examinations mock) | Form có data, editable, nút "Cập nhật" | P0 |
| EX05 | Read-only sau 24h | `co_the_sua=false` (id 1 exam) | Banner vàng; tất cả input readOnly; chỉ nút "Đóng" | P0 |
| EX06 | Header modal đúng | Bất kỳ | `{benh_nhan} · {formatDate(ngay_kham)} {gio_kham}` | P2 |
| EX07 | Thêm/xóa thuốc | Click "Thêm thuốc" / xóa | Dynamic list, tối thiểu 1 thuốc | P1 |
| EX08 | Không xóa khi 1 thuốc | Chỉ 1 thuốc | Nút xóa không xuất hiện | P1 |
| EX09 | Cancelled không mở modal | `cancelled` | Không có nút nào → không thể mở ExamModal | P0 |

### TC-ICON — Icons

| ID | Tình huống | Input | Kết quả mong đợi | P |
|---|---|---|---|---|
| I01 | Icon "edit" đúng | Nút "Kết quả" / "Nhập kết quả" | Hiện icon bút chì, không phải icon nhà | P0 |
| I02 | Icon "eye" đúng | Nút "Xem kết quả" | Hiện icon con mắt | P0 |
| I03 | Icon "check" đúng | Nút "Xác nhận" / "Hoàn thành" | Hiện icon dấu tích | P0 |
| I04 | Icon "x" đúng | Nút "Từ chối" / "Hủy" | Hiện icon X | P0 |

---

## 9. Danh sách File thay đổi (checklist implement)

```
[ ] 1. frontend/src/components/admin/icons.tsx
        → Thêm: edit, trash, lock, user

[ ] 2. frontend/src/types/index.ts
        → Fix DoctorSlot interface

[ ] 3. frontend/src/mock/doctor-appointments.ts
        → Thêm id 11, 12, 13

[ ] 4. frontend/src/services/doctor-appointment.service.ts
        → Fix complete() (bỏ da_co_ket_qua: true)
        → Fix reject() (thêm payment_status refund)
        → Thêm cancelConfirmed()

[ ] 5. frontend/src/pages/doctor/DoctorAppointments.tsx
        → Thêm state: searchText, cancelId, actionLoading
        → Thêm useMemo: urgentCount
        → Thêm helper: isExpiredPending()
        → Thêm constant: PAYMENT_STATUS_COLOR
        → Cập nhật getByTab() để filter search
        → Cập nhật handleConfirm() (actionLoading guard)
        → Cập nhật handleComplete() (actionLoading guard)
        → Cập nhật handleReject() (nhận payment_status từ service)
        → Thêm handleCancelConfirmed()
        → UI: UrgentBanner component (inline)
        → UI: SearchInput
        → UI: Cột Trạng thái (+ badge Hết hạn + payment text)
        → UI: Cột Thao tác (logic đầy đủ theo section 6.8)
        → UI: Expanded row (thêm ô Thanh toán)
        → UI: CancelModal component
        → Render CancelModal khi cancelId !== null
```

---

## 10. Quy tắc bất biến — Không được vi phạm

| # | Quy tắc | Kiểm tra |
|---|---|---|
| 1 | `pending + unpaid` → KHÔNG có nút "Xác nhận" | TC-C02 |
| 2 | `pending + ngay < today` → KHÔNG có nút "Xác nhận" | TC-C03, TC-E01 |
| 3 | `complete()` KHÔNG set `da_co_ket_qua: true` | TC-CO02 |
| 4 | `da_co_ket_qua = true` chỉ khi `examinationService.save()` thành công | TC-EX02 |
| 5 | `reject()` → `payment_status: paid → refunded` | TC-R02 |
| 6 | `cancelConfirmed()` → `payment_status: refunded` luôn 100% | TC-CC03 |
| 7 | `cancelled` / `completed` là trạng thái cuối — không thể thay đổi | Logic UI |
| 8 | `tabCount()` KHÔNG bị ảnh hưởng bởi search hay status filter | TC-V02, TC-S06 |
| 9 | Icon `edit` phải hiện bút chì (không fallback sang dashboard) | TC-I01 |
| 10 | Dị ứng hiện màu đỏ `text-red-600 font-medium` | TC-V10 |
