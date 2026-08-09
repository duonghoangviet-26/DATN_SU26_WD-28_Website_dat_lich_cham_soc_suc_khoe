# WS-1 — Luồng khám 4 bước · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay form phẳng nhồi mọi field bằng quy trình 4 bước có thứ tự (Tiếp nhận → Chẩn đoán → Dịch vụ → Kê đơn → Xác nhận), lưu nháp từng bước, kết thúc mời được bệnh nhân tiếp theo — để hồ sơ sinh ra là một bệnh án hoàn chỉnh chứ không phải vài ô text.

**Architecture:** Thêm `KetQuaKham.buoc_hien_tai` làm máy trạng thái phiên khám. Toàn bộ nghiệp vụ ghi phiên khám gom vào `services/examSession.service.js` — nguồn ghi **duy nhất**; các endpoint cũ (`createResult`, `createResultByQueue`, `updateResult`) giữ nguyên chữ ký nhưng gọi vào service này. Frontend đổi từ modal sang trang riêng `/doctor/exam/:queueId`.

**Tech Stack:** Node.js + Express 4, Mongoose 8, React 18 + Vite + TailwindCSS + TypeScript, `node:test` + `node:assert/strict`.

## Global Constraints

- **KHÔNG sửa** `.claude/rules/lich-lam-viec-bac-si.md`. Không đụng `HangDoi` (bậc ưu tiên động, aging, overflow), `LichLamViec`, quota 70/30, các mốc `T-30'/T-15'/T+15'`.
- **KHÔNG dùng** trạng thái `cho_dich_vu` — quyết định Q1 của spec: bệnh nhân **luôn ở trong phòng** khi làm dịch vụ. Giữ nguyên giá trị đó trong enum, không xoá.
- **Bác sĩ KHÔNG thao tác tiền.** Bước Dịch vụ chỉ ghi chỉ định vào `KetQuaKham.dich_vu_phat_sinh[]`; thu tiền là việc của lễ tân ở quầy (quyết định Q2).
- **Tên field chính xác** trong `KetQuaKham`: `chan_doan`, **`huong_dan_dieu_tri`** (KHÔNG phải `huong_dan`), `ghi_chu`, `trieu_chung_ban_dau`, `ngay_tai_kham`, `dich_vu_phat_sinh`, `co_the_sua`, `status`, `lich_su_sua`.
- **Ràng buộc DB có sẵn:** `KetQuaKham` có unique sparse index trên `appointment_id` và trên `hang_doi_id`, cùng `pre('validate')` bắt buộc có ít nhất một trong hai. Mọi bản ghi nháp phải gán `hang_doi_id` ngay từ bước 1.
- Test: hàm thuần dùng `node:test` + `node:assert/strict` trong `backend/tests/*.test.js` (`npm test`, cwd `backend/`). Luồng chạm DB kiểm bằng script e2e trong `backend/src/scripts/`.
- Comment tiếng Việt cho logic phức tạp. Response chuẩn `{ success, message, data }` qua `ok`/`fail`/`created` của `utils/response.js`.
- Nhánh làm việc: `Fix_demo`.

---

## File Structure

**Tạo mới:**
| File | Trách nhiệm |
|---|---|
| `backend/src/services/examSession.service.js` | Nguồn ghi **duy nhất** cho phiên khám: đọc nháp, lưu từng bước, hoàn tất |
| `backend/src/services/examStepRules.js` | Hàm **thuần** về thứ tự bước + validate từng bước (test được không cần Mongo) |
| `backend/src/controllers/doctor/exam-session.controller.js` | Thin layer |
| `backend/src/routes/doctor/exam-session.routes.js` | 3 endpoint |
| `backend/scripts/migrations/015-backfill-buoc-hien-tai-ket-qua-kham.js` | Gán `buoc_hien_tai='hoan_tat'` cho hồ sơ cũ |
| `backend/tests/doctor.ws1-exam-steps.test.js` | Test `examStepRules.js` |
| `backend/src/scripts/e2e-phien-kham-4-buoc.js` | E2E toàn luồng |
| `frontend/src/services/doctor-exam-session.service.ts` | Gọi API |
| `frontend/src/pages/doctor/ExamSessionPage.tsx` | Khung trang + thanh bước |
| `frontend/src/components/doctor/exam/StepTiepNhan.tsx` | Bước 1 |
| `frontend/src/components/doctor/exam/StepChanDoan.tsx` | Bước 2 |
| `frontend/src/components/doctor/exam/StepDichVu.tsx` | Bước 3 |
| `frontend/src/components/doctor/exam/StepKeDon.tsx` | Bước 4 |
| `frontend/src/components/doctor/exam/StepXacNhan.tsx` | Màn xác nhận |

**Sửa:**
| File | Sửa gì |
|---|---|
| `backend/src/models/KetQuaKham.js` | Thêm `buoc_hien_tai` |
| `backend/src/controllers/doctor/appointments.controller.js` | Chuyển `taoChiDinhDichVu`, `upsertVitals`, `getOwnedOfflineQueue` sang service dùng chung; import ngược lại |
| `backend/src/routes/doctor/index.js` | Mount `/exam-session` |
| `frontend/src/pages/doctor/DoctorExamQueue.tsx` | Nút "Vào phòng" điều hướng sang trang khám thay vì mở modal |
| `frontend/src/routes/AppRoutes.tsx` | Route `/doctor/exam/:queueId` |
| `frontend/src/types/index.ts` (hoặc file type tương ứng) | Type phiên khám |

---

## Task 1: Máy trạng thái bước khám (hàm thuần)

**Files:**
- Create: `backend/src/services/examStepRules.js`
- Test: `backend/tests/doctor.ws1-exam-steps.test.js`

**Interfaces:**
- Consumes: (không có)
- Produces:
  - `CAC_BUOC: string[]` — `['tiep_nhan','chan_doan','dich_vu','ke_don','hoan_tat']`
  - `NHAN_BUOC: Record<string,string>`
  - `buocKeTiep(buoc: string): string|null`
  - `buocTruoc(buoc: string): string|null`
  - `duocPhepVaoBuoc(buocDich: string, buocHienTai: string): boolean`
  - `kiemTraBuocTiepNhan(payload): { ok: boolean; loi: string[]; canhBao: string[] }`
  - `kiemTraBuocChanDoan(payload): { ok: boolean; loi: string[] }`
  - `tinhBMI(canNang: number|null, chieuCao: number|null): number|null`

- [ ] **Step 1: Viết test thất bại**

