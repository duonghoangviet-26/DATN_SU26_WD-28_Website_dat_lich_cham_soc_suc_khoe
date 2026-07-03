# Cơ Cấu Phân Cấp Trang Quản Lý Dịch Vụ (Admin) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tổ chức lại trang `/admin/services` (ManageServices.tsx) từ bảng phẳng thành cây phân cấp 3 tầng (Dịch vụ lớn → Dịch vụ con → chi tiết chuyên khoa), theo spec `docs/superpowers/specs/2026-07-03-admin-service-hierarchy-design.md`.

**Architecture:** Thuần FE, không đổi backend/model. Tầng 1–2 là accordion ngay trong `ManageServices.tsx`. Tầng 3 (chi tiết 1 chuyên khoa: menu dịch vụ liên quan CRUD + danh sách bác sĩ tham chiếu) là trang mới `ManageServiceSpecialtyDetail.tsx` ở route riêng. Dữ liệu vẫn đọc từ `mock/*.ts` qua các service hiện có (`service.service.ts`, `specialty.service.ts`, `doctor.service.ts`) — chỉ bổ sung mock data mẫu để tầng 3 có nội dung demo.

**Tech Stack:** React 18 + TS + Vite + Tailwind, React Router, mock-data-first (không có backend call).

## Global Constraints

- KHÔNG tự `git commit` / `git push` — người dùng review và commit thủ công (thầy cô xem git history, AI commit ảnh hưởng điểm DATN). Mỗi task kết thúc bằng bước kiểm tra `git status`/`git diff`, KHÔNG commit.
- Không đổi backend model (`DichVu`, `BacSi`, `ChuyenKhoa`) — toàn bộ thay đổi ở `frontend/src`.
- Không đổi chữ ký `serviceService.getAll()` — lọc theo `specialty_id` thực hiện client-side.
- Comment tiếng Việt cho logic phức tạp, giữ nguyên convention đặt tên hiện có trong codebase (camelCase biến/hàm, PascalCase component).
- Sau task cuối, khởi động dev server và kiểm tra bằng tay theo hướng dẫn CLAUDE.md ("For UI or frontend changes, start the dev server...").

---

## Task 1: Mock data — thêm chuyên khoa "Cột sống" + dịch vụ liên quan + bác sĩ mẫu

Tầng 3 cần dữ liệu demo thật (hiện tại 8 chuyên khoa mock không có specialty nào có nhiều dịch vụ liên quan + bác sĩ đầy đủ bảo hiểm/related_services để minh họa). Thêm 1 chuyên khoa mới khớp ảnh tham khảo người dùng cung cấp (PGS.TS.BSCKII chuyên Cột sống — Thần kinh — Cơ xương khớp).

**Files:**
- Modify: `frontend/src/mock/hospitals.ts` (thêm vào mảng `mockSpecialties`)
- Modify: `frontend/src/mock/services.ts` (thêm vào mảng `mockServices`)
- Modify: `frontend/src/mock/doctors.ts` (thêm vào mảng `mockDoctors`)

**Interfaces:**
- Consumes: `SpecialtyItem`, `ServiceItem`, `DoctorProfile` (đã định nghĩa ở `frontend/src/types/index.ts`, không đổi)
- Produces: chuyên khoa `id: 9, slug: 'cot-song'`, dịch vụ `id: 'mock-svc-007'/'mock-svc-008'`, bác sĩ `id: 9` — Task 3 và Task 4 dùng các id/slug này để verify.

- [ ] **Step 1: Thêm chuyên khoa "Cột sống" vào `mock/hospitals.ts`**

Mở `frontend/src/mock/hospitals.ts`, thêm 1 dòng vào cuối mảng `mockSpecialties` (sau dòng id 8 "Tai Mũi Họng", trước dấu `]`):

```ts
  { id: 9, ten: 'Cột sống', mo_ta: 'Chẩn đoán và điều trị bệnh lý cột sống, thoát vị đĩa đệm', icon_url: '🦴', slug: 'cot-song', thu_tu: 9, status: 'active' },
```

Giữ nguyên 8 dòng hiện có (không sửa `thu_tu` của các chuyên khoa cũ — 2 test hiện có dựa vào thứ tự Tim mạch=1, Nhi khoa=2).

- [ ] **Step 2: Thêm 2 dịch vụ liên quan cho chuyên khoa Cột sống vào `mock/services.ts`**

Mở `frontend/src/mock/services.ts`, thêm vào cuối mảng `mockServices` (sau `mock-svc-006`, trước dấu `]`):

