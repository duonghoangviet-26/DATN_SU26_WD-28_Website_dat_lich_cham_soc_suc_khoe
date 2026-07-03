# Luồng Khám Chuyên khoa — Điều hướng Client (Tầng 1–3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng 3 trang client mới (`ServicesHome`, `SpecialtyList`, `SpecialtyDoctors`) cho phép bệnh nhân duyệt danh mục dịch vụ → chọn chuyên khoa → xem danh sách bác sĩ, theo đúng luồng 3 tầng mô tả trong `docs/superpowers/specs/2026-07-03-service-navigation-flow.md` mục 3.1.

**Architecture:** Toàn bộ trang mới đọc dữ liệu qua lớp `services/*.service.ts` hiện có (KHÔNG gọi mock trực tiếp), theo đúng convention `Page → service → mock data` đã áp dụng cho mọi trang Admin. Route mới gắn dưới `ClientLayout` hiện có (không cần `ProtectedRoute` — duyệt dịch vụ không yêu cầu đăng nhập). Nút "Đặt lịch" hiển thị Toast "đang hoàn thiện" thay vì submit thật — luồng đặt lịch + thanh toán thật đã được xác định là ngoài phạm vi ở `docs/superpowers/specs/2026-07-02-known-issues-out-of-scope.md`.

**Tech Stack:** React 18 + TypeScript + Vite + TailwindCSS + react-router-dom v6 + Vitest (cho test lớp service).

## Global Constraints

- Giai đoạn hiện tại là **mock-data-first**: `frontend/src/services/axiosInstance.ts` chưa được dùng ở bất kỳ service nào (xác nhận qua comment "CHƯA được dùng" trong file). Mọi hàm service mới PHẢI trả mock data, kèm comment `// Real API: ...` mô tả lời gọi axios thật sẽ thay vào sau — đúng pattern trong `service.service.ts`/`doctor.service.ts` hiện có.
- Trường dữ liệu giữ tiếng Việt khớp DB (`ho_ten`, `chuyen_khoa`, `gia_kham`...).
- Component đặt tên `PascalCase.tsx`, biến/hàm `camelCase`, import dùng alias `@/`.
- Trang **không bao giờ** gọi mock trực tiếp — luôn qua `services/*.service.ts`.
- Chỉ 2/10 danh mục ở Tầng 1 hoạt động thật: "Khám Chuyên khoa" và "Xét nghiệm y học" — 8 danh mục còn lại hiển thị nhưng bấm vào chỉ hiện Toast "đang phát triển" (theo spec mục 2).
- Đặt lịch thật (submit booking + thanh toán) NGOÀI PHẠM VI plan này — nút "Đặt lịch" chỉ hiện Toast thông báo.
- KHÔNG tự ý `git commit`/`git push` — người dùng tự review diff và commit (theo yêu cầu đã ghi nhận từ trước, tránh giáo viên phát hiện AI commit trong đồ án tốt nghiệp).

---

### Task 1: Bổ sung field `slug` cho chuyên khoa và `bao_hiem`/`related_services` cho bác sĩ

**Files:**
- Modify: `frontend/src/types/index.ts:152-159` (interface `SpecialtyItem`)
- Modify: `frontend/src/types/index.ts:105-124` (interface `DoctorProfile`)
- Modify: `frontend/src/mock/hospitals.ts:42-51` (mảng `mockSpecialties`)
- Modify: `frontend/src/mock/doctors.ts` (mảng `mockDoctors`, cả 6 bác sĩ)

**Interfaces:**
- Produces: `SpecialtyItem.slug: string`; `DoctorProfile.bao_hiem?: { nha_nuoc: boolean; bao_lanh: boolean }`; `DoctorProfile.related_services?: { id: string; ten: string; gia: number }[]`. Task 2 và Task 3 dùng các field này.

- [ ] **Step 1: Thêm `slug` vào interface `SpecialtyItem`**

Trong `frontend/src/types/index.ts`, sửa interface `SpecialtyItem`:

```ts
export interface SpecialtyItem {
  id: number
  ten: string
  mo_ta: string
  icon_url: string        // khớp backend ChuyenKhoa.icon_url (GAP-18)
  slug: string             // URL-friendly, khớp backend ChuyenKhoa.slug — dùng cho route /dich-vu/chuyen-khoa/:slug
  thu_tu: number
  status: 'active' | 'hidden'
}
```

- [ ] **Step 2: Thêm `bao_hiem` và `related_services` vào interface `DoctorProfile`**

Trong cùng file, sửa interface `DoctorProfile`:

```ts
// ViewModel kết hợp thông tin bác sĩ + user (dùng cho trang danh sách)
export interface DoctorProfile {
  id: number
  user_id: number
  ho_ten: string
  email: string
  anh_dai_dien?: string | null
  chuyen_khoa: string           // tên chuyên khoa — joined từ ChuyenKhoa.ten
  so_nam_kinh_nghiem: number
  gia_kham: number              // giá mỗi slot 30 phút
  tuoi_nhan_kham_tu?: number    // 0 = không giới hạn
  trang_thai_duyet: DoctorApproval
  diem_danh_gia: number
  so_danh_gia: number
  bang_cap: string
  kinh_nghiem?: string
  ly_do_tu_choi?: string | null
  // specialist = bác sĩ khám clinic | home_staff = nhân viên lấy mẫu tại nhà
  loai?: 'specialist' | 'home_staff'
  // Bảo hiểm bác sĩ chấp nhận — hiển thị ở trang chọn bác sĩ theo chuyên khoa
  bao_hiem?: { nha_nuoc: boolean; bao_lanh: boolean }
  // Dịch vụ liên quan (loai='related') mà bác sĩ này có thể chỉ định — hiển thị tham khảo
  related_services?: { id: string; ten: string; gia: number }[]
  ngay_tao: string
}
```