Tạo `backend/tests/doctor.ws1-exam-steps.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CAC_BUOC,
  buocKeTiep,
  buocTruoc,
  duocPhepVaoBuoc,
  kiemTraBuocTiepNhan,
  kiemTraBuocChanDoan,
  tinhBMI,
} from '../src/services/examStepRules.js'

test('WS-1 thứ tự 5 bước cố định', () => {
  assert.deepEqual(CAC_BUOC, ['tiep_nhan', 'chan_doan', 'dich_vu', 'ke_don', 'hoan_tat'])
})

test('WS-1 buocKeTiep đi đúng thứ tự và dừng ở bước cuối', () => {
  assert.equal(buocKeTiep('tiep_nhan'), 'chan_doan')
  assert.equal(buocKeTiep('ke_don'), 'hoan_tat')
  assert.equal(buocKeTiep('hoan_tat'), null)
  assert.equal(buocKeTiep('buoc_la'), null)
})

test('WS-1 buocTruoc lùi đúng và dừng ở bước đầu', () => {
  assert.equal(buocTruoc('chan_doan'), 'tiep_nhan')
  assert.equal(buocTruoc('tiep_nhan'), null)
})

test('WS-1 được phép quay lại bước đã qua để sửa', () => {
  assert.equal(duocPhepVaoBuoc('tiep_nhan', 'ke_don'), true)
  assert.equal(duocPhepVaoBuoc('chan_doan', 'chan_doan'), true)
})

test('WS-1 KHÔNG được nhảy cóc sang bước chưa tới', () => {
  // Nhảy thẳng sang kê đơn khi mới ở bước tiếp nhận = hồ sơ thiếu chẩn đoán,
  // đúng lỗi "quá sơ sài" mà hội đồng nêu.
  assert.equal(duocPhepVaoBuoc('ke_don', 'tiep_nhan'), false)
  assert.equal(duocPhepVaoBuoc('chan_doan', 'tiep_nhan'), false)
})

test('WS-1 bước tiếp nhận bắt buộc triệu chứng', () => {
  const r = kiemTraBuocTiepNhan({ trieu_chung_ban_dau: '   ' })
  assert.equal(r.ok, false)
  assert.ok(r.loi.some((m) => m.includes('Triệu chứng')))
})

test('WS-1 bước tiếp nhận KHÔNG bắt buộc cân nặng/chiều cao, chỉ cảnh báo', () => {
  // Quyết định Q7: bắt buộc sẽ khiến bác sĩ nhập bừa khi tái khám -> dữ liệu rác.
  const r = kiemTraBuocTiepNhan({ trieu_chung_ban_dau: 'Đau họng 3 ngày' })
  assert.equal(r.ok, true)
  assert.equal(r.loi.length, 0)
  assert.ok(r.canhBao.some((m) => m.includes('cân nặng')))
})

test('WS-1 bước tiếp nhận đủ sinh hiệu thì không còn cảnh báo', () => {
  const r = kiemTraBuocTiepNhan({
    trieu_chung_ban_dau: 'Đau họng 3 ngày',
    can_nang: 60,
    chieu_cao: 165,
  })
  assert.equal(r.ok, true)
  assert.deepEqual(r.canhBao, [])
})

test('WS-1 bước tiếp nhận từ chối sinh hiệu âm hoặc phi lý', () => {
  const r = kiemTraBuocTiepNhan({ trieu_chung_ban_dau: 'Sốt', can_nang: -5, chieu_cao: 900 })
  assert.equal(r.ok, false)
  assert.equal(r.loi.length, 2)
})

test('WS-1 bước chẩn đoán bắt buộc chẩn đoán', () => {
  assert.equal(kiemTraBuocChanDoan({ chan_doan: '' }).ok, false)
  assert.equal(kiemTraBuocChanDoan({ chan_doan: 'Viêm họng cấp' }).ok, true)
})

test('WS-1 BMI tính đúng và làm tròn 1 chữ số', () => {
  assert.equal(tinhBMI(60, 165), 22)
  assert.equal(tinhBMI(75, 180), 23.1)
})

test('WS-1 BMI trả null khi thiếu dữ liệu', () => {
  assert.equal(tinhBMI(null, 165), null)
  assert.equal(tinhBMI(60, null), null)
  assert.equal(tinhBMI(60, 0), null)
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `cd backend && node --test tests/doctor.ws1-exam-steps.test.js`
Expected: FAIL — `Cannot find module '../src/services/examStepRules.js'`

- [ ] **Step 3: Viết implementation**

Tạo `backend/src/services/examStepRules.js`:

```js
// ============================================================
// WS-1 — Quy tắc các bước của một phiên khám (HÀM THUẦN, không chạm DB)
// ============================================================
// Tách khỏi service để test được thứ tự bước và điều kiện từng bước mà không cần Mongo.
// Trước WS-1, toàn bộ hồ sơ khám nhập trong MỘT form phẳng: sinh hiệu, chẩn đoán, đơn
// thuốc hiện ra cùng lúc và không có thứ tự nào. Hội đồng chấm "quá sơ sài" chính vì
// không nhìn thấy quy trình.

export const CAC_BUOC = ['tiep_nhan', 'chan_doan', 'dich_vu', 'ke_don', 'hoan_tat']

export const NHAN_BUOC = {
  tiep_nhan: 'Tiếp nhận',
  chan_doan: 'Chẩn đoán',
  dich_vu:   'Dịch vụ',
  ke_don:    'Kê đơn',
  hoan_tat:  'Xác nhận',
}

// Ngưỡng sinh hiệu — chặn số phi lý (gõ nhầm đơn vị, thừa số 0), KHÔNG phải chuẩn y khoa.
const GIOI_HAN = {
  can_nang:  { min: 0.5, max: 400, ten: 'Cân nặng (kg)' },
  chieu_cao: { min: 20,  max: 300, ten: 'Chiều cao (cm)' },
  nhiet_do:  { min: 25,  max: 45,  ten: 'Nhiệt độ (°C)' },
  nhip_tim:  { min: 20,  max: 300, ten: 'Nhịp tim (lần/phút)' },
}

export function buocKeTiep(buoc) {
  const i = CAC_BUOC.indexOf(buoc)
  if (i < 0 || i === CAC_BUOC.length - 1) return null
  return CAC_BUOC[i + 1]
}

export function buocTruoc(buoc) {
  const i = CAC_BUOC.indexOf(buoc)
  if (i <= 0) return null
  return CAC_BUOC[i - 1]
}

/**
 * Có được mở bước `buocDich` khi phiên đang ở `buocHienTai` không?
 *
 * Được QUAY LẠI bước đã qua để sửa, nhưng KHÔNG được nhảy cóc tới bước chưa tới —
 * nhảy cóc đẻ ra đúng thứ hội đồng chê: hồ sơ có đơn thuốc mà không có chẩn đoán.
 */
export function duocPhepVaoBuoc(buocDich, buocHienTai) {
  const dich = CAC_BUOC.indexOf(buocDich)
  const hienTai = CAC_BUOC.indexOf(buocHienTai)
  if (dich < 0 || hienTai < 0) return false
  return dich <= hienTai
}

function kiemSoDo(payload, loi) {
  for (const [khoa, { min, max, ten }] of Object.entries(GIOI_HAN)) {
    const giaTri = payload[khoa]
    if (giaTri === null || giaTri === undefined || giaTri === '') continue
    const so = Number(giaTri)
    if (!Number.isFinite(so) || so < min || so > max) {
      loi.push(`${ten} phải nằm trong khoảng ${min}–${max}`)
    }
  }
}

/**
 * Bước 1. Quyết định Q7: CHỈ triệu chứng là bắt buộc.
 * Cân nặng/chiều cao thiếu thì cảnh báo vàng, không chặn — bắt buộc sẽ khiến bác sĩ
 * nhập bừa khi tái khám người lớn, sinh dữ liệu rác còn tệ hơn để trống.
 */
export function kiemTraBuocTiepNhan(payload = {}) {
  const loi = []
  const canhBao = []

  if (!payload.trieu_chung_ban_dau || !String(payload.trieu_chung_ban_dau).trim()) {
    loi.push('Triệu chứng / lý do khám là bắt buộc')
  }
  kiemSoDo(payload, loi)

  const thieu = []
  if (!payload.can_nang) thieu.push('cân nặng')
  if (!payload.chieu_cao) thieu.push('chiều cao')
  if (thieu.length) canhBao.push(`Chưa ghi ${thieu.join(' và ')} — hồ sơ sẽ thiếu chỉ số thể trạng`)

  return { ok: loi.length === 0, loi, canhBao }
}

/** Bước 2. `chan_doan` là `required` ở schema — chặn sớm để báo lỗi đọc được. */
export function kiemTraBuocChanDoan(payload = {}) {
  const loi = []
  if (!payload.chan_doan || !String(payload.chan_doan).trim()) {
    loi.push('Chẩn đoán là bắt buộc')
  }
  return { ok: loi.length === 0, loi }
}