```ts
  {
    id: 'mock-svc-007', ma_dich_vu: 'DV007',
    ten: 'Chụp X-quang cột sống cổ thẳng nghiêng',
    loai: 'related', gia: 250000,
    mo_ta_ngan: 'X-quang cột sống cổ 2 tư thế — theo chỉ định bác sĩ Cột sống.',
    mo_ta: 'Chụp X-quang cột sống cổ thẳng và nghiêng giúp đánh giá cấu trúc đốt sống, phát hiện thoái hóa, trượt đốt sống. Kết quả đọc trong 30–60 phút.',
    chuan_bi_truoc: 'Tháo trang sức, vòng cổ kim loại trước khi chụp.',
    thoi_gian_phut: null, ngay_ap_dung: null, gio_bat_dau: null, gio_ket_thuc: null,
    specialty_id: '9', specialty_ten: 'Cột sống', khu_vuc: [],
    so_bac_si: 1, so_luot_dat: 0, status: 'active',
    ngay_tao: '2026-05-01T00:00:00.000Z',
    ngay_cap_nhat: '2026-05-01T00:00:00.000Z',
    lich_su_thay_doi: [
      { id: 'log-013', thoi_gian: '2026-05-01T08:00:00.000Z', hanh_dong: 'tao_moi', nguoi_thay_doi: 'Nguyễn Văn Admin', mo_ta: 'Tạo dịch vụ mới' },
    ],
  },
  {
    id: 'mock-svc-008', ma_dich_vu: 'DV008',
    ten: 'Chụp cộng hưởng từ (MRI) cột sống thắt lưng',
    loai: 'related', gia: 1900000,
    mo_ta_ngan: 'MRI cột sống thắt lưng — theo chỉ định bác sĩ Cột sống.',
    mo_ta: 'Chụp cộng hưởng từ (MRI) cột sống thắt lưng giúp phát hiện thoát vị đĩa đệm, hẹp ống sống, chèn ép rễ thần kinh. Kết quả có trong 1–2 giờ.',
    chuan_bi_truoc: 'Không mang vật dụng kim loại, thiết bị điện tử vào phòng chụp. Báo trước nếu có máy trợ tim hoặc dị vật kim loại trong cơ thể.',
    thoi_gian_phut: null, ngay_ap_dung: null, gio_bat_dau: null, gio_ket_thuc: null,
    specialty_id: '9', specialty_ten: 'Cột sống', khu_vuc: [],
    so_bac_si: 1, so_luot_dat: 0, status: 'active',
    ngay_tao: '2026-05-01T00:00:00.000Z',
    ngay_cap_nhat: '2026-05-01T00:00:00.000Z',
    lich_su_thay_doi: [
      { id: 'log-014', thoi_gian: '2026-05-01T08:00:00.000Z', hanh_dong: 'tao_moi', nguoi_thay_doi: 'Nguyễn Văn Admin', mo_ta: 'Tạo dịch vụ mới' },
    ],
  },
```

- [ ] **Step 3: Thêm bác sĩ mẫu chuyên khoa Cột sống vào `mock/doctors.ts`**

Mở `frontend/src/mock/doctors.ts`, thêm vào cuối mảng `mockDoctors` (sau bác sĩ id 8 "Trần Văn Phúc", trước dấu `]`):

```ts
  // Bác sĩ chuyên khoa Cột sống — dữ liệu tham khảo từ 1 trang bác sĩ y tế thực tế
  // (giá khám + giá dịch vụ liên quan + loại bảo hiểm áp dụng), dùng để demo Tầng 3
  // trang Quản lý dịch vụ (xem 2026-07-03-admin-service-hierarchy-design.md §3).
  {
    id: 9, user_id: 18,
    ho_ten: 'PGS. TS. BSCKII. Vũ Văn Hòa', email: 'hoa.vu@vitafamily.vn',
    anh_dai_dien: null,
    chuyen_khoa: 'Cột sống', so_nam_kinh_nghiem: 35,
    gia_kham: 500000, tuoi_nhan_kham_tu: 7, trang_thai_duyet: 'approved',
    diem_danh_gia: 4.9, so_danh_gia: 210,
    bang_cap: 'Phó Giáo sư, Tiến sĩ — Phó chủ tịch hội Phẫu thuật cột sống Việt Nam',
    loai: 'specialist',
    bao_hiem: { nha_nuoc: false, bao_lanh: true },
    related_services: [
      { id: 'mock-svc-007', ten: 'Chụp X-quang cột sống cổ thẳng nghiêng', gia: 250000 },
      { id: 'mock-svc-008', ten: 'Chụp cộng hưởng từ (MRI) cột sống thắt lưng', gia: 1900000 },
    ],
    ngay_tao: '2026-05-01T08:00:00',
  },
```

- [ ] **Step 4: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: không có lỗi liên quan đến `mock/hospitals.ts`, `mock/services.ts`, `mock/doctors.ts`.

- [ ] **Step 5: Chạy lại test suite hiện có — xác nhận không có regression**

Run: `cd frontend && npx vitest run src/__tests__/services/specialty.service.test.ts src/__tests__/services/doctor-browse.service.test.ts`
Expected: PASS toàn bộ (9 test). Các test chỉ assert theo `tim-mach`, `nhi-khoa`, `da-lieu`, `than-kinh`, `tai-mui-hong` — không bị ảnh hưởng bởi chuyên khoa "Cột sống" (id 9, thu_tu 9) mới thêm.

- [ ] **Step 6: Kiểm tra thay đổi (KHÔNG commit)**

Run: `git status --short frontend/src/mock/`
Expected: liệt kê đúng 3 file `hospitals.ts`, `services.ts`, `doctors.ts` đã sửa. Không chạy `git commit`.

---

## Task 2: `ServiceFormModal` — thêm props `initialLoai` và `initialSpecialtyId`

Modal tạo dịch vụ hiện tại luôn mở với `loai: 'related'` mặc định và chuyên khoa trống. Ở luồng mới, tạo dịch vụ "Xét nghiệm" từ trang Quản lý dịch vụ nên mặc định `loai: 'home'`; tạo "Dịch vụ liên quan" từ trang chi tiết chuyên khoa nên preset sẵn chuyên khoa hiện tại. Đây là 2 props tùy chọn, không đổi hành vi khi không truyền (backward-compatible).

**Files:**
- Modify: `frontend/src/components/admin/services/ServiceFormModal.tsx:43-82`

**Interfaces:**
- Consumes: `EMPTY_FORM` (const đã có trong file, không đổi)
- Produces: `ServiceFormModal` nhận thêm 2 prop tùy chọn `initialLoai?: ServiceType` và `initialSpecialtyId?: string` — Task 3 và Task 4 truyền vào khi mở modal ở chế độ tạo mới.

- [ ] **Step 1: Thêm 2 prop tùy chọn vào interface `Props`**

Trong `frontend/src/components/admin/services/ServiceFormModal.tsx`, sửa khối `interface Props` (dòng 43–48):

```ts
interface Props {
  open: boolean
  service: ServiceItem | null   // null = Thêm mới, ServiceItem = Sửa
  initialLoai?: ServiceType        // preset loại khi tạo mới (VD: 'home' khi tạo từ nhánh Khám tại nhà)
  initialSpecialtyId?: string      // preset chuyên khoa khi tạo mới (VD: từ trang chi tiết chuyên khoa)
  onClose: () => void
  onSave: (data: ServiceFormData, mo_ta_thay_doi?: string) => Promise<void>
}
```

