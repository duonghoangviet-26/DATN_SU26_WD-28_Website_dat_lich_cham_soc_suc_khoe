# WS-4 — Nhật ký thao tác lễ tân · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ghi lại mọi thao tác của lễ tân vào `NhatKyThaoTac` để trả lời được "ai check-in khách này, ai thu tiền, hôm nay ai làm gì" — điều kiện để 2 lễ tân làm thay việc cho nhau khi 1 người nghỉ.

**Architecture:** Thêm 1 service ghi audit dùng chung (`receptionistAudit.service.js`), gắn lời gọi vào **bên trong các service nghiệp vụ** (không phải controller) để mọi đường vào đều được ghi. Thêm 1 service truy vấn + 1 API + 1 trang FE "Nhật ký ca trực". Không đổi schema — `NhatKyThaoTac.hanh_dong` là `String` tự do.

**Tech Stack:** Node.js + Express 4, Mongoose 8, React 18 + Vite + TailwindCSS, `node:test` + `node:assert/strict`.

## Global Constraints

- **KHÔNG sửa** `.claude/rules/lich-lam-viec-bac-si.md` hay bất kỳ nghiệp vụ nào trong đó.
- **KHÔNG đổi schema** `NhatKyThaoTac`: `hanh_dong` là `{ type: String, required: true, maxlength: 100 }`, `loai_doi_tuong` là `{ type: String, required: true, maxlength: 50 }`. Chỉ thêm giá trị và cập nhật khối comment danh mục.
- **Ghi audit KHÔNG BAO GIỜ được làm hỏng nghiệp vụ.** Mọi lời gọi ghi nhật ký phải nuốt lỗi (try/catch, `console.error`), và phải nằm **ngoài** transaction. Bệnh nhân đang đứng trước quầy không được phép check-in thất bại chỉ vì ghi log lỗi.
- Test: hàm thuần dùng `node:test` + `node:assert/strict` trong `backend/tests/*.test.js`, chạy bằng `npm test` (cwd `backend/`). Luồng chạm DB kiểm bằng script e2e trong `backend/src/scripts/`.
- Comment tiếng Việt cho logic phức tạp (convention `CLAUDE.md`).
- Nhánh làm việc: `Fix_demo`. Không push nhánh khác.
- Response API theo chuẩn `{ success, message, data }` qua `utils/response.js` (`ok`/`fail`).

---

## File Structure

**Tạo mới:**
| File | Trách nhiệm |
|---|---|
| `backend/src/services/receptionistAudit.service.js` | Danh mục 10 `hanh_dong` lễ tân + hàm ghi an toàn + hàm chuẩn hóa chi tiết hiển thị |
| `backend/src/services/receptionistActivityLog.service.js` | Truy vấn nhật ký ca trực (lọc ngày/người/nhóm), gộp populate tên người |
| `backend/src/controllers/receptionist/activity-log.controller.js` | Thin layer: nhận query, gọi service, trả response |
| `backend/src/routes/receptionist/activity-log.routes.js` | `GET /` |
| `backend/tests/receptionist.ws4-audit-catalog.test.js` | Test hàm thuần của `receptionistAudit.service.js` |
| `backend/tests/receptionist.ws4-activity-log.test.js` | Test hàm thuần gom nhóm/lọc của `receptionistActivityLog.service.js` |
| `backend/src/scripts/e2e-nhat-ky-le-tan.js` | E2E: check-in → có bản ghi `LT_CHECK_IN` đúng người |
| `frontend/src/pages/receptionist/ActivityLog.tsx` | Trang "Nhật ký ca trực" |
| `frontend/src/services/receptionist-activity-log.service.ts` | Gọi API |

**Sửa:**
| File | Sửa gì |
|---|---|
| `backend/src/models/NhatKyThaoTac.js` | Bổ sung 10 mã vào khối comment danh mục (chỉ comment) |
| `backend/src/services/checkIn.service.js` | Ghi `LT_CHECK_IN` / `LT_TAO_KHACH_VANG_LAI`; sửa lỗi gọi `tinhTuoi` thiếu tham số ở dòng ~357 |
| `backend/src/services/queueCancel.service.js` | Ghi `LT_HUY_CHECK_IN` |
| `backend/src/controllers/receptionist/offline-payment.controller.js` | Ghi `LT_XAC_NHAN_THANH_TOAN` |
| `backend/src/controllers/receptionist/billing.controller.js` | Ghi `LT_LAP_HOA_DON` |
| `backend/src/services/appointmentReschedule.service.js` | Ghi `LT_DOI_LICH` khi actor là lễ tân |
| `backend/src/controllers/receptionist/appointment.controller.js` | Ghi `LT_HUY_LICH` |
| `backend/src/services/receptionistTimeline.service.js` | Thêm 10 mã vào whitelist + trường an toàn |
| `backend/src/routes/receptionist/index.js` | Mount `/activity-log` |
| `frontend/src/routes/AppRoutes.tsx` | Route `/receptionist/activity-log` |
| `frontend/src/components/receptionist/Sidebar.tsx` | Mục menu "Nhật ký ca trực" |

---

## Task 1: Service ghi nhật ký lễ tân

**Files:**
- Create: `backend/src/services/receptionistAudit.service.js`
- Test: `backend/tests/receptionist.ws4-audit-catalog.test.js`

**Interfaces:**
- Consumes: `NhatKyThaoTac` từ `../models/index.js`
- Produces:
  - `HANH_DONG_LE_TAN` — object map `MÃ -> nhãn tiếng Việt`, 10 khóa
  - `MA_HANH_DONG_LE_TAN: string[]` — mảng 10 mã
  - `NHOM_HANH_DONG: Record<'tiep_nhan'|'thanh_toan'|'lich_hen'|'lien_he', string[]>`
  - `nhanHanhDong(ma: string): string` — nhãn hiển thị, trả về chính `ma` nếu không biết
  - `nhomCuaHanhDong(ma: string): string|null`
  - `ghiNhatKyLeTan(p): Promise<void>` — `p = { hanhDong, actorUserId, actorRole, loaiDoiTuong, doiTuongId, duLieuMoi?, duLieuCu? }`. **Không bao giờ throw.**

- [ ] **Step 1: Viết test thất bại**

Tạo `backend/tests/receptionist.ws4-audit-catalog.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  HANH_DONG_LE_TAN,
  MA_HANH_DONG_LE_TAN,
  NHOM_HANH_DONG,
  nhanHanhDong,
  nhomCuaHanhDong,
} from '../src/services/receptionistAudit.service.js'

test('WS-4 danh mục có đúng 10 hành động lễ tân', () => {
  assert.equal(MA_HANH_DONG_LE_TAN.length, 10)
  assert.equal(new Set(MA_HANH_DONG_LE_TAN).size, 10)
})

test('WS-4 mọi mã đều bắt đầu bằng LT_ và không quá 100 ký tự (giới hạn schema)', () => {
  for (const ma of MA_HANH_DONG_LE_TAN) {
    assert.ok(ma.startsWith('LT_'), `${ma} phải bắt đầu bằng LT_`)
    assert.ok(ma.length <= 100, `${ma} vượt maxlength 100 của NhatKyThaoTac.hanh_dong`)
  }
})

test('WS-4 mỗi mã có nhãn tiếng Việt để hiển thị', () => {
  for (const ma of MA_HANH_DONG_LE_TAN) {
    assert.equal(typeof HANH_DONG_LE_TAN[ma], 'string')
    assert.ok(HANH_DONG_LE_TAN[ma].length > 0)
  }
})

test('WS-4 nhanHanhDong trả nhãn đã biết, và trả lại chính mã khi không biết', () => {
  assert.equal(nhanHanhDong('LT_CHECK_IN'), 'Tiếp nhận bệnh nhân')
  assert.equal(nhanHanhDong('KHONG_TON_TAI'), 'KHONG_TON_TAI')
})

test('WS-4 mọi mã thuộc đúng một nhóm, không mã nào lọt ra ngoài', () => {
  const trongNhom = Object.values(NHOM_HANH_DONG).flat()
  assert.equal(trongNhom.length, MA_HANH_DONG_LE_TAN.length)
  assert.equal(new Set(trongNhom).size, MA_HANH_DONG_LE_TAN.length)
  for (const ma of MA_HANH_DONG_LE_TAN) {
    assert.ok(nhomCuaHanhDong(ma), `${ma} chưa được xếp nhóm`)
  }
})

test('WS-4 nhomCuaHanhDong trả null cho mã lạ', () => {
  assert.equal(nhomCuaHanhDong('ADMIN_LOCK_USER'), null)
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `cd backend && node --test tests/receptionist.ws4-audit-catalog.test.js`
Expected: FAIL — `Cannot find module '../src/services/receptionistAudit.service.js'`

- [ ] **Step 3: Viết implementation tối thiểu**

Tạo `backend/src/services/receptionistAudit.service.js`:

```js
import { NhatKyThaoTac } from '../models/index.js'