/** BMI = kg / m². Trả null khi thiếu dữ liệu — KHÔNG trả 0 (0 trông như một chỉ số thật). */
export function tinhBMI(canNang, chieuCao) {
  const kg = Number(canNang)
  const cm = Number(chieuCao)
  if (!Number.isFinite(kg) || !Number.isFinite(cm) || kg <= 0 || cm <= 0) return null
  const bmi = kg / ((cm / 100) ** 2)
  return Math.round(bmi * 10) / 10
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `cd backend && node --test tests/doctor.ws1-exam-steps.test.js`
Expected: PASS — 12 test

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/examStepRules.js backend/tests/doctor.ws1-exam-steps.test.js
git commit -m "feat(bac-si): quy tac 5 buoc phien kham (ham thuan)

Thu tu buoc, chan nhay coc, validate tung buoc, tinh BMI.
Q7: chi trieu chung bat buoc; can nang/chieu cao chi canh bao."
```

---

## Task 2: Thêm `buoc_hien_tai` vào model + migration

**Files:**
- Modify: `backend/src/models/KetQuaKham.js`
- Create: `backend/scripts/migrations/015-backfill-buoc-hien-tai-ket-qua-kham.js`

**Interfaces:**
- Consumes: `CAC_BUOC` từ Task 1
- Produces: `KetQuaKham.buoc_hien_tai` — enum 5 giá trị, default `'tiep_nhan'`

- [ ] **Step 1: Thêm field vào schema**

Trong `backend/src/models/KetQuaKham.js`, thêm ngay **sau** field `status` (khối `enum: ['ban_nhap', 'cho_xac_nhan', ...]`):

```js
    // WS-1 — Bước đang dở của phiên khám 4 bước. Là con trỏ tiến độ, KHÔNG phải trạng thái
    // duyệt (đó là `status`). Bác sĩ đóng tab giữa chừng thì mở lại vào đúng bước này.
    // Hồ sơ nhập bằng luồng cũ (một form phẳng) vào thẳng 'hoan_tat'.
    buoc_hien_tai: {
      type: String,
      enum: ['tiep_nhan', 'chan_doan', 'dich_vu', 'ke_don', 'hoan_tat'],
      default: 'tiep_nhan',
    },
```

- [ ] **Step 2: Viết migration**

Tạo `backend/scripts/migrations/015-backfill-buoc-hien-tai-ket-qua-kham.js`.

Trước tiên đọc một migration có sẵn để khớp đúng khuôn `_migrationRunner.js`:

```bash
cd backend && cat scripts/migrations/012-backfill-nguon-lich-hen.js
```

Viết migration theo đúng khuôn đó, với phần thân:

```js
// Hồ sơ cũ đều được nhập bằng luồng một-form-phẳng và đã xác nhận xong, nên đúng nghĩa là
// đã ở bước cuối. Để default 'tiep_nhan' sẽ khiến trang khám hiểu nhầm là "đang dở dang"
// và mở lại bước 1 cho một hồ sơ đã chốt.
const ketQua = await db.collection('ket_qua_kham').updateMany(
  { buoc_hien_tai: { $exists: false } },
  { $set: { buoc_hien_tai: 'hoan_tat' } },
)
console.log(`  Da gan buoc_hien_tai='hoan_tat' cho ${ketQua.modifiedCount} ho so cu`)
```

- [ ] **Step 3: Chạy thử migration trên DB TEST trước**

Run: `cd backend && MONGODB_URI=<uri-db-test> node scripts/migrations/015-backfill-buoc-hien-tai-ket-qua-kham.js`
Expected: in ra số hồ sơ đã gán, không lỗi

Kiểm chứng:
```bash
cd backend && MONGODB_URI=<uri-db-test> node -e "
import('mongoose').then(async (m) => {
  await m.default.connect(process.env.MONGODB_URI)
  const c = m.default.connection.collection('ket_qua_kham')
  console.log('thieu buoc_hien_tai:', await c.countDocuments({ buoc_hien_tai: { \$exists: false } }))
  console.log('hoan_tat:', await c.countDocuments({ buoc_hien_tai: 'hoan_tat' }))
  await m.default.disconnect()
})"
```
Expected: `thieu buoc_hien_tai: 0`

- [ ] **Step 4: Chạy toàn bộ test backend**

Run: `cd backend && npm test`
Expected: PASS toàn bộ. Đặc biệt `ketquakham-sinhhieu.dualkey.test.js` phải còn xanh — nếu đỏ nghĩa là field mới phá `pre('validate')`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/models/KetQuaKham.js backend/scripts/migrations/015-backfill-buoc-hien-tai-ket-qua-kham.js
git commit -m "feat(bac-si): them KetQuaKham.buoc_hien_tai + migration 015

Ho so cu gan 'hoan_tat' — de default 'tiep_nhan' se lam trang kham
mo lai buoc 1 cho ho so da chot."
```

---

## Task 3: Tách helper dùng chung sang service

**Files:**
- Create: `backend/src/services/examSession.service.js` (phần helper)
- Modify: `backend/src/controllers/doctor/appointments.controller.js`

**Interfaces:**
- Consumes: `KetQuaKham`, `DonThuoc`, `SinhHieuKham`, `HangDoi`, `DichVu` từ models
- Produces (export từ `examSession.service.js`):
  - `upsertVitals({ appointmentId, hangDoiId, memberId, doctorUserId, sinhHieu }): Promise<void>`
  - `taoChiDinhDichVu(value, specialtyId, doctorId): Promise<{ ok, status?, message?, lines? }>`
  - `getOwnedOfflineQueue(queueId, docId): Promise<HangDoiDoc>` — throw `err.httpStatus`

**Lý do:** 3 helper này hiện là hàm **private** trong `appointments.controller.js` (dòng ~11, ~42, ~622). Luồng 4 bước cần dùng lại y hệt. Copy sẽ đẻ ra hai bản logic tính tiền dịch vụ — đúng thứ rule mục 7 cấm ("không mỗi vai trò một luồng").

- [ ] **Step 1: Đọc nguyên văn 3 helper**

Run:
```bash
cd backend && sed -n '1,60p' src/controllers/doctor/appointments.controller.js
cd backend && sed -n '622,636p' src/controllers/doctor/appointments.controller.js
```

Chép **nguyên văn** thân hàm `upsertVitals`, `taoChiDinhDichVu`, `getOwnedOfflineQueue` — không sửa logic ở bước này.

- [ ] **Step 2: Tạo service với 3 helper đã chuyển sang**

Tạo `backend/src/services/examSession.service.js`:

```js
import mongoose from 'mongoose'
import { DichVu, DonThuoc, HangDoi, KetQuaKham, LichHen, SinhHieuKham } from '../models/index.js'
import { soSanhThuTuHangDoi } from '../models/HangDoi.js'
import {
  CAC_BUOC,
  buocKeTiep,
  duocPhepVaoBuoc,
  kiemTraBuocChanDoan,
  kiemTraBuocTiepNhan,
  tinhBMI,
} from './examStepRules.js'

// ============================================================
// WS-1 — Phiên khám 4 bước. NGUỒN GHI DUY NHẤT cho hồ sơ khám.
// ============================================================
// `appointments.controller.js` (createResult / createResultByQueue / updateResult) nay gọi
// vào đây thay vì tự ghi. Có hai đường ghi song song vào cùng `KetQuaKham` là cách chắc
// chắn nhất để hai luồng lệch nhau — đúng thứ rule mục 7 cấm.

function loi(statusCode, message) {
  return Object.assign(new Error(message), { statusCode, httpStatus: statusCode })
}

// ─── Helper dùng chung (chuyển từ appointments.controller.js) ────────────────
// PASTE NGUYÊN VĂN thân 3 hàm dưới đây từ appointments.controller.js, chỉ thêm `export`:

export async function upsertVitals({ appointmentId, hangDoiId, memberId, doctorUserId, sinhHieu }) {
  // … nguyên văn từ appointments.controller.js dòng ~11
}

export async function taoChiDinhDichVu(value, specialtyId, doctorId) {
  // … nguyên văn từ appointments.controller.js dòng ~42
}

export async function getOwnedOfflineQueue(queueId, docId) {
  // … nguyên văn từ appointments.controller.js dòng ~622
}
```

- [ ] **Step 3: Sửa controller để import thay vì tự định nghĩa**

Trong `backend/src/controllers/doctor/appointments.controller.js`:
- **Xoá** 3 định nghĩa hàm `upsertVitals`, `taoChiDinhDichVu`, `getOwnedOfflineQueue`
- **Thêm** import:

```js
import {
  getOwnedOfflineQueue,
  taoChiDinhDichVu,
  upsertVitals,
} from '../../services/examSession.service.js'
```

Mọi lời gọi hiện có giữ nguyên — chữ ký không đổi.

- [ ] **Step 4: Chạy toàn bộ test backend**

Run: `cd backend && npm test`
Expected: PASS toàn bộ. `doctor.confirm-offline.test.js`, `doctor.confirm-result.test.js`, `ketquakham-sinhhieu.dualkey.test.js` là các test bảo vệ luồng này — đỏ nghĩa là chép thiếu.

- [ ] **Step 5: Kiểm import vòng**

Run: `cd backend && node -e "import('./src/controllers/doctor/appointments.controller.js').then(() => console.log('OK - khong co import vong')).catch((e) => { console.error(e); process.exit(1) })"`
Expected: `OK - khong co import vong`

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/examSession.service.js backend/src/controllers/doctor/appointments.controller.js
git commit -m "refactor(bac-si): chuyen helper ho so kham sang examSession.service

upsertVitals / taoChiDinhDichVu / getOwnedOfflineQueue tro thanh dung
chung. Chu ky khong doi, khong sua logic."
```

---

## Task 4: Đọc phiên khám + lưu nháp từng bước

**Files:**
- Modify: `backend/src/services/examSession.service.js`

**Interfaces:**
- Consumes: helper Task 3, quy tắc Task 1, `KetQuaKham.buoc_hien_tai` Task 2
- Produces:
  - `layPhienKham({ queueId, docId }): Promise<PhienKham>` với
    `PhienKham = { queue: {...}, ho_so: {...}|null, buoc_hien_tai: string, bmi: number|null, thuoc: object[], dich_vu_kha_dung: object[] }`
  - `luuBuoc({ queueId, docId, doctorUserId, buoc, payload }): Promise<PhienKham>`

- [ ] **Step 1: Viết hàm đọc phiên khám**

Thêm vào `backend/src/services/examSession.service.js`:

```js
/**
 * Đọc toàn bộ trạng thái một phiên khám: lượt hàng đợi, nháp hồ sơ, sinh hiệu, đơn thuốc,
 * và danh sách dịch vụ chỉ định được của chuyên khoa.
 *
 * Trả một lần đủ dữ liệu cho cả 5 bước: trang khám mở ra là dùng được ngay, không phải
 * gọi 5 API rời rạc rồi ghép — bác sĩ đang có bệnh nhân ngồi trước mặt.
 */
export async function layPhienKham({ queueId, docId }) {
  const entry = await getOwnedOfflineQueue(queueId, docId)

  const [hoSo, sinhHieu, dichVuKhaDung] = await Promise.all([
    KetQuaKham.findOne({ hang_doi_id: entry._id }).lean(),
    SinhHieuKham.findOne({ hang_doi_id: entry._id }).lean(),
    DichVu.find({ loai: 'related', specialty_id: entry.specialty_id, an_hien: { $ne: false } })
      .select('_id ten gia ma_dich_vu').sort({ ten: 1 }).lean(),
  ])

  const thuoc = hoSo
    ? (await DonThuoc.findOne({ medical_record_id: hoSo._id }).lean())?.items ?? []
    : []

  return {
    queue: {
      id: String(entry._id),
      ten_benh_nhan: entry.ten_benh_nhan,
      tuoi: entry.tuoi ?? null,
      gioi_tinh: entry.gioi_tinh ?? null,
      nhom_mau: entry.nhom_mau ?? null,
      di_ung: entry.di_ung ?? null,
      benh_nen: entry.benh_nen ?? null,
      ma_so_thu_tu: entry.ma_so_thu_tu ?? null,
      nguon: entry.nguon,
      trang_thai: entry.trang_thai,
      phong_kham: entry.phong_kham ?? null,
      appointment_id: entry.appointment_id ? String(entry.appointment_id) : null,
    },
    ho_so: hoSo
      ? {
          id: String(hoSo._id),
          status: hoSo.status,
          trieu_chung_ban_dau: hoSo.trieu_chung_ban_dau ?? null,
          chan_doan: hoSo.chan_doan ?? null,
          huong_dan_dieu_tri: hoSo.huong_dan_dieu_tri ?? null,
          ghi_chu: hoSo.ghi_chu ?? null,
          ngay_tai_kham: hoSo.ngay_tai_kham ?? null,
          dich_vu_phat_sinh: hoSo.dich_vu_phat_sinh ?? [],
        }
      : null,
    sinh_hieu: sinhHieu
      ? {
          can_nang: sinhHieu.can_nang, chieu_cao: sinhHieu.chieu_cao,
          huyet_ap: sinhHieu.huyet_ap, nhiet_do: sinhHieu.nhiet_do, nhip_tim: sinhHieu.nhip_tim,
        }
      : null,
    buoc_hien_tai: hoSo?.buoc_hien_tai ?? 'tiep_nhan',
    bmi: tinhBMI(sinhHieu?.can_nang ?? null, sinhHieu?.chieu_cao ?? null),
    thuoc,
    dich_vu_kha_dung: dichVuKhaDung.map((d) => ({
      service_id: String(d._id), ten: d.ten, gia: d.gia, ma_dich_vu: d.ma_dich_vu ?? null,
    })),
  }
}
```

Kiểm tên field ẩn/hiện của `DichVu` trước khi chạy:
```bash
cd backend && grep -n "an_hien\|trang_thai\|hien_thi" src/models/DichVu.js | head
```
Nếu tên khác `an_hien` thì sửa cho khớp; nếu không có field ẩn/hiện thì bỏ điều kiện đó.

- [ ] **Step 2: Viết hàm lưu nháp từng bước**

Thêm tiếp vào cùng file:

```js
/** Bảo đảm có bản ghi nháp để gắn dữ liệu bước 1. */
async function taoNhapNeuChua(entry, doctorUserId, docId) {
  const daCo = await KetQuaKham.findOne({ hang_doi_id: entry._id })
  if (daCo) return daCo

  return KetQuaKham.create({
    hang_doi_id: entry._id,
    ho_so_benh_nhan_id: entry.ho_so_benh_nhan_id ?? null,
    nguoi_nhap_id: doctorUserId,
    bac_si_phu_trach_id: docId,
    status: 'ban_nhap',
    buoc_hien_tai: 'tiep_nhan',
    // `chan_doan` là required ở schema nhưng bước 1 chưa có. Đặt chỗ giữ, bước 2 ghi đè.
    // Không đặt sẽ ném ValidationError ngay lúc bấm "Tiếp tục" ở bước 1.
    chan_doan: '(đang khám)',
  })
}

/**
 * Lưu nháp một bước rồi đẩy con trỏ sang bước kế tiếp.
 *
 * Không có nút "Lưu" thủ công trên UI — mỗi lần bấm "Tiếp tục" là một lần gọi hàm này.
 * Bác sĩ đóng tab giữa chừng vẫn mở lại đúng chỗ đang dở.
 */
export async function luuBuoc({ queueId, docId, doctorUserId, buoc, payload = {} }) {
  if (!CAC_BUOC.includes(buoc) || buoc === 'hoan_tat') {
    throw loi(400, `Bước không hợp lệ: ${buoc}`)
  }

  const entry = await getOwnedOfflineQueue(queueId, docId)
  if (entry.trang_thai !== 'trong_phong') {
    throw loi(409, 'Chỉ nhập hồ sơ khi bệnh nhân đang trong phòng')
  }

  const hoSo = await taoNhapNeuChua(entry, doctorUserId, docId)
  if (hoSo.status === 'da_xac_nhan' && hoSo.co_the_sua === false) {
    throw loi(409, 'Hồ sơ đã khóa, không sửa được')
  }
  if (!duocPhepVaoBuoc(buoc, hoSo.buoc_hien_tai ?? 'tiep_nhan')) {
    throw loi(409, 'Không được bỏ qua bước trước đó')
  }

  const capNhat = {}

  if (buoc === 'tiep_nhan') {
    const kq = kiemTraBuocTiepNhan(payload)
    if (!kq.ok) throw loi(400, kq.loi.join('; '))

    capNhat.trieu_chung_ban_dau = String(payload.trieu_chung_ban_dau).trim()
    await upsertVitals({
      hangDoiId: entry._id,
      memberId: entry.member_id ?? null,
      doctorUserId,
      sinhHieu: {
        can_nang:  payload.can_nang  ?? null,
        chieu_cao: payload.chieu_cao ?? null,
        huyet_ap:  payload.huyet_ap  ?? null,
        nhiet_do:  payload.nhiet_do  ?? null,
        nhip_tim:  payload.nhip_tim  ?? null,
      },
    })
  }

  if (buoc === 'chan_doan') {
    const kq = kiemTraBuocChanDoan(payload)
    if (!kq.ok) throw loi(400, kq.loi.join('; '))

    capNhat.chan_doan = String(payload.chan_doan).trim()
    capNhat.huong_dan_dieu_tri = payload.huong_dan_dieu_tri?.trim() || null
    capNhat.ghi_chu = payload.ghi_chu?.trim() || null
    capNhat.ngay_tai_kham = payload.ngay_tai_kham ? new Date(payload.ngay_tai_kham) : null
    capNhat.chi_dinh_tai_kham = Boolean(payload.ngay_tai_kham)
  }

  if (buoc === 'dich_vu') {
    // Quyết định Q1: bệnh nhân LUÔN ở trong phòng — không đổi trạng thái hàng đợi.
    // Quyết định Q2: bác sĩ chỉ ghi chỉ định, KHÔNG thu tiền.
    const chiDinh = await taoChiDinhDichVu(payload.dich_vu_phat_sinh ?? [], entry.specialty_id, docId)
    if (!chiDinh.ok) throw loi(chiDinh.status ?? 400, chiDinh.message)
    capNhat.dich_vu_phat_sinh = chiDinh.lines
  }

  if (buoc === 'ke_don') {
    const items = Array.isArray(payload.thuoc) ? payload.thuoc : []
    await DonThuoc.deleteMany({ medical_record_id: hoSo._id })
    if (items.length) {
      await DonThuoc.create({
        ket_qua_kham_id: hoSo._id,
        medical_record_id: hoSo._id,
        member_id: entry.member_id ?? null,
        ten_khach: entry.ten_benh_nhan,
        doctor_id: docId,
        nguon: 'bac_si',
        items,
      })
    }
  }

  // Con trỏ chỉ TIẾN, không lùi: bác sĩ quay lại sửa bước 1 khi đang ở bước 4 thì
  // vẫn ở bước 4, không bị đẩy ngược về bước 2.
  const buocSau = buocKeTiep(buoc)
  const hienTai = hoSo.buoc_hien_tai ?? 'tiep_nhan'
  if (CAC_BUOC.indexOf(buocSau) > CAC_BUOC.indexOf(hienTai)) {
    capNhat.buoc_hien_tai = buocSau
  }

  await KetQuaKham.updateOne({ _id: hoSo._id }, { $set: capNhat })
  return layPhienKham({ queueId, docId })
}
```

- [ ] **Step 3: Chạy toàn bộ test backend**

Run: `cd backend && npm test`
Expected: PASS toàn bộ

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/examSession.service.js
git commit -m "feat(bac-si): doc phien kham + luu nhap tung buoc

Con tro buoc_hien_tai chi tien khong lui, quay lai sua buoc cu khong
day nguoc tien do. Chan nhay coc buoc."
```

---

## Task 5: Hoàn tất phiên khám + trả bệnh nhân kế tiếp

**Files:**
- Modify: `backend/src/services/examSession.service.js`

**Interfaces:**
- Consumes: `layPhienKham` Task 4, `soSanhThuTuHangDoi` từ `models/HangDoi.js`
- Produces: `hoanTatPhienKham({ queueId, docId, doctorUserId }): Promise<{ ho_so_id, benh_nhan_ke_tiep, co_dich_vu_can_thu }>`

- [ ] **Step 1: Viết hàm hoàn tất**

Thêm vào `backend/src/services/examSession.service.js`:

```js
/**
 * Bệnh nhân kế tiếp trong hàng đợi của bác sĩ, theo đúng thứ tự ưu tiên ĐỘNG (rule mục 6).
 *
 * Trả kèm khi hoàn tất ca để bác sĩ bấm "Gọi" ngay tại chỗ. Không có nó, bác sĩ phải quay
 * về trang hàng đợi sau mỗi ca — thao tác thừa lặp lại 30 lần một ngày.
 */
async function timBenhNhanKeTiep(docId, now = new Date()) {
  const dangCho = await HangDoi.find({
    doctor_id: docId,
    trang_thai: { $in: ['dang_cho', 'da_goi'] },
  }).lean()
  if (dangCho.length === 0) return null

  const [ke] = [...dangCho].sort((a, b) => soSanhThuTuHangDoi(a, b, now))
  return {
    queue_id: String(ke._id),
    ten_benh_nhan: ke.ten_benh_nhan,
    ma_so_thu_tu: ke.ma_so_thu_tu ?? null,
    nguon: ke.nguon,
    trang_thai: ke.trang_thai,
  }
}

/**
 * Chốt ca khám: hồ sơ → `da_xac_nhan`, lượt → `hoan_thanh`, lịch hẹn → `completed`.
 *
 * Ba bản ghi này phải cùng đúng hoặc cùng sai. Chốt hồ sơ mà lượt còn `trong_phong` sẽ
 * khóa phòng vĩnh viễn; chốt lượt mà lịch hẹn còn `checked_in` sẽ khiến cron `no_show`
 * cuối ca hiểu nhầm — nên gói trong MỘT transaction.
 */
export async function hoanTatPhienKham({ queueId, docId, doctorUserId, now = new Date() }) {
  const entry = await getOwnedOfflineQueue(queueId, docId)
  const hoSo = await KetQuaKham.findOne({ hang_doi_id: entry._id })
  if (!hoSo) throw loi(409, 'Chưa có hồ sơ khám cho lượt này')

  // Không cho chốt khi chưa đi qua chẩn đoán — đúng lỗi hội đồng nêu.
  if (!hoSo.chan_doan || hoSo.chan_doan === '(đang khám)') {
    throw loi(400, 'Chưa nhập chẩn đoán, không chốt được ca khám')
  }
  if (!hoSo.trieu_chung_ban_dau) {
    throw loi(400, 'Chưa ghi triệu chứng ở bước tiếp nhận')
  }

  const coDichVu = Array.isArray(hoSo.dich_vu_phat_sinh) && hoSo.dich_vu_phat_sinh.length > 0
  const tongTienDichVu = coDichVu
    ? hoSo.dich_vu_phat_sinh.reduce((s, d) => s + (d.thanh_tien ?? 0), 0)
    : 0

  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      await KetQuaKham.updateOne(
        { _id: hoSo._id },
        {
          $set: {
            status: 'da_xac_nhan',
            buoc_hien_tai: 'hoan_tat',
            nguoi_xac_nhan_id: doctorUserId,
            thoi_diem_xac_nhan: now,
          },
          $push: {
            lich_su_sua: {
              nguoi_sua_id: doctorUserId,
              thoi_diem_sua: now,
              noi_dung: 'Bác sĩ hoàn tất phiên khám 4 bước',
            },
          },
        },
        { session },
      )

      await HangDoi.updateOne(
        { _id: entry._id },
        { $set: { trang_thai: 'hoan_thanh', thoi_diem_ket_thuc: now } },
        { session },
      )

      // ⚠️ updateOne chứ KHÔNG phải .save(): `LichHen.pre('validate')` kiểm cả những field
      // ca khám không hề chạm, và với bản ghi cũ thiếu field nào đó sẽ ném lỗi vô nghĩa —
      // cùng cái bẫy đã ghi ở `doiTrangThaiLichHen` trong queue.controller.js.
      if (entry.appointment_id) {
        await LichHen.updateOne(
          { _id: entry.appointment_id },
          { $set: { status: 'completed' } },
          { session },
        )
      }
    })
  } finally {
    await session.endSession()
  }

  return {
    ho_so_id: String(hoSo._id),
    benh_nhan_ke_tiep: await timBenhNhanKeTiep(docId, now),
    co_dich_vu_can_thu: coDichVu,
    tong_tien_dich_vu: tongTienDichVu,
    ten_benh_nhan: entry.ten_benh_nhan,
  }
}
```

**Ghi chú WS-3:** thông báo `BS_THU_TIEN_DICH_VU` cho lễ tân sẽ móc vào đây khi làm WS-3 — dùng `co_dich_vu_can_thu` và `tong_tien_dich_vu` đã trả sẵn. Không tự thêm ở WS-1 vì kênh thông báo nhóm chưa tồn tại.

- [ ] **Step 2: Chạy toàn bộ test backend**

Run: `cd backend && npm test`
Expected: PASS toàn bộ

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/examSession.service.js
git commit -m "feat(bac-si): hoan tat phien kham trong 1 transaction

Ho so + hang doi + lich hen cung doi trang thai. Tra kem benh nhan
ke tiep de bac si goi ngay, khong phai quay ve trang hang doi."
```

---

## Task 6: Controller + route

**Files:**
- Create: `backend/src/controllers/doctor/exam-session.controller.js`
- Create: `backend/src/routes/doctor/exam-session.routes.js`
- Modify: `backend/src/routes/doctor/index.js`

**Interfaces:**
- Consumes: `layPhienKham`, `luuBuoc`, `hoanTatPhienKham` từ Task 4–5
- Produces:
  - `GET  /api/doctor/exam-session/:queueId`
  - `PATCH /api/doctor/exam-session/:queueId/step/:buoc`
  - `POST /api/doctor/exam-session/:queueId/complete`

- [ ] **Step 1: Viết controller**

Tạo `backend/src/controllers/doctor/exam-session.controller.js`:

```js
import { BacSi } from '../../models/index.js'
import {
  hoanTatPhienKham,
  layPhienKham,
  luuBuoc,
} from '../../services/examSession.service.js'
import { ok, fail } from '../../utils/response.js'

async function getDocId(userId) {
  const d = await BacSi.findOne({ user_id: userId }).select('_id').lean()
  return d?._id ?? null
}

// GET /api/doctor/exam-session/:queueId
export async function get(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')
    return ok(res, await layPhienKham({ queueId: req.params.queueId, docId }))
  } catch (err) {
    return fail(res, err.httpStatus ?? err.statusCode ?? 500, err.message)
  }
}