- [ ] **Step 2: Nhận 2 prop mới trong destructuring của component**

Sửa dòng 50:

```ts
export default function ServiceFormModal({ open, service, initialLoai, initialSpecialtyId, onClose, onSave }: Props) {
```

- [ ] **Step 3: Dùng 2 prop mới khi populate form ở chế độ tạo mới**

Sửa khối `useEffect` "Populate form khi mở / đổi service" (dòng 63–82) — thay nhánh `else` (dòng 77-79):

```ts
  useEffect(() => {
    if (!open) return
    if (service) {
      setForm({
        ten: service.ten,
        loai: service.loai,
        gia: service.gia,
        mo_ta_ngan: service.mo_ta_ngan ?? '',
        mo_ta: service.mo_ta ?? '',
        chuan_bi_truoc: service.chuan_bi_truoc ?? '',
        gio_dat_truoc_toi_thieu: service.gio_dat_truoc_toi_thieu ?? undefined,
        specialty_id: service.specialty_id ?? null,
        khu_vuc: service.khu_vuc ?? [],
      })
    } else {
      const loai = initialLoai ?? EMPTY_FORM.loai
      setForm({
        ...EMPTY_FORM,
        loai,
        specialty_id: initialSpecialtyId ?? EMPTY_FORM.specialty_id,
        gio_dat_truoc_toi_thieu: loai === 'home' ? 4 : undefined,
      })
    }
    setErrors({})
    setMotaThayDoi('')
  }, [open, service, initialLoai, initialSpecialtyId])
```

- [ ] **Step 4: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: không có lỗi trong `ServiceFormModal.tsx`. (2 call site hiện có — `ManageServices.tsx` cũ — vẫn hợp lệ vì 2 prop mới là optional; Task 4 sẽ cập nhật call site này.)

- [ ] **Step 5: Kiểm tra thay đổi (KHÔNG commit)**

Run: `git diff --stat frontend/src/components/admin/services/ServiceFormModal.tsx`
Expected: chỉ hiện thay đổi trong file này, không có gì khác.

---

## Task 3: Trang chi tiết chuyên khoa (Tầng 3) — `ManageServiceSpecialtyDetail.tsx`

**Files:**
- Create: `frontend/src/pages/admin/ManageServiceSpecialtyDetail.tsx`
- Modify: `frontend/src/routes/AppRoutes.tsx:22` (import) và dòng chứa `<Route path="services" ...>` (thêm route con)

**Interfaces:**
- Consumes: `specialtyService.getBySlug(slug): Promise<SpecialtyBrowseItem | null>`, `serviceService.getAll(loai, search, status, page, limit): Promise<PagedResult<ServiceItem>>`, `doctorService.getBySpecialtySlug(slug): Promise<DoctorProfile[]>`, `ServiceFormModal` (Task 2, props `initialSpecialtyId`), `ServiceViewModal` (không đổi)
- Produces: route `/admin/services/chuyen-khoa/:slug` — Task 4 điều hướng (`navigate`) tới route này khi Admin click 1 chuyên khoa con.

- [ ] **Step 1: Tạo file `ManageServiceSpecialtyDetail.tsx`**