- [ ] **Step 3: Thêm `slug` cho từng chuyên khoa trong mock**

Trong `frontend/src/mock/hospitals.ts`, sửa mảng `mockSpecialties` (giữ nguyên toàn bộ field khác, chỉ thêm `slug`):

```ts
export const mockSpecialties: SpecialtyItem[] = [
  { id: 1, ten: 'Tim mạch', mo_ta: 'Khám và điều trị bệnh tim mạch', icon_url: '❤️', slug: 'tim-mach', thu_tu: 1, status: 'active' },
  { id: 2, ten: 'Nhi khoa', mo_ta: 'Chăm sóc sức khỏe trẻ em', icon_url: '👶', slug: 'nhi-khoa', thu_tu: 2, status: 'active' },
  { id: 3, ten: 'Da liễu', mo_ta: 'Các bệnh về da, tóc, móng', icon_url: '🧴', slug: 'da-lieu', thu_tu: 3, status: 'active' },
  { id: 4, ten: 'Sản phụ khoa', mo_ta: 'Sức khỏe sinh sản và thai kỳ', icon_url: '🌸', slug: 'san-phu-khoa', thu_tu: 4, status: 'active' },
  { id: 5, ten: 'Thần kinh', mo_ta: 'Bệnh lý hệ thần kinh', icon_url: '🧠', slug: 'than-kinh', thu_tu: 5, status: 'active' },
  { id: 6, ten: 'Nội tổng quát', mo_ta: 'Khám và điều trị bệnh nội khoa', icon_url: '🩺', slug: 'noi-tong-quat', thu_tu: 6, status: 'active' },
  { id: 7, ten: 'Mắt', mo_ta: 'Các bệnh về mắt và thị lực', icon_url: '👁️', slug: 'mat', thu_tu: 7, status: 'active' },
  { id: 8, ten: 'Tai Mũi Họng', mo_ta: 'Khám tai, mũi, họng', icon_url: '👂', slug: 'tai-mui-hong', thu_tu: 8, status: 'hidden' },
]
```

- [ ] **Step 4: Thêm `bao_hiem` và `related_services` cho từng bác sĩ trong mock**

Trong `frontend/src/mock/doctors.ts`, sửa từng object trong mảng `mockDoctors` — thêm 2 field mới vào cuối mỗi object (trước `ngay_tao`), giữ nguyên toàn bộ field khác:

```ts
import type { DoctorProfile } from '@/types'

export const mockDoctors: DoctorProfile[] = [
  {
    id: 1, user_id: 10,
    ho_ten: 'BS. Lê Hoàng Cường', email: 'cuong.le@vitafamily.vn',
    anh_dai_dien: null,
    chuyen_khoa: 'Tim mạch', so_nam_kinh_nghiem: 12,
    gia_kham: 350000, tuoi_nhan_kham_tu: 0, trang_thai_duyet: 'approved',
    diem_danh_gia: 4.8, so_danh_gia: 124,
    bang_cap: 'Tiến sĩ Y khoa — ĐH Y Hà Nội',
    loai: 'specialist',
    bao_hiem: { nha_nuoc: true, bao_lanh: true },
    related_services: [
      { id: 'mock-svc-001', ten: 'Siêu âm tim', gia: 350000 },
      { id: 'mock-svc-002', ten: 'Điện tâm đồ (ECG)', gia: 150000 },
    ],
    ngay_tao: '2026-01-20T09:00:00',
  },
  {
    id: 2, user_id: 11,
    ho_ten: 'BS. Phạm Thu Dung', email: 'dung.pham@vitafamily.vn',
    anh_dai_dien: null,
    chuyen_khoa: 'Nhi khoa', so_nam_kinh_nghiem: 8,
    gia_kham: 280000, tuoi_nhan_kham_tu: 0, trang_thai_duyet: 'approved',
    diem_danh_gia: 4.6, so_danh_gia: 87,
    bang_cap: 'Thạc sĩ Y khoa — ĐH Y Dược TP.HCM',
    loai: 'specialist',
    bao_hiem: { nha_nuoc: true, bao_lanh: false },
    related_services: [],
    ngay_tao: '2026-02-05T10:30:00',
  },
  {
    id: 3, user_id: 12,
    ho_ten: 'BS. Đỗ Minh Khoa', email: 'khoa.do@vitafamily.vn',
    anh_dai_dien: null,
    chuyen_khoa: 'Da liễu', so_nam_kinh_nghiem: 5,
    gia_kham: 220000, tuoi_nhan_kham_tu: 0, trang_thai_duyet: 'pending',
    diem_danh_gia: 0, so_danh_gia: 0,
    bang_cap: 'Bác sĩ Y khoa — ĐH Y Dược Cần Thơ',
    loai: 'specialist',
    bao_hiem: { nha_nuoc: false, bao_lanh: false },
    related_services: [],
    ngay_tao: '2026-04-10T14:00:00',
  },
  {
    id: 4, user_id: 13,
    ho_ten: 'BS. Nguyễn Thị Mai', email: 'mai.nguyen@vitafamily.vn',
    anh_dai_dien: null,
    chuyen_khoa: 'Sản phụ khoa', so_nam_kinh_nghiem: 15,
    gia_kham: 400000, tuoi_nhan_kham_tu: 0, trang_thai_duyet: 'pending',
    diem_danh_gia: 0, so_danh_gia: 0,
    bang_cap: 'Phó Giáo sư — ĐH Y Hà Nội',
    loai: 'specialist',
    bao_hiem: { nha_nuoc: true, bao_lanh: false },
    related_services: [],
    ngay_tao: '2026-04-12T09:15:00',
  },
  {
    id: 5, user_id: 14,
    ho_ten: 'BS. Trần Quốc Hùng', email: 'hung.tran@vitafamily.vn',
    anh_dai_dien: null,
    chuyen_khoa: 'Nội tổng quát', so_nam_kinh_nghiem: 3,
    gia_kham: 180000, tuoi_nhan_kham_tu: 0, trang_thai_duyet: 'rejected',
    diem_danh_gia: 0, so_danh_gia: 0,
    bang_cap: 'Bác sĩ Y khoa — ĐH Y Dược TP.HCM',
    ly_do_tu_choi: 'Hồ sơ bằng cấp chưa được công chứng đầy đủ.',
    loai: 'specialist',
    bao_hiem: { nha_nuoc: true, bao_lanh: false },
    related_services: [
      { id: 'mock-svc-005', ten: 'Xét nghiệm máu tổng quát', gia: 120000 },
      { id: 'mock-svc-006', ten: 'Chụp X-quang phổi', gia: 180000 },
    ],
    ngay_tao: '2026-03-28T16:00:00',
  },
  {
    id: 6, user_id: 15,
    ho_ten: 'BS. Vũ Thị Lan', email: 'lan.vu@vitafamily.vn',
    anh_dai_dien: null,
    chuyen_khoa: 'Thần kinh', so_nam_kinh_nghiem: 10,
    gia_kham: 320000, tuoi_nhan_kham_tu: 0, trang_thai_duyet: 'suspended',
    diem_danh_gia: 3.2, so_danh_gia: 45,
    bang_cap: 'Tiến sĩ Y khoa — ĐH Y Dược TP.HCM',
    loai: 'specialist',
    bao_hiem: { nha_nuoc: false, bao_lanh: false },
    related_services: [],
    ngay_tao: '2026-02-20T08:00:00',
  },
]
```