// PATCH /api/doctor/exam-session/:queueId/step/:buoc
export async function saveStep(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')
    const phien = await luuBuoc({
      queueId: req.params.queueId,
      docId,
      doctorUserId: req.user.id,
      buoc: req.params.buoc,
      payload: req.body ?? {},
    })
    return ok(res, phien, 'Đã lưu')
  } catch (err) {
    return fail(res, err.httpStatus ?? err.statusCode ?? 500, err.message)
  }
}

// POST /api/doctor/exam-session/:queueId/complete
export async function complete(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')
    const ketQua = await hoanTatPhienKham({
      queueId: req.params.queueId,
      docId,
      doctorUserId: req.user.id,
    })
    return ok(res, ketQua, 'Đã hoàn tất ca khám')
  } catch (err) {
    return fail(res, err.httpStatus ?? err.statusCode ?? 500, err.message)
  }
}
```

- [ ] **Step 2: Viết route**

Tạo `backend/src/routes/doctor/exam-session.routes.js`:

```js
import { Router } from 'express'
import { get, saveStep, complete } from '../../controllers/doctor/exam-session.controller.js'

const router = Router()

router.get('/:queueId', get)
router.patch('/:queueId/step/:buoc', saveStep)
router.post('/:queueId/complete', complete)

export default router
```

- [ ] **Step 3: Mount route**

Trong `backend/src/routes/doctor/index.js`, thêm import cạnh các import khác:

```js
import examSessionRoutes from './exam-session.routes.js'
```

và mount cạnh `router.use('/queue', queueRoutes)`:

```js
// WS-1 — Phiên khám 4 bước. `verifyToken` + `requireRole('doctor')` đã áp ở đầu file.
router.use('/exam-session', examSessionRoutes)
```

- [ ] **Step 4: Kiểm bằng tay**

Run: `cd backend && npm run dev`

```bash
TOKEN=<token-bac-si>
QID=<id-hang-doi-dang-trong_phong>
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:5000/api/doctor/exam-session/$QID" | head -c 500
```
Expected: JSON có `buoc_hien_tai`, `queue`, `dich_vu_kha_dung`

```bash
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"trieu_chung_ban_dau":"Dau hong 3 ngay","can_nang":60,"chieu_cao":165}' \
  "http://localhost:5000/api/doctor/exam-session/$QID/step/tiep_nhan" | head -c 400