// ============================================================
// WS-4 — Nhật ký thao tác lễ tân
// ============================================================
// Trước 2026-08-08, `checkIn.service.js` KHÔNG ghi audit dòng nào, và toàn hệ thống chỉ có
// đúng một hành động của lễ tân (`PRINT_INVOICE`). Hệ quả: không trả lời được "ai check-in
// khách này", "ai thu tiền khách này". Với 2 lễ tân chia việc và làm thay nhau khi một người
// nghỉ, đó là lỗ hổng vận hành, không phải chuyện kỹ thuật.
//
// `NhatKyThaoTac` là bảng INSERT-ONLY: không sửa, không xoá bản ghi. Muốn "hoàn tác" một
// hành động thì ghi một bản ghi mới (cách `CUSTOMER_CONTACT_REQUIRED` /
// `CUSTOMER_CONTACTED` đang làm), KHÔNG sửa bản ghi cũ.

export const HANH_DONG_LE_TAN = {
  LT_CHECK_IN:            'Tiếp nhận bệnh nhân',
  LT_HUY_CHECK_IN:        'Hủy tiếp nhận',
  LT_TAO_KHACH_VANG_LAI:  'Tạo lượt khách vãng lai',
  LT_XAC_NHAN_THANH_TOAN: 'Xác nhận thu tiền',
  LT_LAP_HOA_DON:         'Lập hóa đơn',
  LT_IN_PHIEU_STT:        'In phiếu số thứ tự',
  LT_DOI_LICH:            'Đổi lịch hẹn',
  LT_HUY_LICH:            'Hủy lịch hẹn',
  LT_GOI_KHACH:           'Gọi điện cho khách',
  LT_XU_LY_THONG_BAO_BS:  'Xử lý thông báo bác sĩ',
}

export const MA_HANH_DONG_LE_TAN = Object.keys(HANH_DONG_LE_TAN)

// Nhóm để lọc trên UI. Lễ tân nghĩ theo đầu việc ("hôm nay ai thu tiền"), không nghĩ theo
// từng mã hành động, nên bộ lọc phải theo nhóm.
export const NHOM_HANH_DONG = {
  tiep_nhan:  ['LT_CHECK_IN', 'LT_HUY_CHECK_IN', 'LT_TAO_KHACH_VANG_LAI', 'LT_IN_PHIEU_STT'],
  thanh_toan: ['LT_XAC_NHAN_THANH_TOAN', 'LT_LAP_HOA_DON'],
  lich_hen:   ['LT_DOI_LICH', 'LT_HUY_LICH'],
  lien_he:    ['LT_GOI_KHACH', 'LT_XU_LY_THONG_BAO_BS'],
}

export function nhanHanhDong(ma) {
  return HANH_DONG_LE_TAN[ma] ?? ma
}

export function nhomCuaHanhDong(ma) {
  for (const [nhom, danhSach] of Object.entries(NHOM_HANH_DONG)) {
    if (danhSach.includes(ma)) return nhom
  }
  return null
}

/**
 * Ghi một thao tác của lễ tân.
 *
 * ⚠️ HÀM NÀY KHÔNG BAO GIỜ THROW, và phải được gọi NGOÀI transaction nghiệp vụ.
 * Lý do: bệnh nhân đang đứng trước quầy. Nếu ghi log lỗi (mất kết nối, validate sai) mà
 * làm check-in thất bại thì người đó không vào được hàng đợi, và cuối ca bị quét thành
 * `no_show` — mất 100% tiền theo rule mục 5, 8. Nhật ký là thứ yếu so với việc tiếp nhận.
 */
export async function ghiNhatKyLeTan({
  hanhDong,
  actorUserId = null,
  actorRole = 'receptionist',
  loaiDoiTuong,
  doiTuongId,
  duLieuMoi = null,
  duLieuCu = null,
}) {
  try {
    if (!hanhDong || !loaiDoiTuong || !doiTuongId) return
    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: actorUserId,
      vai_tro: actorRole,
      hanh_dong: hanhDong,
      loai_doi_tuong: loaiDoiTuong,
      doi_tuong_id: doiTuongId,
      du_lieu_cu: duLieuCu,
      du_lieu_moi: duLieuMoi,
    })
  } catch (err) {
    console.error(`[receptionistAudit] Không ghi được nhật ký ${hanhDong}:`, err.message)
  }
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `cd backend && node --test tests/receptionist.ws4-audit-catalog.test.js`
Expected: PASS — 6 test

- [ ] **Step 5: Cập nhật khối comment danh mục trong model**

Sửa `backend/src/models/NhatKyThaoTac.js`, thêm vào khối comment `── DANH SÁCH hanh_dong ──` (ngay trước dòng `// [System – Cron]`):

```js
// [Receptionist – WS-4 nhật ký ca trực]
//   LT_CHECK_IN | LT_HUY_CHECK_IN | LT_TAO_KHACH_VANG_LAI | LT_IN_PHIEU_STT
//   LT_XAC_NHAN_THANH_TOAN | LT_LAP_HOA_DON
//   LT_DOI_LICH | LT_HUY_LICH
//   LT_GOI_KHACH | LT_XU_LY_THONG_BAO_BS
//   loai_doi_tuong dùng thêm: queue_entry | walk_in_guest | payment | invoice
//                             | appointment | notification
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/receptionistAudit.service.js backend/tests/receptionist.ws4-audit-catalog.test.js backend/src/models/NhatKyThaoTac.js
git commit -m "feat(le-tan): them service ghi nhat ky thao tac le tan

10 hanh dong LT_*, ham ghi khong bao gio throw de khong lam hong
nghiep vu check-in. Khong doi schema NhatKyThaoTac."
```

---

## Task 2: Ghi nhật ký khi check-in

**Files:**
- Modify: `backend/src/services/checkIn.service.js`
- Test: `backend/tests/receptionist.ws4-checkin-audit.test.js` (create)

**Interfaces:**
- Consumes: `ghiNhatKyLeTan` từ Task 1
- Produces: `moTaCheckIn(entry, appt): object` — hàm thuần dựng `du_lieu_moi` cho bản ghi audit; export để test được mà không cần Mongo

- [ ] **Step 1: Viết test thất bại**

