# C4 — Quản lý dịch vụ: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hoàn chỉnh trang Quản lý dịch vụ (C4) cho Admin với mock data, sẵn sàng swap sang backend chỉ bằng cách đổi phần thân hàm trong `service.service.ts`.

**Architecture:** Mọi truy xuất dữ liệu đi qua `serviceService` — UI không biết gì về nguồn dữ liệu. Types ở `index.ts` khớp 100% với DB schema (tên field, ENUM value) để không cần đổi interface khi gắn backend. Modals tách thành file riêng để dễ maintain độc lập.

**Tech Stack:** React 18, TypeScript, TailwindCSS, Vite — không thêm dependency mới.

## Global Constraints

- Không thêm npm package mới
- Tên field TypeScript khớp DB: `gia` (không phải `gia_co_ban`), `status: 'active'|'inactive'` (không phải `'hidden'`)
- Loại dịch vụ chỉ: `'clinic' | 'home'` — bỏ hoàn toàn `'video'`
- Comment bằng tiếng Việt cho logic phức tạp
- Dùng lại: `Badge`, `ConfirmDialog`, `PageHeader`, `Icon`, `formatPrice`, `formatDateTime`, `delay`
- Icon khả dụng: dashboard, users, doctor, hospital, service, calendar, star, bell, payment, logout, menu, search, check, x, eye, eye-off, send, plus, clock, ban, chevron-down, file-text, alert-circle, trending
- CSS class có sẵn: `card`, `input`, `btn-primary`, `btn-secondary`, `btn-danger`

---

## File Map

| File | Hành động | Trách nhiệm |
|---|---|---|
| `frontend/src/types/index.ts` | Sửa | Chuẩn hoá types — nguồn sự thật duy nhất |
| `frontend/src/utils/constants.ts` | Sửa | Bỏ `video` khỏi `SERVICE_TYPE_LABEL` |
| `frontend/src/mock/services.ts` | Viết lại | 4 dịch vụ đầy đủ fields + audit log mẫu |
| `frontend/src/services/service.service.ts` | Viết lại | API contract: getAll, getById, create, update, toggle |
| `frontend/src/components/admin/services/ServiceFormModal.tsx` | Tạo mới | Modal Thêm/Sửa + validation |
| `frontend/src/components/admin/services/ServiceViewModal.tsx` | Tạo mới | Modal Xem chi tiết + audit log timeline |
| `frontend/src/pages/admin/ManageServices.tsx` | Viết lại | Trang chính: stats, filter, bảng, wire modals |

---

## Task 1: Chuẩn hoá Types & Constants

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/utils/constants.ts`

**Interfaces:**
- Produces: `ServiceType`, `ServiceStatus`, `ServiceChangeLog`, `ServiceItem`, `ServiceFormData` — dùng trong mọi task sau

- [ ] **Bước 1: Sửa `types/index.ts`**

Tìm block `ServiceType` + `ServiceItem` hiện tại (dòng 130–140) và thay toàn bộ bằng:

```typescript
// ─── Dịch vụ ─────────────────────────────────────────────────────────────────
export type ServiceType   = 'clinic' | 'home'
export type ServiceStatus = 'active' | 'inactive'

export interface ServiceChangeLog {
  id: number
  thoi_gian: string                                      // ISO datetime
  hanh_dong: 'tao_moi' | 'cap_nhat' | 'an' | 'hien'
  nguoi_thay_doi: string
  mo_ta?: string
}

export interface ServiceItem {
  id: number
  ma_dich_vu: string                    // "DV001" — auto-gen bởi BE
  ten: string
  loai: ServiceType
  gia: number                           // giá thực tế bệnh nhân trả
  mo_ta_ngan?: string | null
  mo_ta?: string | null
  thoi_gian_phut: number
  gio_dat_truoc_toi_thieu: number       // đơn vị: giờ
  ngay_ap_dung?: string | null          // "T2–T7"
  gio_bat_dau?: string | null           // "08:00"
  gio_ket_thuc?: string | null          // "17:00"
  specialty_id?: number | null
  specialty_ten?: string | null         // joined — chỉ dùng để hiển thị
  khu_vuc?: string[]                    // home only
  so_bac_si?: number                    // computed từ doctor_services
  so_luot_dat?: number                  // computed từ appointments
  status: ServiceStatus
  ngay_tao?: string
  ngay_cap_nhat?: string
  lich_su_thay_doi?: ServiceChangeLog[]
}

export interface ServiceFormData {
  ten: string
  loai: ServiceType
  gia: number
  mo_ta_ngan?: string
  mo_ta?: string
  thoi_gian_phut: number
  gio_dat_truoc_toi_thieu: number
  ngay_ap_dung?: string
  gio_bat_dau?: string
  gio_ket_thuc?: string
  specialty_id?: number | null
  khu_vuc?: string[]                    // home only — map tới bảng service_areas
}
```

Đồng thời sửa `AppointmentItem.loai_kham` (dòng ~150):
```typescript
loai_kham: 'clinic' | 'home'  // bỏ 'video'
```

- [ ] **Bước 2: Sửa `utils/constants.ts`**

Tìm `SERVICE_TYPE_LABEL` và thay:
```typescript
export const SERVICE_TYPE_LABEL: Record<ServiceType, string> = {
  clinic: 'Phòng khám',
  home:   'Tại nhà',
}
```

Xoá dòng `video: 'Tư vấn video'`.

- [ ] **Bước 3: Kiểm tra TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Kết quả mong đợi: chỉ thấy lỗi liên quan `video` ở `mock/services.ts` và `ManageServices.tsx` cũ — đây là lỗi hợp lệ, sẽ fix ở Task 2 & 4.

- [ ] **Bước 4: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/utils/constants.ts
git commit -m "refactor(types): chuẩn hoá ServiceItem, bỏ video type, thêm ServiceChangeLog + ServiceFormData"
```

---

## Task 2: Viết lại Mock Data

**Files:**
- Modify: `frontend/src/mock/services.ts`

**Interfaces:**
- Consumes: `ServiceItem`, `ServiceChangeLog` từ Task 1
- Produces: `mockServices: ServiceItem[]` — 4 dịch vụ, audit log id 1–10

- [ ] **Bước 1: Viết lại toàn bộ `mock/services.ts`**