```
Expected: `"buoc_hien_tai":"chan_doan"`, `"bmi":22`

```bash
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"trieu_chung_ban_dau":"   "}' \
  "http://localhost:5000/api/doctor/exam-session/$QID/step/tiep_nhan"
```
Expected: `{"success":false,"message":"Triệu chứng / lý do khám là bắt buộc"}` với HTTP 400

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5000/api/doctor/exam-session/$QID/complete"
```
Expected (khi mới ở bước 1): HTTP 400 `"Chưa nhập chẩn đoán, không chốt được ca khám"`

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/doctor/exam-session.controller.js backend/src/routes/doctor/exam-session.routes.js backend/src/routes/doctor/index.js
git commit -m "feat(bac-si): API phien kham 4 buoc

GET :queueId / PATCH :queueId/step/:buoc / POST :queueId/complete"
```

---

## Task 7: E2E toàn luồng 4 bước

**Files:**
- Create: `backend/src/scripts/e2e-phien-kham-4-buoc.js`
- Modify: `backend/package.json`

**Interfaces:**
- Consumes: `layPhienKham`, `luuBuoc`, `hoanTatPhienKham`
- Produces: `npm run test:e2e:phien-kham`

- [ ] **Step 1: Viết script**

Tạo `backend/src/scripts/e2e-phien-kham-4-buoc.js`. Dùng khuôn `kt()` / `muc()` giống `e2e-luong-tiep-nhan.js`. Nội dung kiểm:

```
1. Mở phiên khám mới -> buoc_hien_tai = 'tiep_nhan', ho_so = null
2. Bước 1 thiếu triệu chứng -> lỗi 400, con trỏ KHÔNG tiến
3. Bước 1 đủ -> buoc_hien_tai = 'chan_doan', sinh hiệu ghi được, bmi tính đúng
4. Nhảy cóc sang 'ke_don' khi đang ở 'chan_doan' -> lỗi 409
5. Bước 2 -> buoc_hien_tai = 'dich_vu', chan_doan ghi đúng
6. Bước 3 tick 1 dịch vụ -> dich_vu_phat_sinh có 1 dòng, thanh_tien > 0
   và HangDoi.trang_thai VẪN LÀ 'trong_phong' (quyết định Q1: không rời phòng)
