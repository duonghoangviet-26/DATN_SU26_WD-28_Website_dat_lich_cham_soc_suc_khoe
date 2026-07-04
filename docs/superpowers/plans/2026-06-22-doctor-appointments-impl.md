# Doctor Appointments B3+B4 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement B3 (xác nhận/quản lý lịch hẹn) + B4 (ghi kết quả khám) cho actor Bác sĩ, sửa 6 bugs từ spec, bổ sung 4 gap features, đảm bảo 61 test cases pass.

**Architecture:** Frontend-first với mock data. Page → service → mock data. Khi gắn MongoDB chỉ đổi service method bodies, UI giữ nguyên.

**Tech Stack:** React 18, TypeScript, TailwindCSS, Vite, mock data (src/mock/*.ts)

## Global Constraints

- Không hardcode logic nghiệp vụ trong JSX — đưa vào service
- Debounce search 300ms (pattern từ ManageServices)
- Tab count KHÔNG bị ảnh hưởng bởi search / status filter
- `da_co_ket_qua` chỉ được set `true` khi `examinationService.save()` thành công
- Nút "Xác nhận" chỉ hiện khi `payment_status === 'paid' && !isExpiredPending`
- Bác sĩ hủy `confirmed` → 100% refund bất kể thời điểm
- Kết quả khám khóa sau 24h (`co_the_sua = false`)
- Comment bằng tiếng Việt cho logic phức tạp
- Không dùng `var`, dùng `const`/`let`

---

## File Map

| File | Trạng thái | Vai trò |
|---|---|---|
| `frontend/src/types/index.ts` | ✅ DONE | `DoctorAppointmentDetail`, `ExaminationResult`, `PrescriptionDrug`, `DoctorSlot` |
| `frontend/src/components/admin/icons.tsx` | ✅ DONE | Thêm `edit`, `trash`, `lock`, `user` SVG |
| `frontend/src/mock/doctor-appointments.ts` | ✅ DONE | 13 records bao phủ tất cả test cases |
| `frontend/src/mock/doctor-schedule.ts` | ✅ DONE | 14 slots theo B2 spec |
| `frontend/src/mock/examinations.ts` | ✅ DONE | 2 kết quả khám mẫu |
| `frontend/src/services/doctor-appointment.service.ts` | ✅ DONE | `confirm`, `reject`, `complete`, `cancelConfirmed` |
| `frontend/src/services/examination.service.ts` | ✅ DONE | `getByAppointment`, `save` |
| `frontend/src/services/schedule.service.ts` | ✅ DONE | `getAll`, `addSlot`, `lockSlot`, `unlockSlot`, `deleteSlot` |
| `frontend/src/pages/doctor/DoctorAppointments.tsx` | ⚠ BUG | Fix React.Fragment key + past tab sort |
| `frontend/src/pages/doctor/DoctorSchedule.tsx` | ✅ DONE | Slot management B2 |

---

## Task 1: Foundation — types, icons, mock data

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/components/admin/icons.tsx`
- Modify: `frontend/src/mock/doctor-appointments.ts`
- Modify: `frontend/src/mock/doctor-schedule.ts`
- Modify: `frontend/src/mock/examinations.ts`

**Status: ✅ DONE**

- [x] **Step 1:** Cập nhật `DoctorSlot` type trong `types/index.ts`
  ```ts
  export interface DoctorSlot {
    id: number
    ngay: string
    gio_bat_dau: string
    gio_ket_thuc: string
    phong_kham?: string | null
    benh_nhan?: string | null
    benh_nhan_id?: number | null
    status: 'active' | 'booked' | 'locked' | 'cancelled' | 'expired'
  }
  ```

- [x] **Step 2:** Thêm 4 icon vào `icons.tsx`
  ```ts
  edit: ['M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
         'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'],
  trash: ['M3 6h18','M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
          'M10 11v6','M14 11v6','M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2'],
  lock:  ['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z',
          'M7 11V7a5 5 0 0 1 10 0v4'],
  user:  ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2',
          'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  ```

- [x] **Step 3:** Thêm 3 record vào `mock/doctor-appointments.ts` (id 11, 12, 13)
  - id 11: TODAY, pending, **paid** → test TC-C01 "Xác nhận" happy path
  - id 12: d(-4), pending, unpaid → test TC-EDG09 badge "Hết hạn"
  - id 13: d(-1), completed, `da_co_ket_qua: false` → test TC-CO03 "Nhập kết quả"

- [x] **Step 4:** Kiểm tra TypeScript
  ```
  cd frontend && npx tsc --noEmit
  ```
  Expected: 0 errors

- [x] **Step 5:** Commit
  ```
  git add frontend/src/types/index.ts frontend/src/components/admin/icons.tsx
  git add frontend/src/mock/
  git commit -m "feat: fix DoctorSlot type + icons + expand mock data"
  ```

---

## Task 2: Service layer — fix bugs + new methods

**Files:**
- Modify: `frontend/src/services/doctor-appointment.service.ts`
- Modify: `frontend/src/services/schedule.service.ts`
- Modify: `frontend/src/services/examination.service.ts`

**Status: ✅ DONE**

- [x] **Step 1:** Fix `complete()` — bỏ `da_co_ket_qua: true`
  ```ts
  async complete(id: number) {
    appointments = appointments.map((a) =>
      a.id === id ? { ...a, status: 'completed' } : a
    )
    return findOrThrow(appointments, id, 'Lịch hẹn')
  }
  ```

- [x] **Step 2:** Fix `reject()` — cập nhật `payment_status → refunded`
  ```ts
  async reject(id: number, ly_do: string) {
    appointments = appointments.map((a) =>
      a.id === id ? {
        ...a, status: 'cancelled', ly_do_huy: ly_do,
        payment_status: a.payment_status === 'paid' ? 'refunded' : a.payment_status,
      } : a
    )
    return findOrThrow(appointments, id, 'Lịch hẹn')
  }
  ```

- [x] **Step 3:** Thêm `cancelConfirmed()` — bác sĩ hủy `confirmed`, 100% refund
  ```ts
  async cancelConfirmed(id: number, ly_do: string) {
    appointments = appointments.map((a) =>
      a.id === id
        ? { ...a, status: 'cancelled', payment_status: 'refunded', ly_do_huy: ly_do }
        : a
    )
    return findOrThrow(appointments, id, 'Lịch hẹn')
  }
  ```

- [x] **Step 4:** Cập nhật `schedule.service.ts` — `addSlot` nhận `phong_kham`, thêm `lockSlot`/`unlockSlot`

- [x] **Step 5:** Kiểm tra TypeScript
  ```
  cd frontend && npx tsc --noEmit
  ```
  Expected: 0 errors

- [x] **Step 6:** Commit
  ```
  git commit -m "fix: complete() không set da_co_ket_qua, reject() hoàn tiền, thêm cancelConfirmed()"
  ```

---

## Task 3: DoctorAppointments.tsx — giao diện chính

**Files:**
- Modify: `frontend/src/pages/doctor/DoctorAppointments.tsx`

**Status: ✅ DONE**

- [x] **Step 1:** Thêm 4 tab thời gian (today/upcoming/past/all) + badge count KHÔNG bị filter
  ```ts
  function tabCount(t: Tab) {
    if (t === 'today') return all.filter((a) => a.ngay_kham === todayStr).length
    if (t === 'upcoming') return all.filter((a) => a.ngay_kham > todayStr).length
    if (t === 'past') return all.filter((a) => a.ngay_kham < todayStr).length
    return all.length
  }
  ```

- [x] **Step 2:** Debounce search 300ms (pattern ManageServices)
  ```ts
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])
  ```

- [x] **Step 3:** Status tab card-style (pending/confirmed/completed/cancelled/all)

- [x] **Step 4:** Column sort ▲/▼/⇅ cho 3 cột: Bệnh nhân, Ngày/Giờ, Phí

- [x] **Step 5:** `useMemo` cho `urgentCount` (pending hôm nay) + banner cảnh báo

- [x] **Step 6:** Helper `isExpiredPending` → badge "Hết hạn" + ẩn nút Xác nhận

- [x] **Step 7:** Expand row — hiện phone, thanh toán, tuổi/giới tính, dị ứng, bệnh nền, lý do khám/hủy

- [x] **Step 8:** Empty state contextual (khi search vs. khi không có dữ liệu)

- [x] **Step 9:** Toast notification sau mỗi action

---

## Task 4: Action buttons + modals

**Files:**
- Modify: `frontend/src/pages/doctor/DoctorAppointments.tsx`

**Status: ✅ DONE**

| Trạng thái | Nút | Điều kiện |
|---|---|---|
| `pending` | Xác nhận | `payment_status === 'paid' && !isExpiredPending` |
| `pending` | Từ chối | Luôn hiện |
| `confirmed` | Hoàn thành | Luôn hiện |
| `confirmed` | Kết quả | Luôn hiện (mở ExamModal) |
| `confirmed` | Hủy | Luôn hiện (bác sĩ hủy) |
| `completed` | Xem/Nhập kết quả | `da_co_ket_qua ? 'Xem' : 'Nhập'` |

- [x] **Step 1:** Nút Xác nhận với guard `payment_status === 'paid' && !isExpiredPending`
- [x] **Step 2:** `ReasonModal` dùng chung cho Từ chối và Bác sĩ hủy
- [x] **Step 3:** `ExamModal` (xem Task 5)
- [x] **Step 4:** `handleCancelConfirmed` — set `payment_status: 'refunded'`

---

## Task 5: ExamModal — B4 ghi kết quả khám

**Files:**
- Modify: `frontend/src/pages/doctor/DoctorAppointments.tsx` (ExamModal component)
- Dependency: `frontend/src/services/examination.service.ts`

**Status: ✅ DONE**

- [x] **Step 1:** Load kết quả cũ qua `examinationService.getByAppointment(appt.id)`
- [x] **Step 2:** `isReadOnly = existing !== null && !existing.co_the_sua` — khóa form sau 24h
- [x] **Step 3:** Fields: chẩn đoán (required), hướng dẫn điều trị, ngày tái khám, đơn thuốc
- [x] **Step 4:** Đơn thuốc: thêm/xóa dòng, fields: tên thuốc, liều dùng, tần suất, số ngày, ghi chú
- [x] **Step 5:** `onSaved(result)` → parent set `da_co_ket_qua: true` qua `updateAppt()`
  ```ts
  onSaved={() => {
    updateAppt(examAppt.id, { da_co_ket_qua: true })
    showToast('Đã lưu kết quả khám')
    setExamAppt(null)
  }}
  ```

---

## Task 6: Fix React.Fragment key + past tab sort ← **CẦN LÀM**

**Files:**
- Modify: `frontend/src/pages/doctor/DoctorAppointments.tsx`

**Status: ⏳ TODO**

### 6.1 — React.Fragment key warning

**Vấn đề:** `displayed.map((appt) => (<>...</>))` — fragment `<>` không hỗ trợ `key` prop → React cảnh báo "Each child in a list should have a unique 'key' prop".

- [ ] **Step 1:** Tìm dòng 591 trong `DoctorAppointments.tsx`
  ```tsx
  // HIỆN TẠI (sai):
  displayed.map((appt) => (
    <>
      <tr key={appt.id}>...</tr>
      {expandedId === appt.id && <tr key={`${appt.id}-detail`}>...</tr>}
    </>
  ))
  ```

- [ ] **Step 2:** Thay `<>` bằng `React.Fragment` với `key`
  ```tsx
  // SAU KHI FIX:
  displayed.map((appt) => (
    <React.Fragment key={appt.id}>
      <tr className={...} onClick={...}>...</tr>
      {expandedId === appt.id && <tr className="bg-brand-50/30">...</tr>}
    </React.Fragment>
  ))
  ```
  Xóa `key` khỏi inner `<tr>` (key chỉ cần ở Fragment).

- [ ] **Step 3:** Thêm `React` vào import nếu chưa có
  ```ts
  import React, { useEffect, useMemo, useRef, useState } from 'react'
  ```

### 6.2 — Past tab mặc định sort descending

**Vấn đề:** Tab "Đã qua" hiện `sortDir = 'asc'` (cũ nhất lên đầu). Spec yêu cầu mặc định hiện mới nhất trước.

- [ ] **Step 4:** Thêm hàm `handleTabChange` để reset sort khi chuyển tab
  ```ts
  function handleTabChange(newTab: Tab) {
    setTab(newTab)
    setSortKey('ngay_kham')
    // "Đã qua" → mới nhất lên đầu; các tab khác → sớm nhất lên đầu
    setSortDir(newTab === 'past' ? 'desc' : 'asc')
    setActiveStatus('')
  }
  ```

- [ ] **Step 5:** Thay `onClick={() => setTab(key)}` bằng `onClick={() => handleTabChange(key)}`
  ```tsx
  // Tìm trong TIME_TABS.map:
  // Trước:
  onClick={() => setTab(key)}
  // Sau:
  onClick={() => handleTabChange(key)}
  ```

- [ ] **Step 6:** Kiểm tra TypeScript
  ```
  cd frontend && npx tsc --noEmit
  ```
  Expected: 0 errors

- [ ] **Step 7:** Commit
  ```
  git add frontend/src/pages/doctor/DoctorAppointments.tsx
  git commit -m "fix: React.Fragment key trong bảng lịch hẹn, tab Đã qua sort mặc định giảm dần"
  ```

---

## Task 7: DoctorSchedule.tsx — B2 slot management

**Files:**
- Modify: `frontend/src/pages/doctor/DoctorSchedule.tsx`

**Status: ✅ DONE**

- [x] Hiển thị slot theo ngày, badge phong_kham (cảnh báo nếu null)
- [x] Badge tên bệnh nhân khi `status === 'booked'`
- [x] Nút Khóa (active → locked), Bỏ khóa (locked → active), Xóa (active + không có bệnh nhân)
- [x] Form thêm ca: ngày, giờ bắt đầu/kết thúc, phòng khám
- [x] Validate: giờ bắt đầu < giờ kết thúc
- [x] Toast/error inline khi action thất bại

---

## Task 8: Verification — chạy test cases từ spec

**Files:** Không sửa code — chỉ verify

**Dựa trên:** `docs/superpowers/specs/2026-06-22-doctor-appointments-upgrade.md` — 61 test cases

### Verify step-by-step (chạy dev server):

```
cd frontend && npm run dev
```

Mở: `http://localhost:5173/doctor/appointments`

### Nhóm CONFIRM (TC-C01 → TC-C04):

- [ ] **TC-C01:** Click "Xác nhận" ở id 11 (pending + paid hôm nay) → badge chuyển "Đã xác nhận", toast "Đã xác nhận lịch hẹn"
- [ ] **TC-C02:** id 3 (pending + unpaid) → KHÔNG thấy nút "Xác nhận"
- [ ] **TC-C03:** id 4 (pending + unpaid) → chỉ thấy nút "Từ chối"
- [ ] **TC-C04:** Xác nhận id 11 → badge tab count "Hôm nay" KHÔNG giảm (count không bị filter)

### Nhóm REJECT (TC-R01 → TC-R05):

- [ ] **TC-R01:** Click "Từ chối" id 11 (paid) → modal hiện → nhập lý do → xác nhận → badge "Đã hủy", payment "Đã hoàn tiền"
- [ ] **TC-R02:** Click "Từ chối" id 3 (unpaid) → hủy thành công, payment_status KHÔNG đổi
- [ ] **TC-R03:** Modal "Từ chối" → bỏ trống lý do → nút "Xác nhận từ chối" disabled
- [ ] **TC-R04:** Đóng modal → lịch hẹn không thay đổi
- [ ] **TC-R05:** id 12 (pending hết hạn) → thấy nút "Từ chối", không thấy "Xác nhận"

### Nhóm COMPLETE (TC-CO01 → TC-CO04):

- [ ] **TC-CO01:** Click "Hoàn thành" ở id 1 (confirmed) → badge "Hoàn thành", vẫn thấy nút "Xem kết quả"
- [ ] **TC-CO02:** id 2 (confirmed, `da_co_ket_qua: false`) → click "Hoàn thành" → nút đổi thành "Nhập kết quả" (brand)
- [ ] **TC-CO03:** id 13 (completed, `da_co_ket_qua: false`) → thấy nút "Nhập kết quả" màu brand
- [ ] **TC-CO04:** id 8 (completed, `da_co_ket_qua: true`) → thấy nút "Xem kết quả" màu green

### Nhóm CANCEL CONFIRMED (TC-CC01 → TC-CC03):

- [ ] **TC-CC01:** Click "Hủy" ở id 5 (confirmed) → modal "Hủy lịch đã xác nhận" với description hoàn 100%
- [ ] **TC-CC02:** Nhập lý do → xác nhận → badge "Đã hủy", payment "Đã hoàn tiền"
- [ ] **TC-CC03:** Modal CC → bỏ trống lý do → nút Xác nhận hủy disabled

### Nhóm EXAM MODAL (TC-EM01 → TC-EM06):

- [ ] **TC-EM01:** Click "Kết quả" ở id 5 (confirmed) → modal mở, form trống, editable
- [ ] **TC-EM02:** Nhập chẩn đoán + đơn thuốc → lưu → toast "Đã lưu kết quả khám"
- [ ] **TC-EM03:** Sau lưu → nút đổi thành "Xem kết quả" màu green
- [ ] **TC-EM04:** id 8 (completed, `da_co_ket_qua: true`) → ExamModal mở ở chế độ xem (readOnly nếu >24h)
- [ ] **TC-EM05:** "Thêm thuốc" → dòng mới; nút xóa chỉ hiện khi có ≥2 thuốc
- [ ] **TC-EM06:** Form chẩn đoán required → submit khi trống → không lưu

### Nhóm SEARCH (TC-S01 → TC-S04):

- [ ] **TC-S01:** Gõ "Nguyễn" → chỉ hiện các lịch hẹn có "Nguyễn" trong tên, debounce 300ms
- [ ] **TC-S02:** Xóa search → hiện lại tất cả
- [ ] **TC-S03:** Tab count không đổi khi gõ search
- [ ] **TC-S04:** Gõ "zzz" → empty state "Không tìm thấy..." + nút "Xoá tìm kiếm"

### Nhóm FILTER (TC-F01 → TC-F04):

- [ ] **TC-F01:** Click "Chờ xác nhận" → chỉ hiện pending
- [ ] **TC-F02:** Kết hợp tab "Hôm nay" + status "Chờ xác nhận" → lọc chính xác
- [ ] **TC-F03:** Status filter reset khi không có kết quả → empty state
- [ ] **TC-F04:** Tab "Tất cả" + status "Tất cả" → hiện 13 lịch hẹn

### Nhóm SORT (TC-SO01 → TC-SO04):

- [ ] **TC-SO01:** Click "Bệnh nhân" header → sắp xếp A→Z, click lại → Z→A
- [ ] **TC-SO02:** Click "Ngày/Giờ" header → sắp xếp tăng dần, click lại → giảm dần
- [ ] **TC-SO03:** Click "Phí" header → sắp theo giá
- [ ] **TC-SO04:** Chuyển sang tab "Đã qua" → sort mặc định là desc (mới nhất lên đầu)

### Nhóm EXPAND (TC-EX01 → TC-EX04):

- [ ] **TC-EX01:** Click vào row id 1 → expanded row hiện: phone, thanh toán, tuổi/giới, dị ứng, bệnh nền, lý do khám
- [ ] **TC-EX02:** Click lại → thu gọn
- [ ] **TC-EX03:** id 10 (cancelled) → expanded row hiện "Lý do hủy" màu đỏ
- [ ] **TC-EX04:** id 11 không có dị ứng/bệnh nền → các field đó KHÔNG hiện

### Nhóm URGENT BANNER (TC-U01 → TC-U02):

- [ ] **TC-U01:** Trang load lần đầu → banner "Có X lịch hôm nay chưa xác nhận" hiện (X ≥ 1 vì id 3, 4, 11)
- [ ] **TC-U02:** Xác nhận hết tất cả pending hôm nay → banner biến mất

### Nhóm EDGE CASES (TC-EDG01 → TC-EDG10):

- [ ] **TC-EDG09:** id 12 (pending + `ngay_kham < today`) → badge "Hết hạn" (gray) hiện thêm bên dưới "Chờ xác nhận"
- [ ] **TC-EDG10:** Tab "Đã qua" → id 12 xuất hiện trong tab này

---

## Checklist đối chiếu spec

Tất cả yêu cầu trong `docs/superpowers/specs/2026-06-22-doctor-appointments-upgrade.md`:

- [x] BUG-1: `complete()` không set `da_co_ket_qua: true`
- [x] BUG-2: Nút Xác nhận chỉ hiện khi `payment_status === 'paid'`
- [x] BUG-3: `reject()` cập nhật `payment_status → refunded`
- [x] BUG-4: Icon `edit`, `trash`, `lock`, `user` tồn tại trong icons.tsx
- [x] BUG-5: `DoctorSlot` type đúng theo B2 spec
- [x] BUG-6: Mock data đủ 3 record bổ sung
- [x] GAP-1: Tìm kiếm debounce theo tên bệnh nhân
- [x] GAP-2: Badge "Hết hạn" cho pending quá ngày
- [x] GAP-3: `cancelConfirmed()` + modal bác sĩ hủy
- [x] GAP-4: Banner urgent + `urgentCount` useMemo
- [ ] FIX-1: React.Fragment key trong bảng (Task 6)
- [ ] FIX-2: Past tab mặc định sort desc (Task 6)