- [ ] **Step 5: Kiểm tra TypeScript build không lỗi**

Run: `cd frontend && npx tsc --noEmit`
Expected: Không có lỗi liên quan `types/index.ts`, `mock/hospitals.ts`, `mock/doctors.ts`.

---

### Task 2: Hàm service cho duyệt chuyên khoa + bác sĩ theo chuyên khoa (kèm test)

**Files:**
- Modify: `frontend/src/services/specialty.service.ts`
- Modify: `frontend/src/services/doctor.service.ts`
- Create: `frontend/src/__tests__/services/specialty.service.test.ts`
- Create: `frontend/src/__tests__/services/doctor-browse.service.test.ts`

**Interfaces:**
- Consumes: `SpecialtyItem.slug` (Task 1), `DoctorProfile.trang_thai_duyet/chuyen_khoa` (đã có).
- Produces: `specialtyService.getAllActive(): Promise<SpecialtyBrowseItem[]>`; `specialtyService.getBySlug(slug: string): Promise<SpecialtyBrowseItem | null>`; `doctorService.getBySpecialtySlug(slug: string): Promise<DoctorProfile[]>`. Task 5/6 dùng các hàm này.

- [ ] **Step 1: Viết test cho `specialtyService.getAllActive()` và `getBySlug()` (test trước, sẽ fail vì hàm chưa tồn tại)**

Tạo `frontend/src/__tests__/services/specialty.service.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

async function freshService() {
  vi.resetModules()
  const mod = await import('@/services/specialty.service')
  return mod.specialtyService
}

describe('getAllActive()', () => {
  let svc: Awaited<ReturnType<typeof freshService>>
  beforeEach(async () => { svc = await freshService() })

  it('không trả về chuyên khoa status=hidden (Tai Mũi Họng)', async () => {
    const list = await svc.getAllActive()
    expect(list.some((s) => s.slug === 'tai-mui-hong')).toBe(false)
  })

  it('mỗi item có slug khớp mock', async () => {
    const list = await svc.getAllActive()
    expect(list.find((s) => s.ten === 'Tim mạch')?.slug).toBe('tim-mach')
  })

  it('so_bac_si đếm đúng bác sĩ approved theo chuyên khoa Tim mạch', async () => {
    const list = await svc.getAllActive()
    const timMach = list.find((s) => s.slug === 'tim-mach')
    expect(timMach?.so_bac_si).toBe(1) // chỉ BS Lê Hoàng Cường approved
  })

  it('sắp xếp theo thu_tu tăng dần — Tim mạch trước Nhi khoa', async () => {
    const list = await svc.getAllActive()
    expect(list[0].slug).toBe('tim-mach')
    expect(list[1].slug).toBe('nhi-khoa')
  })
})

describe('getBySlug()', () => {
  let svc: Awaited<ReturnType<typeof freshService>>
  beforeEach(async () => { svc = await freshService() })

  it('slug tồn tại + active → trả về đúng chuyên khoa', async () => {
    const sp = await svc.getBySlug('tim-mach')
    expect(sp?.ten).toBe('Tim mạch')
  })

  it('slug thuộc chuyên khoa hidden → trả về null', async () => {
    const sp = await svc.getBySlug('tai-mui-hong')
    expect(sp).toBeNull()
  })

  it('slug không tồn tại → trả về null', async () => {
    const sp = await svc.getBySlug('khong-ton-tai')
    expect(sp).toBeNull()
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `cd frontend && npx vitest run src/__tests__/services/specialty.service.test.ts`
Expected: FAIL — `svc.getAllActive is not a function` (hàm chưa tồn tại).

- [ ] **Step 3: Implement `getAllActive()` và `getBySlug()` trong `specialty.service.ts`**

Thay toàn bộ nội dung `frontend/src/services/specialty.service.ts`:

```ts
import { mockSpecialties } from '@/mock/hospitals'
import { mockDoctors } from '@/mock/doctors'