```typescript
import type { ServiceItem } from '@/types'

// ID audit log 1–10 được dùng ở đây.
// service.service.ts bắt đầu nextLogId = 11 để tránh trùng.
export const mockServices: ServiceItem[] = [
  {
    id: 1, ma_dich_vu: 'DV001',
    ten: 'Khám tổng quát tại viện',
    loai: 'clinic', gia: 200000,
    mo_ta_ngan: 'Khám sức khỏe tổng quát tại cơ sở y tế.',
    mo_ta: 'Khám sức khỏe tổng quát với bác sĩ. Đầy đủ thiết bị: XQ, siêu âm, xét nghiệm máu cơ bản.',
    thoi_gian_phut: 30, gio_dat_truoc_toi_thieu: 2,
    ngay_ap_dung: 'T2–T7', gio_bat_dau: '07:00', gio_ket_thuc: '17:00',
    specialty_id: null, specialty_ten: null, khu_vuc: [],
    so_bac_si: 3, so_luot_dat: 128, status: 'active',
    ngay_tao: '2026-01-10T00:00:00.000Z',
    ngay_cap_nhat: '2026-03-15T14:00:00.000Z',
    lich_su_thay_doi: [
      { id: 1, thoi_gian: '2026-01-10T08:00:00.000Z', hanh_dong: 'tao_moi',  nguoi_thay_doi: 'Nguyễn Văn Admin', mo_ta: 'Tạo dịch vụ mới' },
      { id: 2, thoi_gian: '2026-02-05T10:30:00.000Z', hanh_dong: 'cap_nhat', nguoi_thay_doi: 'Nguyễn Văn Admin', mo_ta: 'Cập nhật giá và mô tả dịch vụ' },
      { id: 3, thoi_gian: '2026-03-15T14:00:00.000Z', hanh_dong: 'cap_nhat', nguoi_thay_doi: 'Trần Thị Admin',   mo_ta: 'Điều chỉnh thời gian áp dụng' },
    ],
  },
  {
    id: 2, ma_dich_vu: 'DV002',
    ten: 'Khám chuyên khoa tại viện',
    loai: 'clinic', gia: 350000,
    mo_ta_ngan: 'Khám chuyên sâu với bác sĩ chuyên khoa.',
    mo_ta: 'Tư vấn và thăm khám với bác sĩ chuyên khoa. Có đầy đủ thiết bị chẩn đoán hình ảnh tại cơ sở.',
    thoi_gian_phut: 45, gio_dat_truoc_toi_thieu: 2,
    ngay_ap_dung: 'T2–T6', gio_bat_dau: '08:00', gio_ket_thuc: '16:00',
    specialty_id: null, specialty_ten: null, khu_vuc: [],
    so_bac_si: 5, so_luot_dat: 74, status: 'active',
    ngay_tao: '2026-01-12T00:00:00.000Z',
    ngay_cap_nhat: '2026-02-20T09:00:00.000Z',
    lich_su_thay_doi: [
      { id: 4, thoi_gian: '2026-01-12T09:00:00.000Z', hanh_dong: 'tao_moi',  nguoi_thay_doi: 'Nguyễn Văn Admin', mo_ta: 'Tạo dịch vụ mới' },
      { id: 5, thoi_gian: '2026-02-20T09:00:00.000Z', hanh_dong: 'cap_nhat', nguoi_thay_doi: 'Trần Thị Admin',   mo_ta: 'Cập nhật khung giờ và giá dịch vụ' },
    ],
  },
  {
    id: 3, ma_dich_vu: 'DV003',
    ten: 'Khám sức khỏe tại nhà',
    loai: 'home', gia: 500000,
    mo_ta_ngan: 'Bác sĩ đến tận nhà thăm khám. Giá đã bao gồm phí đi lại.',
    mo_ta: 'Bác sĩ đến tận nhà thăm khám, phù hợp người cao tuổi và trẻ nhỏ. Chỉ chỉ định xét nghiệm — không thực hiện tại nhà. Giá đã bao gồm phí đi lại.',
    thoi_gian_phut: 60, gio_dat_truoc_toi_thieu: 4,
    ngay_ap_dung: 'T2–T7', gio_bat_dau: '08:00', gio_ket_thuc: '17:00',
    specialty_id: null, specialty_ten: null,
    khu_vuc: ['Cầu Giấy', 'Nam Từ Liêm', 'Thanh Xuân', 'Đống Đa', 'Hoàng Mai'],
    so_bac_si: 2, so_luot_dat: 43, status: 'active',
    ngay_tao: '2026-01-15T00:00:00.000Z',
    ngay_cap_nhat: '2026-04-10T11:00:00.000Z',
    lich_su_thay_doi: [
      { id: 6, thoi_gian: '2026-01-15T10:00:00.000Z', hanh_dong: 'tao_moi',  nguoi_thay_doi: 'Nguyễn Văn Admin', mo_ta: 'Tạo dịch vụ mới' },
      { id: 7, thoi_gian: '2026-04-10T11:00:00.000Z', hanh_dong: 'cap_nhat', nguoi_thay_doi: 'Trần Thị Admin',   mo_ta: 'Mở rộng khu vực phục vụ thêm Hoàng Mai' },
    ],
  },
  {
    id: 4, ma_dich_vu: 'DV004',
    ten: 'Khám chuyên khoa tại nhà',
    loai: 'home', gia: 700000,
    mo_ta_ngan: 'Bác sĩ chuyên khoa đến nhà tư vấn và điều trị.',
    mo_ta: 'Bác sĩ chuyên khoa đến nhà thăm khám và tư vấn điều trị. Phù hợp bệnh nhân không thể di chuyển. Giá đã bao gồm phí đi lại.',
    thoi_gian_phut: 90, gio_dat_truoc_toi_thieu: 4,
    ngay_ap_dung: 'T2–T6', gio_bat_dau: '09:00', gio_ket_thuc: '15:00',
    specialty_id: null, specialty_ten: null,
    khu_vuc: ['Cầu Giấy', 'Nam Từ Liêm'],
    so_bac_si: 1, so_luot_dat: 12, status: 'inactive',
    ngay_tao: '2026-01-20T00:00:00.000Z',
    ngay_cap_nhat: '2026-04-01T11:00:00.000Z',
    lich_su_thay_doi: [
      { id: 8,  thoi_gian: '2026-01-20T09:00:00.000Z', hanh_dong: 'tao_moi',  nguoi_thay_doi: 'Nguyễn Văn Admin', mo_ta: 'Tạo dịch vụ mới' },
      { id: 9,  thoi_gian: '2026-03-01T14:30:00.000Z', hanh_dong: 'cap_nhat', nguoi_thay_doi: 'Trần Thị Admin',   mo_ta: 'Thu hẹp khu vực phục vụ' },
      { id: 10, thoi_gian: '2026-04-01T11:00:00.000Z', hanh_dong: 'an',       nguoi_thay_doi: 'Nguyễn Văn Admin', mo_ta: 'Ẩn tạm thời — chưa có bác sĩ đảm nhận' },
    ],
  },
]
```