7. Bước 4 kê 2 thuốc -> DonThuoc có 2 items; kê lại 1 thuốc -> còn đúng 1 (không cộng dồn)
8. Quay lại bước 1 sửa triệu chứng -> buoc_hien_tai VẪN LÀ 'hoan_tat', không lùi
9. Hoàn tất -> KetQuaKham.status='da_xac_nhan', HangDoi='hoan_thanh',
   LichHen='completed', trả benh_nhan_ke_tiep và co_dich_vu_can_thu=true
10. Hoàn tất lần 2 -> lỗi (lượt đã xong)
11. Bác sĩ khác gọi cùng queueId -> lỗi 403/404
```

Khuôn đầu file (chặn DB thật) chép nguyên từ `e2e-luong-tiep-nhan.js`:

```js
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('Thieu MONGODB_URI')
  if (!/test/i.test(uri)) throw new Error('CHI chay tren DB TEST — ten DB phai chua "TEST"')
```

- [ ] **Step 2: Thêm script vào package.json**

Trong `backend/package.json`, thêm vào `scripts`:

```json
    "test:e2e:phien-kham": "node src/scripts/e2e-phien-kham-4-buoc.js",
```

- [ ] **Step 3: Chạy e2e**

Run: `cd backend && MONGODB_URI=<uri-db-test> npm run test:e2e:phien-kham`
Expected: tất cả kiểm tra xanh, exit code 0

- [ ] **Step 4: Commit**

```bash
git add backend/src/scripts/e2e-phien-kham-4-buoc.js backend/package.json
git commit -m "test(bac-si): e2e phien kham 4 buoc"
```

---

## Task 8: Frontend — service + khung trang + bước 1, 2

**Files:**
- Create: `frontend/src/services/doctor-exam-session.service.ts`
- Create: `frontend/src/pages/doctor/ExamSessionPage.tsx`
- Create: `frontend/src/components/doctor/exam/StepTiepNhan.tsx`
- Create: `frontend/src/components/doctor/exam/StepChanDoan.tsx`
- Modify: `frontend/src/routes/AppRoutes.tsx`

**Interfaces:**
- Consumes: API Task 6
- Produces:
  - types `PhienKham`, `BuocKham = 'tiep_nhan'|'chan_doan'|'dich_vu'|'ke_don'|'hoan_tat'`
  - `doctorExamSessionService.get(queueId)`, `.saveStep(queueId, buoc, payload)`, `.complete(queueId)`
  - props chung của mỗi bước: `{ phien: PhienKham; saving: boolean; onNext: (payload: Record<string, unknown>) => void }`

- [ ] **Step 1: Viết service**

Tạo `frontend/src/services/doctor-exam-session.service.ts`:

```ts
import axiosInstance from './axiosInstance'

export type BuocKham = 'tiep_nhan' | 'chan_doan' | 'dich_vu' | 'ke_don' | 'hoan_tat'

export interface DichVuChiDinh {
  service_id: string
  ten: string
  so_luong: number
  don_gia: number
  thanh_tien: number
}

export interface ThuocItem {
  ten_thuoc: string
  lieu_luong?: string | null
  tan_suat?: string | null
  gio_uong?: string[]
  so_ngay: number
  ghi_chu?: string | null
}

export interface PhienKham {
  queue: {
    id: string
    ten_benh_nhan: string
    tuoi: number | null
    gioi_tinh: string | null
    nhom_mau: string | null
    di_ung: string | null
    benh_nen: string | null
    ma_so_thu_tu: string | null
    nguon: string
    trang_thai: string
    phong_kham: string | null
    appointment_id: string | null
  }
  ho_so: {
    id: string
    status: string
    trieu_chung_ban_dau: string | null
    chan_doan: string | null
    huong_dan_dieu_tri: string | null
    ghi_chu: string | null
    ngay_tai_kham: string | null
    dich_vu_phat_sinh: DichVuChiDinh[]
  } | null
  sinh_hieu: {
    can_nang: number | null
    chieu_cao: number | null
    huyet_ap: string | null
    nhiet_do: number | null
    nhip_tim: number | null
  } | null
  buoc_hien_tai: BuocKham
  bmi: number | null
  thuoc: ThuocItem[]
  dich_vu_kha_dung: { service_id: string; ten: string; gia: number; ma_dich_vu: string | null }[]
}

export interface KetQuaHoanTat {
  ho_so_id: string
  ten_benh_nhan: string
  co_dich_vu_can_thu: boolean
  tong_tien_dich_vu: number
  benh_nhan_ke_tiep: {
    queue_id: string
    ten_benh_nhan: string
    ma_so_thu_tu: string | null
    nguon: string
    trang_thai: string
  } | null
}

export const doctorExamSessionService = {
  async get(queueId: string) {
    const { data } = await axiosInstance.get(`/doctor/exam-session/${queueId}`)
    return data.data as PhienKham
  },
  async saveStep(queueId: string, buoc: BuocKham, payload: Record<string, unknown>) {
    const { data } = await axiosInstance.patch(`/doctor/exam-session/${queueId}/step/${buoc}`, payload)
    return data.data as PhienKham
  },
  async complete(queueId: string) {
    const { data } = await axiosInstance.post(`/doctor/exam-session/${queueId}/complete`)
    return data.data as KetQuaHoanTat
  },
}
```

- [ ] **Step 2: Viết bước 1**

Tạo `frontend/src/components/doctor/exam/StepTiepNhan.tsx`:

```tsx
import { useMemo, useState } from 'react'
import type { PhienKham } from '@/services/doctor-exam-session.service'

interface Props {
  phien: PhienKham
  saving: boolean
  onNext: (payload: Record<string, unknown>) => void
}