const delay = (ms = 300) => new Promise<void>(r => setTimeout(r, ms))

export interface SpecialtyOption {
  id: string
  ten: string
}

// ViewModel cho trang duyệt dịch vụ (client) — nhiều field hơn SpecialtyOption
export interface SpecialtyBrowseItem {
  id: string
  ten: string
  mo_ta: string
  icon_url: string
  slug: string
  so_bac_si: number
}

function countApprovedDoctors(specialtyTen: string): number {
  return mockDoctors.filter(
    (d) => d.trang_thai_duyet === 'approved' && d.chuyen_khoa === specialtyTen,
  ).length
}

export const specialtyService = {
  async getAll(): Promise<SpecialtyOption[]> {
    await delay()
    return mockSpecialties
      .filter(s => s.status === 'active')
      .map(s => ({ id: String(s.id), ten: s.ten }))
    // Real API:
    // const res = await axiosInstance.get<ApiResponse<SpecialtyOption[]>>('/admin/specialties')
    // return res.data.data
  },

  // Tầng 2 — danh sách chuyên khoa cho trang duyệt dịch vụ (client)
  async getAllActive(): Promise<SpecialtyBrowseItem[]> {
    await delay()
    return mockSpecialties
      .filter((s) => s.status === 'active')
      .sort((a, b) => a.thu_tu - b.thu_tu)
      .map((s) => ({
        id: String(s.id),
        ten: s.ten,
        mo_ta: s.mo_ta,
        icon_url: s.icon_url,
        slug: s.slug,
        so_bac_si: countApprovedDoctors(s.ten),
      }))
    // Real API:
    // const res = await axiosInstance.get<ApiResponse<SpecialtyBrowseItem[]>>('/specialties')
    // return res.data.data
  },

  // Tầng 3 — chi tiết 1 chuyên khoa theo slug (dùng làm tiêu đề trang danh sách bác sĩ)
  async getBySlug(slug: string): Promise<SpecialtyBrowseItem | null> {
    await delay()
    const found = mockSpecialties.find((s) => s.slug === slug && s.status === 'active')
    if (!found) return null
    return {
      id: String(found.id),
      ten: found.ten,
      mo_ta: found.mo_ta,
      icon_url: found.icon_url,
      slug: found.slug,
      so_bac_si: countApprovedDoctors(found.ten),
    }
    // Real API:
    // const res = await axiosInstance.get<ApiResponse<SpecialtyBrowseItem>>(`/specialties/${slug}`)
    // return res.data.data
  },
}
```

- [ ] **Step 4: Chạy lại test, xác nhận PASS**

Run: `cd frontend && npx vitest run src/__tests__/services/specialty.service.test.ts`
Expected: PASS — 7 test đều xanh.

- [ ] **Step 5: Viết test cho `doctorService.getBySpecialtySlug()` (fail trước)**

Tạo `frontend/src/__tests__/services/doctor-browse.service.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

async function freshService() {
  vi.resetModules()
  const mod = await import('@/services/doctor.service')
  return mod.doctorService
}

describe('getBySpecialtySlug()', () => {
  let svc: Awaited<ReturnType<typeof freshService>>
  beforeEach(async () => { svc = await freshService() })

  it('trả về đúng bác sĩ approved theo chuyên khoa', async () => {
    const docs = await svc.getBySpecialtySlug('tim-mach')
    expect(docs.length).toBe(1)
    expect(docs[0].ho_ten).toBe('BS. Lê Hoàng Cường')
  })

  it('không trả bác sĩ pending', async () => {
    const docs = await svc.getBySpecialtySlug('da-lieu') // Đỗ Minh Khoa pending
    expect(docs.length).toBe(0)
  })

  it('không trả bác sĩ suspended', async () => {
    const docs = await svc.getBySpecialtySlug('than-kinh') // Vũ Thị Lan suspended
    expect(docs.length).toBe(0)
  })

  it('slug không tồn tại → mảng rỗng', async () => {
    const docs = await svc.getBySpecialtySlug('khong-ton-tai')
    expect(docs).toEqual([])
  })

  it('slug thuộc chuyên khoa hidden → mảng rỗng', async () => {
    const docs = await svc.getBySpecialtySlug('tai-mui-hong')
    expect(docs).toEqual([])
  })
})
```

- [ ] **Step 6: Chạy test, xác nhận FAIL**

Run: `cd frontend && npx vitest run src/__tests__/services/doctor-browse.service.test.ts`
Expected: FAIL — `svc.getBySpecialtySlug is not a function`.

- [ ] **Step 7: Implement `getBySpecialtySlug()` trong `doctor.service.ts`**

Trong `frontend/src/services/doctor.service.ts`, thêm import và hàm mới. File sau khi sửa:

```ts
import { mockDoctors } from '@/mock/doctors'
import { mockSpecialties } from '@/mock/hospitals'
import type { DoctorProfile, DoctorApproval } from '@/types'