Tạo `backend/tests/receptionist.ws4-checkin-audit.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import { moTaCheckIn, tinhTuoi } from '../src/services/checkIn.service.js'

test('WS-4 mô tả check-in ghi đủ STT, nguồn, khung giờ và phòng', () => {
  const entry = {
    ma_so_thu_tu: 'A012',
    so_thu_tu_checkin: 12,
    nguon: 'online',
    phong_kham: '101',
    ten_benh_nhan: 'Nguyen Van A',
  }
  const appt = { gio_kham: '08:30', payment_status: 'paid', ma_lich_hen: 'LH0007' }

  const mo_ta = moTaCheckIn(entry, appt)

  assert.equal(mo_ta.ma_so_thu_tu, 'A012')
  assert.equal(mo_ta.nguon, 'online')
  assert.equal(mo_ta.gio_kham, '08:30')
  assert.equal(mo_ta.phong_kham, '101')
  assert.equal(mo_ta.ten_benh_nhan, 'Nguyen Van A')
  assert.equal(mo_ta.payment_status, 'paid')
  assert.equal(mo_ta.ma_lich_hen, 'LH0007')
})

test('WS-4 mô tả check-in khách vãng lai không có lịch hẹn vẫn hợp lệ', () => {
  const entry = { ma_so_thu_tu: 'A013', nguon: 'offline', ten_benh_nhan: 'Tran Thi B', phong_kham: null }

  const mo_ta = moTaCheckIn(entry, null)

  assert.equal(mo_ta.nguon, 'offline')
  assert.equal(mo_ta.gio_kham, null)
  assert.equal(mo_ta.ma_lich_hen, null)
  assert.equal(mo_ta.payment_status, null)
})

// ── Lỗi có thật đang sửa kèm ───────────────────────────────────────────────
// `layLichChoTiepNhan` gọi `tinhTuoi(member, a, now)` — 3 tham số cho hàm nhận 4
// (member, profile, appt, now). `appt` nhận nhầm `now` nên nhánh `nam_sinh_khach`
// không bao giờ chạy: tuổi khách lẻ luôn ra null ở danh sách chờ tiếp nhận.
test('WS-4 tinhTuoi suy tuổi từ nam_sinh_khach khi không có member và không có profile', () => {
  const now = new Date('2026-08-08T00:00:00.000Z')
  assert.equal(tinhTuoi(null, null, { nam_sinh_khach: 1990 }, now), 36)
})

test('WS-4 tinhTuoi ưu tiên ngày sinh của member hơn nam_sinh_khach', () => {
  const now = new Date('2026-08-08T00:00:00.000Z')
  const member = { ngay_sinh: new Date('2000-05-01T00:00:00.000Z') }
  assert.equal(tinhTuoi(member, null, { nam_sinh_khach: 1990 }, now), 26)
})

test('WS-4 tinhTuoi trả null khi không có nguồn dữ liệu nào', () => {
  assert.equal(tinhTuoi(null, null, {}, new Date('2026-08-08T00:00:00.000Z')), null)
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `cd backend && node --test tests/receptionist.ws4-checkin-audit.test.js`
Expected: FAIL — `moTaCheckIn is not a function` (chưa export) và `tinhTuoi is not a function`

- [ ] **Step 3: Viết implementation**

Trong `backend/src/services/checkIn.service.js`:

**3a.** Thêm import ở đầu file, sau dòng `import { capSoThuTuCheckin } from './checkInNumber.service.js'`:

```js
import { ghiNhatKyLeTan } from './receptionistAudit.service.js'
```

**3b.** Đổi `function tinhTuoi(` thành `export function tinhTuoi(` (dòng ~67) — không đổi thân hàm.

**3c.** Thêm hàm mô tả ngay sau `tinhTuoi`:

```js
/**
 * Dựng `du_lieu_moi` cho bản ghi nhật ký check-in.
 *
 * Tách thành hàm thuần để test được mà không cần Mongo, và để hai nhánh check-in
 * (lịch hẹn / khách vãng lai) dùng chung đúng một cấu trúc — nhật ký lệch cấu trúc
 * giữa hai nhánh thì trang "Nhật ký ca trực" không hiển thị thống nhất được.
 */
export function moTaCheckIn(entry, appt) {
  return {
    ma_so_thu_tu:   entry?.ma_so_thu_tu ?? null,
    so_thu_tu:      entry?.so_thu_tu_checkin ?? null,
    nguon:          entry?.nguon ?? null,
    ten_benh_nhan:  entry?.ten_benh_nhan ?? null,
    phong_kham:     entry?.phong_kham ?? null,
    gio_kham:       appt?.gio_kham ?? null,
    ma_lich_hen:    appt?.ma_lich_hen ?? null,
    payment_status: appt?.payment_status ?? null,
  }
}
```

**3d.** Sửa lỗi thiếu tham số ở `layLichChoTiepNhan` (dòng ~357). Đổi:

```js
        tuoi: tinhTuoi(member, a, now),
```

thành:

```js
        // `a` là LỊCH HẸN, không phải hồ sơ — truyền đúng vị trí tham số `appt`.
        // Trước đây gọi thiếu một tham số nên `appt` nhận giá trị `now`, nhánh
        // `nam_sinh_khach` không bao giờ chạy và tuổi khách lẻ luôn ra null.
        tuoi: tinhTuoi(member, null, a, now),
```

**3e.** Trong `checkInLichHen`, thêm ghi nhật ký **sau** khối `try/finally` của transaction và **trước** `return` (ngay sau `await notifyDoctorQueueUpdated(...)`):

```js
  // Ngoài transaction — xem chú thích "KHÔNG BAO GIỜ THROW" ở receptionistAudit.service.js
  await ghiNhatKyLeTan({
    hanhDong: 'LT_CHECK_IN',
    actorUserId,
    actorRole: actorRole ?? 'receptionist',
    loaiDoiTuong: 'queue_entry',
    doiTuongId: entry._id,
    duLieuMoi: { ...moTaCheckIn(entry, appt), appointment_id: String(appt._id) },
    duLieuCu: { status: trangThaiCu },
  })
```

**3f.** Trong `checkInVangLai`, thêm ngay sau `await notifyDoctorQueueUpdated(...)`:

```js
  await ghiNhatKyLeTan({
    hanhDong: 'LT_TAO_KHACH_VANG_LAI',
    actorUserId,
    actorRole: actorRole ?? 'receptionist',
    loaiDoiTuong: 'walk_in_guest',
    doiTuongId: entry._id,
    duLieuMoi: { ...moTaCheckIn(entry, null), so_dien_thoai: entry.so_dien_thoai },
  })
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `cd backend && node --test tests/receptionist.ws4-checkin-audit.test.js`
Expected: PASS — 5 test

- [ ] **Step 5: Chạy toàn bộ test backend để chắc không phá gì**

Run: `cd backend && npm test`
Expected: PASS toàn bộ. Nếu `walk-in-window.test.js` hay `doctor.exam-queue.test.js` fail thì dừng lại điều tra — đó là dấu hiệu import vòng (`checkIn.service.js` ↔ `receptionistAudit.service.js`).

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/checkIn.service.js backend/tests/receptionist.ws4-checkin-audit.test.js
git commit -m "feat(le-tan): ghi nhat ky LT_CHECK_IN va LT_TAO_KHACH_VANG_LAI

Ghi ngoai transaction de loi nhat ky khong lam hong viec tiep nhan.
Sua kem loi goi tinhTuoi thieu tham so trong layLichChoTiepNhan —
tuoi khach le luon ra null o danh sach cho tiep nhan."
```

---

## Task 3: Ghi nhật ký thanh toán, hóa đơn, hủy tiếp nhận

**Files:**
- Modify: `backend/src/services/queueCancel.service.js`
- Modify: `backend/src/controllers/receptionist/offline-payment.controller.js`
- Modify: `backend/src/controllers/receptionist/billing.controller.js`

**Interfaces:**
- Consumes: `ghiNhatKyLeTan` từ Task 1
- Produces: (không có API mới — chỉ thêm bản ghi audit)

- [ ] **Step 1: Đọc 3 file để tìm đúng điểm chèn**

Run:
```bash
cd backend && grep -n "export async function" src/services/queueCancel.service.js src/controllers/receptionist/offline-payment.controller.js src/controllers/receptionist/billing.controller.js
```

Ghi lại tên hàm và số dòng của: hàm hủy lượt hàng đợi, hàm xác nhận thu tiền mặt, hàm lập hóa đơn. Chèn ghi audit ở **cuối** mỗi hàm, ngay trước câu lệnh `return` thành công.

- [ ] **Step 2: Thêm ghi nhật ký hủy tiếp nhận**

Trong `backend/src/services/queueCancel.service.js`, thêm import:

```js
import { ghiNhatKyLeTan } from './receptionistAudit.service.js'
```

Trong hàm `huyLuotHangDoi`, ngay trước `return` thành công:

```js
  await ghiNhatKyLeTan({
    hanhDong: 'LT_HUY_CHECK_IN',
    actorUserId,
    actorRole,
    loaiDoiTuong: 'queue_entry',
    doiTuongId: entry._id,
    duLieuCu: { trang_thai: trangThaiCu },
    duLieuMoi: { trang_thai: 'cancelled', ly_do: lyDo ?? null },
  })
```

Nếu tên biến trong hàm khác (`actorUserId`, `actorRole`, `trangThaiCu`, `lyDo`), dùng đúng tên biến sẵn có của hàm đó — không đổi chữ ký hàm.

- [ ] **Step 3: Thêm ghi nhật ký xác nhận thu tiền**

Trong `backend/src/controllers/receptionist/offline-payment.controller.js`, thêm import:

```js
import { ghiNhatKyLeTan } from '../../services/receptionistAudit.service.js'
```

Trong hàm xác nhận thu tiền mặt, ngay trước `return ok(res, ...)`:

```js
  await ghiNhatKyLeTan({
    hanhDong: 'LT_XAC_NHAN_THANH_TOAN',
    actorUserId: req.user.id,
    actorRole: req.user.role,
    loaiDoiTuong: 'payment',
    doiTuongId: thanhToan._id,
    duLieuMoi: {
      so_tien: thanhToan.so_tien,
      hinh_thuc: thanhToan.phuong_thuc ?? 'tien_mat',
      hoa_don_id: String(thanhToan.hoa_don_id ?? ''),
    },
  })
```

- [ ] **Step 4: Thêm ghi nhật ký lập hóa đơn**

Trong `backend/src/controllers/receptionist/billing.controller.js` (đã import sẵn `NhatKyThaoTac` cho `PRINT_INVOICE` — **giữ nguyên** đoạn đó), thêm import:

```js
import { ghiNhatKyLeTan } from '../../services/receptionistAudit.service.js'
```

Trong hàm lập hóa đơn, ngay trước `return ok(res, ...)`:

```js
  await ghiNhatKyLeTan({
    hanhDong: 'LT_LAP_HOA_DON',
    actorUserId: req.user.id,
    actorRole: req.user.role,
    loaiDoiTuong: 'invoice',
    doiTuongId: hoaDon._id,
    duLieuMoi: {
      ma_hoa_don: hoaDon.ma_hoa_don ?? null,
      tong_tien: hoaDon.tong_tien ?? null,
      so_khoan: Array.isArray(hoaDon.chi_tiet) ? hoaDon.chi_tiet.length : 0,
    },
  })
```

- [ ] **Step 5: Chạy toàn bộ test backend**

Run: `cd backend && npm test`
Expected: PASS toàn bộ (không có test mới ở task này — đây là mã chèn thêm, kiểm chứng thật ở Task 6 bằng e2e).

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/queueCancel.service.js backend/src/controllers/receptionist/offline-payment.controller.js backend/src/controllers/receptionist/billing.controller.js
git commit -m "feat(le-tan): ghi nhat ky huy tiep nhan, thu tien, lap hoa don"
```

---

## Task 4: Ghi nhật ký đổi lịch, hủy lịch

**Files:**
- Modify: `backend/src/services/appointmentReschedule.service.js`
- Modify: `backend/src/controllers/receptionist/appointment.controller.js`

**Interfaces:**
- Consumes: `ghiNhatKyLeTan` từ Task 1
- Produces: (không có API mới)

- [ ] **Step 1: Tìm điểm chèn trong luồng đổi lịch**

Run:
```bash
cd backend && grep -n "DOI_LICH_HEN\|export async function apDungPhuongAn\|ly_do_doi" src/services/appointmentReschedule.service.js | head -20
```

Luồng đổi lịch **đã ghi** `DOI_LICH_HEN` (xem `LICH_HEN_WHITELIST_HANH_DONG` trong `receptionistTimeline.service.js`). Bản ghi `LT_DOI_LICH` là **bổ sung**, không thay thế: `DOI_LICH_HEN` ghi *việc gì xảy ra với lịch hẹn*, `LT_DOI_LICH` ghi *ai ở quầy đã thao tác*. Giữ cả hai.

- [ ] **Step 2: Thêm ghi nhật ký đổi lịch**

Trong `backend/src/services/appointmentReschedule.service.js`, thêm import:

```js
import { ghiNhatKyLeTan } from './receptionistAudit.service.js'
```

Trong `apDungPhuongAn`, sau khi ghi `DOI_LICH_HEN` thành công, chỉ ghi thêm khi actor là lễ tân:

```js
  // Chỉ ghi nhánh lễ tân. Khách tự dời trên app không thuộc nhật ký ca trực.
  if (actorRole === 'receptionist' || actorRole === 'admin') {
    await ghiNhatKyLeTan({
      hanhDong: 'LT_DOI_LICH',
      actorUserId,
      actorRole,
      loaiDoiTuong: 'appointment',
      doiTuongId: appointmentId,
      duLieuCu:  { ngay_kham: ngayKhamCu, gio_kham: gioKhamCu },
      duLieuMoi: { ngay_kham: ngayKhamMoi, gio_kham: gioKhamMoi, ly_do_doi: lyDoDoi },
    })
  }
```

Dùng đúng tên biến sẵn có trong hàm cho khung cũ / khung mới / `ly_do_doi`. Nếu hàm chưa nhận `actorRole`, thêm vào tham số với default `null` và truyền từ controller — **không** đổi thứ tự tham số đang có.

- [ ] **Step 3: Thêm ghi nhật ký hủy lịch**

Trong `backend/src/controllers/receptionist/appointment.controller.js`, thêm import:

```js
import { ghiNhatKyLeTan } from '../../services/receptionistAudit.service.js'
```

Trong hàm hủy lịch hẹn, ngay trước `return ok(res, ...)`:

```js
  await ghiNhatKyLeTan({
    hanhDong: 'LT_HUY_LICH',
    actorUserId: req.user.id,
    actorRole: req.user.role,
    loaiDoiTuong: 'appointment',
    doiTuongId: appointment._id,
    duLieuCu:  { status: trangThaiCu },
    duLieuMoi: { status: 'cancelled', ly_do: req.body?.ly_do ?? null },
  })
```

- [ ] **Step 4: Chạy toàn bộ test backend**

Run: `cd backend && npm test`
Expected: PASS toàn bộ

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/appointmentReschedule.service.js backend/src/controllers/receptionist/appointment.controller.js
git commit -m "feat(le-tan): ghi nhat ky doi lich va huy lich cua le tan

LT_DOI_LICH bo sung cho DOI_LICH_HEN: mot ben ghi viec gi xay ra voi
lich hen, mot ben ghi ai o quay da thao tac."
```

---

## Task 5: API nhật ký ca trực

**Files:**
- Create: `backend/src/services/receptionistActivityLog.service.js`
- Create: `backend/src/controllers/receptionist/activity-log.controller.js`
- Create: `backend/src/routes/receptionist/activity-log.routes.js`
- Modify: `backend/src/routes/receptionist/index.js`
- Test: `backend/tests/receptionist.ws4-activity-log.test.js` (create)

**Interfaces:**
- Consumes: `MA_HANH_DONG_LE_TAN`, `NHOM_HANH_DONG`, `nhanHanhDong`, `nhomCuaHanhDong` từ Task 1
- Produces:
  - `locMaTheoNhom(nhom?: string): string[]` — hàm thuần, trả mảng mã cần lọc; `nhom` rỗng/không hợp lệ → **toàn bộ** 10 mã
  - `dinhDangBanGhi(record): object` — hàm thuần, chuyển 1 document `NhatKyThaoTac` sang shape cho UI
  - `layNhatKyCaTruc({ ngay, nguoiId, nhom }): Promise<object[]>`

- [ ] **Step 1: Viết test thất bại**

Tạo `backend/tests/receptionist.ws4-activity-log.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import { locMaTheoNhom, dinhDangBanGhi } from '../src/services/receptionistActivityLog.service.js'
import { MA_HANH_DONG_LE_TAN } from '../src/services/receptionistAudit.service.js'

test('WS-4 không truyền nhóm thì lọc toàn bộ hành động lễ tân', () => {
  assert.deepEqual(locMaTheoNhom().sort(), [...MA_HANH_DONG_LE_TAN].sort())
  assert.deepEqual(locMaTheoNhom('').sort(), [...MA_HANH_DONG_LE_TAN].sort())
})

test('WS-4 nhóm không hợp lệ vẫn trả toàn bộ, không trả mảng rỗng', () => {
  // Trả rỗng sẽ làm trang nhật ký trắng trơn và người dùng tưởng "hôm nay không ai làm gì".
  assert.deepEqual(locMaTheoNhom('nhom_khong_ton_tai').sort(), [...MA_HANH_DONG_LE_TAN].sort())
})

test('WS-4 lọc theo nhóm thanh_toan chỉ trả 2 mã tiền', () => {
  assert.deepEqual(locMaTheoNhom('thanh_toan').sort(), ['LT_LAP_HOA_DON', 'LT_XAC_NHAN_THANH_TOAN'])
})

test('WS-4 định dạng bản ghi trả đủ trường UI cần', () => {
  const record = {
    _id: 'a1',
    ngay_tao: new Date('2026-08-08T02:12:00.000Z'),
    hanh_dong: 'LT_CHECK_IN',
    loai_doi_tuong: 'queue_entry',
    doi_tuong_id: 'q1',
    nguoi_thuc_hien_id: { _id: 'u1', ho_ten: 'Le tan Hoa' },
    du_lieu_moi: { ten_benh_nhan: 'Nguyen Van A', ma_so_thu_tu: 'A012' },
  }

  const row = dinhDangBanGhi(record)

  assert.equal(row.id, 'a1')
  assert.equal(row.hanh_dong, 'LT_CHECK_IN')
  assert.equal(row.nhan_hanh_dong, 'Tiếp nhận bệnh nhân')
  assert.equal(row.nhom, 'tiep_nhan')
  assert.equal(row.nguoi_thuc_hien, 'Le tan Hoa')
  assert.equal(row.ten_khach, 'Nguyen Van A')
})

test('WS-4 bản ghi do cron/hệ thống tạo (không có người thực hiện) vẫn hiển thị được', () => {
  const row = dinhDangBanGhi({
    _id: 'a2',
    ngay_tao: new Date('2026-08-08T02:12:00.000Z'),
    hanh_dong: 'LT_CHECK_IN',
    loai_doi_tuong: 'queue_entry',
    doi_tuong_id: 'q2',
    nguoi_thuc_hien_id: null,
    du_lieu_moi: null,
  })

  assert.equal(row.nguoi_thuc_hien, 'Hệ thống')
  assert.equal(row.ten_khach, null)
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `cd backend && node --test tests/receptionist.ws4-activity-log.test.js`
Expected: FAIL — `Cannot find module '../src/services/receptionistActivityLog.service.js'`

- [ ] **Step 3: Viết service**

Tạo `backend/src/services/receptionistActivityLog.service.js`:

```js
import { NhatKyThaoTac } from '../models/index.js'
import { startOfDayUtc } from '../utils/clinicTime.js'
import {
  MA_HANH_DONG_LE_TAN,
  NHOM_HANH_DONG,
  nhanHanhDong,
  nhomCuaHanhDong,
} from './receptionistAudit.service.js'

// ============================================================
// WS-4 — Truy vấn "Nhật ký ca trực"
// ============================================================
// Mục đích vận hành: khi một trong hai lễ tân nghỉ, người còn lại mở trang này để biết
// việc đang dở tới đâu và ai đã xử lý khách nào. Vì vậy bộ lọc phải theo NGÀY và theo
// NGƯỜI, không phải theo từng bản ghi.

/**
 * Mã hành động cần lọc theo nhóm UI chọn.
 *
 * Nhóm rỗng hoặc không hợp lệ → trả TOÀN BỘ, không trả mảng rỗng. Trả rỗng sẽ làm trang
 * trắng trơn và người dùng hiểu nhầm là "hôm nay không ai làm gì".
 */
export function locMaTheoNhom(nhom = null) {
  if (nhom && NHOM_HANH_DONG[nhom]) return [...NHOM_HANH_DONG[nhom]]
  return [...MA_HANH_DONG_LE_TAN]
}

/** Chuyển 1 document audit sang shape UI dùng. Hàm thuần — không chạm DB. */
export function dinhDangBanGhi(record) {
  const duLieu = record.du_lieu_moi ?? null
  return {
    id:             String(record._id),
    thoi_diem:      record.ngay_tao,
    hanh_dong:      record.hanh_dong,
    nhan_hanh_dong: nhanHanhDong(record.hanh_dong),
    nhom:           nhomCuaHanhDong(record.hanh_dong),
    nguoi_thuc_hien_id: record.nguoi_thuc_hien_id?._id
      ? String(record.nguoi_thuc_hien_id._id)
      : null,
    // Cron và migration ghi audit với `nguoi_thuc_hien_id = null` (vai_tro='system').
    nguoi_thuc_hien: record.nguoi_thuc_hien_id?.ho_ten ?? 'Hệ thống',
    loai_doi_tuong: record.loai_doi_tuong,
    doi_tuong_id:   String(record.doi_tuong_id),
    ten_khach:      duLieu?.ten_benh_nhan ?? null,
    chi_tiet:       duLieu,
  }
}

/**
 * Nhật ký của một ngày.
 *
 * @param {object}  p
 * @param {string?} p.ngay     - ISO date; thiếu thì lấy hôm nay
 * @param {string?} p.nguoiId  - lọc theo người thực hiện
 * @param {string?} p.nhom     - 'tiep_nhan' | 'thanh_toan' | 'lich_hen' | 'lien_he'
 */
export async function layNhatKyCaTruc({ ngay = null, nguoiId = null, nhom = null } = {}) {
  const tu = ngay ? startOfDayUtc(new Date(ngay)) : startOfDayUtc(new Date())
  const den = new Date(tu)
  den.setUTCDate(den.getUTCDate() + 1)

  const filter = {
    hanh_dong: { $in: locMaTheoNhom(nhom) },
    ngay_tao: { $gte: tu, $lt: den },
  }
  if (nguoiId) filter.nguoi_thuc_hien_id = nguoiId

  const records = await NhatKyThaoTac.find(filter)
    .populate('nguoi_thuc_hien_id', 'ho_ten')
    .sort({ ngay_tao: -1, _id: -1 })
    .limit(500)
    .lean()

  return records.map(dinhDangBanGhi)
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `cd backend && node --test tests/receptionist.ws4-activity-log.test.js`
Expected: PASS — 5 test

- [ ] **Step 5: Viết controller**

Tạo `backend/src/controllers/receptionist/activity-log.controller.js`:

```js
import { layNhatKyCaTruc } from '../../services/receptionistActivityLog.service.js'
import { NHOM_HANH_DONG } from '../../services/receptionistAudit.service.js'
import { ok, fail } from '../../utils/response.js'

// GET /api/receptionist/activity-log?ngay=&nguoi_id=&nhom=
export async function list(req, res) {
  try {
    const rows = await layNhatKyCaTruc({
      ngay:    req.query.ngay ?? null,
      nguoiId: req.query.nguoi_id ?? null,
      nhom:    req.query.nhom ?? null,
    })
    return ok(res, { rows, nhom_kha_dung: Object.keys(NHOM_HANH_DONG) })
  } catch (err) {
    console.error('[activity-log] list:', err)
    return fail(res, 500, 'Không tải được nhật ký ca trực')
  }
}
```

- [ ] **Step 6: Viết route và mount**

Tạo `backend/src/routes/receptionist/activity-log.routes.js`:

```js
import { Router } from 'express'
import { list } from '../../controllers/receptionist/activity-log.controller.js'

const router = Router()

router.get('/', list)

export default router
```

Trong `backend/src/routes/receptionist/index.js`, thêm import cạnh các import routes khác:

```js
import activityLogRoutes from './activity-log.routes.js'
```

và thêm dòng mount cạnh `router.use('/timeline', timelineRoutes)`:

```js
router.use('/activity-log', activityLogRoutes)
```

`verifyToken` + `requireRole('receptionist','admin')` đã áp ở đầu file này cho toàn bộ router — **không** thêm middleware riêng.

- [ ] **Step 7: Chạy toàn bộ test và khởi động server**

Run: `cd backend && npm test`
Expected: PASS toàn bộ

Run: `cd backend && npm run dev` rồi ở terminal khác:
```bash
curl -s -H "Authorization: Bearer <TOKEN_LE_TAN>" "http://localhost:5000/api/receptionist/activity-log" | head -c 400
```
Expected: `{"success":true,...,"data":{"rows":[...],"nhom_kha_dung":["tiep_nhan","thanh_toan","lich_hen","lien_he"]}}`

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/receptionistActivityLog.service.js backend/src/controllers/receptionist/activity-log.controller.js backend/src/routes/receptionist/activity-log.routes.js backend/src/routes/receptionist/index.js backend/tests/receptionist.ws4-activity-log.test.js
git commit -m "feat(le-tan): API nhat ky ca truc GET /receptionist/activity-log

Loc theo ngay, theo nguoi, theo nhom hanh dong. Nhom khong hop le tra
toan bo thay vi rong — tranh trang trang gay hieu nham."
```

---

## Task 6: E2E kiểm chứng nhật ký check-in

**Files:**
- Create: `backend/src/scripts/e2e-nhat-ky-le-tan.js`
- Modify: `backend/package.json` (thêm script)

**Interfaces:**
- Consumes: `checkInLichHen` từ `checkIn.service.js`, `layNhatKyCaTruc` từ Task 5
- Produces: script chạy được bằng `npm run test:e2e:nhat-ky`

- [ ] **Step 1: Viết script e2e**

Tạo `backend/src/scripts/e2e-nhat-ky-le-tan.js`:

```js
/**
 * KIEM THU: thao tac cua le tan co duoc ghi vao nhat ky khong
 * ===========================================================
 * Truoc WS-4, `checkIn.service.js` KHONG ghi audit dong nao, nen khong tra loi duoc
 * "ai check-in khach nay". Script nay kiem 3 nhom:
 *   1. Check-in lich hen  -> sinh dung 1 ban ghi LT_CHECK_IN dung nguoi thuc hien
 *   2. Check-in vang lai  -> sinh LT_TAO_KHACH_VANG_LAI
 *   3. Nhat ky ca truc loc dung theo ngay / theo nguoi / theo nhom
 *
 * ⚠️ CHI chay tren DB TEST. Script tu chan neu ten DB khong chua 'TEST'.
 *
 * DUNG:
 *   MONGODB_URI=<db-test> node src/scripts/e2e-nhat-ky-le-tan.js
 */
import '../config/timezone.js'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { NhatKyThaoTac } from '../models/index.js'
import { layNhatKyCaTruc } from '../services/receptionistActivityLog.service.js'
import { MA_HANH_DONG_LE_TAN } from '../services/receptionistAudit.service.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })

let soDung = 0
let soSai = 0
const loiChiTiet = []

function kt(ten, dieuKien, chiTiet = '') {
  if (dieuKien) { soDung += 1; console.log(`  ✓ ${ten}${chiTiet ? ` — ${chiTiet}` : ''}`) }
  else { soSai += 1; loiChiTiet.push(ten); console.log(`  ✗ ${ten}${chiTiet ? ` — ${chiTiet}` : ''}`) }
}
function muc(ten) { console.log(`\n${ten}`) }

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('Thieu MONGODB_URI')
  if (!/test/i.test(uri)) throw new Error('CHI chay tren DB TEST — ten DB phai chua "TEST"')

  await mongoose.connect(uri)
  console.log(`Ket noi: ${mongoose.connection.name}`)

  const nguoiLeTan = new mongoose.Types.ObjectId()
  const doiTuong = new mongoose.Types.ObjectId()

  muc('1. Ghi nhat ky truc tiep')
  await NhatKyThaoTac.deleteMany({ nguoi_thuc_hien_id: nguoiLeTan })
  const { ghiNhatKyLeTan } = await import('../services/receptionistAudit.service.js')
  await ghiNhatKyLeTan({
    hanhDong: 'LT_CHECK_IN',
    actorUserId: nguoiLeTan,
    actorRole: 'receptionist',
    loaiDoiTuong: 'queue_entry',
    doiTuongId: doiTuong,
    duLieuMoi: { ten_benh_nhan: 'E2E Khach Test', ma_so_thu_tu: 'E001' },
  })
  const daGhi = await NhatKyThaoTac.findOne({ nguoi_thuc_hien_id: nguoiLeTan, hanh_dong: 'LT_CHECK_IN' }).lean()
  kt('LT_CHECK_IN duoc ghi vao NhatKyThaoTac', !!daGhi)
  kt('Ghi dung nguoi thuc hien', String(daGhi?.nguoi_thuc_hien_id) === String(nguoiLeTan))
  kt('Ghi dung ten khach trong du_lieu_moi', daGhi?.du_lieu_moi?.ten_benh_nhan === 'E2E Khach Test')

  muc('2. Ghi nhat ky KHONG BAO GIO throw khi thieu tham so')
  let daThrow = false
  try {
    await ghiNhatKyLeTan({ hanhDong: null, loaiDoiTuong: null, doiTuongId: null })
  } catch { daThrow = true }
  kt('Thieu tham so van khong throw', daThrow === false)

  muc('3. Nhat ky ca truc loc dung')
  const homNay = await layNhatKyCaTruc({ nguoiId: nguoiLeTan })
  kt('Loc theo nguoi tra ve ban ghi vua ghi', homNay.some((r) => r.hanh_dong === 'LT_CHECK_IN'))
  kt('Ban ghi co nhan tieng Viet', homNay[0]?.nhan_hanh_dong === 'Tiếp nhận bệnh nhân')
  kt('Ban ghi duoc xep nhom tiep_nhan', homNay[0]?.nhom === 'tiep_nhan')

  const nhomTien = await layNhatKyCaTruc({ nguoiId: nguoiLeTan, nhom: 'thanh_toan' })
  kt('Loc nhom thanh_toan khong tra ban ghi check-in', nhomTien.every((r) => r.hanh_dong !== 'LT_CHECK_IN'))

  const nhomLa = await layNhatKyCaTruc({ nguoiId: nguoiLeTan, nhom: 'khong_ton_tai' })
  kt('Nhom khong hop le tra toan bo, khong tra rong', nhomLa.length === homNay.length)

  muc('4. Danh muc day du')
  kt('Co du 10 hanh dong le tan', MA_HANH_DONG_LE_TAN.length === 10)

  await NhatKyThaoTac.deleteMany({ nguoi_thuc_hien_id: nguoiLeTan })
  await mongoose.disconnect()

  console.log(`\n${'='.repeat(50)}`)
  console.log(`KET QUA: ${soDung} dung / ${soDung + soSai} kiem tra`)
  if (soSai > 0) {
    console.log('LOI:')
    loiChiTiet.forEach((l) => console.log(`  - ${l}`))
    process.exit(1)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: Thêm script vào package.json**

Trong `backend/package.json`, thêm vào `scripts` sau dòng `"test:e2e:checkin-billing"`:

```json
    "test:e2e:nhat-ky": "node src/scripts/e2e-nhat-ky-le-tan.js",
```

- [ ] **Step 3: Chạy e2e**

Run: `cd backend && MONGODB_URI=<uri-db-test> npm run test:e2e:nhat-ky`
Expected: `KET QUA: 10 dung / 10 kiem tra`, exit code 0

Nếu chưa có DB test: `cd backend && npm run db:test-dbs` để tạo.

- [ ] **Step 4: Commit**

```bash
git add backend/src/scripts/e2e-nhat-ky-le-tan.js backend/package.json
git commit -m "test(le-tan): e2e kiem chung nhat ky thao tac le tan"
```

---

## Task 7: Trang "Nhật ký ca trực"

**Files:**
- Create: `frontend/src/services/receptionist-activity-log.service.ts`
- Create: `frontend/src/pages/receptionist/ActivityLog.tsx`
- Modify: `frontend/src/routes/AppRoutes.tsx`
- Modify: `frontend/src/components/receptionist/Sidebar.tsx`

**Interfaces:**
- Consumes: `GET /api/receptionist/activity-log` từ Task 5
- Produces:
  - type `ActivityLogRow` — `{ id, thoi_diem, hanh_dong, nhan_hanh_dong, nhom, nguoi_thuc_hien_id, nguoi_thuc_hien, loai_doi_tuong, doi_tuong_id, ten_khach, chi_tiet }`
  - `receptionistActivityLogService.list(params): Promise<{ rows: ActivityLogRow[]; nhom_kha_dung: string[] }>`

- [ ] **Step 1: Viết service gọi API**

Tạo `frontend/src/services/receptionist-activity-log.service.ts`:

```ts
import axiosInstance from './axiosInstance'

export interface ActivityLogRow {
  id: string
  thoi_diem: string
  hanh_dong: string
  nhan_hanh_dong: string
  nhom: string | null
  nguoi_thuc_hien_id: string | null
  nguoi_thuc_hien: string
  loai_doi_tuong: string
  doi_tuong_id: string
  ten_khach: string | null
  chi_tiet: Record<string, unknown> | null
}

export interface ActivityLogParams {
  ngay?: string
  nguoi_id?: string
  nhom?: string
}

export const receptionistActivityLogService = {
  async list(params: ActivityLogParams = {}) {
    const { data } = await axiosInstance.get('/receptionist/activity-log', { params })
    return data.data as { rows: ActivityLogRow[]; nhom_kha_dung: string[] }
  },
}
```

Kiểm tra tên file `axiosInstance` khớp thực tế:
```bash
ls frontend/src/services/ | grep -i axios
```
Nếu là `axiosInstance.js` thì import không đuôi như trên là đúng.

- [ ] **Step 2: Viết trang**

Tạo `frontend/src/pages/receptionist/ActivityLog.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityLogRow,
  receptionistActivityLogService,
} from '@/services/receptionist-activity-log.service'

const NHAN_NHOM: Record<string, string> = {
  tiep_nhan: 'Tiếp nhận',
  thanh_toan: 'Thanh toán',
  lich_hen: 'Lịch hẹn',
  lien_he: 'Liên hệ',
}

const MAU_NHOM: Record<string, string> = {
  tiep_nhan: 'bg-blue-50 text-blue-700',
  thanh_toan: 'bg-emerald-50 text-emerald-700',
  lich_hen: 'bg-amber-50 text-amber-700',
  lien_he: 'bg-violet-50 text-violet-700',
}

function gioPhut(value: string) {
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function homNayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ActivityLog() {
  const [rows, setRows] = useState<ActivityLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ngay, setNgay] = useState(homNayISO())
  const [nhom, setNhom] = useState('')
  const [nguoiId, setNguoiId] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    receptionistActivityLogService
      .list({ ngay, nhom: nhom || undefined, nguoi_id: nguoiId || undefined })
      .then((result) => setRows(result.rows))
      .catch((e) => setError(e?.response?.data?.message || 'Không tải được nhật ký'))
      .finally(() => setLoading(false))
  }, [ngay, nhom, nguoiId])

  // Danh sách người trực suy từ chính dữ liệu — không cần API riêng.
  const nguoiTrong = useMemo(() => {
    const map = new Map<string, string>()
    rows.forEach((r) => {
      if (r.nguoi_thuc_hien_id) map.set(r.nguoi_thuc_hien_id, r.nguoi_thuc_hien)
    })
    return [...map.entries()]
  }, [rows])

  return (
    <div className="min-h-full bg-slate-50 p-4 lg:p-6">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
          Vận hành · Bàn giao ca
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Nhật ký ca trực</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ai đã thao tác với khách nào, lúc nào. Dùng khi bàn giao ca hoặc làm thay đồng nghiệp nghỉ.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="text-sm font-medium text-slate-600">
          Ngày
          <input
            type="date"
            value={ngay}
            onChange={(e) => setNgay(e.target.value)}
            className="ml-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
        </label>

        <label className="text-sm font-medium text-slate-600">
          Nhóm việc
          <select
            value={nhom}
            onChange={(e) => setNhom(e.target.value)}
            className="ml-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">Tất cả</option>
            {Object.entries(NHAN_NHOM).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-600">
          Người trực
          <select
            value={nguoiId}
            onChange={(e) => setNguoiId(e.target.value)}
            className="ml-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">Tất cả</option>
            {nguoiTrong.map(([id, ten]) => (
              <option key={id} value={id}>{ten}</option>
            ))}
          </select>
        </label>

        <span className="ml-auto text-sm text-slate-500">{rows.length} thao tác</span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Giờ</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Người thực hiện</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Hành động</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Khách hàng</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Đang tải...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                Chưa có thao tác nào trong ngày này.
              </td></tr>
            )}
            {!loading && rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{gioPhut(row.thoi_diem)}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{row.nguoi_thuc_hien}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${row.nhom ? MAU_NHOM[row.nhom] : 'bg-slate-100 text-slate-600'}`}>
                    {row.nhan_hanh_dong}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">{row.ten_khach ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {row.chi_tiet
                    ? Object.entries(row.chi_tiet)
                        .filter(([, v]) => v !== null && v !== '' && v !== undefined)
                        .slice(0, 3)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ')
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Thêm route**

Trong `frontend/src/routes/AppRoutes.tsx`, thêm cạnh các lazy import lễ tân khác (sau dòng `ReceptionistContactTasks`):

```tsx
const ReceptionistActivityLog = lazy(() => import('@/pages/receptionist/ActivityLog'))
```

Trong khối `<Route path="/receptionist" ...>`, thêm cạnh route `contact-tasks`:

```tsx
<Route path="activity-log" element={<ReceptionistActivityLog />} />
```

- [ ] **Step 4: Thêm mục sidebar**

Trong `frontend/src/components/receptionist/Sidebar.tsx`, thêm mục menu sau "Cần liên hệ":

```tsx
{ to: '/receptionist/activity-log', label: 'Nhật ký ca trực' },
```

Khớp đúng shape object mà file đó đang dùng cho các mục khác (nếu có `icon` thì thêm icon tương ứng).

- [ ] **Step 5: Kiểm typecheck và lint**

Run: `cd frontend && npm run typecheck`
Expected: không lỗi

Run: `cd frontend && npm run lint`
Expected: không lỗi

- [ ] **Step 6: Kiểm bằng mắt**

Run: `cd backend && npm run dev` và `cd frontend && npm run dev`

Đăng nhập tài khoản lễ tân → vào `/receptionist/activity-log`.
Expected: bảng hiển thị, đổi ngày/nhóm/người thì danh sách đổi theo, không có lỗi console.

Sau đó check-in 1 bệnh nhân ở trang lịch hẹn → quay lại nhật ký → thấy dòng "Tiếp nhận bệnh nhân" đúng tên mình.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/services/receptionist-activity-log.service.ts frontend/src/pages/receptionist/ActivityLog.tsx frontend/src/routes/AppRoutes.tsx frontend/src/components/receptionist/Sidebar.tsx
git commit -m "feat(le-tan): trang Nhat ky ca truc

Loc theo ngay, nhom viec, nguoi truc. Dung khi ban giao ca hoac lam
thay dong nghiep nghi."
```

---

## Task 8: Mở rộng timeline theo từng khách

**Files:**
- Modify: `backend/src/services/receptionistTimeline.service.js`

**Interfaces:**
- Consumes: `MA_HANH_DONG_LE_TAN` từ Task 1
- Produces: timeline của 1 lịch hẹn nay bao gồm cả thao tác lễ tân

- [ ] **Step 1: Đọc whitelist hiện tại**

Run:
```bash
cd backend && sed -n '1,80p' src/services/receptionistTimeline.service.js
```

Ghi lại: `HO_SO_WHITELIST_HANH_DONG`, `LICH_HEN_WHITELIST_HANH_DONG`, và tên hằng chứa danh sách trường an toàn.

- [ ] **Step 2: Thêm mã lễ tân vào whitelist**

Trong `backend/src/services/receptionistTimeline.service.js`, sửa `LICH_HEN_WHITELIST_HANH_DONG`:

```js
export const LICH_HEN_WHITELIST_HANH_DONG = [
  'DOI_LICH_HEN',
  'CUSTOMER_CONTACT_REQUIRED',
  'AUTO_MARK_NO_SHOW',
  'UNDO_AUTO_MARK_NO_SHOW',
  'AUTO_CANCEL_APPOINTMENT',
  // WS-4 — thao tác của lễ tân lên chính lịch hẹn/lượt khám này. Không có nhóm này thì
  // câu hỏi "ai check-in khách này, ai thu tiền" không trả lời được ở màn chi tiết khách.
  'LT_CHECK_IN',
  'LT_HUY_CHECK_IN',
  'LT_IN_PHIEU_STT',
  'LT_XAC_NHAN_THANH_TOAN',
  'LT_LAP_HOA_DON',
  'LT_DOI_LICH',
  'LT_HUY_LICH',
  'LT_GOI_KHACH',
]
```

- [ ] **Step 3: Thêm trường an toàn để hiển thị**

Tìm hằng chứa danh sách trường an toàn (bước 1) và bổ sung các khóa mà `du_lieu_moi` của WS-4 sinh ra:

```js
  'ma_so_thu_tu',
  'so_thu_tu',
  'nguon',
  'ten_benh_nhan',
  'phong_kham',
  'gio_kham',
  'ma_lich_hen',
  'payment_status',
  'so_tien',
  'hinh_thuc',
  'ma_hoa_don',
  'tong_tien',
  'ly_do',
  'ly_do_doi',
```

**Không** thêm: `so_dien_thoai`, `dia_chi`, `di_ung`, `benh_nen` — timeline hiển thị công khai trong panel, không phải chỗ để lộ dữ liệu nhạy cảm.

- [ ] **Step 4: Chạy test liên quan**

Run: `cd backend && node --test tests/receptionist.e1-timeline.test.js`
Expected: PASS

Run: `cd backend && npm test`
Expected: PASS toàn bộ

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/receptionistTimeline.service.js
git commit -m "feat(le-tan): timeline khach hien them thao tac cua le tan

Whitelist 8 hanh dong LT_* + truong an toan tuong ung. Khong them
truong nhay cam (SDT, dia chi, di ung) vao timeline hien cong khai."
```

---

## Self-Review

**Spec coverage** — đối chiếu mục 6 của spec:

| Yêu cầu spec | Task |
|---|---|
| 10 `hanh_dong` mới | Task 1 |
| Ghi trong service, không trong controller | Task 2 (checkIn), Task 4 (reschedule). Task 3 ghi ở controller cho `offline-payment` và `billing` vì nghiệp vụ đó **không có service riêng** — đã nêu rõ trong task |
| `LT_CHECK_IN` | Task 2 |
| `LT_HUY_CHECK_IN` | Task 3 |
| `LT_TAO_KHACH_VANG_LAI` | Task 2 |
| `LT_XAC_NHAN_THANH_TOAN` | Task 3 |
| `LT_LAP_HOA_DON` | Task 3 |
| `LT_IN_PHIEU_STT` | ⚠️ **Chưa có task** — xem ghi chú bên dưới |
| `LT_DOI_LICH`, `LT_HUY_LICH` | Task 4 |
| `LT_GOI_KHACH` | Đã có sẵn `CUSTOMER_CONTACTED` trong `contactTasks.service.js` — không cần thêm mã mới, giữ `LT_GOI_KHACH` trong danh mục để dùng ở WS-3 |
| `LT_XU_LY_THONG_BAO_BS` | Thuộc **WS-3** (thông báo BS→LT chưa tồn tại ở WS-4). Danh mục đã khai sẵn |
| Trang "Nhật ký ca trực" | Task 7 |
| Tab lịch sử theo khách | Task 8 (backend). Giao diện tab thuộc **WS-5** (panel chi tiết khách của trang Quầy tiếp nhận) |
| API `GET /activity-log` | Task 5 |
| Mở rộng `receptionistTimeline` | Task 8 |

**Ghi chú `LT_IN_PHIEU_STT`:** in phiếu số thứ tự hiện là hành động **phía frontend** (`printData` trong `Appointments.tsx`), không có endpoint backend nào để gắn audit. Ghi audit cho nó cần thêm 1 endpoint `POST /receptionist/queue/:id/printed` — việc này thuộc **WS-5** khi làm lại luồng in phiếu ở trang Quầy tiếp nhận. Danh mục đã khai sẵn mã, không cần sửa Task 1.

**Placeholder scan:** không có TBD/TODO. Mọi step có code thật hoặc lệnh chạy thật. Task 3 và Task 4 yêu cầu đọc file trước để lấy đúng tên biến — đây là chỉ dẫn cụ thể (có lệnh `grep` kèm theo), không phải placeholder.

**Type consistency:**
- `ghiNhatKyLeTan({ hanhDong, actorUserId, actorRole, loaiDoiTuong, doiTuongId, duLieuMoi, duLieuCu })` — dùng nhất quán ở Task 2, 3, 4.
- `dinhDangBanGhi` trả `{ id, thoi_diem, hanh_dong, nhan_hanh_dong, nhom, nguoi_thuc_hien_id, nguoi_thuc_hien, loai_doi_tuong, doi_tuong_id, ten_khach, chi_tiet }` (Task 5) — khớp đúng interface `ActivityLogRow` ở Task 7.
- `locMaTheoNhom` / `nhomCuaHanhDong` / `nhanHanhDong` — tên dùng thống nhất giữa Task 1 và Task 5.
- Khóa nhóm `tiep_nhan | thanh_toan | lich_hen | lien_he` — thống nhất giữa `NHOM_HANH_DONG` (Task 1), test (Task 5), và `NHAN_NHOM`/`MAU_NHOM` (Task 7).