- [ ] **Bước 2: Kiểm tra TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "services.ts"
```

Kết quả mong đợi: không có lỗi từ `mock/services.ts`.

- [ ] **Bước 3: Commit**

```bash
git add frontend/src/mock/services.ts
git commit -m "feat(mock): cập nhật mockServices — 4 dịch vụ clinic/home với audit log đầy đủ"
```

---

## Task 3: Viết lại Service Layer

**Files:**
- Modify: `frontend/src/services/service.service.ts`

**Interfaces:**
- Consumes: `ServiceItem`, `ServiceFormData`, `ServiceType`, `ServiceChangeLog` từ Task 1; `mockServices` từ Task 2
- Produces: `serviceService.{ getAll, getById, create, update, toggle }` — contract này bất biến khi swap BE

**Ghi chú cho người gắn backend:** Mỗi hàm có comment `// Khi gắn BE:` chỉ rõ endpoint và body tương ứng. Chỉ đổi phần thân hàm, giữ nguyên signature.

- [ ] **Bước 1: Viết lại `service.service.ts`**

```typescript
import type { ServiceItem, ServiceFormData, ServiceType, ServiceChangeLog } from '@/types'
import { mockServices } from '@/mock/services'
import { delay } from '@/utils/format'

// ─── Audit log helpers ────────────────────────────────────────────────────────
// Khi gắn BE: log do server tạo, bỏ toàn bộ block này
let nextLogId = 11 // mock data đã dùng id 1–10

function makeLog(
  hanh_dong: ServiceChangeLog['hanh_dong'],
  mo_ta: string,
): ServiceChangeLog {
  return {
    id: nextLogId++,
    thoi_gian: new Date().toISOString(),
    hanh_dong,
    nguoi_thay_doi: 'Admin', // khi gắn BE: lấy tên từ JWT token
    mo_ta,
  }
}

// ─── Auto-generate mã dịch vụ (mock only) ────────────────────────────────────
// Khi gắn BE: server tự generate, không cần hàm này
function genMaDichVu(list: ServiceItem[]): string {
  const max = list.reduce((acc, s) => {
    const n = parseInt(s.ma_dich_vu.replace('DV', ''), 10)
    return isNaN(n) ? acc : Math.max(acc, n)
  }, 0)
  return `DV${String(max + 1).padStart(3, '0')}`
}

// ─── In-memory store (thay bằng axios calls khi gắn backend) ─────────────────
let _store: ServiceItem[] = [...mockServices]

// ─── Public API — signature KHÔNG thay đổi khi swap BE ───────────────────────
export const serviceService = {

  /**
   * Lấy danh sách dịch vụ, có thể lọc và tìm kiếm.
   * Khi gắn BE: GET /api/admin/services?loai=clinic&search=khám
   */
  async getAll(loai?: ServiceType | '', search?: string): Promise<ServiceItem[]> {
    await delay()
    let result = [..._store]
    if (loai) result = result.filter((s) => s.loai === loai)
    if (search?.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((s) => s.ten.toLowerCase().includes(q))
    }
    return result
  },

  /**
   * Lấy chi tiết 1 dịch vụ kèm audit log.
   * Khi gắn BE: GET /api/admin/services/:id
   */
  async getById(id: number): Promise<ServiceItem> {
    await delay(150)
    const found = _store.find((s) => s.id === id)
    if (!found) throw new Error('Dịch vụ không tồn tại')
    return { ...found }
  },

  /**
   * Tạo dịch vụ mới.
   * Khi gắn BE: POST /api/admin/services — body: ServiceFormData (không có ma_dich_vu)
   * BE trả về ServiceItem đầy đủ với ma_dich_vu do server generate.
   */
  async create(data: ServiceFormData): Promise<ServiceItem> {
    await delay(400)
    const newItem: ServiceItem = {
      ...data,
      id: Date.now(),
      ma_dich_vu: genMaDichVu(_store),
      khu_vuc: data.loai === 'home' ? (data.khu_vuc ?? []) : [],
      specialty_ten: null,
      so_bac_si: 0,
      so_luot_dat: 0,
      status: 'active',
      ngay_tao: new Date().toISOString(),
      ngay_cap_nhat: new Date().toISOString(),
      lich_su_thay_doi: [makeLog('tao_moi', 'Tạo dịch vụ mới')],
    }
    _store = [..._store, newItem]
    return { ...newItem }
  },

  /**
   * Cập nhật dịch vụ.
   * Khi gắn BE: PUT /api/admin/services/:id — body: { ...ServiceFormData, mo_ta_thay_doi?: string }
   */
  async update(
    id: number,
    data: ServiceFormData,
    mo_ta_thay_doi?: string,
  ): Promise<ServiceItem> {
    await delay(400)
    const log = makeLog('cap_nhat', mo_ta_thay_doi?.trim() || 'Cập nhật thông tin dịch vụ')
    let updated: ServiceItem | undefined
    _store = _store.map((s) => {
      if (s.id !== id) return s
      updated = {
        ...s,
        ...data,
        khu_vuc: data.loai === 'home' ? (data.khu_vuc ?? []) : [],
        ngay_cap_nhat: new Date().toISOString(),
        lich_su_thay_doi: [log, ...(s.lich_su_thay_doi ?? [])],
      }
      return updated
    })
    if (!updated) throw new Error('Dịch vụ không tồn tại')
    return { ...updated }
  },

  /**
   * Toggle ẩn / hiện dịch vụ.
   * Khi gắn BE: PATCH /api/admin/services/:id/toggle
   * BE trả về { id, status, active_appointments } — FE chỉ dùng id + status.
   */
  async toggle(id: number): Promise<ServiceItem> {
    await delay(250)
    let updated: ServiceItem | undefined
    _store = _store.map((s) => {
      if (s.id !== id) return s
      const nextStatus = s.status === 'active' ? 'inactive' : 'active'
      const log = makeLog(
        nextStatus === 'inactive' ? 'an' : 'hien',
        nextStatus === 'inactive' ? 'Ẩn dịch vụ' : 'Hiện lại dịch vụ',
      )
      updated = {
        ...s,
        status: nextStatus,
        ngay_cap_nhat: new Date().toISOString(),
        lich_su_thay_doi: [log, ...(s.lich_su_thay_doi ?? [])],
      }
      return updated
    })
    if (!updated) throw new Error('Dịch vụ không tồn tại')
    return { ...updated }
  },
}
```

- [ ] **Bước 2: Kiểm tra TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "service.service"
```

Kết quả mong đợi: không lỗi từ file này.

- [ ] **Bước 3: Commit**

```bash
git add frontend/src/services/service.service.ts
git commit -m "feat(service): viết lại serviceService — thêm create/update/getById, fix toggle, thêm audit log"
```

---

## Task 4: Build ServiceFormModal

**Files:**
- Create: `frontend/src/components/admin/services/ServiceFormModal.tsx`

**Interfaces:**
- Consumes: `ServiceItem`, `ServiceFormData`, `ServiceType` từ Task 1
- Produces:
  ```typescript
  // Props của component
  interface Props {
    open: boolean
    service: ServiceItem | null   // null = Thêm mới, ServiceItem = Sửa
    onClose: () => void
    onSave: (data: ServiceFormData, mo_ta_thay_doi?: string) => Promise<void>
  }
  ```

- [ ] **Bước 1: Tạo thư mục**

```bash
mkdir -p "frontend/src/components/admin/services"
```

- [ ] **Bước 2: Tạo `ServiceFormModal.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { ServiceItem, ServiceFormData, ServiceType } from '@/types'
import Icon from '@/components/admin/icons'

