# Luồng Xét nghiệm tại nhà — Điều hướng Client (Tầng 2–3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng 2 trang client mới (`HomeServiceList`, `HomeServiceDetail`) cho phép bệnh nhân duyệt danh sách dịch vụ xét nghiệm tại nhà và xem chi tiết gói dịch vụ, theo `docs/superpowers/specs/2026-07-03-service-navigation-flow.md` mục 3.2.

**Architecture:** Tái sử dụng `serviceService.getAll()`/`getById()` đã có sẵn trong `frontend/src/services/service.service.ts` (không cần thêm hàm mới — `getAll('home', '', 'active')` đã đủ lọc đúng dữ liệu cần). Route mới gắn dưới `ClientLayout`. Nút "Đặt lịch ngay" hiển thị Toast "đang hoàn thiện" — giống Task 6 của plan `2026-07-03-client-specialty-navigation.md`, không submit booking thật (ngoài phạm vi, xem `docs/superpowers/specs/2026-07-02-known-issues-out-of-scope.md`).

**Tech Stack:** React 18 + TypeScript + Vite + TailwindCSS + react-router-dom v6.

## Global Constraints

- **Phụ thuộc:** Plan này giả định `docs/superpowers/plans/2026-07-03-client-specialty-navigation.md` đã chạy xong — cụ thể là route `/dich-vu` (trang `ServicesHome.tsx`) đã tồn tại và đã có sẵn link tới `/dich-vu/xet-nghiem` trong mảng `CATEGORIES`. Nếu plan kia CHƯA chạy, Task 1 Step 2 dưới đây (sửa `AppRoutes.tsx`) vẫn áp dụng được độc lập — chỉ cần bỏ qua phần giả định `ServicesHome.tsx` đã trỏ sẵn tới `/dich-vu/xet-nghiem`.
- Giai đoạn hiện tại là **mock-data-first** — không thêm axios thật, tái sử dụng `service.service.ts` hiện có nguyên trạng.
- Trường dữ liệu giữ tiếng Việt khớp DB (`ten`, `gia`, `khu_vuc`, `mo_ta_ngan`...).
- Component đặt tên `PascalCase.tsx`, biến/hàm `camelCase`, import dùng alias `@/`.
- Trang **không bao giờ** gọi mock trực tiếp — luôn qua `services/*.service.ts`.
- Đặt lịch thật (submit booking + thanh toán) NGOÀI PHẠM VI plan này — nút "Đặt lịch ngay" chỉ hiện Toast thông báo.
- KHÔNG tự ý `git commit`/`git push` — người dùng tự review diff và commit.

---

### Task 1: Trang `HomeServiceList.tsx` (Tầng 2 — danh sách dịch vụ tại nhà)

**Files:**
- Create: `frontend/src/pages/client/HomeServiceList.tsx`
- Modify: `frontend/src/routes/AppRoutes.tsx`

**Interfaces:**
- Consumes: `serviceService.getAll(loai?, search?, status?, page?, limit?): Promise<PagedResult<ServiceItem>>` (đã có, không cần sửa) từ `frontend/src/services/service.service.ts`.
- Produces: Route `/dich-vu/xet-nghiem` render `HomeServiceList`, mỗi card link sang `/dich-vu/xet-nghiem/:id` mà Task 2 tiêu thụ.

- [ ] **Step 1: Tạo trang `HomeServiceList.tsx`**