const delay = (ms = 300) => new Promise<void>(r => setTimeout(r, ms))

let doctors = [...mockDoctors]

export const doctorService = {
  async getAll(trang_thai?: DoctorApproval | '', search?: string): Promise<DoctorProfile[]> {
    await delay()
    let list = [...doctors]
    if (trang_thai) list = list.filter(d => d.trang_thai_duyet === trang_thai)
    if (search?.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(d => d.ho_ten.toLowerCase().includes(q) || d.email.toLowerCase().includes(q))
    }
    return list
    // Real API:
    // const params: Record<string, string> = {}
    // if (trang_thai) params.trang_thai = trang_thai
    // if (search?.trim()) params.search = search.trim()
    // const res = await axiosInstance.get<ApiResponse<DoctorProfile[]>>('/admin/doctors', { params })
    // return res.data.data
  },

  async getById(id: string): Promise<DoctorProfile> {
    await delay()
    const doc = doctors.find(d => String(d.id) === String(id))
    if (!doc) throw new Error('Không tìm thấy bác sĩ')
    return { ...doc }
    // Real API:
    // const res = await axiosInstance.get<ApiResponse<DoctorProfile>>(`/admin/doctors/${id}`)
    // return res.data.data
  },

  async approve(id: string, phong_kham_mac_dinh?: string): Promise<DoctorProfile> {
    await delay()
    const doc = doctors.find(d => String(d.id) === String(id))
    if (!doc) throw new Error('Không tìm thấy bác sĩ')
    doc.trang_thai_duyet = 'approved'
    doc.ly_do_tu_choi = null
    return { ...doc }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<DoctorProfile>>(`/admin/doctors/${id}/approve`, phong_kham_mac_dinh ? { phong_kham_mac_dinh } : {})
    // return res.data.data
  },

  async reject(id: string, ly_do: string): Promise<DoctorProfile> {
    await delay()
    const doc = doctors.find(d => String(d.id) === String(id))
    if (!doc) throw new Error('Không tìm thấy bác sĩ')
    doc.trang_thai_duyet = 'rejected'
    doc.ly_do_tu_choi = ly_do
    return { ...doc }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<DoctorProfile>>(`/admin/doctors/${id}/reject`, { ly_do })
    // return res.data.data
  },

  async suspend(id: string): Promise<DoctorProfile> {
    await delay()
    const doc = doctors.find(d => String(d.id) === String(id))
    if (!doc) throw new Error('Không tìm thấy bác sĩ')
    doc.trang_thai_duyet = 'suspended'
    return { ...doc }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<DoctorProfile>>(`/admin/doctors/${id}/suspend`)
    // return res.data.data
  },

  async assignRoom(id: string, phong_kham_mac_dinh: string): Promise<DoctorProfile> {
    await delay()
    const doc = doctors.find(d => String(d.id) === String(id))
    if (!doc) throw new Error('Không tìm thấy bác sĩ')
    return { ...doc }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<DoctorProfile>>(`/admin/doctors/${id}/assign-room`, { phong_kham_mac_dinh })
    // return res.data.data
  },

  // Tầng 3 — danh sách bác sĩ approved theo chuyên khoa (client, dùng slug)
  async getBySpecialtySlug(slug: string): Promise<DoctorProfile[]> {
    await delay()
    const specialty = mockSpecialties.find((s) => s.slug === slug && s.status === 'active')
    if (!specialty) return []
    return doctors.filter(
      (d) => d.trang_thai_duyet === 'approved' && d.chuyen_khoa === specialty.ten,
    )
    // Real API:
    // const res = await axiosInstance.get<ApiResponse<DoctorProfile[]>>(`/specialties/${slug}/doctors`)
    // return res.data.data
  },
}
```

- [ ] **Step 8: Chạy lại test, xác nhận PASS**

Run: `cd frontend && npx vitest run src/__tests__/services/doctor-browse.service.test.ts`
Expected: PASS — 5 test đều xanh.

- [ ] **Step 9: Chạy toàn bộ test suite frontend, xác nhận không có regression**

Run: `cd frontend && npx vitest run`
Expected: Toàn bộ test (kể cả `schedule.service.test.ts`, `examination.service.test.ts`, `doctor-appointment.service.test.ts` đã có từ trước) đều PASS.

---

### Task 3: Component `DoctorCard` (2 cột — hồ sơ + đặt lịch)

**Files:**
- Create: `frontend/src/components/client/DoctorCard.tsx`

**Interfaces:**
- Consumes: `DoctorProfile` (đầy đủ field từ Task 1, gồm `bao_hiem`, `related_services`).
- Produces: `DoctorCard` component nhận props `{ doctor: DoctorProfile; onBook: () => void }`. Task 6 (`SpecialtyDoctors.tsx`) dùng component này.

- [ ] **Step 1: Tạo component**

Tạo `frontend/src/components/client/DoctorCard.tsx`:

```tsx
import type { DoctorProfile } from '@/types'

interface Props {
  doctor: DoctorProfile
  onBook: () => void
}