// ─── Specialties mock ─────────────────────────────────────────────────────────
// Khi gắn BE: fetch từ GET /api/specialties?status=active và lưu vào state
const SPECIALTIES = [
  { id: 1, ten: 'Nội tổng quát' },
  { id: 2, ten: 'Nhi khoa' },
  { id: 3, ten: 'Tim mạch' },
  { id: 4, ten: 'Da liễu' },
  { id: 5, ten: 'Thần kinh' },
  { id: 6, ten: 'Cơ xương khớp' },
  { id: 7, ten: 'Tai mũi họng' },
  { id: 8, ten: 'Mắt' },
]

// 13 quận/huyện nội thành Hà Nội — khi gắn BE có thể mở rộng
const HN_DISTRICTS = [
  'Hoàn Kiếm', 'Ba Đình', 'Đống Đa', 'Hai Bà Trưng',
  'Hoàng Mai', 'Thanh Xuân', 'Nam Từ Liêm', 'Bắc Từ Liêm',
  'Tây Hồ', 'Cầu Giấy', 'Long Biên', 'Hà Đông', 'Gia Lâm',
]

const EMPTY_FORM: ServiceFormData = {
  ten: '', loai: 'clinic', gia: 0,
  mo_ta_ngan: '', mo_ta: '',
  thoi_gian_phut: 30, gio_dat_truoc_toi_thieu: 2,
  ngay_ap_dung: '', gio_bat_dau: '', gio_ket_thuc: '',
  specialty_id: null, khu_vuc: [],
}

// ─── Validation theo 13 rule từ tài liệu ─────────────────────────────────────
function validate(data: ServiceFormData): Record<string, string> {
  const e: Record<string, string> = {}
  if (!data.ten.trim())            e.ten = 'Vui lòng nhập tên dịch vụ'
  else if (data.ten.length > 255)  e.ten = 'Tên không vượt quá 255 ký tự'
  if (!data.gia || data.gia <= 0)                e.gia = 'Giá phải lớn hơn 0'
  else if (!Number.isInteger(data.gia))          e.gia = 'Giá phải là số nguyên (VNĐ)'
  else if (data.gia > 100_000_000)               e.gia = 'Giá không vượt quá 100 triệu'
  if (!data.thoi_gian_phut || data.thoi_gian_phut < 10)   e.thoi_gian_phut = 'Thời lượng tối thiểu 10 phút'
  else if (data.thoi_gian_phut > 480)            e.thoi_gian_phut = 'Thời lượng tối đa 8 giờ (480 phút)'
  if (!data.gio_dat_truoc_toi_thieu || data.gio_dat_truoc_toi_thieu < 1) e.gio_dat_truoc_toi_thieu = 'Tối thiểu đặt trước 1 giờ'
  else if (data.gio_dat_truoc_toi_thieu > 48)    e.gio_dat_truoc_toi_thieu = 'Tối đa đặt trước 48 giờ'
  if (data.gio_bat_dau && data.gio_ket_thuc && data.gio_ket_thuc <= data.gio_bat_dau)
    e.gio_ket_thuc = 'Giờ kết thúc phải sau giờ bắt đầu'
  if (data.mo_ta_ngan && data.mo_ta_ngan.length > 500) e.mo_ta_ngan = 'Mô tả ngắn không vượt 500 ký tự'
  if (data.mo_ta && data.mo_ta.length > 5000)    e.mo_ta = 'Mô tả không vượt 5000 ký tự'
  return e
}

interface Props {
  open: boolean
  service: ServiceItem | null
  onClose: () => void
  onSave: (data: ServiceFormData, mo_ta_thay_doi?: string) => Promise<void>
}