function bmiCua(canNang: string, chieuCao: string) {
  const kg = Number(canNang)
  const cm = Number(chieuCao)
  if (!kg || !cm) return null
  return Math.round((kg / (cm / 100) ** 2) * 10) / 10
}

export default function StepTiepNhan({ phien, saving, onNext }: Props) {
  const [trieuChung, setTrieuChung] = useState(phien.ho_so?.trieu_chung_ban_dau ?? '')
  const [canNang, setCanNang] = useState(String(phien.sinh_hieu?.can_nang ?? ''))
  const [chieuCao, setChieuCao] = useState(String(phien.sinh_hieu?.chieu_cao ?? ''))
  const [huyetAp, setHuyetAp] = useState(phien.sinh_hieu?.huyet_ap ?? '')
  const [nhietDo, setNhietDo] = useState(String(phien.sinh_hieu?.nhiet_do ?? ''))
  const [nhipTim, setNhipTim] = useState(String(phien.sinh_hieu?.nhip_tim ?? ''))

  const bmi = useMemo(() => bmiCua(canNang, chieuCao), [canNang, chieuCao])
  const thieuTheTrang = !canNang || !chieuCao

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-900">Chỉ số thể trạng</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[
            { label: 'Cân nặng (kg)', value: canNang, set: setCanNang, type: 'number' },
            { label: 'Chiều cao (cm)', value: chieuCao, set: setChieuCao, type: 'number' },
            { label: 'Huyết áp', value: huyetAp, set: setHuyetAp, type: 'text' },
            { label: 'Nhiệt độ (°C)', value: nhietDo, set: setNhietDo, type: 'number' },
            { label: 'Nhịp tim', value: nhipTim, set: setNhipTim, type: 'number' },
          ].map((f) => (
            <label key={f.label} className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">{f.label}</span>
              <input
                type={f.type}
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          ))}
        </div>
        {bmi !== null && (
          <p className="mt-2 text-sm text-slate-600">
            BMI: <span className="font-semibold text-slate-900">{bmi}</span>
          </p>
        )}
        {thieuTheTrang && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Chưa ghi cân nặng / chiều cao — hồ sơ sẽ thiếu chỉ số thể trạng. Vẫn tiếp tục được.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          Triệu chứng / lý do khám <span className="text-red-500">*</span>
        </h2>
        <textarea
          value={trieuChung}
          onChange={(e) => setTrieuChung(e.target.value)}
          rows={4}
          placeholder="Bệnh nhân cảm thấy thế nào, đau ở đâu, bao lâu rồi?"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving || !trieuChung.trim()}
          onClick={() =>
            onNext({
              trieu_chung_ban_dau: trieuChung,
              can_nang: canNang ? Number(canNang) : null,
              chieu_cao: chieuCao ? Number(chieuCao) : null,
              huyet_ap: huyetAp || null,
              nhiet_do: nhietDo ? Number(nhietDo) : null,
              nhip_tim: nhipTim ? Number(nhipTim) : null,
            })
          }
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {saving ? 'Đang lưu...' : 'Tiếp tục → Chẩn đoán'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Viết bước 2**

Tạo `frontend/src/components/doctor/exam/StepChanDoan.tsx`:

```tsx
import { useState } from 'react'
import type { PhienKham } from '@/services/doctor-exam-session.service'

interface Props {
  phien: PhienKham
  saving: boolean
  onNext: (payload: Record<string, unknown>) => void
}

export default function StepChanDoan({ phien, saving, onNext }: Props) {
  const banDau = phien.ho_so?.chan_doan === '(đang khám)' ? '' : phien.ho_so?.chan_doan ?? ''
  const [chanDoan, setChanDoan] = useState(banDau)
  const [huongDan, setHuongDan] = useState(phien.ho_so?.huong_dan_dieu_tri ?? '')
  const [ghiChu, setGhiChu] = useState(phien.ho_so?.ghi_chu ?? '')
  const [ngayTaiKham, setNgayTaiKham] = useState(
    phien.ho_so?.ngay_tai_kham ? String(phien.ho_so.ngay_tai_kham).slice(0, 10) : '',
  )

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <span className="font-medium text-slate-500">Triệu chứng đã ghi:</span>{' '}
        {phien.ho_so?.trieu_chung_ban_dau ?? '—'}
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-slate-900">
          Chẩn đoán <span className="text-red-500">*</span>
        </span>
        <textarea
          value={chanDoan}
          onChange={(e) => setChanDoan(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-slate-900">Giải pháp / hướng dẫn điều trị</span>
        <textarea
          value={huongDan}
          onChange={(e) => setHuongDan(e.target.value)}
          rows={3}
          placeholder="Bệnh nhân cần làm gì, kiêng gì, theo dõi ra sao"
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-slate-900">Lưu ý</span>
        <textarea
          value={ghiChu}
          onChange={(e) => setGhiChu(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-slate-900">Ngày tái khám</span>
        <input
          type="date"
          value={ngayTaiKham}
          onChange={(e) => setNgayTaiKham(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
      </label>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving || !chanDoan.trim()}
          onClick={() =>
            onNext({
              chan_doan: chanDoan,
              huong_dan_dieu_tri: huongDan,
              ghi_chu: ghiChu,
              ngay_tai_kham: ngayTaiKham || null,
            })
          }
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {saving ? 'Đang lưu...' : 'Tiếp tục → Dịch vụ'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Viết khung trang (tạm thời chỉ 2 bước)**

Tạo `frontend/src/pages/doctor/ExamSessionPage.tsx` với: header thông tin bệnh nhân, thanh 5 bước bấm được (chỉ bước đã qua), vùng nội dung render `StepTiepNhan` / `StepChanDoan` theo `buocDangXem`, xử lý `onNext` gọi `saveStep` rồi cập nhật `phien`. Bước 3–5 tạm hiển thị `<p>Đang xây dựng</p>` — Task 9 thay thế.

Quy tắc: `buocDangXem` là state riêng của UI, `phien.buoc_hien_tai` là tiến độ đã lưu. Sau `saveStep`, đặt `buocDangXem = phienMoi.buoc_hien_tai`.

- [ ] **Step 5: Thêm route**

Trong `frontend/src/routes/AppRoutes.tsx`:

```tsx
const DoctorExamSession = lazy(() => import('@/pages/doctor/ExamSessionPage'))
```

và trong khối route bác sĩ:

```tsx
<Route path="exam/:queueId" element={<DoctorExamSession />} />
```

- [ ] **Step 6: Kiểm typecheck + lint**

Run: `cd frontend && npm run typecheck && npm run lint`
Expected: không lỗi

- [ ] **Step 7: Commit**

```bash
git add frontend/src/services/doctor-exam-session.service.ts frontend/src/pages/doctor/ExamSessionPage.tsx frontend/src/components/doctor/exam/StepTiepNhan.tsx frontend/src/components/doctor/exam/StepChanDoan.tsx frontend/src/routes/AppRoutes.tsx
git commit -m "feat(bac-si): trang phien kham + buoc Tiep nhan, Chan doan"
```

---

## Task 9: Frontend — bước 3, 4, màn xác nhận, nối vào hàng đợi

**Files:**
- Create: `frontend/src/components/doctor/exam/StepDichVu.tsx`
- Create: `frontend/src/components/doctor/exam/StepKeDon.tsx`
- Create: `frontend/src/components/doctor/exam/StepXacNhan.tsx`
- Modify: `frontend/src/pages/doctor/ExamSessionPage.tsx`
- Modify: `frontend/src/pages/doctor/DoctorExamQueue.tsx`

**Interfaces:**
- Consumes: `PhienKham`, `KetQuaHoanTat`, `doctorExamSessionService` từ Task 8
- Produces: luồng khám hoàn chỉnh 5 màn

- [ ] **Step 1: Viết bước 3 — Dịch vụ**

Tạo `frontend/src/components/doctor/exam/StepDichVu.tsx`. Yêu cầu:
- Checkbox từ `phien.dich_vu_kha_dung`, tick sẵn những dịch vụ đã có trong `phien.ho_so.dich_vu_phat_sinh`
- Mỗi dòng đã tick: ô số lượng (min 1), hiển thị đơn giá và thành tiền
- Dòng tổng tiền ở cuối, kèm dòng chữ: **"Bác sĩ không thu tiền. Lễ tân thu ở quầy khi bệnh nhân ra về."**
- 2 nút: "Bỏ qua bước này" (gửi `dich_vu_phat_sinh: []`) và "Đã thực hiện xong → Kê đơn"
- **Không** có nút nào đổi trạng thái hàng đợi — quyết định Q1: bệnh nhân ở trong phòng

Payload gửi lên: `{ dich_vu_phat_sinh: [{ service_id, so_luong }] }` — đơn giá và thành tiền do backend tính lại từ `DichVu.gia` trong `taoChiDinhDichVu`, **không tin giá do client gửi**.

- [ ] **Step 2: Viết bước 4 — Kê đơn**

Tạo `frontend/src/components/doctor/exam/StepKeDon.tsx`. Yêu cầu:
- Bảng thuốc động, **tối đa 10 dòng** (giới hạn của `DonThuoc`)
- Mỗi dòng: tên thuốc (bắt buộc), liều lượng, tần suất, số ngày (1–90, bắt buộc), giờ uống (nhiều ô `HH:MM`), ghi chú
- Panel bên phải hiển thị lại chẩn đoán (bước 2) và dịch vụ đã dùng (bước 3) làm bối cảnh
- 2 nút: "Không kê đơn" (gửi `thuoc: []`) và "Tiếp tục → Xác nhận"
- Chặn gửi khi có dòng thiếu tên thuốc hoặc `so_ngay` ngoài 1–90

- [ ] **Step 3: Viết màn xác nhận**

Tạo `frontend/src/components/doctor/exam/StepXacNhan.tsx`. Yêu cầu:
- Đọc lại **toàn bộ 4 bước** trên một trang, chia 4 khối rõ ràng có tiêu đề
- Mỗi khối có nút "Sửa" quay về đúng bước đó
- Nút chính: **"Hoàn tất ca khám & mời bệnh nhân tiếp theo"**
- Sau khi gọi `complete()` thành công, hiển thị màn kết quả:
  - Nếu `co_dich_vu_can_thu` → dòng nhắc "Đã báo lễ tân thu {tong_tien_dich_vu}đ dịch vụ"
  - Nếu `benh_nhan_ke_tiep` → thẻ tên + STT + nút "Gọi bệnh nhân này" (điều hướng về `/doctor/queue` kèm id để gọi)
  - Nếu không còn ai → "Đã hết bệnh nhân trong hàng đợi"

- [ ] **Step 4: Hoàn thiện khung trang**

Trong `frontend/src/pages/doctor/ExamSessionPage.tsx`, thay 3 chỗ `Đang xây dựng` bằng 3 component mới. Thanh bước hiển thị đủ 5 mục với trạng thái: đã xong (xanh, bấm được) · đang làm (đậm) · chưa tới (xám, không bấm được).

- [ ] **Step 5: Nối từ hàng đợi sang trang khám**

Trong `frontend/src/pages/doctor/DoctorExamQueue.tsx`, ở dòng có trạng thái `trong_phong`, đổi nút mở `ExamResultModal` thành điều hướng:

```tsx
navigate(`/doctor/exam/${row.id}`)
```

Giữ nguyên `ExamResultModal` cho các trạng thái khác (`cho_nhap_ho_so`, `cho_xac_nhan`) — đó là luồng xem/sửa hồ sơ cũ, không phải ca khám mới.

- [ ] **Step 6: Kiểm typecheck + lint**

Run: `cd frontend && npm run typecheck && npm run lint`
Expected: không lỗi

- [ ] **Step 7: Kiểm bằng mắt toàn luồng**

Run: `cd backend && npm run dev` và `cd frontend && npm run dev`

Đăng nhập bác sĩ → hàng đợi → "Vào phòng" một bệnh nhân → trang khám mở ra:
1. Bước 1: bỏ trống triệu chứng → nút mờ, không bấm được
2. Điền triệu chứng + cân nặng 60 + chiều cao 165 → thấy BMI 22 → Tiếp tục
3. **Tải lại trang (F5)** → vào đúng bước 2, dữ liệu bước 1 còn nguyên
4. Bước 2: điền chẩn đoán → Tiếp tục
5. Bước 3: tick 1 dịch vụ → thấy thành tiền → "Đã thực hiện xong"
6. Bước 4: "Không kê đơn"
7. Xác nhận: thấy đủ 4 khối → "Hoàn tất ca khám"
8. Thấy thẻ bệnh nhân kế tiếp; quay về hàng đợi thấy ca vừa xong ở trạng thái "Đã xong"

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/doctor/exam frontend/src/pages/doctor/ExamSessionPage.tsx frontend/src/pages/doctor/DoctorExamQueue.tsx
git commit -m "feat(bac-si): buoc Dich vu, Ke don, man Xac nhan + noi tu hang doi

Hoan tat ca kham tra ve benh nhan ke tiep de goi ngay."
```

---

## Self-Review

**Spec coverage** — đối chiếu mục 3 của spec:

| Yêu cầu spec | Task |
|---|---|
| Trang riêng `/doctor/exam/:queueId` thay modal | Task 8 (route), Task 9 (nối từ hàng đợi) |
| `KetQuaKham.buoc_hien_tai` enum 5 giá trị | Task 2 |
| Bước 1: `SinhHieuKham` + `trieu_chung_ban_dau`, chỉ triệu chứng bắt buộc, BMI | Task 1 (quy tắc), Task 4 (ghi), Task 8 (UI) |
| Bước 2: `chan_doan` bắt buộc, `huong_dan_dieu_tri`, `ghi_chu`, `ngay_tai_kham` | Task 1, 4, 8 |
| Bước 3: `DichVu` loại `related` lọc theo chuyên khoa, ghi `dich_vu_phat_sinh[]`, bác sĩ không chạm tiền, không rời phòng | Task 4 (`luuBuoc` nhánh `dich_vu`), Task 9 |
| Bước 4: `DonThuoc` tối đa 10, có nút "Không kê đơn" | Task 4 (nhánh `ke_don`), Task 9 |
| Màn xác nhận đọc lại toàn bộ | Task 9 |
| Transaction 3 bản ghi + trả bệnh nhân kế tiếp | Task 5 |
| Lưu nháp mỗi bước, mở lại đúng chỗ | Task 4 (`buoc_hien_tai`), Task 9 Step 7 mục 3 |
| Cho quay lại bước trước để sửa | Task 1 (`duocPhepVaoBuoc`), Task 4 (con trỏ chỉ tiến) |
| `examSession.service.js` là nguồn ghi duy nhất | Task 3 (chuyển helper), Task 4–5 |
| Endpoint cũ giữ chữ ký, gọi vào service | Task 3 |
| Bắn thông báo thu tiền DV cho lễ tân | **Thuộc WS-3.** Task 5 đã trả sẵn `co_dich_vu_can_thu` + `tong_tien_dich_vu` làm điểm móc — có ghi chú rõ trong task |
| Ghi audit `DOCTOR_COMPLETE_EXAM` | ⚠️ **Chưa có task** — xem ghi chú bên dưới |

**Ghi chú `DOCTOR_COMPLETE_EXAM`:** spec mục 3.3 liệt kê bước 5 của transaction là ghi audit. Task 5 chưa làm vì `ghiNhatKyLeTan` của WS-4 chỉ nhận mã `LT_*`. Cách xử lý khi thi công Task 5: gọi trực tiếp `NhatKyThaoTac.create({ vai_tro: 'doctor', hanh_dong: 'DOCTOR_COMPLETE_EXAM', loai_doi_tuong: 'examination_result', doi_tuong_id: hoSo._id })` **sau** transaction, bọc try/catch nuốt lỗi — cùng nguyên tắc "audit không được làm hỏng nghiệp vụ" của WS-4. Thêm 1 step vào Task 5 khi thực thi.

**Placeholder scan:** Task 3 Step 2 dùng chữ "PASTE NGUYÊN VĂN" thay vì chép sẵn 3 helper — đây là **cố ý**: chép lại nguyên văn ~80 dòng vào plan sẽ tạo nguy cơ plan và code thật lệch nhau. Đã kèm lệnh `sed` chỉ đúng dòng cần lấy. Task 7, Task 9 Step 1–3 mô tả yêu cầu bằng danh sách gạch đầu dòng thay vì code đầy đủ — chấp nhận được với component form thuần hiển thị, vì đã nêu rõ payload, ràng buộc, và nhãn nút. Không có TBD/TODO.

**Type consistency:**
- `buoc` nhận đúng 5 giá trị `tiep_nhan|chan_doan|dich_vu|ke_don|hoan_tat` — thống nhất giữa `CAC_BUOC` (Task 1), enum schema (Task 2), route param (Task 6), type `BuocKham` (Task 8).
- `layPhienKham` trả `{ queue, ho_so, sinh_hieu, buoc_hien_tai, bmi, thuoc, dich_vu_kha_dung }` (Task 4) — khớp đúng interface `PhienKham` (Task 8).
- `hoanTatPhienKham` trả `{ ho_so_id, benh_nhan_ke_tiep, co_dich_vu_can_thu, tong_tien_dich_vu, ten_benh_nhan }` (Task 5) — khớp `KetQuaHoanTat` (Task 8).
- Field `huong_dan_dieu_tri` dùng nhất quán ở Task 4, 8 — **không** dùng `huong_dan`.
- `taoChiDinhDichVu(value, specialtyId, doctorId)` trả `{ ok, status, message, lines }` — dùng đúng ở Task 4.