Tạo `frontend/src/pages/admin/ManageServiceSpecialtyDetail.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { specialtyService } from '@/services/specialty.service'
import type { SpecialtyBrowseItem } from '@/services/specialty.service'
import { serviceService } from '@/services/service.service'
import { doctorService } from '@/services/doctor.service'
import type { ServiceItem, ServiceFormData, DoctorProfile } from '@/types'
import { formatPrice } from '@/utils/format'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Icon from '@/components/admin/icons'
import ServiceFormModal from '@/components/admin/services/ServiceFormModal'
import ServiceViewModal from '@/components/admin/services/ServiceViewModal'

// Tầng 3 — trang chi tiết 1 chuyên khoa trong Quản lý dịch vụ:
// (A) menu dịch vụ liên quan của khoa (CRUD thật) + (B) danh sách bác sĩ khoa (chỉ xem)
// Xem docs/superpowers/specs/2026-07-03-admin-service-hierarchy-design.md
export default function ManageServiceSpecialtyDetail() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const [specialty, setSpecialty] = useState<SpecialtyBrowseItem | null>(null)
  const [notFound, setNotFound]   = useState(false)
  const [services, setServices]   = useState<ServiceItem[]>([])
  const [doctors, setDoctors]     = useState<DoctorProfile[]>([])
  const [loading, setLoading]     = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  const [formTarget, setFormTarget]     = useState<ServiceItem | 'new' | null>(null)
  const [viewTarget, setViewTarget]     = useState<ServiceItem | null>(null)
  const [viewLoading, setViewLoading]   = useState(false)
  const [toggleTarget, setToggleTarget] = useState<ServiceItem | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  function triggerReload() { setReloadKey(k => k + 1) }

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    Promise.all([
      specialtyService.getBySlug(slug),
      serviceService.getAll('related', '', '', 1, 9999),
      doctorService.getBySpecialtySlug(slug),
    ])
      .then(([sp, svcResult, docs]) => {
        if (!sp) { setNotFound(true); return }
        setSpecialty(sp)
        setServices(svcResult.items.filter(s => s.specialty_id === String(sp.id)))
        setDoctors(docs)
      })
      .catch(() => showToast('Không thể tải dữ liệu chuyên khoa', 'error'))
      .finally(() => setLoading(false))
  }, [slug, reloadKey])

  async function handleSave(data: ServiceFormData, mo_ta?: string) {
    try {
      if (formTarget === 'new') {
        await serviceService.create(data)
        showToast('Tạo dịch vụ thành công')
      } else if (formTarget) {
        await serviceService.update(formTarget.id, data, mo_ta)
        showToast('Cập nhật dịch vụ thành công')
      }
      setFormTarget(null)
      triggerReload()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Có lỗi xảy ra', 'error')
    }
  }

  async function handleToggleConfirm() {
    if (!toggleTarget) return
    const wasActive = toggleTarget.status === 'active'
    const id = toggleTarget.id
    setToggleTarget(null)
    try {
      await serviceService.toggle(id)
      showToast(wasActive ? 'Đã ẩn dịch vụ' : 'Đã hiện dịch vụ')
      triggerReload()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể thay đổi trạng thái', 'error')
    }
  }

  async function handleView(service: ServiceItem) {
    setViewTarget(service)
    setViewLoading(true)
    try {
      const full = await serviceService.getById(service.id)
      setViewTarget(full)
    } catch {
      showToast('Không thể tải lịch sử thao tác', 'error')
    } finally {
      setViewLoading(false)
    }
  }

  function handleEditFromView(service: ServiceItem) {
    setViewTarget(null)
    setFormTarget(service)
  }

  if (loading) {
    return <div className="py-16 text-center text-slate-400">Đang tải...</div>
  }

  if (notFound || !specialty) {
    return (
      <div className="py-16 text-center">
        <p className="text-base font-medium text-slate-600">Không tìm thấy chuyên khoa</p>
        <Link to="/admin/services" className="mt-3 inline-block text-sm text-brand-600 hover:underline">
          ← Quay lại Quản lý dịch vụ
        </Link>
      </div>
    )
  }

  return (
    <>
      {toast && (
        <div className={`fixed right-6 top-6 z-[100] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? '✓' : '✗'} {toast.message}
        </div>
      )}

      <div>
        <button
          onClick={() => navigate('/admin/services')}
          className="mb-3 flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600"
        >
          ← Quay lại Quản lý dịch vụ
        </button>

        <PageHeader title={`${specialty.icon_url} ${specialty.ten}`} description={specialty.mo_ta}>
          <button onClick={() => setFormTarget('new')} className="btn-primary flex items-center gap-1.5">
            <Icon name="plus" className="h-4 w-4" />
            Thêm dịch vụ liên quan
          </button>
        </PageHeader>

        {/* (A) Menu dịch vụ liên quan của khoa — CRUD thật */}
        <div className="card mb-6 overflow-hidden">
          <div className="border-b bg-slate-50 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">Dịch vụ liên quan ({services.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Mã DV</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Tên dịch vụ</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Giá</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Trạng thái</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {services.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      Chưa có dịch vụ liên quan nào cho chuyên khoa này
                    </td>
                  </tr>
                )}
                {services.map((s) => {
                  const dim = s.status === 'inactive' ? 'opacity-40' : ''
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className={`px-4 py-3 font-mono text-xs text-slate-500 ${dim}`}>{s.ma_dich_vu}</td>
                      <td className={`px-4 py-3 ${dim}`}>
                        <div className="font-medium text-slate-800">{s.ten}</div>
                        {s.mo_ta_ngan && <div className="mt-0.5 line-clamp-1 text-xs text-slate-400">{s.mo_ta_ngan}</div>}
                      </td>
                      <td className={`px-4 py-3 font-semibold text-slate-800 ${dim}`}>{formatPrice(s.gia)}</td>
                      <td className={`px-4 py-3 ${dim}`}>
                        <Badge color={s.status === 'active' ? 'green' : 'gray'}>
                          {s.status === 'active' ? 'Hoạt động' : 'Đã ẩn'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleView(s)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600">Xem</button>
                          <button onClick={() => setFormTarget(s)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600">Sửa</button>
                          <button
                            onClick={() => setToggleTarget(s)}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
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

        {/* (B) Bác sĩ thuộc khoa — chỉ xem tham khảo, sửa ở trang Quản lý bác sĩ */}
        <div className="card overflow-hidden">
          <div className="border-b bg-slate-50 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">Bác sĩ chuyên khoa này ({doctors.length})</h2>
            <p className="mt-0.5 text-xs text-slate-400">Chỉ xem tham khảo. Sửa thông tin bác sĩ ở trang Quản lý bác sĩ.</p>
          </div>
          {doctors.length === 0 ? (
            <div className="py-12 text-center text-slate-400">Chưa có bác sĩ được duyệt thuộc chuyên khoa này</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {doctors.map((d) => (
                <div key={d.id} className="flex flex-wrap items-start gap-4 px-4 py-4">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                    <Icon name="doctor" className="h-5 w-5" />
                  </div>
                  <div className="min-w-[200px] flex-1">
                    <div className="font-medium text-slate-800">{d.ho_ten}</div>
                    <div className="text-xs text-slate-400">{d.bang_cap} · {d.so_nam_kinh_nghiem} năm kinh nghiệm</div>
                  </div>
                  <div className="min-w-[120px]">
                    <div className="text-xs uppercase tracking-wide text-slate-400">Giá khám</div>
                    <div className="font-semibold text-slate-800">{formatPrice(d.gia_kham)}</div>
                  </div>
                  <div className="min-w-[160px]">
                    <div className="text-xs uppercase tracking-wide text-slate-400">Bảo hiểm</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {d.bao_hiem?.nha_nuoc && <Badge color="blue">Y tế nhà nước</Badge>}
                      {d.bao_hiem?.bao_lanh && <Badge color="blue">Bảo lãnh</Badge>}
                      {!d.bao_hiem?.nha_nuoc && !d.bao_hiem?.bao_lanh && <Badge color="gray">Không áp dụng</Badge>}
                    </div>
                  </div>
                  <div className="min-w-[220px] flex-1">
                    <div className="text-xs uppercase tracking-wide text-slate-400">Dịch vụ liên quan đã áp dụng</div>
                    {d.related_services && d.related_services.length > 0 ? (
                      <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                        {d.related_services.map((rs) => (
                          <li key={rs.id} className="flex justify-between gap-2">
                            <span>{rs.ten}</span>
                            <span className="font-medium">{formatPrice(rs.gia)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="mt-1 text-xs text-slate-400">Chưa áp dụng dịch vụ nào</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <ServiceFormModal
          open={formTarget !== null}
          service={formTarget === 'new' ? null : formTarget}
          initialSpecialtyId={String(specialty.id)}
          onClose={() => setFormTarget(null)}
          onSave={handleSave}
        />

        <ServiceViewModal
          open={viewTarget !== null}
          service={viewTarget}
          loadingLog={viewLoading}
          onClose={() => setViewTarget(null)}
          onEdit={handleEditFromView}
        />

        <ConfirmDialog
          open={toggleTarget !== null}
          title={toggleTarget?.status === 'active' ? 'Ẩn dịch vụ?' : 'Hiện dịch vụ?'}
          message={
            toggleTarget?.status === 'active'
              ? `Dịch vụ "${toggleTarget?.ten}" sẽ bị ẩn. Bệnh nhân không thể đặt thêm lịch.`
              : `Dịch vụ "${toggleTarget?.ten}" sẽ hiển thị trở lại.`
          }
          confirmText={toggleTarget?.status === 'active' ? 'Ẩn dịch vụ' : 'Hiện dịch vụ'}
          danger={toggleTarget?.status === 'active'}
          onConfirm={handleToggleConfirm}
          onCancel={() => setToggleTarget(null)}
        />
      </div>
    </>
  )
}
```

- [ ] **Step 2: Đăng ký route trong `AppRoutes.tsx`**

Trong `frontend/src/routes/AppRoutes.tsx`, thêm import sau dòng `import ManageServices from '@/pages/admin/ManageServices'` (dòng 22):

```ts
import ManageServiceSpecialtyDetail from '@/pages/admin/ManageServiceSpecialtyDetail'
```

Thêm route con ngay sau dòng `<Route path="services" element={<ManageServices />} />     {/* C4 */}` (dòng 67):

```tsx
        <Route path="services/chuyen-khoa/:slug" element={<ManageServiceSpecialtyDetail />} />
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: không có lỗi trong `ManageServiceSpecialtyDetail.tsx` hoặc `AppRoutes.tsx`.

- [ ] **Step 4: Kiểm tra thủ công bằng dev server**

Run: `cd frontend && npm run dev` (chạy nền)
Mở trình duyệt tới `http://localhost:5173/admin/services/chuyen-khoa/cot-song` (đăng nhập admin trước nếu `ProtectedRoute` yêu cầu).
Expected:
- Tiêu đề "🦴 Cột sống" hiển thị.
- Bảng "Dịch vụ liên quan (2)" hiển thị DV007 và DV008 đúng giá.
- Khối "Bác sĩ chuyên khoa này (1)" hiển thị "PGS. TS. BSCKII. Vũ Văn Hòa", giá khám 500.000đ, badge "Bảo lãnh", danh sách 2 dịch vụ liên quan đã áp dụng.
- Click "Sửa" trên DV007 → modal mở, chuyên khoa preset sẵn "Cột sống".
- Truy cập `/admin/services/chuyen-khoa/khong-ton-tai` → hiển thị "Không tìm thấy chuyên khoa" + link quay lại.

- [ ] **Step 5: Kiểm tra thay đổi (KHÔNG commit)**

Run: `git status --short frontend/src/pages/admin/ frontend/src/routes/`
Expected: liệt kê file mới `ManageServiceSpecialtyDetail.tsx` và file sửa `AppRoutes.tsx`. Không chạy `git commit`.

---

## Task 4: Viết lại `ManageServices.tsx` — UI 2 tầng (Dịch vụ lớn → Dịch vụ con)

**Files:**
- Modify: `frontend/src/pages/admin/ManageServices.tsx` (viết lại toàn bộ nội dung file)

**Interfaces:**
- Consumes: `serviceService.getAll()` (không đổi chữ ký), `specialtyService.getAllActive(): Promise<SpecialtyBrowseItem[]>`, `ServiceFormModal` với prop `initialLoai="home"` (Task 2), `useNavigate` từ `react-router-dom` để điều hướng sang route Task 3.
- Produces: không có gì file khác phụ thuộc (đây là trang lá — route `services` trong `AppRoutes.tsx`, đã tồn tại, không cần sửa thêm).

- [ ] **Step 1: Thay toàn bộ nội dung `ManageServices.tsx`**

Ghi đè toàn bộ `frontend/src/pages/admin/ManageServices.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { serviceService } from '@/services/service.service'
import { specialtyService } from '@/services/specialty.service'
import type { SpecialtyBrowseItem } from '@/services/specialty.service'
import type { ServiceItem, ServiceStatus, ServiceFormData } from '@/types'
import { formatPrice } from '@/utils/format'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Icon from '@/components/admin/icons'
import ServiceFormModal from '@/components/admin/services/ServiceFormModal'
import ServiceViewModal from '@/components/admin/services/ServiceViewModal'

// ─── Hằng số ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

const STATUS_TABS: { value: ServiceStatus | ''; label: string }[] = [
  { value: '',         label: 'Tất cả' },
  { value: 'active',   label: 'Hoạt động' },
  { value: 'inactive', label: 'Đã ẩn' },
]

// Tầng 1 — "dịch vụ lớn": cố định trong code (xem 2026-07-03-admin-service-hierarchy-design.md §2).
// Thêm dịch vụ lớn mới sau này (VD: "Khám tổng quát") chỉ cần thêm 1 GroupKey + nhánh UI tương ứng.
type GroupKey = 'clinic' | 'home'

// ─── Component chính ──────────────────────────────────────────────────────────
export default function ManageServices() {
  const navigate = useNavigate()

  // ── Stats — toàn bộ dịch vụ, không lọc (dùng cho số liệu tổng quan + đếm dịch vụ liên quan/khoa) ──
  const [allServices, setAllServices] = useState<ServiceItem[]>([])
  function loadStats() {
    serviceService.getAll('', '', '', 1, 9999).then(({ items }) => setAllServices(items))
  }
  useEffect(() => { loadStats() }, [])

  const stats = {
    total:    allServices.length,
    active:   allServices.filter(s => s.status === 'active').length,
    inactive: allServices.filter(s => s.status === 'inactive').length,
    related:  allServices.filter(s => s.loai === 'related').length,
    home:     allServices.filter(s => s.loai === 'home').length,
  }

  function countRelated(specialtyId: number) {
    return allServices.filter(s => s.loai === 'related' && s.specialty_id === String(specialtyId)).length
  }

  // ── Tầng 1 — nhóm dịch vụ lớn đang mở ──
  const [expandedGroup, setExpandedGroup] = useState<GroupKey | null>(null)

  // ── Tầng 2 (nhánh Khám chuyên khoa) — danh sách chuyên khoa active ──
  const [specialties, setSpecialties] = useState<SpecialtyBrowseItem[]>([])
  useEffect(() => {
    specialtyService.getAllActive().then(setSpecialties).catch(() => {})
  }, [])

  // ── Tầng 2 (nhánh Khám tại nhà) — "Xét nghiệm" mở rộng thêm bảng DichVu loai='home' ──
  const [homeExpanded, setHomeExpanded] = useState(false)

  const [homeServices, setHomeServices]       = useState<ServiceItem[]>([])
  const [homeLoading, setHomeLoading]         = useState(false)
  const [homeStatus, setHomeStatus]           = useState<ServiceStatus | ''>('')
  const [homeSearchInput, setHomeSearchInput] = useState('')
  const [homeSearch, setHomeSearch]           = useState('')
  const [homePage, setHomePage]               = useState(1)
  const [homeTotal, setHomeTotal]             = useState(0)
  const [homeTotalPages, setHomeTotalPages]   = useState(1)
  const [homeReloadKey, setHomeReloadKey]     = useState(0)
  function triggerHomeReload() { setHomeReloadKey(k => k + 1) }

  useEffect(() => {
    const timer = setTimeout(() => setHomeSearch(homeSearchInput), 300)
    return () => clearTimeout(timer)
  }, [homeSearchInput])

  useEffect(() => { setHomePage(1) }, [homeStatus, homeSearch])

  useEffect(() => {
    if (!homeExpanded) return
    setHomeLoading(true)
    serviceService
      .getAll('home', homeSearch, homeStatus, homePage, PAGE_SIZE)
      .then(({ items, total, totalPages }) => {
        setHomeServices(items)
        setHomeTotal(total)
        setHomeTotalPages(totalPages)
      })
      .catch(() => showToast('Không thể tải danh sách dịch vụ tại nhà', 'error'))
      .finally(() => setHomeLoading(false))
  }, [homeExpanded, homeStatus, homeSearch, homePage, homeReloadKey])

  // ── Modal state — dùng chung cho tạo/sửa dịch vụ "Xét nghiệm" tại nhà ──
  const [formTarget, setFormTarget]     = useState<ServiceItem | 'new' | null>(null)
  const [viewTarget, setViewTarget]     = useState<ServiceItem | null>(null)
  const [viewLoading, setViewLoading]   = useState(false)
  const [toggleTarget, setToggleTarget] = useState<ServiceItem | null>(null)

  // ── Toast ──
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleSave(data: ServiceFormData, mo_ta?: string) {
    try {
      if (formTarget === 'new') {
        await serviceService.create(data)
        showToast('Tạo dịch vụ thành công')
      } else if (formTarget) {
        await serviceService.update(formTarget.id, data, mo_ta)
        showToast('Cập nhật dịch vụ thành công')
      }
      setFormTarget(null)
      triggerHomeReload()
      loadStats()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Có lỗi xảy ra', 'error')
    }
  }

  async function handleToggleConfirm() {
    if (!toggleTarget) return
    const wasActive = toggleTarget.status === 'active'
    const id = toggleTarget.id
    setToggleTarget(null)
    try {
      await serviceService.toggle(id)
      showToast(wasActive ? 'Đã ẩn dịch vụ' : 'Đã hiện dịch vụ')
      triggerHomeReload()
      loadStats()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể thay đổi trạng thái', 'error')
    }
  }

  async function handleView(service: ServiceItem) {
    setViewTarget(service)
    setViewLoading(true)
    try {
      const full = await serviceService.getById(service.id)
      setViewTarget(full)
    } catch {
      showToast('Không thể tải lịch sử thao tác', 'error')
    } finally {
      setViewLoading(false)
    }
  }

  function handleEditFromView(service: ServiceItem) {
    setViewTarget(null)
    setFormTarget(service)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {toast && (
        <div className={`fixed right-6 top-6 z-[100] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? '✓' : '✗'} {toast.message}
        </div>
      )}

      <div>
        <PageHeader
          title="Quản lý dịch vụ"
          description="Cấu hình dịch vụ khám bệnh và giá trong hệ thống — tổ chức theo dịch vụ lớn → dịch vụ con."
        />

        {/* ── Số liệu thống kê ── */}
        <div className="mb-6 grid grid-cols-5 gap-3">
          {[
            { label: 'Tổng dịch vụ', value: stats.total,    color: 'text-slate-700'  },
            { label: 'Hoạt động',    value: stats.active,   color: 'text-green-600'  },
            { label: 'Đã ẩn',        value: stats.inactive, color: 'text-slate-400'  },
            { label: 'Liên quan',    value: stats.related,  color: 'text-blue-600'   },
            { label: 'Tại nhà',      value: stats.home,     color: 'text-yellow-600' },
          ].map((item) => (
            <div key={item.label} className="card p-4 text-center">
              <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
              <div className="mt-1 text-xs text-slate-500">{item.label}</div>
            </div>
          ))}
        </div>

        {/* ── TẦNG 1 — Dịch vụ lớn ── */}
        <div className="space-y-4">

          {/* --- Khám chuyên khoa --- */}
          <div className="card overflow-hidden">
            <button
              onClick={() => setExpandedGroup(g => g === 'clinic' ? null : 'clinic')}
              className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏥</span>
                <div>
                  <div className="font-semibold text-slate-800">Khám chuyên khoa</div>
                  <div className="text-xs text-slate-400">{specialties.length} chuyên khoa · {stats.related} dịch vụ liên quan</div>
                </div>
              </div>
              <span className="text-slate-400">{expandedGroup === 'clinic' ? '▾' : '▸'}</span>
            </button>

            {expandedGroup === 'clinic' && (
              <div className="divide-y divide-slate-100 border-t">
                {specialties.length === 0 && (
                  <div className="px-5 py-6 text-center text-sm text-slate-400">Chưa có chuyên khoa nào đang hoạt động</div>
                )}
                {specialties.map((sp) => (
                  <button
                    key={sp.id}
                    onClick={() => navigate(`/admin/services/chuyen-khoa/${sp.slug}`)}
                    className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{sp.icon_url}</span>
                      <span className="font-medium text-slate-700">{sp.ten}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{countRelated(Number(sp.id))} dịch vụ liên quan</span>
                      <span>{sp.so_bac_si} bác sĩ</span>
                      <span className="text-slate-300">›</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* --- Khám tại nhà --- */}
          <div className="card overflow-hidden">
            <button
              onClick={() => setExpandedGroup(g => g === 'home' ? null : 'home')}
              className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏠</span>
                <div>
                  <div className="font-semibold text-slate-800">Khám tại nhà</div>
                  <div className="text-xs text-slate-400">{stats.home} dịch vụ xét nghiệm</div>
                </div>
              </div>
              <span className="text-slate-400">{expandedGroup === 'home' ? '▾' : '▸'}</span>
            </button>

            {expandedGroup === 'home' && (
              <div className="border-t">
                {/* Xét nghiệm — hoạt động đầy đủ */}
                <div>
                  <button
                    onClick={() => setHomeExpanded(v => !v)}
                    className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🧪</span>
                      <span className="font-medium text-slate-700">Xét nghiệm</span>
                      <Badge color="green">{stats.home} dịch vụ</Badge>
                    </div>
                    <span className="text-slate-400">{homeExpanded ? '▾' : '▸'}</span>
                  </button>

                  {homeExpanded && (
                    <div className="border-t bg-slate-50/50 px-5 py-4">
                      {/* Filter + search + thêm */}
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <div className="card flex gap-1 p-1.5">
                          {STATUS_TABS.map((tab) => (
                            <button
                              key={tab.value}
                              onClick={() => setHomeStatus(tab.value)}
                              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                                homeStatus === tab.value
                                  ? tab.value === 'inactive' ? 'bg-slate-500 text-white'
                                    : tab.value === 'active' ? 'bg-green-500 text-white'
                                    : 'bg-brand-500 text-white'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                        <div className="relative min-w-[220px] flex-1">
                          <Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Tìm theo tên, mã, mô tả..."
                            value={homeSearchInput}
                            onChange={(e) => setHomeSearchInput(e.target.value)}
                            className="input w-full bg-white pl-9"
                          />
                        </div>
                        <button onClick={() => setFormTarget('new')} className="btn-primary flex items-center gap-1.5">
                          <Icon name="plus" className="h-4 w-4" />
                          Thêm dịch vụ
                        </button>
                      </div>

                      {/* Bảng */}
                      <div className="card overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-left">
                              <tr>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Mã DV</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Tên dịch vụ</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Giá</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Khu vực phục vụ</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Nhân sự</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">Trạng thái</th>
                                <th className="px-4 py-3" />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {homeLoading && (
                                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Đang tải...</td></tr>
                              )}
                              {!homeLoading && homeServices.length === 0 && (
                                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Chưa có dịch vụ xét nghiệm tại nhà nào</td></tr>
                              )}
                              {!homeLoading && homeServices.map((s) => {
                                const dim = s.status === 'inactive' ? 'opacity-40' : ''
                                return (
                                  <tr key={s.id} className="hover:bg-slate-50">
                                    <td className={`px-4 py-3 font-mono text-xs text-slate-500 ${dim}`}>{s.ma_dich_vu}</td>
                                    <td className={`px-4 py-3 ${dim}`}>
                                      <div className="font-medium text-slate-800">{s.ten}</div>
                                      {s.mo_ta_ngan && <div className="mt-0.5 line-clamp-1 text-xs text-slate-400">{s.mo_ta_ngan}</div>}
                                    </td>
                                    <td className={`px-4 py-3 font-semibold text-slate-800 ${dim}`}>{formatPrice(s.gia)}</td>
                                    <td className={`px-4 py-3 text-slate-500 ${dim}`}>
                                      {s.khu_vuc && s.khu_vuc.length > 0 ? s.khu_vuc.join(', ') : '—'}
                                    </td>
                                    <td className={`px-4 py-3 text-slate-600 ${dim}`}>{s.so_bac_si ?? 0} nhân viên</td>
                                    <td className={`px-4 py-3 ${dim}`}>
                                      <Badge color={s.status === 'active' ? 'green' : 'gray'}>
                                        {s.status === 'active' ? 'Hoạt động' : 'Đã ẩn'}
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center justify-end gap-1">
                                        <button onClick={() => handleView(s)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600">Xem</button>
                                        <button onClick={() => setFormTarget(s)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600">Sửa</button>
                                        <button
                                          onClick={() => setToggleTarget(s)}
                                          className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
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

                        {!homeLoading && homeTotal > 0 && (
                          <div className="flex items-center justify-between border-t px-4 py-3">
                            <span className="text-xs text-slate-500">{homeTotal} dịch vụ · Trang {homePage}/{homeTotalPages}</span>
                            <div className="flex items-center gap-1">
                              <button onClick={() => setHomePage(p => Math.max(1, p - 1))} disabled={homePage === 1} className="rounded border px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50">← Trước</button>
                              <span className="min-w-[32px] px-2 text-center text-sm font-medium text-slate-700">{homePage}</span>
                              <button onClick={() => setHomePage(p => Math.min(homeTotalPages, p + 1))} disabled={homePage === homeTotalPages} className="rounded border px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50">Tiếp →</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Khám trực tiếp — placeholder, chưa hoạt động trong phạm vi DATN */}
                <div className="flex items-center justify-between border-t px-5 py-3.5 opacity-60">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🩺</span>
                    <span className="font-medium text-slate-500">Khám trực tiếp</span>
                    <Badge color="gray">0 dịch vụ</Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Icon name="lock" className="h-3.5 w-3.5" />
                    Sắp ra mắt
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Modals — dùng chung cho dịch vụ "Xét nghiệm" tại nhà ── */}
        <ServiceFormModal
          open={formTarget !== null}
          service={formTarget === 'new' ? null : formTarget}
          initialLoai="home"
          onClose={() => setFormTarget(null)}
          onSave={handleSave}
        />

        <ServiceViewModal
          open={viewTarget !== null}
          service={viewTarget}
          loadingLog={viewLoading}
          onClose={() => setViewTarget(null)}
          onEdit={handleEditFromView}
        />

        <ConfirmDialog
          open={toggleTarget !== null}
          title={toggleTarget?.status === 'active' ? 'Ẩn dịch vụ?' : 'Hiện dịch vụ?'}
          message={
            toggleTarget?.status === 'active'
              ? `Dịch vụ "${toggleTarget?.ten}" sẽ bị ẩn. Bệnh nhân không thể đặt thêm lịch.` +
                (toggleTarget?.active_appointments
                  ? ` Có ${toggleTarget.active_appointments} lịch hẹn đang chờ — các lịch đó không bị hủy.`
                  : ' Lịch hẹn hiện có không bị hủy.')
              : `Dịch vụ "${toggleTarget?.ten}" sẽ hiển thị trở lại. Bệnh nhân có thể đặt lịch.`
          }
          confirmText={toggleTarget?.status === 'active' ? 'Ẩn dịch vụ' : 'Hiện dịch vụ'}
          danger={toggleTarget?.status === 'active'}
          onConfirm={handleToggleConfirm}
          onCancel={() => setToggleTarget(null)}
        />
      </div>
    </>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 lỗi. Nếu báo lỗi thiếu import hoặc prop sai tên, đối chiếu lại với `ServiceFormModal.tsx` (Task 2) và `specialty.service.ts`.

- [ ] **Step 3: Chạy toàn bộ test suite FE — xác nhận không có regression**

Run: `cd frontend && npx vitest run`
Expected: cùng baseline PASS/FAIL như trước khi bắt đầu (58 test fail đã biết trước từ `doctor-appointment.service.test.ts`, `schedule.service.test.ts`, `examination.service.test.ts` — không liên quan tới thay đổi này). Không có test mới nào fail liên quan tới `specialty.service`, `doctor-browse.service`, hoặc `ManageServices`.

- [ ] **Step 4: Kiểm tra thủ công bằng dev server (bắt buộc theo CLAUDE.md — thay đổi UI)**

Run: `cd frontend && npm run dev` (nếu chưa chạy từ Task 3)
Mở `http://localhost:5173/admin/services`.

Kiểm tra các luồng:
1. Trang hiển thị 2 card "Khám chuyên khoa" và "Khám tại nhà" (đóng theo mặc định), số liệu thống kê phía trên không đổi so với trước.
2. Click "Khám chuyên khoa" → xổ ra danh sách 9 chuyên khoa active (bao gồm "Cột sống" mới thêm ở Task 1), mỗi dòng hiện đúng số dịch vụ liên quan + số bác sĩ.
3. Click dòng "Cột sống" → điều hướng sang `/admin/services/chuyen-khoa/cot-song` (trang Task 3).
4. Quay lại `/admin/services`, click "Khám tại nhà" → xổ ra 2 dòng "Xét nghiệm" (badge số dịch vụ) và "Khám trực tiếp" (mờ, khóa, "Sắp ra mắt", không phản ứng khi click).
5. Click "Xét nghiệm" → xổ ra bảng dịch vụ tại nhà hiện có (2 dịch vụ mock), filter trạng thái + tìm kiếm hoạt động đúng như bảng cũ.
6. Click "+ Thêm dịch vụ" trong khối Xét nghiệm → modal mở với "Loại hình" preset sẵn "Tại nhà".
7. Sửa 1 dịch vụ tại nhà, lưu thành công → toast hiện, bảng reload, số liệu thống kê "Tại nhà" ở đầu trang cập nhật đúng.
8. Ẩn/hiện 1 dịch vụ tại nhà → hoạt động như cũ (confirm dialog, toast, cập nhật badge trạng thái).

Nếu bất kỳ bước nào sai lệch, sửa trực tiếp trong `ManageServices.tsx` trước khi qua Step 5.

- [ ] **Step 5: Kiểm tra thay đổi (KHÔNG commit)**

Run: `git diff --stat frontend/src/pages/admin/ManageServices.tsx`
Expected: hiện đúng 1 file thay đổi. Không chạy `git commit`. Để người dùng tự review và commit toàn bộ 4 task (mock data, ServiceFormModal, trang chi tiết, ManageServices) theo ý họ.

---

## Ghi chú tổng kết

Sau khi hoàn thành cả 4 task: chạy lại `npx tsc --noEmit` và `npx vitest run` một lần cuối ở gốc `frontend/`, xác nhận baseline test fail không đổi, rồi báo cáo lại cho người dùng để họ tự `git add` + `git commit` theo quy ước Conventional Commits của dự án (`feat: ...`).