export default function DoctorCard({ doctor, onBook }: Props) {
  const initial = doctor.ho_ten.trim().split(' ').slice(-1)[0]?.[0] ?? 'BS'

  return (
    <div className="card grid gap-4 p-5 sm:grid-cols-2">
      {/* Trái: hồ sơ bác sĩ */}
      <div className="flex gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand-100 text-xl font-bold text-brand-600">
          {initial}
        </div>
        <div>
          <h3 className="font-semibold text-slate-800">{doctor.ho_ten}</h3>
          <p className="text-sm text-brand-600">{doctor.chuyen_khoa}</p>
          <p className="mt-1 text-sm text-slate-500">{doctor.so_nam_kinh_nghiem} năm kinh nghiệm</p>
          <p className="text-sm text-slate-500">{doctor.bang_cap}</p>
          {doctor.diem_danh_gia > 0 && (
            <p className="mt-1 text-sm text-amber-600">
              ★ {doctor.diem_danh_gia.toFixed(1)} ({doctor.so_danh_gia} đánh giá)
            </p>
          )}
        </div>
      </div>

      {/* Phải: thông tin đặt lịch */}
      <div className="flex flex-col justify-between border-t border-slate-100 pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-slate-800">
            {doctor.gia_kham.toLocaleString('vi-VN')}đ <span className="font-normal text-slate-500">/ 30 phút</span>
          </p>

          {(doctor.bao_hiem?.nha_nuoc || doctor.bao_hiem?.bao_lanh) && (
            <div className="flex flex-wrap gap-1.5">
              {doctor.bao_hiem?.nha_nuoc && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">BHYT nhà nước</span>
              )}
              {doctor.bao_hiem?.bao_lanh && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Bảo lãnh viện phí</span>
              )}
            </div>
          )}

          {doctor.related_services && doctor.related_services.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500">Dịch vụ có thể được bác sĩ chỉ định:</p>
              <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                {doctor.related_services.map((s) => (
                  <li key={s.id}>• {s.ten} — {s.gia.toLocaleString('vi-VN')}đ</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <button onClick={onBook} className="btn-primary mt-4 w-full text-sm">
          Đặt lịch
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Kiểm tra TypeScript build không lỗi**

Run: `cd frontend && npx tsc --noEmit`
Expected: Không có lỗi liên quan `DoctorCard.tsx`.

---

### Task 4: Trang `ServicesHome.tsx` (Tầng 1) + route + CTA ở trang chủ

**Files:**
- Create: `frontend/src/pages/client/ServicesHome.tsx`
- Modify: `frontend/src/routes/AppRoutes.tsx`
- Modify: `frontend/src/pages/client/Home.tsx`

**Interfaces:**
- Consumes: `Toast` component hiện có (`components/common/Toast.tsx`, props `{ message, type, onClose }`), `PageHeader` hiện có.
- Produces: Route `/dich-vu` render `ServicesHome`. Task 6 dùng đường dẫn `/dich-vu/chuyen-khoa/:slug` mà `ServicesHome` link tới.

- [ ] **Step 1: Tạo trang `ServicesHome.tsx`**

Tạo `frontend/src/pages/client/ServicesHome.tsx`:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import Toast from '@/components/common/Toast'

interface Category {
  key: string
  ten: string
  icon: string
  active: boolean
  path?: string
}

// Chỉ 2 danh mục hoạt động thật (xem docs/superpowers/specs/2026-07-03-service-navigation-flow.md mục 2).
// 8 danh mục còn lại hiển thị cho đủ giao diện nhưng bấm vào chỉ báo "đang phát triển".
const CATEGORIES: Category[] = [
  { key: 'chuyen-khoa', ten: 'Khám Chuyên khoa',    icon: '🩺', active: true,  path: '/dich-vu/chuyen-khoa' },
  { key: 'xet-nghiem',  ten: 'Xét nghiệm y học',     icon: '🧪', active: true,  path: '/dich-vu/xet-nghiem' },
  { key: 'tu-xa',       ten: 'Khám từ xa',           icon: '💻', active: false },
  { key: 'tong-quat',   ten: 'Khám tổng quát',       icon: '📋', active: false },
  { key: 'tinh-than',   ten: 'Sức khỏe tinh thần',   icon: '🧘', active: false },
  { key: 'nha-khoa',    ten: 'Khám nha khoa',        icon: '🦷', active: false },
  { key: 'phau-thuat',  ten: 'Gói Phẫu thuật',       icon: '🏥', active: false },
  { key: 'tieu-duong',  ten: 'Sống khỏe Tiểu đường', icon: '💉', active: false },
  { key: 'test',        ten: 'Bài Test Sức khỏe',    icon: '📝', active: false },
  { key: 'gan-ban',     ten: 'Y tế gần bạn',         icon: '📍', active: false },
]

export default function ServicesHome() {
  const [toast, setToast] = useState<string | null>(null)

  return (
    <div>
      <PageHeader
        title="Dịch vụ toàn diện"
        description="Chọn danh mục dịch vụ bạn cần — khám chuyên khoa hoặc xét nghiệm tại nhà."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {CATEGORIES.map((c) =>
          c.active ? (
            <Link
              key={c.key}
              to={c.path!}
              className="card-hover flex flex-col items-center gap-2 p-5 text-center"
            >
              <span className="text-3xl">{c.icon}</span>
              <span className="text-sm font-medium text-slate-800">{c.ten}</span>
            </Link>
          ) : (
            <button
              key={c.key}
              type="button"
              onClick={() => setToast('Tính năng đang được phát triển, vui lòng quay lại sau.')}
              className="card flex flex-col items-center gap-2 p-5 text-center opacity-60"
            >
              <span className="text-3xl">{c.icon}</span>
              <span className="text-sm font-medium text-slate-600">{c.ten}</span>
            </button>
          ),
        )}
      </div>

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  )
}
```

- [ ] **Step 2: Đăng ký route `/dich-vu` trong `AppRoutes.tsx`**

Trong `frontend/src/routes/AppRoutes.tsx`, thêm import:

```tsx
import Home from '@/pages/client/Home'
import ServicesHome from '@/pages/client/ServicesHome'
```

Và thêm route bên trong khối `<Route element={<ClientLayout />}>`:

```tsx
      {/* Khu vực khách (client) */}
      <Route element={<ClientLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/dich-vu" element={<ServicesHome />} />
      </Route>
```

- [ ] **Step 3: Thêm CTA "Khám phá dịch vụ" ở trang chủ**

Trong `frontend/src/pages/client/Home.tsx`, thêm 1 import và 1 nút trong khối nút hero, đồng thời cập nhật dòng ghi chú cuối trang cho đúng thực tế (không còn "chỉ tập trung Admin" nữa vì trang dịch vụ đã có):

```tsx
import { Link } from 'react-router-dom'
```

Sửa khối nút hero (thêm 1 `Link` mới):

```tsx
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/dich-vu" className="btn-primary px-6 py-2.5 text-base">
            Khám phá dịch vụ
          </Link>
          <Link to="/register" className="btn-secondary px-6 py-2.5 text-base">
            Bắt đầu miễn phí
          </Link>
        </div>
```

Sửa dòng ghi chú cuối trang:

```tsx
      <p className="mt-10 text-center text-sm text-slate-400">
        * Một số tính năng (đặt lịch, thanh toán) đang được hoàn thiện.
      </p>
```

- [ ] **Step 4: Chạy dev server và kiểm tra thủ công**

Run: `cd frontend && npm run dev`

Mở trình duyệt tại `http://localhost:5173/`:
- Xác nhận nút "Khám phá dịch vụ" hiển thị và điều hướng tới `/dich-vu`.
- Tại `/dich-vu`: xác nhận grid 10 danh mục hiển thị, 2 danh mục đầu (Khám Chuyên khoa, Xét nghiệm y học) có style khác (không mờ), 8 danh mục còn lại mờ hơn.
- Bấm vào 1 danh mục "đang phát triển" (VD: Khám từ xa) → Toast "Tính năng đang được phát triển..." hiện góc phải trên, tự biến mất sau ~4s.
- Bấm "Khám Chuyên khoa" → điều hướng sang `/dich-vu/chuyen-khoa` (sẽ 404 tạm thời cho tới khi Task 6 hoàn thành — dự kiến, không phải lỗi).

---

### Task 5: Trang `SpecialtyList.tsx` (Tầng 2 — danh sách chuyên khoa)

**Files:**
- Create: `frontend/src/pages/client/SpecialtyList.tsx`
- Modify: `frontend/src/routes/AppRoutes.tsx`

**Interfaces:**
- Consumes: `specialtyService.getAllActive(): Promise<SpecialtyBrowseItem[]>` (Task 2).
- Produces: Route `/dich-vu/chuyen-khoa` render `SpecialtyList`, link sang `/dich-vu/chuyen-khoa/:slug` mà Task 6 tiêu thụ.

- [ ] **Step 1: Tạo trang `SpecialtyList.tsx`**

Tạo `frontend/src/pages/client/SpecialtyList.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { specialtyService, type SpecialtyBrowseItem } from '@/services/specialty.service'
import PageHeader from '@/components/common/PageHeader'

export default function SpecialtyList() {
  const [specialties, setSpecialties] = useState<SpecialtyBrowseItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    specialtyService
      .getAllActive()
      .then((data) => {
        if (!ignore) setSpecialties(data)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  return (
    <div>
      <PageHeader title="Khám Chuyên khoa" description="Chọn chuyên khoa để xem danh sách bác sĩ." />

      {loading ? (
        <p className="text-sm text-slate-500">Đang tải...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {specialties.map((s) => (
            <Link key={s.id} to={`/dich-vu/chuyen-khoa/${s.slug}`} className="card-hover p-5 text-center">
              <span className="text-3xl">{s.icon_url}</span>
              <h3 className="mt-2 font-semibold text-slate-800">{s.ten}</h3>
              <p className="mt-1 text-xs text-slate-500">{s.so_bac_si} bác sĩ</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Đăng ký route trong `AppRoutes.tsx`**

Thêm import:

```tsx
import SpecialtyList from '@/pages/client/SpecialtyList'
```

Thêm route trong khối `<Route element={<ClientLayout />}>`:

```tsx
      <Route element={<ClientLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/dich-vu" element={<ServicesHome />} />
        <Route path="/dich-vu/chuyen-khoa" element={<SpecialtyList />} />
      </Route>
```

- [ ] **Step 3: Kiểm tra thủ công**

Với dev server đang chạy (`npm run dev`), mở `http://localhost:5173/dich-vu/chuyen-khoa`:
- Xác nhận hiển thị 7 chuyên khoa active (KHÔNG có "Tai Mũi Họng" vì status=hidden).
- Xác nhận "Tim mạch" hiển thị "1 bác sĩ".
- Bấm vào "Tim mạch" → điều hướng `/dich-vu/chuyen-khoa/tim-mach` (404 tạm thời tới khi Task 6 xong).

---

### Task 6: Trang `SpecialtyDoctors.tsx` (Tầng 3 — danh sách bác sĩ theo chuyên khoa) + E2E walkthrough

**Files:**
- Create: `frontend/src/pages/client/SpecialtyDoctors.tsx`
- Modify: `frontend/src/routes/AppRoutes.tsx`

**Interfaces:**
- Consumes: `specialtyService.getBySlug()`, `doctorService.getBySpecialtySlug()` (Task 2), `DoctorCard` (Task 3).
- Produces: Route `/dich-vu/chuyen-khoa/:slug` — điểm cuối của luồng 3 tầng "Khám Chuyên khoa".

- [ ] **Step 1: Tạo trang `SpecialtyDoctors.tsx`**

Tạo `frontend/src/pages/client/SpecialtyDoctors.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { specialtyService, type SpecialtyBrowseItem } from '@/services/specialty.service'
import { doctorService } from '@/services/doctor.service'
import type { DoctorProfile } from '@/types'
import DoctorCard from '@/components/client/DoctorCard'
import PageHeader from '@/components/common/PageHeader'
import Toast from '@/components/common/Toast'

export default function SpecialtyDoctors() {
  const { slug } = useParams<{ slug: string }>()
  const [specialty, setSpecialty] = useState<SpecialtyBrowseItem | null>(null)
  const [doctors, setDoctors] = useState<DoctorProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    let ignore = false
    setLoading(true)
    Promise.all([specialtyService.getBySlug(slug), doctorService.getBySpecialtySlug(slug)])
      .then(([sp, docs]) => {
        if (ignore) return
        setSpecialty(sp)
        setDoctors(docs)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [slug])

  if (loading) return <p className="text-sm text-slate-500">Đang tải...</p>

  if (!specialty) {
    return (
      <div className="text-center">
        <p className="text-slate-600">Không tìm thấy chuyên khoa.</p>
        <Link to="/dich-vu/chuyen-khoa" className="btn-secondary mt-4 inline-block">
          Quay lại danh sách
        </Link>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title={`Bác sĩ ${specialty.ten}`} description={specialty.mo_ta} />

      {doctors.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có bác sĩ nào cho chuyên khoa này.</p>
      ) : (
        <div className="grid gap-4">
          {doctors.map((d) => (
            <DoctorCard
              key={d.id}
              doctor={d}
              onBook={() => setToast('Chức năng đặt lịch đang được hoàn thiện, vui lòng quay lại sau.')}
            />
          ))}
        </div>
      )}

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  )
}
```

- [ ] **Step 2: Đăng ký route trong `AppRoutes.tsx`**

Thêm import:

```tsx
import SpecialtyDoctors from '@/pages/client/SpecialtyDoctors'
```

Thêm route — khối `<Route element={<ClientLayout />}>` hoàn chỉnh sau bước này:

```tsx
      {/* Khu vực khách (client) */}
      <Route element={<ClientLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/dich-vu" element={<ServicesHome />} />
        <Route path="/dich-vu/chuyen-khoa" element={<SpecialtyList />} />
        <Route path="/dich-vu/chuyen-khoa/:slug" element={<SpecialtyDoctors />} />
      </Route>
```

- [ ] **Step 3: Chạy toàn bộ test suite, xác nhận không có regression**

Run: `cd frontend && npx vitest run`
Expected: Toàn bộ test PASS (bao gồm test mới ở Task 2).

- [ ] **Step 4: Kiểm tra TypeScript build**

Run: `cd frontend && npx tsc --noEmit`
Expected: Không lỗi.

- [ ] **Step 5: E2E walkthrough thủ công đầy đủ luồng 3 tầng**

Với dev server đang chạy, thực hiện tuần tự trên trình duyệt:
1. Vào `/` → bấm "Khám phá dịch vụ" → tới `/dich-vu`.
2. Bấm "Khám Chuyên khoa" → tới `/dich-vu/chuyen-khoa`, thấy 7 chuyên khoa active.
3. Bấm "Tim mạch" → tới `/dich-vu/chuyen-khoa/tim-mach`, thấy đúng 1 card bác sĩ "BS. Lê Hoàng Cường" với: giá khám 350.000đ/30 phút, badge "BHYT nhà nước" + "Bảo lãnh viện phí", danh sách 2 dịch vụ liên quan (Siêu âm tim, Điện tâm đồ).
4. Bấm nút "Đặt lịch" trên card → Toast "Chức năng đặt lịch đang được hoàn thiện..." hiện ra.
5. Vào trực tiếp `/dich-vu/chuyen-khoa/nhi-khoa` → thấy 1 bác sĩ "BS. Phạm Thu Dung", KHÔNG có badge bảo hiểm "Bảo lãnh viện phí" (vì `bao_lanh: false`), không có mục "Dịch vụ có thể được chỉ định" (mảng rỗng).
6. Vào `/dich-vu/chuyen-khoa/da-lieu` (BS Đỗ Minh Khoa — pending) → thấy thông báo "Chưa có bác sĩ nào cho chuyên khoa này" (đúng vì bác sĩ pending không hiển thị).
7. Vào `/dich-vu/chuyen-khoa/khong-ton-tai` → thấy "Không tìm thấy chuyên khoa" + nút quay lại.
8. Vào `/dich-vu/chuyen-khoa/tai-mui-hong` (chuyên khoa hidden) → cũng thấy "Không tìm thấy chuyên khoa" (đúng vì `getBySlug` lọc `status='active'`).

Nếu cả 8 bước trên đúng như mô tả, plan này hoàn thành.