Tạo `frontend/src/pages/client/HomeServiceList.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { serviceService } from '@/services/service.service'
import type { ServiceItem } from '@/types'
import PageHeader from '@/components/common/PageHeader'

export default function HomeServiceList() {
  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    serviceService
      .getAll('home', '', 'active', 1, 50)
      .then((res) => {
        if (!ignore) setServices(res.items)
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
      <PageHeader
        title="Xét nghiệm y học tại nhà"
        description="Nhân viên đến tận nhà lấy mẫu — kết quả trả qua ứng dụng."
      />

      {loading ? (
        <p className="text-sm text-slate-500">Đang tải...</p>
      ) : services.length === 0 ? (
        <p className="text-sm text-slate-500">Hiện chưa có dịch vụ nào.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <Link key={s.id} to={`/dich-vu/xet-nghiem/${s.id}`} className="card-hover p-5">
              <h3 className="font-semibold text-slate-800">{s.ten}</h3>
              <p className="mt-1 text-sm text-slate-500">{s.mo_ta_ngan}</p>
              <p className="mt-3 font-semibold text-brand-600">{s.gia.toLocaleString('vi-VN')}đ</p>
              {s.khu_vuc && s.khu_vuc.length > 0 && (
                <p className="mt-1 text-xs text-slate-400">Khu vực: {s.khu_vuc.join(', ')}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Đăng ký route trong `AppRoutes.tsx`**

Thêm import trong `frontend/src/routes/AppRoutes.tsx`:

```tsx
import HomeServiceList from '@/pages/client/HomeServiceList'
```

Thêm route trong khối `<Route element={<ClientLayout />}>` (giữ nguyên các route đã có từ plan specialty-navigation nếu đã chạy):

```tsx
      <Route element={<ClientLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/dich-vu" element={<ServicesHome />} />
        <Route path="/dich-vu/chuyen-khoa" element={<SpecialtyList />} />
        <Route path="/dich-vu/chuyen-khoa/:slug" element={<SpecialtyDoctors />} />
        <Route path="/dich-vu/xet-nghiem" element={<HomeServiceList />} />
      </Route>
```

Nếu plan `2026-07-03-client-specialty-navigation.md` CHƯA chạy, các dòng `ServicesHome`/`SpecialtyList`/`SpecialtyDoctors` sẽ không tồn tại — chỉ thêm dòng `HomeServiceList` vào khối `<Route element={<ClientLayout />}>` hiện có.

- [ ] **Step 3: Kiểm tra thủ công**

Run: `cd frontend && npm run dev` (nếu chưa chạy)

Mở `http://localhost:5173/dich-vu/xet-nghiem`:
- Xác nhận hiển thị đúng 2 dịch vụ (mock có 4 dịch vụ `loai='home'` nhưng chỉ 2 cái `status='active'`: "Lấy mẫu xét nghiệm máu tại nhà" 500.000đ và... — mock-svc-004 "nước tiểu" có `status:'inactive'` nên KHÔNG hiện).
- Xác nhận card hiển thị đúng khu vực phục vụ (Cầu Giấy, Nam Từ Liêm, Thanh Xuân, Đống Đa, Hoàng Mai).

---

### Task 2: Trang `HomeServiceDetail.tsx` (Tầng 3 — chi tiết gói dịch vụ) + E2E walkthrough

**Files:**
- Create: `frontend/src/pages/client/HomeServiceDetail.tsx`
- Modify: `frontend/src/routes/AppRoutes.tsx`

**Interfaces:**
- Consumes: `serviceService.getById(id: string): Promise<ServiceItem>` (đã có, ném lỗi nếu không tìm thấy).
- Produces: Route `/dich-vu/xet-nghiem/:id` — điểm cuối của luồng "Xét nghiệm y học".

- [ ] **Step 1: Tạo trang `HomeServiceDetail.tsx`**

Tạo `frontend/src/pages/client/HomeServiceDetail.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { serviceService } from '@/services/service.service'
import type { ServiceItem } from '@/types'
import PageHeader from '@/components/common/PageHeader'
import Toast from '@/components/common/Toast'

export default function HomeServiceDetail() {
  const { id } = useParams<{ id: string }>()
  const [service, setService] = useState<ServiceItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let ignore = false
    setLoading(true)
    serviceService
      .getById(id)
      .then((s) => {
        if (ignore) return
        // Chỉ hiển thị dịch vụ home + active — khớp điều kiện lọc của HomeServiceList
        setService(s.loai === 'home' && s.status === 'active' ? s : null)
      })
      .catch(() => {
        if (!ignore) setService(null)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [id])

  if (loading) return <p className="text-sm text-slate-500">Đang tải...</p>

  if (!service) {
    return (
      <div className="text-center">
        <p className="text-slate-600">Không tìm thấy dịch vụ.</p>
        <Link to="/dich-vu/xet-nghiem" className="btn-secondary mt-4 inline-block">
          Quay lại danh sách
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={service.ten} description={service.mo_ta_ngan ?? undefined} />

      <div className="card space-y-4 p-6">
        <p className="text-2xl font-bold text-brand-600">{service.gia.toLocaleString('vi-VN')}đ</p>

        {service.mo_ta && <p className="text-sm text-slate-600">{service.mo_ta}</p>}

        {service.khu_vuc && service.khu_vuc.length > 0 && (
          <div>
            <p className="text-sm font-medium text-slate-700">Khu vực phục vụ</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {service.khu_vuc.map((kv) => (
                <span key={kv} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                  {kv}
                </span>
              ))}
            </div>
          </div>
        )}

        {service.ngay_ap_dung && (
          <div>
            <p className="text-sm font-medium text-slate-700">Lịch hoạt động</p>
            <p className="mt-1 text-sm text-slate-500">
              {service.ngay_ap_dung}, {service.gio_bat_dau}–{service.gio_ket_thuc}
            </p>
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-slate-700">Quy trình</p>
          <p className="mt-1 text-sm text-slate-500">
            Nhân viên đến tận nơi → lấy mẫu → mẫu chuyển về lab xử lý → kết quả PDF gửi qua ứng dụng.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setToast('Chức năng đặt lịch đang được hoàn thiện, vui lòng quay lại sau.')}
          className="btn-primary w-full"
        >
          Đặt lịch ngay
        </button>
      </div>

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  )
}
```

- [ ] **Step 2: Đăng ký route trong `AppRoutes.tsx`**

Thêm import:

```tsx
import HomeServiceDetail from '@/pages/client/HomeServiceDetail'
```

Route cuối cùng trong khối `<Route element={<ClientLayout />}>`:

```tsx
      <Route element={<ClientLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/dich-vu" element={<ServicesHome />} />
        <Route path="/dich-vu/chuyen-khoa" element={<SpecialtyList />} />
        <Route path="/dich-vu/chuyen-khoa/:slug" element={<SpecialtyDoctors />} />
        <Route path="/dich-vu/xet-nghiem" element={<HomeServiceList />} />
        <Route path="/dich-vu/xet-nghiem/:id" element={<HomeServiceDetail />} />
      </Route>
```

- [ ] **Step 3: Kiểm tra TypeScript build**

Run: `cd frontend && npx tsc --noEmit`
Expected: Không lỗi.

- [ ] **Step 4: Chạy toàn bộ test suite, xác nhận không có regression**

Run: `cd frontend && npx vitest run`
Expected: Toàn bộ test PASS (plan này không thêm test service mới vì không sửa `service.service.ts`).

- [ ] **Step 5: E2E walkthrough thủ công**

Với dev server đang chạy:
1. Vào `/dich-vu/xet-nghiem` → bấm vào "Lấy mẫu xét nghiệm máu tại nhà" → tới `/dich-vu/xet-nghiem/mock-svc-003`.
2. Xác nhận hiển thị: giá 500.000đ, mô tả đầy đủ, 5 khu vực phục vụ dạng badge, lịch hoạt động "T2–T7, 08:00–17:00", mục "Quy trình".
3. Bấm "Đặt lịch ngay" → Toast "Chức năng đặt lịch đang được hoàn thiện..." hiện ra.
4. Vào trực tiếp `/dich-vu/xet-nghiem/mock-svc-004` (dịch vụ "nước tiểu", `status:'inactive'`) → xác nhận hiển thị "Không tìm thấy dịch vụ" (đúng vì bị ẩn), KHÔNG rò rỉ thông tin dịch vụ chưa duyệt.
5. Vào trực tiếp `/dich-vu/xet-nghiem/mock-svc-001` (dịch vụ `loai:'related'` "Siêu âm tim") → xác nhận hiển thị "Không tìm thấy dịch vụ" (đúng vì related không được đặt lịch riêng).
6. Vào `/dich-vu/xet-nghiem/khong-ton-tai` → xác nhận hiển thị "Không tìm thấy dịch vụ" + nút quay lại, không crash trang trắng.

Nếu cả 6 bước trên đúng như mô tả, plan này hoàn thành.