export default function ServiceFormModal({ open, service, onClose, onSave }: Props) {
  const isEdit = service !== null
  const [form, setForm] = useState<ServiceFormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [motaThayDoi, setMotaThayDoi] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    if (service) {
      setForm({
        ten: service.ten,
        loai: service.loai,
        gia: service.gia,
        mo_ta_ngan: service.mo_ta_ngan ?? '',
        mo_ta: service.mo_ta ?? '',
        thoi_gian_phut: service.thoi_gian_phut,
        gio_dat_truoc_toi_thieu: service.gio_dat_truoc_toi_thieu,
        ngay_ap_dung: service.ngay_ap_dung ?? '',
        gio_bat_dau: service.gio_bat_dau ?? '',
        gio_ket_thuc: service.gio_ket_thuc ?? '',
        specialty_id: service.specialty_id ?? null,
        khu_vuc: service.khu_vuc ?? [],
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setErrors({})
    setMotaThayDoi('')
  }, [open, service])

  function handleLoaiChange(loai: ServiceType) {
    setForm((f) => ({
      ...f,
      loai,
      // Auto-set đặt trước mặc định theo loại
      gio_dat_truoc_toi_thieu: loai === 'clinic' ? 2 : 4,
    }))
  }

  function setField(field: keyof ServiceFormData, value: unknown) {
    setForm((f) => ({ ...f, [field]: value }))
    // Xoá lỗi ngay khi user bắt đầu sửa
    if (errors[field]) setErrors((e) => { const n = { ...e }; delete n[field]; return n })
  }

  function toggleDistrict(district: string, checked: boolean) {
    const current = form.khu_vuc ?? []
    setField('khu_vuc', checked ? [...current, district] : current.filter((k) => k !== district))
  }

  async function handleSubmit() {
    const errs = validate(form)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSubmitting(true)
    try {
      await onSave(form, isEdit ? motaThayDoi : undefined)
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800">
            {isEdit ? `Sửa dịch vụ — ${service.ma_dich_vu}` : 'Thêm dịch vụ mới'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        {/* Body scrollable */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">

          {/* Mã dịch vụ — readonly */}
          <FormField label="Mã dịch vụ">
            <input
              type="text"
              value={isEdit ? service.ma_dich_vu : 'Tự động'}
              disabled
              className="input w-full cursor-not-allowed bg-slate-50 text-slate-400"
            />
          </FormField>

          {/* Tên dịch vụ */}
          <FormField label="Tên dịch vụ" required error={errors.ten}>
            <input
              type="text"
              value={form.ten}
              onChange={(e) => setField('ten', e.target.value)}
              placeholder="VD: Khám tổng quát tại viện"
              maxLength={255}
              className={`input w-full ${errors.ten ? 'border-red-300 focus:ring-red-200' : ''}`}
            />
          </FormField>

          {/* Loại hình — Radio cards */}
          <FormField label="Loại hình" required>
            <div className="grid grid-cols-2 gap-3">
              {([ 
                { value: 'clinic' as ServiceType, title: 'Phòng khám', desc: 'Bệnh nhân đến cơ sở. Đầy đủ thiết bị.' },
                { value: 'home'   as ServiceType, title: 'Tại nhà',    desc: 'Bác sĩ đến nhà bệnh nhân. Slot max 1 người, cần bác sĩ confirm.' },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleLoaiChange(opt.value)}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    form.loai === opt.value
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-3.5 w-3.5 flex-shrink-0 rounded-full border-2 ${
                      form.loai === opt.value ? 'border-brand-500 bg-brand-500' : 'border-slate-300'
                    }`} />
                    <span className="font-medium text-slate-800">{opt.title}</span>
                  </div>
                  <p className="mt-1 pl-[22px] text-xs text-slate-500">{opt.desc}</p>
                </button>
              ))}
            </div>
          </FormField>

          {/* Chuyên khoa */}
          <FormField label="Chuyên khoa liên quan">
            <select
              value={form.specialty_id ?? ''}
              onChange={(e) => setField('specialty_id', e.target.value ? Number(e.target.value) : null)}
              className="input w-full"
            >
              <option value="">Không chọn</option>
              {SPECIALTIES.map((sp) => (
                <option key={sp.id} value={sp.id}>{sp.ten}</option>
              ))}
            </select>
          </FormField>

          {/* Giá + Thời lượng */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Giá dịch vụ (VNĐ)" required error={errors.gia}>
              <input
                type="number"
                value={form.gia || ''}
                onChange={(e) => setField('gia', Math.floor(Number(e.target.value)))}
                min={1} step={1000}
                placeholder="200000"
                className={`input w-full ${errors.gia ? 'border-red-300' : ''}`}
              />
              <p className="mt-1 text-xs text-slate-400">Bệnh nhân trả đúng số này khi đặt lịch</p>
            </FormField>
            <FormField label="Thời lượng (phút)" required error={errors.thoi_gian_phut}>
              <input
                type="number"
                value={form.thoi_gian_phut || ''}
                onChange={(e) => setField('thoi_gian_phut', Number(e.target.value))}
                min={10} max={480}
                className={`input w-full ${errors.thoi_gian_phut ? 'border-red-300' : ''}`}
              />
            </FormField>
          </div>

          {/* Đặt trước tối thiểu */}
          <FormField label="Đặt trước tối thiểu (giờ)" required error={errors.gio_dat_truoc_toi_thieu}>
            <input
              type="number"
              value={form.gio_dat_truoc_toi_thieu || ''}
              onChange={(e) => setField('gio_dat_truoc_toi_thieu', Number(e.target.value))}
              min={1} max={48}
              className={`input w-full ${errors.gio_dat_truoc_toi_thieu ? 'border-red-300' : ''}`}
            />
            <p className="mt-1 text-xs text-slate-400">
              Mặc định: {form.loai === 'clinic' ? '2' : '4'} giờ
            </p>
          </FormField>

          {/* Lịch áp dụng */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Lịch áp dụng <span className="font-normal text-slate-400">(hiển thị tổng quát cho bệnh nhân)</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <input
                  type="text"
                  value={form.ngay_ap_dung ?? ''}
                  onChange={(e) => setField('ngay_ap_dung', e.target.value)}
                  placeholder="T2–T7"
                  className="input w-full"
                />
                <p className="mt-1 text-xs text-slate-400">Ngày</p>
              </div>
              <div>
                <input type="time" value={form.gio_bat_dau ?? ''}
                  onChange={(e) => setField('gio_bat_dau', e.target.value)}
                  className="input w-full"
                />
                <p className="mt-1 text-xs text-slate-400">Từ</p>
              </div>
              <div>
                <input type="time" value={form.gio_ket_thuc ?? ''}
                  onChange={(e) => setField('gio_ket_thuc', e.target.value)}
                  className={`input w-full ${errors.gio_ket_thuc ? 'border-red-300' : ''}`}
                />
                <p className="mt-1 text-xs text-slate-400">Đến</p>
                {errors.gio_ket_thuc && <p className="mt-0.5 text-xs text-red-500">{errors.gio_ket_thuc}</p>}
              </div>
            </div>
          </div>

          {/* Khu vực hỗ trợ — chỉ hiện khi loai = 'home' */}
          {form.loai === 'home' && (
            <FormField label="Khu vực hỗ trợ">
              <div className="grid grid-cols-3 gap-x-4 gap-y-2.5 rounded-xl border border-slate-200 p-4">
                {HN_DISTRICTS.map((d) => (
                  <label key={d} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={(form.khu_vuc ?? []).includes(d)}
                      onChange={(e) => toggleDistrict(d, e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 accent-brand-500"
                    />
                    {d}
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                Giá nên bao gồm phí đi lại. Slot tại nhà tối đa 1 bệnh nhân, bác sĩ cần confirm thủ công.
              </p>
            </FormField>
          )}

          {/* Mô tả ngắn */}
          <FormField label="Mô tả ngắn" error={errors.mo_ta_ngan}>
            <div className="relative">
              <input
                type="text"
                value={form.mo_ta_ngan ?? ''}
                onChange={(e) => setField('mo_ta_ngan', e.target.value)}
                maxLength={500}
                placeholder="Hiển thị trong danh sách dịch vụ"
                className={`input w-full pr-16 ${errors.mo_ta_ngan ? 'border-red-300' : ''}`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                {(form.mo_ta_ngan ?? '').length}/500
              </span>
            </div>
          </FormField>

          {/* Mô tả chi tiết */}
          <FormField label="Mô tả chi tiết" error={errors.mo_ta}>
            <textarea
              value={form.mo_ta ?? ''}
              onChange={(e) => setField('mo_ta', e.target.value)}
              rows={4} maxLength={5000}
              placeholder="Hiển thị trong trang đặt lịch của bệnh nhân"
              className={`input w-full resize-y ${errors.mo_ta ? 'border-red-300' : ''}`}
            />
            <p className="mt-0.5 text-right text-xs text-slate-400">{(form.mo_ta ?? '').length}/5000</p>
          </FormField>

          {/* Mô tả cập nhật — chỉ hiện khi Sửa */}
          {isEdit && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <label className="mb-1.5 block text-sm font-medium text-blue-800">
                Mô tả cập nhật <span className="font-normal">(ghi vào lịch sử thay đổi)</span>
              </label>
              <div className="relative">
                <textarea
                  value={motaThayDoi}
                  onChange={(e) => setMotaThayDoi(e.target.value.slice(0, 300))}
                  rows={2}
                  placeholder="VD: Tăng giá từ 200.000đ lên 250.000đ..."
                  className="input w-full resize-none bg-white"
                />
                <span className="absolute bottom-2 right-3 text-xs text-slate-400">
                  {motaThayDoi.length}/300
                </span>
              </div>
              <p className="mt-1.5 text-xs text-blue-600">
                Để trống → ghi mặc định "Cập nhật thông tin dịch vụ"
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button onClick={onClose} className="btn-secondary" disabled={submitting}>Hủy</button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary disabled:opacity-60">
            {submitting ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Thêm dịch vụ'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Helper component (dùng nội bộ) ──────────────────────────────────────────
function FormField({
  label, required, error, children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
```

- [ ] **Bước 3: Kiểm tra TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "ServiceFormModal"
```

Kết quả mong đợi: không lỗi.

- [ ] **Bước 4: Commit**

```bash
git add frontend/src/components/admin/services/ServiceFormModal.tsx
git commit -m "feat(ui): thêm ServiceFormModal — Add/Edit dịch vụ với validation đầy đủ"
```

---

## Task 5: Build ServiceViewModal

**Files:**
- Create: `frontend/src/components/admin/services/ServiceViewModal.tsx`

**Interfaces:**
- Consumes: `ServiceItem`, `ServiceChangeLog` từ Task 1; `SERVICE_TYPE_LABEL` từ constants; `formatPrice`, `formatDateTime` từ format utils; `Badge` component
- Produces:
  ```typescript
  interface Props {
    open: boolean
    service: ServiceItem | null
    onClose: () => void
    onEdit: (service: ServiceItem) => void  // đóng modal xem, mở modal sửa
  }
  ```

- [ ] **Bước 1: Tạo `ServiceViewModal.tsx`**

```tsx
import type { ServiceItem, ServiceChangeLog } from '@/types'
import { SERVICE_TYPE_LABEL } from '@/utils/constants'
import { formatPrice, formatDateTime } from '@/utils/format'
import Badge from '@/components/common/Badge'
import Icon from '@/components/admin/icons'

// Badge config theo loại hành động
const LOG_CONFIG: Record<
  ServiceChangeLog['hanh_dong'],
  { color: 'green' | 'blue' | 'red'; label: string }
> = {
  tao_moi:  { color: 'green', label: 'Tạo mới' },
  cap_nhat: { color: 'blue',  label: 'Cập nhật' },
  an:       { color: 'red',   label: 'Đã ẩn' },
  hien:     { color: 'green', label: 'Đã hiện' },
}

interface Props {
  open: boolean
  service: ServiceItem | null
  onClose: () => void
  onEdit: (service: ServiceItem) => void
}

export default function ServiceViewModal({ open, service, onClose, onEdit }: Props) {
  if (!open || !service) return null

  // Sắp xếp log mới nhất lên trên
  const logs = [...(service.lich_su_thay_doi ?? [])].sort(
    (a, b) => new Date(b.thoi_gian).getTime() - new Date(a.thoi_gian).getTime(),
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-800">Chi tiết dịch vụ</h2>
            <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 font-mono text-xs text-slate-500">
              {service.ma_dich_vu}
            </span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">

          {/* ── Thông tin dịch vụ ── */}
          <section>
            <div className="mb-3 flex flex-wrap items-start gap-2">
              <h3 className="text-base font-semibold text-slate-800">{service.ten}</h3>
              <Badge color={service.loai === 'clinic' ? 'blue' : 'yellow'}>
                {SERVICE_TYPE_LABEL[service.loai]}
              </Badge>
              <Badge color={service.status === 'active' ? 'green' : 'gray'}>
                {service.status === 'active' ? 'Hoạt động' : 'Đã ẩn'}
              </Badge>
            </div>

            {/* Grid thông số chính */}
            <dl className="grid grid-cols-3 gap-x-4 gap-y-3 text-sm">
              <InfoCell label="Giá dịch vụ"   value={formatPrice(service.gia)} />
              <InfoCell label="Thời lượng"     value={`${service.thoi_gian_phut} phút`} />
              <InfoCell label="Đặt trước"      value={`${service.gio_dat_truoc_toi_thieu} giờ`} />
              <InfoCell label="Chuyên khoa"    value={service.specialty_ten ?? '—'} />
              <InfoCell label="Số bác sĩ"      value={`${service.so_bac_si ?? 0} bác sĩ`} />
              <InfoCell label="Lượt đặt"       value={`${service.so_luot_dat ?? 0} lần`} />
            </dl>

            {/* Lịch áp dụng */}
            {(service.ngay_ap_dung || service.gio_bat_dau) && (
              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <span className="font-medium">Lịch áp dụng:</span>{' '}
                {service.ngay_ap_dung}
                {service.gio_bat_dau && `, ${service.gio_bat_dau}–${service.gio_ket_thuc}`}
              </div>
            )}

            {/* Khu vực (home only) */}
            {service.loai === 'home' && (service.khu_vuc?.length ?? 0) > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Khu vực phục vụ
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {service.khu_vuc!.map((k) => (
                    <span key={k} className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs text-yellow-700">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Mô tả ngắn */}
            {service.mo_ta_ngan && (
              <p className="mt-3 text-sm italic text-slate-500">"{service.mo_ta_ngan}"</p>
            )}

            {/* Mô tả chi tiết */}
            {service.mo_ta && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Mô tả chi tiết
                </p>
                <p className="text-sm leading-relaxed text-slate-700">{service.mo_ta}</p>
              </div>
            )}

            {/* Ngày tạo / cập nhật */}
            <div className="mt-4 flex gap-5 text-xs text-slate-400">
              {service.ngay_tao        && <span>Tạo: {formatDateTime(service.ngay_tao)}</span>}
              {service.ngay_cap_nhat   && <span>Cập nhật: {formatDateTime(service.ngay_cap_nhat)}</span>}
            </div>
          </section>

          {/* ── Lịch sử thay đổi ── */}
          <section>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Lịch sử thay đổi
            </h4>
            {logs.length === 0 ? (
              <p className="text-sm text-slate-400">Chưa có lịch sử.</p>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => {
                  const cfg = LOG_CONFIG[log.hanh_dong]
                  return (
                    <div key={log.id} className="flex gap-3">
                      <div className="mt-0.5 flex-shrink-0">
                        <Badge color={cfg.color}>{cfg.label}</Badge>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                          <span className="font-medium text-slate-700">{log.nguoi_thay_doi}</span>
                          <span>·</span>
                          <span>{formatDateTime(log.thoi_gian)}</span>
                        </div>
                        {log.mo_ta && (
                          <p className="mt-0.5 text-sm text-slate-600">{log.mo_ta}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button onClick={onClose} className="btn-secondary">Đóng</button>
          <button
            onClick={() => onEdit(service)}
            className="btn-primary flex items-center gap-1.5"
          >
            <Icon name="file-text" className="h-4 w-4" />
            Sửa dịch vụ này
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-800">{value}</dd>
    </div>
  )
}
```

- [ ] **Bước 2: Kiểm tra TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "ServiceViewModal"
```

Kết quả mong đợi: không lỗi.

- [ ] **Bước 3: Commit**

```bash
git add frontend/src/components/admin/services/ServiceViewModal.tsx
git commit -m "feat(ui): thêm ServiceViewModal — xem chi tiết dịch vụ và audit log timeline"
```

---

## Task 6: Viết lại ManageServices (trang chính)

**Files:**
- Modify: `frontend/src/pages/admin/ManageServices.tsx`

**Interfaces:**
- Consumes: `serviceService.{ getAll, create, update, toggle }` từ Task 3; `ServiceFormModal` từ Task 4; `ServiceViewModal` từ Task 5; `ServiceItem`, `ServiceType`, `ServiceFormData` từ Task 1

- [ ] **Bước 1: Viết lại `ManageServices.tsx`**

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { serviceService } from '@/services/service.service'
import type { ServiceItem, ServiceType, ServiceFormData } from '@/types'
import { SERVICE_TYPE_LABEL } from '@/utils/constants'
import { formatPrice } from '@/utils/format'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Icon from '@/components/admin/icons'
import ServiceFormModal from '@/components/admin/services/ServiceFormModal'
import ServiceViewModal from '@/components/admin/services/ServiceViewModal'

// ─── Constants ────────────────────────────────────────────────────────────────
const TYPE_TABS: { value: ServiceType | ''; label: string }[] = [
  { value: '',        label: 'Tất cả' },
  { value: 'clinic',  label: 'Phòng khám' },
  { value: 'home',    label: 'Tại nhà' },
]

const TYPE_BADGE_COLOR: Record<ServiceType, 'blue' | 'yellow'> = {
  clinic: 'blue',
  home:   'yellow',
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ManageServices() {
  // ── Danh sách đã lọc (hiển thị trong bảng) ──
  const [services, setServices]     = useState<ServiceItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [activeType, setActiveType] = useState<ServiceType | ''>('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch]         = useState('')

  // ── Toàn bộ list (để tính stats, không bị ảnh hưởng bởi filter) ──
  const [allServices, setAllServices] = useState<ServiceItem[]>([])

  // ── Modal state ──
  // formTarget: null=đóng, 'new'=Thêm, ServiceItem=Sửa
  const [formTarget, setFormTarget]   = useState<ServiceItem | 'new' | null>(null)
  const [viewTarget, setViewTarget]   = useState<ServiceItem | null>(null)
  const [toggleTarget, setToggleTarget] = useState<ServiceItem | null>(null)

  // ── Debounce search 300ms ──
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // ── Load danh sách lọc ──
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    serviceService.getAll(activeType, search)
      .then((data) => { if (!cancelled) setServices(data) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [activeType, search])

  // ── Load toàn bộ list cho stats ──
  const refreshStats = useCallback(() => {
    serviceService.getAll().then(setAllServices)
  }, [])

  useEffect(() => { refreshStats() }, [refreshStats])

  // ── Stats ──
  const stats = useMemo(() => ({
    total:    allServices.length,
    active:   allServices.filter((s) => s.status === 'active').length,
    inactive: allServices.filter((s) => s.status === 'inactive').length,
    clinic:   allServices.filter((s) => s.loai === 'clinic').length,
    home:     allServices.filter((s) => s.loai === 'home').length,
  }), [allServices])

  // ── Handlers ──
  async function handleSave(data: ServiceFormData, mo_ta?: string) {
    if (formTarget === 'new') {
      const created = await serviceService.create(data)
      setServices((prev) => [...prev, created])
    } else if (formTarget) {
      const updated = await serviceService.update(formTarget.id, data, mo_ta)
      setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    }
    setFormTarget(null)
    refreshStats()
  }

  async function handleToggleConfirm() {
    if (!toggleTarget) return
    const id = toggleTarget.id
    setToggleTarget(null)
    const updated = await serviceService.toggle(id)
    setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    refreshStats()
  }

  function handleEditFromView(service: ServiceItem) {
    setViewTarget(null)
    setFormTarget(service)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Quản lý dịch vụ"
        description="Cấu hình dịch vụ khám bệnh và giá trong hệ thống."
      />

      {/* ── Stats bar ── */}
      <div className="mb-4 grid grid-cols-5 gap-3">
        {[
          { label: 'Tổng dịch vụ',  value: stats.total,    color: 'text-slate-700' },
          { label: 'Hoạt động',     value: stats.active,   color: 'text-green-600' },
          { label: 'Đã ẩn',         value: stats.inactive, color: 'text-slate-400' },
          { label: 'Phòng khám',    value: stats.clinic,   color: 'text-blue-600'  },
          { label: 'Tại nhà',       value: stats.home,     color: 'text-yellow-600' },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="mt-1 text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filter + Search + Add ── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Tabs */}
        <div className="card flex gap-1 p-1.5">
          {TYPE_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setActiveType(t.value)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeType === t.value
                  ? 'bg-brand-500 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[220px] flex-1">
          <Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên dịch vụ..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input w-full pl-9"
          />
        </div>

        {/* Thêm mới */}
        <button
          onClick={() => setFormTarget('new')}
          className="btn-primary flex items-center gap-1.5"
        >
          <Icon name="plus" className="h-4 w-4" />
          Thêm dịch vụ
        </button>
      </div>

      {/* ── Bảng dịch vụ ── */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                {['Mã DV', 'Tên dịch vụ', 'Loại', 'Chuyên khoa', 'Giá', 'Thời lượng', 'Lịch áp dụng', 'Bác sĩ', 'Trạng thái', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-400">Đang tải...</td>
                </tr>
              ) : services.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-400">Không tìm thấy dịch vụ nào.</td>
                </tr>
              ) : services.map((s) => {
                const dim = s.status === 'inactive' ? 'opacity-40' : ''
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    {/* Các cột data mờ khi inactive, cột action giữ nguyên */}
                    <td className={`px-4 py-3 font-mono text-xs text-slate-500 ${dim}`}>{s.ma_dich_vu}</td>
                    <td className={`px-4 py-3 ${dim}`}>
                      <div className="font-medium text-slate-800">{s.ten}</div>
                      {s.mo_ta_ngan && (
                        <div className="mt-0.5 line-clamp-1 text-xs text-slate-400">{s.mo_ta_ngan}</div>
                      )}
                    </td>
                    <td className={`px-4 py-3 ${dim}`}>
                      <Badge color={TYPE_BADGE_COLOR[s.loai]}>{SERVICE_TYPE_LABEL[s.loai]}</Badge>
                    </td>
                    <td className={`px-4 py-3 text-slate-500 ${dim}`}>{s.specialty_ten ?? '—'}</td>
                    <td className={`px-4 py-3 font-semibold text-slate-800 ${dim}`}>{formatPrice(s.gia)}</td>
                    <td className={`px-4 py-3 text-slate-600 ${dim}`}>{s.thoi_gian_phut} ph</td>
                    <td className={`px-4 py-3 text-slate-500 ${dim}`}>
                      {s.ngay_ap_dung
                        ? `${s.ngay_ap_dung}, ${s.gio_bat_dau}–${s.gio_ket_thuc}`
                        : '—'}
                    </td>
                    <td className={`px-4 py-3 text-slate-600 ${dim}`}>{s.so_bac_si ?? 0} BS</td>
                    <td className={`px-4 py-3 ${dim}`}>
                      <Badge color={s.status === 'active' ? 'green' : 'gray'}>
                        {s.status === 'active' ? 'Hoạt động' : 'Đã ẩn'}
                      </Badge>
                    </td>
                    {/* Action — KHÔNG áp opacity */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewTarget(s)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600"
                        >
                          Xem
                        </button>
                        <button
                          onClick={() => setFormTarget(s)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => setToggleTarget(s)}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                            s.status === 'active'
                              ? 'border-slate-200 bg-white text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
                              : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                          }`}
                        >
                          {s.status === 'active' ? 'Ẩn' : 'Hiện'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modals ── */}
      <ServiceFormModal
        open={formTarget !== null}
        service={formTarget === 'new' ? null : formTarget}
        onClose={() => setFormTarget(null)}
        onSave={handleSave}
      />

      <ServiceViewModal
        open={viewTarget !== null}
        service={viewTarget}
        onClose={() => setViewTarget(null)}
        onEdit={handleEditFromView}
      />

      <ConfirmDialog
        open={!!toggleTarget}
        title={toggleTarget?.status === 'active' ? 'Ẩn dịch vụ?' : 'Hiện dịch vụ?'}
        message={
          toggleTarget?.status === 'active'
            ? `Dịch vụ "${toggleTarget?.ten}" sẽ bị ẩn. Bệnh nhân không thể đặt thêm lịch mới. Các lịch hẹn đang chờ không bị hủy.`
            : `Dịch vụ "${toggleTarget?.ten}" sẽ hiển thị trở lại. Bệnh nhân có thể đặt lịch.`
        }
        confirmText={toggleTarget?.status === 'active' ? 'Ẩn dịch vụ' : 'Hiện dịch vụ'}
        danger={toggleTarget?.status === 'active'}
        onConfirm={handleToggleConfirm}
        onCancel={() => setToggleTarget(null)}
      />
    </div>
  )
}
```

- [ ] **Bước 2: Kiểm tra TypeScript toàn bộ**

```bash
cd frontend && npx tsc --noEmit 2>&1
```

Kết quả mong đợi: **0 lỗi**.

- [ ] **Bước 3: Chạy dev server và kiểm tra thủ công**

```bash
cd frontend && npm run dev
```

Mở trình duyệt tại `http://localhost:5173/admin/services` và kiểm tra theo checklist:

- [ ] Stats bar hiển thị đúng: Tổng=4, Hoạt động=3, Đã ẩn=1, Phòng khám=2, Tại nhà=2
- [ ] Tab "Tất cả" hiện 4 dịch vụ; tab "Tại nhà" hiện 2
- [ ] Search "tổng quát" → chỉ hiện DV001
- [ ] Dịch vụ DV004 (inactive) → cột data mờ, cột action nút vẫn rõ
- [ ] Nút "Thêm dịch vụ" → mở modal, `Mã dịch vụ` hiện "Tự động"
- [ ] Chọn loại "Tại nhà" → hiện checkbox khu vực; quay lại "Phòng khám" → checkbox ẩn
- [ ] `Đặt trước tối thiểu` tự điền 2 (clinic) hoặc 4 (home) khi chuyển loại
- [ ] Submit form trống → hiện lỗi validation tất cả trường bắt buộc
- [ ] Submit form hợp lệ → dịch vụ mới xuất hiện trong bảng, stats cập nhật
- [ ] Nút "Sửa" → mở modal Sửa với dữ liệu hiện tại, có thêm ô "Mô tả cập nhật"
- [ ] Lưu sửa → dịch vụ cập nhật trong bảng
- [ ] Nút "Xem" → mở modal Xem chi tiết với audit log đúng thứ tự mới nhất lên trên
- [ ] Trong modal Xem → nút "Sửa dịch vụ này" → đóng modal Xem, mở modal Sửa
- [ ] Nút "Ẩn" DV001 → ConfirmDialog với message đúng → confirm → DV001 chuyển sang mờ
- [ ] Nút "Hiện" DV004 → ConfirmDialog → confirm → DV004 hiển thị bình thường
- [ ] Xem audit log DV001 sau khi Ẩn → log "Đã ẩn" xuất hiện đầu tiên

- [ ] **Bước 4: Commit cuối**

```bash
git add frontend/src/pages/admin/ManageServices.tsx
git commit -m "feat(admin): hoàn thiện trang Quản lý dịch vụ C4 — stats, filter, bảng 10 cột, modal thêm/sửa/xem, audit log"
```

---

## Checklist tự review sau khi hoàn thành

### Spec coverage
- [x] Stats bar (Tổng/Hoạt động/Đã ẩn/Phòng khám/Tại nhà)
- [x] Tab filter (Tất cả/Phòng khám/Tại nhà) + search debounce
- [x] Bảng 10 cột: Mã DV, Tên, Loại, Chuyên khoa, Giá, Thời lượng, Lịch áp dụng, Bác sĩ, Trạng thái, Hành động
- [x] Dòng inactive: data mờ 40%, action giữ nguyên
- [x] Modal Thêm: ma_dich_vu = "Tự động", form dynamic clinic/home
- [x] Modal Sửa: ma_dich_vu readonly, có ô "Mô tả cập nhật"
- [x] Validation 13 rule đầy đủ với error message cụ thể
- [x] Auto-set `gio_dat_truoc_toi_thieu` khi đổi loại (2 clinic / 4 home)
- [x] Checkbox khu vực 13 quận/huyện (chỉ hiện khi loai=home)
- [x] Modal Xem chi tiết: thông tin đầy đủ + audit log mới nhất lên trên
- [x] Badge màu cho từng loại log (tao_moi=xanh, cap_nhat=xanh dương, an=đỏ, hien=xanh)
- [x] Nút "Sửa dịch vụ này" trong modal Xem → chuyển sang modal Sửa
- [x] ConfirmDialog ẩn: message giải thích rõ lịch cũ không bị hủy
- [x] Audit log tự động ghi khi create/update/toggle
- [x] serviceService signature bất biến — comment chỉ rõ endpoint BE tương ứng

### Backend readiness
- [x] Field names khớp DB schema (`gia`, `status: 'active'|'inactive'`, `loai: 'clinic'|'home'`)
- [x] `serviceService` là single point of truth — UI không import mock trực tiếp
- [x] Mỗi hàm trong serviceService có comment `// Khi gắn BE:` rõ ràng
- [x] `ma_dich_vu` FE không truyền khi create (BE tự generate)
- [x] `khu_vuc: string[]` map tới bảng `service_areas` — comment ghi rõ
- [x] `specialty_ten` là display-only (joined), không gửi lên BE khi save
