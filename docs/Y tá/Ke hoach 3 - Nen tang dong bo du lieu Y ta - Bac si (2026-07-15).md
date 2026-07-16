# Kế hoạch 3 — Nền tảng đồng bộ dữ liệu Y tá ↔ Bác sĩ

> **Cho người thực thi:** Thực thi tuần tự từng Task, mỗi Task chạy verification xong mới sang Task sau.
> Nguồn thiết kế: `Audit - Dong bo du lieu Y ta voi Bac si va Frontend cu (2026-07-15).md` (cùng thư mục).
> Đây là **kế hoạch nền tảng** — không đụng UI y tá (đó là Kế hoạch 4), không đụng các bản đồ trạng
> thái cục bộ ở trang bác sĩ/admin/khách hàng ngoài phạm vi bắt buộc để giữ `tsc --noEmit` xanh
> (dedup toàn diện là Kế hoạch 5).

**Mục tiêu:** Vá 3 lỗ hổng backend khiến dữ liệu lệch giữa trang Y tá và Bác sĩ sau khi Kế hoạch 2
đưa `LichHen.status` qua các trạng thái mới (`in_progress` qua hàng đợi, `waiting_record`), đồng thời
gộp `AppointmentStatus`/nhãn/màu trạng thái frontend về một nguồn (`types/index.ts` +
`utils/constants.ts`) và thêm type + service layer cho 9 endpoint `/nurse/room-status` (2) +
`/nurse/queue` (7) (hiện chưa có consumer nào ở frontend).

**Kiến trúc:** Backend: sửa trực tiếp 3 controller đã có (không tạo model/route mới). Frontend: mở
rộng nguồn dữ liệu dùng chung đã tồn tại (`types/index.ts`, `utils/constants.ts`,
`services/nurse.service.ts`) — không tạo trang mới.

**Tech Stack:** Node.js ESM · Express 4 · Mongoose 8 · `node:test` (backend) — React 18 + TypeScript
+ Vite, verify bằng `npm run typecheck` (không có test runner frontend trong repo).

## Ràng buộc toàn cục

- **KHÔNG tự `git commit`** — nhóm tự làm, chỉ để lệnh gợi ý trong plan.
- Field/tên hàm tiếng Việt snake_case khớp field đã có. Không đổi tên field.
- Test backend dùng dữ liệu THẬT đã seed từ phiên trước: bác sĩ `6a4fba7e001249319b047cae`
  (`doctor.test@vitafamily.local` / `Test123456`), y tá **Điều dưỡng Thanh Hà**
  (`nurse@vitafamily.vn` / `123456`), lịch hẹn hôm nay `TEST_TODAY_APT_01` (08:00) và
  `TEST_TODAY_APT_03` (09:00, seed gốc ở trạng thái `in_progress`).
- Test **tự dọn** — mọi thay đổi trên `LichHen`/`HangDoi`/`TrangThaiPhongKham`/`KetQuaKham` phải
  được trả về trạng thái ban đầu ở `after()`, cho phép chạy lại nhiều lần (quy ước đã dùng ở
  `nurse-queue-room.test.js`, `doctor.schedule.test.js`).
- Không sửa `HangDoi`/`TrangThaiPhongKham`/`queue.controller.js`/`room-status.controller.js` —
  đã đúng theo Kế hoạch 2, ngoài phạm vi kế hoạch này.
- Việc mở rộng `AppointmentStatus` ở Task 5 **bắt buộc kèm** Task 7 (vá 3 file
  `Record<AppointmentStatus, ...>` bị strict-typed) trong cùng đợt — nếu không `npm run typecheck`
  sẽ đỏ ngay lập tức. Task 7 chỉ thêm đúng 3 key còn thiếu theo màu đã dùng sẵn trong từng file
  (không đổi màu các key cũ, không thay bằng import từ constants — đó là việc của Kế hoạch 5).

---

## Cấu trúc file

| File | Thay đổi |
|---|---|
| `backend/src/controllers/nurse/dashboard.controller.js` | Sửa — thêm `waiting_record` vào 2 bộ lọc |
| `backend/src/controllers/doctor/appointments.controller.js` | Sửa — mở rộng status hợp lệ cho `complete()`, `createResult()` |
| `backend/src/controllers/doctor/stats.controller.js` | Sửa — `getTodayOverview()` trả đúng `y_ta_ho_tro`, sửa `cho_kham` |
| `backend/tests/nurse-doctor-status-sync.test.js` | Tạo mới — integration test cho cả 3 sửa trên |
| `frontend/src/types/index.ts` | Sửa — mở rộng `AppointmentStatus`, thêm 6 interface mới cho room-status/queue |
| `frontend/src/utils/constants.ts` | Sửa — thêm 2 key vào `APPOINTMENT_STATUS_LABEL`/`COLOR`, thêm `KET_QUA_KHAM_STATUS_LABEL` |
| `frontend/src/pages/doctor/DoctorDashboard.tsx` | Sửa — thêm 3 key vào `STATUS_COLOR` cục bộ (giữ compile xanh) |
| `frontend/src/pages/admin/ManageAppointments/AppointmentList.tsx` | Sửa — thêm 3 key vào `STATUS_COLOR` cục bộ |
| `frontend/src/pages/admin/ManageAppointments/DoctorAppointmentGroupList.tsx` | Sửa — thêm 3 key vào `STATUS_COLOR` cục bộ |
| `frontend/src/services/nurse.service.ts` | Sửa — thêm 9 hàm gọi `/nurse/room-status` + `/nurse/queue` |

---

## Task 1: Backend — vá `nurse/dashboard.controller.js`

**Files:**
- Modify: `backend/src/controllers/nurse/dashboard.controller.js:47-49,59-61`

**Interfaces:**
- Không đổi signature `getDashboard(req, res)` — chỉ đổi logic lọc bên trong.

- [ ] **Step 1: Sửa `cho_nhap_ho_so` và `hang_doi_gan_nhat`**

Thay khối dòng 41-61:

```js
    // Chờ nhập hồ sơ: đã khám xong (confirmed/completed) nhưng CHƯA có KetQuaKham
    // waiting_record = y tá vừa kết thúc khám qua hàng đợi động (Kế hoạch 2, queue.controller.js
    // finish()) — PHẢI có ở đây, nếu không widget "chờ nhập hồ sơ" bỏ sót đúng lúc y tá cần nó nhất.
    const apptIdsToday = apptsToday.map((a) => a._id)
    const recordedApptIds = new Set(
      (await KetQuaKham.find({ appointment_id: { $in: apptIdsToday } }).select('appointment_id').lean())
        .map((r) => String(r.appointment_id)),
    )
    const cho_nhap_ho_so = apptsToday.filter((a) =>
      ['confirmed', 'completed', 'waiting_record'].includes(a.status) && !recordedApptIds.has(String(a._id)),
    ).length
```

Thay dòng lọc `queueSample` (dòng gốc 59-61):

```js
    // Danh sách gần nhất trong hàng đợi hôm nay (tối đa 5, sắp theo giờ hẹn — xem ghi chú giới
    // hạn "chưa có checkin_time thật" trong nurse/appointments.controller.js).
    // waiting_record thêm vào vì đây chính xác là việc y tá cần làm tiếp — không thêm 'skipped'
    // vào preview này vì đã là trạng thái kết thúc, không phải việc "gần nhất cần chú ý".
    const queueSample = apptsToday
      .filter((a) => ['confirmed', 'checked_in', 'in_progress', 'waiting_record', 'waiting_doctor_confirm'].includes(a.status))
      .sort((a, b) => a.gio_kham.localeCompare(b.gio_kham))
      .slice(0, 5)
```

- [ ] **Step 2: Kiểm tra cú pháp**

```
cd backend && node --check src/controllers/nurse/dashboard.controller.js
```
Mong đợi: không in gì (cú pháp hợp lệ).

- [ ] **Step 3: Checkpoint commit (nhóm tự làm)**
```
git add backend/src/controllers/nurse/dashboard.controller.js
git commit -m "fix(nurse): dashboard tinh dung cho_nhap_ho_so va hang_doi_gan_nhat voi waiting_record"
```

---

## Task 2: Backend — vá `doctor/appointments.controller.js`

**Files:**
- Modify: `backend/src/controllers/doctor/appointments.controller.js:178-180,223-225`

- [ ] **Step 1: Mở rộng `complete()` cho phép cả `in_progress`/`waiting_record`**

Thay dòng 178-180:

```js
    // Cho phép complete() từ 'in_progress'/'waiting_record' — 2 trạng thái này giờ đạt được qua
    // hàng đợi động của y tá (Kế hoạch 2: queue.controller.js intoRoom()/finish()), KHÔNG chỉ qua
    // luồng xác nhận cũ ('confirmed'). Bác sĩ vẫn có thể tự đánh dấu hoàn thành bất kể y tá đã
    // nhập hồ sơ hay chưa (giữ nguyên hành vi "không bắt buộc đã nhập kết quả" đã có từ trước).
    if (!['confirmed', 'in_progress', 'waiting_record'].includes(a.status)) {
      return fail(res, 409, 'Chỉ đánh dấu hoàn thành cho lịch hẹn đã xác nhận, đang khám, hoặc đang chờ nhập hồ sơ')
    }
```

- [ ] **Step 2: Mở rộng `createResult()` cùng lý do**

Thay dòng 223-225:

```js
    // Cho phép cả 'completed' — bác sĩ có thể đã bấm "Hoàn thành" (complete()) trước
    // khi nhập kết quả khám, xem comment tại complete() ở trên.
    // Cho phép cả 'in_progress'/'waiting_record' — bác sĩ có thể tự nhập kết quả trực tiếp (bỏ
    // qua luồng nháp của y tá) ngay sau khi bệnh nhân đã vào phòng qua hàng đợi động (Kế hoạch 2).
    if (!['confirmed', 'in_progress', 'waiting_record', 'completed'].includes(a.status)) {
      return fail(res, 409, 'Chỉ nhập kết quả khi lịch hẹn đã xác nhận, đang khám, chờ nhập hồ sơ, hoặc đã hoàn thành')
    }
```

- [ ] **Step 3: Kiểm tra cú pháp**

```
cd backend && node --check src/controllers/doctor/appointments.controller.js
```
Mong đợi: không in gì.

- [ ] **Step 4: Checkpoint commit (nhóm tự làm)**
```
git add backend/src/controllers/doctor/appointments.controller.js
git commit -m "fix(doctor): complete/createResult chap nhan in_progress va waiting_record tu hang doi y ta"
```

---

## Task 3: Backend — vá `doctor/stats.controller.js`

**Files:**
- Modify: `backend/src/controllers/doctor/stats.controller.js:86-116`

- [ ] **Step 1: Populate `nurse_id` trên truy vấn lịch làm việc**

Thay dòng 86-93:

```js
    const [schedule, appointments] = await Promise.all([
      LichLamViec.findOne({ doctor_id: doc._id, ngay: { $gte: todayStart, $lt: todayEnd } })
        .populate('nurse_id', 'ho_ten')
        .lean(),
      LichHen.find({ doctor_id: doc._id, ngay_kham: { $gte: todayStart, $lt: todayEnd } })
        .sort({ gio_kham: 1 })
        .populate('user_id', 'ho_ten')
        .populate('member_id', 'ho_ten')
        .lean(),
    ])
```

- [ ] **Step 2: Trả đúng `y_ta_ho_tro`, sửa `cho_kham`**

Thay dòng 107-116:

```js
    return ok(res, {
      ho_ten: doc.user_id?.ho_ten ?? '',
      chuyen_khoa: (doc.specialties ?? []).map((s) => s.ten).join(', ') || 'Chưa rõ',
      ca_lam_viec,
      phong_kham,
      // Module gán y tá cho ca làm việc đã có từ Kế hoạch 1 (LichLamViec.nurse_id) — trước đây
      // hardcode null vì module chưa tồn tại, giờ trả đúng dữ liệu thật.
      y_ta_ho_tro: schedule?.nurse_id ? { id: schedule.nurse_id._id, ho_ten: schedule.nurse_id.ho_ten } : null,
      tong_lich_hen: appointments.length,
      // checked_in cũng là "chờ khám" — khớp cách đếm dang_cho_kham bên nurse/dashboard.controller.js
      cho_kham: appointments.filter((a) => ['confirmed', 'checked_in'].includes(a.status)).length,
      dang_kham: appointments.filter((a) => a.status === 'in_progress').length,
      hoan_thanh: appointments.filter((a) => a.status === 'completed').length,
      lich_hen_gan_nhat: appointments
        .filter((a) => a.status !== 'cancelled')
        .slice(0, 5)
        .map((a) => ({
          id: a._id,
          gio_kham: a.gio_kham,
          benh_nhan: a.member_id?.ho_ten ?? a.ten_khach ?? a.user_id?.ho_ten ?? 'Không rõ',
          ten_dich_vu: a.ten_dich_vu ?? null,
          status: a.status,
        })),
    })
```

Xóa dòng comment cũ ở đầu hàm (dòng 71-72) `// y_ta_ho_tro luôn null — hệ thống chưa có module gán
y tá cho ca làm việc...` — không còn đúng.

- [ ] **Step 3: Kiểm tra cú pháp**

```
cd backend && node --check src/controllers/doctor/stats.controller.js
```
Mong đợi: không in gì.

- [ ] **Step 4: Checkpoint commit (nhóm tự làm)**
```
git add backend/src/controllers/doctor/stats.controller.js
git commit -m "fix(doctor): getTodayOverview tra dung y_ta_ho_tro va tinh cho_kham gom ca checked_in"
```

---

## Task 4: Backend — integration test cho Task 1–3

**Files:**
- Create: `backend/tests/nurse-doctor-status-sync.test.js`

**Interfaces:**
- Consumes: `POST /nurse/queue/checkin`, `PATCH /nurse/queue/:id/into-room`, `PATCH /nurse/queue/:id/finish`
  (Kế hoạch 2, không đổi), `GET /nurse/dashboard`, `PATCH /doctor/appointments/:id/complete`,
  `POST /doctor/appointments/:id/result`, `GET /doctor/stats/today`.

- [ ] **Step 1: Viết file test**

```js
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config()

import { LichHen, HangDoi, TrangThaiPhongKham, KetQuaKham } from '../src/models/index.js'

// ============================================================
// INTEGRATION TEST — Đồng bộ dữ liệu Y tá <-> Bác sĩ (Kế hoạch 3)
// Yêu cầu: backend chạy tại BASE_URL, dùng y tá thật (nurse@vitafamily.vn/123456) và bác sĩ thật
//          (doctor.test@vitafamily.local/Test123456), lịch hẹn TEST_TODAY_APT_01 (08:00) +
//          TEST_TODAY_APT_03 (09:00, seed gốc ở trạng thái in_progress) hôm nay cho bác sĩ
//          6a4fba7e001249319b047cae.
// Test TỰ DỌN — cho phép chạy lại nhiều lần (giống nurse-queue-room.test.js).
// ============================================================

const BASE_URL = process.env.TEST_API_BASE_URL || 'http://localhost:5000/api'
const NURSE_EMAIL = 'nurse@vitafamily.vn'
const NURSE_PASSWORD = '123456'
const DOCTOR_EMAIL = 'doctor.test@vitafamily.local'
const DOCTOR_PASSWORD = 'Test123456'
const DOCTOR_ID = '6a4fba7e001249319b047cae'

let nurseToken
let doctorToken
let apt01Id
let apt03Id
let queueEntryId

async function api(path, { method = 'GET', body, auth } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, body: json }
}

before(async () => {
  await mongoose.connect(process.env.MONGODB_URI)

  const apt01 = await LichHen.findOne({ ma_lich_hen: 'TEST_TODAY_APT_01' })
  assert.ok(apt01, 'Không tìm thấy TEST_TODAY_APT_01 — kiểm tra dữ liệu seed hôm nay')
  apt01Id = String(apt01._id)
  await HangDoi.deleteMany({ appointment_id: apt01._id })
  await KetQuaKham.deleteMany({ appointment_id: apt01._id })
  apt01.status = 'confirmed'
  apt01.gio_den_thuc_te = null
  apt01.trang_thai_den = null
  await apt01.save()

  const apt03 = await LichHen.findOne({ ma_lich_hen: 'TEST_TODAY_APT_03' })
  assert.ok(apt03, 'Không tìm thấy TEST_TODAY_APT_03 — kiểm tra dữ liệu seed hôm nay')
  apt03Id = String(apt03._id)
  await KetQuaKham.deleteMany({ appointment_id: apt03._id })
  apt03.status = 'in_progress'
  await apt03.save()

  await TrangThaiPhongKham.updateOne(
    { doctor_id: DOCTOR_ID },
    { $set: { trang_thai: 'san_sang', benh_nhan_hien_tai_id: null } },
  )

  const nurseLogin = await api('/auth/login', { method: 'POST', body: { email: NURSE_EMAIL, mat_khau: NURSE_PASSWORD } })
  assert.equal(nurseLogin.status, 200, 'Đăng nhập y tá thất bại')
  nurseToken = nurseLogin.body.data.token

  const doctorLogin = await api('/auth/login', { method: 'POST', body: { email: DOCTOR_EMAIL, mat_khau: DOCTOR_PASSWORD } })
  assert.equal(doctorLogin.status, 200, 'Đăng nhập bác sĩ thất bại')
  doctorToken = doctorLogin.body.data.token
})

after(async () => {
  const apt01 = await LichHen.findOne({ ma_lich_hen: 'TEST_TODAY_APT_01' })
  if (apt01) {
    await HangDoi.deleteMany({ appointment_id: apt01._id })
    await KetQuaKham.deleteMany({ appointment_id: apt01._id })
    apt01.status = 'confirmed'
    apt01.gio_den_thuc_te = null
    apt01.trang_thai_den = null
    await apt01.save()
  }
  const apt03 = await LichHen.findOne({ ma_lich_hen: 'TEST_TODAY_APT_03' })
  if (apt03) {
    await KetQuaKham.deleteMany({ appointment_id: apt03._id })
    apt03.status = 'in_progress'
    await apt03.save()
  }
  await TrangThaiPhongKham.updateOne(
    { doctor_id: DOCTOR_ID },
    { $set: { trang_thai: 'san_sang', benh_nhan_hien_tai_id: null } },
  )
  await mongoose.disconnect()
})

test('Luồng hàng đợi y tá đưa APT_01 sang waiting_record', async () => {
  const checkin = await api('/nurse/queue/checkin', { method: 'POST', auth: nurseToken, body: { appointment_id: apt01Id } })
  assert.equal(checkin.status, 201, JSON.stringify(checkin.body))
  queueEntryId = checkin.body.data.entry._id ?? checkin.body.data.entry.id

  const into = await api(`/nurse/queue/${queueEntryId}/into-room`, { method: 'PATCH', auth: nurseToken })
  assert.equal(into.status, 200, JSON.stringify(into.body))

  const finish = await api(`/nurse/queue/${queueEntryId}/finish`, { method: 'PATCH', auth: nurseToken })
  assert.equal(finish.status, 200, JSON.stringify(finish.body))

  const detail = await api(`/nurse/appointments/${apt01Id}`, { auth: nurseToken })
  assert.equal(detail.status, 200)
  assert.equal(detail.body.data.status, 'waiting_record')
})

test('GET /nurse/dashboard thấy APT_01 trong hang_doi_gan_nhat và tính vào cho_nhap_ho_so', async () => {
  const res = await api('/nurse/dashboard', { auth: nurseToken })
  assert.equal(res.status, 200)
  const inQueue = res.body.data.hang_doi_gan_nhat.some((q) => String(q.id) === apt01Id)
  assert.ok(inQueue, 'APT_01 (waiting_record) phải xuất hiện trong hang_doi_gan_nhat')
  assert.ok(res.body.data.cho_nhap_ho_so >= 1, 'cho_nhap_ho_so phải tính APT_01')
})

test('PATCH /doctor/appointments/:id/complete chấp nhận waiting_record (đến từ hàng đợi y tá)', async () => {
  const res = await api(`/doctor/appointments/${apt01Id}/complete`, { method: 'PATCH', auth: doctorToken })
  assert.equal(res.status, 200, JSON.stringify(res.body))
  assert.equal(res.body.data.status, 'completed')
})

test('POST /doctor/appointments/:id/result chấp nhận in_progress (bác sĩ tự nhập, bỏ qua y tá)', async () => {
  const res = await api(`/doctor/appointments/${apt03Id}/result`, {
    method: 'POST', auth: doctorToken,
    body: { chan_doan: 'TEST_SYNC Chẩn đoán bác sĩ tự nhập khi lịch đang in_progress' },
  })
  assert.equal(res.status, 201, JSON.stringify(res.body))
  assert.equal(res.body.data.status, 'da_xac_nhan')
})

test('GET /doctor/stats/today trả đúng y_ta_ho_tro (không còn null)', async () => {
  const res = await api('/doctor/stats/today', { auth: doctorToken })
  assert.equal(res.status, 200)
  assert.ok(res.body.data.y_ta_ho_tro, 'y_ta_ho_tro không được null — module gán y tá đã có dữ liệu')
  assert.equal(res.body.data.y_ta_ho_tro.ho_ten, 'Điều dưỡng Thanh Hà')
  assert.equal(typeof res.body.data.cho_kham, 'number')
})
```

- [ ] **Step 2: Chạy test**

```
cd backend && node --test tests/nurse-doctor-status-sync.test.js
```
Mong đợi: `# pass 5`, `# fail 0`.

- [ ] **Step 3: Chạy lại lần 2 liên tiếp để xác nhận tự dọn đúng**

```
cd backend && node --test tests/nurse-doctor-status-sync.test.js
```
Mong đợi: vẫn `# pass 5`, `# fail 0` (không phụ thuộc trạng thái để lại từ lần chạy trước).

- [ ] **Step 4: Hồi quy toàn bộ backend**

> Cần `--test-concurrency=1` — `nurse-queue-room.test.js` và file test mới ở Task này cùng thao
> tác `TEST_TODAY_APT_01`, chạy song song (mặc định của `node --test` khi truyền nhiều file) sẽ
> đua nhau ghi DB thật và fail ngẫu nhiên.

```
cd backend && node --test --test-concurrency=1 tests/nurse-db.models.test.js tests/nurse-queue-room.test.js tests/nurse-doctor-status-sync.test.js tests/doctor.schedule.test.js tests/doctor.api.test.js
```
Mong đợi: toàn bộ pass, `# fail 0`.

- [ ] **Step 5: Không cần checkpoint commit**

`backend/tests/` nằm trong `.gitignore` toàn dự án (dòng `tests`, "chỉ trên máy local") — file test
mới KHÔNG track được bằng `git add`, đây là quy ước sẵn có của repo (xác nhận qua
`git check-ignore -v`), không phải lỗi. Không có gì để commit ở bước này.

---

## Task 5: Frontend — mở rộng `types/index.ts`

**Files:**
- Modify: `frontend/src/types/index.ts:7-14` (mở rộng union)
- Modify: `frontend/src/types/index.ts` (thêm interface mới, cuối file sau `NurseMedicalRecordDraftPayload`)

**Interfaces:**
- Produces: `AppointmentStatus` (10 giá trị), `NurseRoomStatus`, `NurseQueueEntry`,
  `NurseQueueCheckinPayload`, `NurseQueueCheckinEntry`, `NurseQueueCheckinResult`,
  `NurseQueueActionResult` — dùng ở Task 8 (`nurse.service.ts`) và Kế hoạch 4 (UI).

- [ ] **Step 1: Mở rộng `AppointmentStatus`**

Thay dòng 7-14:

```ts
export type AppointmentStatus =
    | "pending"
    | "confirmed"
    | "checked_in"
    | "in_progress"
    | "waiting_record"
    | "waiting_doctor_confirm"
    | "completed"
    | "cancelled"
    | "no_show"
    | "skipped";
```

- [ ] **Step 2: Thêm type cho hàng đợi động + trạng thái phòng**

Thêm vào cuối file, sau `NurseMedicalRecordDraftPayload` (dòng 1141):

```ts

// ============================================================
// Hàng đợi động + Trạng thái phòng (Kế hoạch 2) — khớp response
// backend/src/controllers/nurse/{room-status,queue}.controller.js
// ============================================================

export type PhongKhamTrangThai = "san_sang" | "tam_nghi" | "dang_don_phong" | "dang_kham";

// GET /nurse/room-status — 1 dòng / bác sĩ y tá phụ trách hôm nay
export interface NurseRoomStatus {
    doctor_id: string;
    ten_bac_si: string | null;
    chuyen_khoa: string | null;
    phong_kham: string | null;
    trang_thai: PhongKhamTrangThai;
    benh_nhan_hien_tai_id: string | null;
    y_ta_co_mat: boolean;
    thoi_gian_kham_tb_phut: number;
    thoi_diem_doi: string | null;
}

export type HangDoiMucUuTien = "online_uu_tien" | "online_thuong" | "offline";
export type HangDoiTrangThai = "dang_cho" | "da_goi" | "trong_phong" | "skipped" | "cancelled" | "hoan_thanh";

// GET /nurse/queue — 1 dòng trong hàng đợi động (khác NurseQueueItem — đó là /nurse/appointments cũ)
export interface NurseQueueEntry {
    id: string;
    nguon: "online" | "offline";
    ten_benh_nhan: string;
    tuoi: number | null;
    gioi_tinh: "nam" | "nu" | "khac" | null;
    doctor_id: string;
    phong_kham: string | null;
    muc_uu_tien: HangDoiMucUuTien;
    trang_thai: HangDoiTrangThai;
    checkin_time: string;
    so_lan_goi: number;
    thoi_gian_cho_uoc_tinh_phut: number | null;
}

// POST /nurse/queue/checkin — body: online cần appointment_id, offline cần ten_benh_nhan + so_dien_thoai
export interface NurseQueueCheckinPayload {
    appointment_id?: string;
    doctor_id?: string;
    ten_benh_nhan?: string;
    so_dien_thoai?: string;
    tuoi?: number;
    gioi_tinh?: "nam" | "nu" | "khac";
    specialty_id?: string;
}

// entry trả về từ checkin() là doc Mongoose thô (_id, không phải id như list())
export interface NurseQueueCheckinEntry {
    _id: string;
    nguon: "online" | "offline";
    appointment_id?: string | null;
    ten_benh_nhan: string;
    so_dien_thoai: string | null;
    tuoi: number | null;
    gioi_tinh: "nam" | "nu" | "khac" | null;
    doctor_id: string;
    phong_kham: string | null;
    muc_uu_tien: HangDoiMucUuTien;
    trang_thai: HangDoiTrangThai;
    checkin_time: string;
    so_lan_goi: number;
}

export interface NurseQueueCheckinResult {
    entry: NurseQueueCheckinEntry;
    canh_bao_qua_tai: string | null;
}

// PATCH /nurse/queue/:id/{call,into-room,finish,skip,cancel}
export interface NurseQueueActionResult {
    id: string;
    trang_thai: HangDoiTrangThai;
    so_lan_goi?: number;
}
```

- [ ] **Step 3: Typecheck**

```
cd frontend && npm run typecheck
```
Mong đợi: **LỖI** — các file `Record<AppointmentStatus, ...>` ở Task 7 chưa được vá. Đây là kết quả
đúng dự kiến ở bước này (xác nhận widening union đã surface đúng chỗ cần sửa) — tiếp tục Task 6-7
rồi mới chạy lại.

- [ ] **Step 4: Checkpoint commit (nhóm tự làm)**
```
git add frontend/src/types/index.ts
git commit -m "feat(types): mo rong AppointmentStatus va them type cho hang doi dong + trang thai phong"
```

---

## Task 6: Frontend — bổ sung `utils/constants.ts`

**Files:**
- Modify: `frontend/src/utils/constants.ts:47-56,62-71` (thêm key)
- Modify: `frontend/src/utils/constants.ts` (thêm `KET_QUA_KHAM_STATUS_LABEL` sau `KET_QUA_KHAM_STATUS_COLOR`, dòng 147)

- [ ] **Step 1: Thêm `waiting_record`/`skipped` vào label + màu**

Thay dòng 47-56:

```ts
export const APPOINTMENT_STATUS_LABEL: Record<string, string> = {
    pending: "Chờ xác nhận",
    confirmed: "Đã xác nhận",
    checked_in: "Đã check-in",
    in_progress: "Đang khám",
    waiting_record: "Chờ nhập hồ sơ",
    waiting_doctor_confirm: "Chờ bác sĩ xác nhận hồ sơ",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
    no_show: "Không đến",
    skipped: "Bỏ lượt",
};
```

Thay dòng 62-71:

```ts
export const APPOINTMENT_STATUS_COLOR: Record<string, BadgeColor> = {
    pending: "yellow",
    confirmed: "blue",
    checked_in: "blue",
    in_progress: "yellow",
    waiting_record: "yellow",
    waiting_doctor_confirm: "yellow",
    completed: "green",
    cancelled: "red",
    no_show: "red",
    skipped: "red",
};
```

- [ ] **Step 2: Thêm nhãn hồ sơ khám dùng chung (đang lặp lại ở 3 file)**

Thêm ngay sau `KET_QUA_KHAM_STATUS_COLOR` (dòng 147):

```ts

// Nhãn trạng thái hồ sơ khám (KetQuaKhamStatus) — nguồn duy nhất, khớp KET_QUA_STATUS_LABEL
// đang lặp lại độc lập ở NurseAppointmentDetail.tsx/DoctorAppointments.tsx/DoctorPendingRecords.tsx
// (chưa thay các nơi đó — đó là việc của Kế hoạch 5, ở đây chỉ tạo nguồn dùng chung).
export const KET_QUA_KHAM_STATUS_LABEL: Record<string, string> = {
    ban_nhap: "Nháp",
    cho_xac_nhan: "Chờ bác sĩ xác nhận",
    da_xac_nhan: "Đã xác nhận",
    yeu_cau_chinh_sua: "Cần chỉnh sửa",
};
```

- [ ] **Step 3: Checkpoint commit (nhóm tự làm)**
```
git add frontend/src/utils/constants.ts
git commit -m "feat(constants): bo sung waiting_record/skipped va nguon nhan ho so kham dung chung"
```

---

## Task 7: Frontend — vá 3 bản đồ `Record<AppointmentStatus, ...>` để giữ typecheck xanh

**Files:**
- Modify: `frontend/src/pages/doctor/DoctorDashboard.tsx:14-17`
- Modify: `frontend/src/pages/admin/ManageAppointments/AppointmentList.tsx:9-17`
- Modify: `frontend/src/pages/admin/ManageAppointments/DoctorAppointmentGroupList.tsx:9-17`

> Chỉ thêm đúng 3 key còn thiếu (`waiting_record`, `waiting_doctor_confirm`, `skipped`), giữ nguyên
> màu các key cũ và phong cách màu riêng của từng file — KHÔNG thay bằng import
> `APPOINTMENT_STATUS_COLOR` (đó là việc dedup toàn diện của Kế hoạch 5).

- [ ] **Step 1: `DoctorDashboard.tsx`**

Thay dòng 14-17:

```tsx
const STATUS_COLOR: Record<AppointmentStatus, 'yellow' | 'blue' | 'green' | 'red'> = {
  pending: 'yellow', confirmed: 'blue', checked_in: 'blue', in_progress: 'yellow',
  waiting_record: 'yellow', waiting_doctor_confirm: 'yellow',
  completed: 'green', cancelled: 'red', no_show: 'red', skipped: 'red',
}
```

- [ ] **Step 2: `AppointmentList.tsx`**

Thay dòng 9-17:

```tsx
const STATUS_COLOR: Record<AppointmentStatus, 'yellow' | 'blue' | 'green' | 'red' | 'gray'> = {
  pending: 'yellow',
  confirmed: 'blue',
  checked_in: 'blue',
  in_progress: 'green',
  waiting_record: 'yellow',
  waiting_doctor_confirm: 'yellow',
  completed: 'green',
  cancelled: 'red',
  no_show: 'gray',
  skipped: 'gray',
}
```

- [ ] **Step 3: `DoctorAppointmentGroupList.tsx`**

Thay dòng 9-17 (cùng nội dung với Step 2 — 2 file có cùng bản đồ trước khi vá):

```tsx
const STATUS_COLOR: Record<AppointmentStatus, 'yellow' | 'blue' | 'green' | 'red' | 'gray'> = {
  pending: 'yellow',
  confirmed: 'blue',
  checked_in: 'blue',
  in_progress: 'green',
  waiting_record: 'yellow',
  waiting_doctor_confirm: 'yellow',
  completed: 'green',
  cancelled: 'red',
  no_show: 'gray',
  skipped: 'gray',
}
```

- [ ] **Step 4: Typecheck lại — lần này phải xanh**

```
cd frontend && npm run typecheck
```
Mong đợi: không còn lỗi liên quan `AppointmentStatus`/`STATUS_COLOR`. Nếu còn lỗi khác không liên
quan tới thay đổi của kế hoạch này, dừng lại và báo cáo (không tự sửa ngoài phạm vi).

- [ ] **Step 5: Checkpoint commit (nhóm tự làm)**
```
git add frontend/src/pages/doctor/DoctorDashboard.tsx frontend/src/pages/admin/ManageAppointments/AppointmentList.tsx frontend/src/pages/admin/ManageAppointments/DoctorAppointmentGroupList.tsx
git commit -m "fix(frontend): bo sung 3 trang thai moi vao cac ban do STATUS_COLOR strict-typed"
```

---

## Task 8: Frontend — service layer cho `/nurse/room-status` + `/nurse/queue`

**Files:**
- Modify: `frontend/src/services/nurse.service.ts`

**Interfaces:**
- Consumes: types từ Task 5 (`NurseRoomStatus`, `NurseQueueEntry`, `NurseQueueCheckinPayload`,
  `NurseQueueCheckinResult`, `NurseQueueActionResult`, `HangDoiTrangThai`, `PhongKhamTrangThai`).
- Produces: 9 hàm mới trong `nurseService` — dùng ở Kế hoạch 4 (UI hàng đợi/phòng khám).

- [ ] **Step 1: Thêm import**

Thay dòng 2-11:

```ts
import type {
  ApiResponse,
  NurseDashboard,
  NurseQueueItem,
  NurseAppointmentDetail,
  NurseMedicalRecord,
  NurseRevisionItem,
  NurseMedicalRecordDraftPayload,
  AppointmentStatus,
  NurseRoomStatus,
  PhongKhamTrangThai,
  NurseQueueEntry,
  HangDoiTrangThai,
  NurseQueueCheckinPayload,
  NurseQueueCheckinResult,
  NurseQueueActionResult,
} from '@/types'
```

- [ ] **Step 2: Thêm 9 hàm mới**

Thêm vào cuối object `nurseService`, ngay trước dấu `}` đóng (sau `getRevisions`, dòng 52-55):

```ts

  // ─── Trạng thái phòng (Kế hoạch 2) ─────────────────────────────────────────
  async getRoomStatus(): Promise<NurseRoomStatus[]> {
    const res = await axiosInstance.get<ApiResponse<NurseRoomStatus[]>>('/nurse/room-status')
    return res.data.data
  },

  async updateRoomStatus(doctorId: string, trangThai: Exclude<PhongKhamTrangThai, 'dang_kham'>): Promise<{ doctor_id: string; trang_thai: string }> {
    const res = await axiosInstance.patch<ApiResponse<{ doctor_id: string; trang_thai: string }>>(
      `/nurse/room-status/${doctorId}`,
      { trang_thai: trangThai },
    )
    return res.data.data
  },

  // ─── Hàng đợi động (Kế hoạch 2) ─────────────────────────────────────────────
  async getQueueEntries(status?: HangDoiTrangThai): Promise<NurseQueueEntry[]> {
    const query: Record<string, string> = {}
    if (status) query.status = status
    const res = await axiosInstance.get<ApiResponse<NurseQueueEntry[]>>('/nurse/queue', { params: query })
    return res.data.data
  },

  async checkinQueue(payload: NurseQueueCheckinPayload): Promise<NurseQueueCheckinResult> {
    const res = await axiosInstance.post<ApiResponse<NurseQueueCheckinResult>>('/nurse/queue/checkin', payload)
    return res.data.data
  },

  async callQueuePatient(id: string): Promise<NurseQueueActionResult> {
    const res = await axiosInstance.patch<ApiResponse<NurseQueueActionResult>>(`/nurse/queue/${id}/call`)
    return res.data.data
  },

  async intoRoomQueue(id: string): Promise<NurseQueueActionResult> {
    const res = await axiosInstance.patch<ApiResponse<NurseQueueActionResult>>(`/nurse/queue/${id}/into-room`)
    return res.data.data
  },

  async finishQueue(id: string): Promise<NurseQueueActionResult> {
    const res = await axiosInstance.patch<ApiResponse<NurseQueueActionResult>>(`/nurse/queue/${id}/finish`)
    return res.data.data
  },

  async skipQueue(id: string): Promise<NurseQueueActionResult> {
    const res = await axiosInstance.patch<ApiResponse<NurseQueueActionResult>>(`/nurse/queue/${id}/skip`)
    return res.data.data
  },

  async cancelQueue(id: string): Promise<NurseQueueActionResult> {
    const res = await axiosInstance.patch<ApiResponse<NurseQueueActionResult>>(`/nurse/queue/${id}/cancel`)
    return res.data.data
  },
```

- [ ] **Step 3: Typecheck**

```
cd frontend && npm run typecheck
```
Mong đợi: xanh (0 lỗi).

- [ ] **Step 4: Lint**

```
cd frontend && npm run lint
```
Mong đợi: xanh (0 lỗi/0 warning trên các file vừa sửa).

- [ ] **Step 5: Checkpoint commit (nhóm tự làm)**
```
git add frontend/src/services/nurse.service.ts
git commit -m "feat(nurse): them service layer cho 7 endpoint trang thai phong va hang doi dong"
```

---

## Task 9: Hồi quy toàn bộ

- [ ] **Step 1: Backend — chạy toàn bộ test suite liên quan**

> **Lưu ý phát hiện ở Task 4:** `node --test` (Node 22) chạy nhiều file cùng lúc mặc định —
> `nurse-queue-room.test.js` và `nurse-doctor-status-sync.test.js` cùng thao tác trên
> `TEST_TODAY_APT_01` nên chạy song song sẽ đua nhau ghi DB thật, gây fail ngẫu nhiên. Bắt buộc
> thêm `--test-concurrency=1`.

```
cd backend && node --test --test-concurrency=1 tests/nurse-db.models.test.js tests/nurse-queue-room.test.js tests/nurse-doctor-status-sync.test.js tests/doctor.schedule.test.js tests/doctor.api.test.js
```
Mong đợi: toàn bộ pass, `# fail 0`.

- [ ] **Step 2: Frontend — typecheck + lint toàn repo**

> **Lưu ý phát hiện ở Task 6:** repo có sẵn 108 lỗi typecheck KHÔNG liên quan tới Kế hoạch 3
> (76 lỗi `Duplicate identifier` trong `src/types/index.ts` dòng ~237-312, 32 lỗi trong
> `src/mock/doctor-appointments.ts`) — xác nhận qua `git diff` không nằm trong bất kỳ thay đổi
> nào của kế hoạch này, có từ trước phiên làm việc. `npm run typecheck` sẽ KHÔNG thoát mã 0 dù
> Kế hoạch 3 làm đúng 100% — đây là nợ kỹ thuật có sẵn, ngoài phạm vi, không tự sửa ở đây.

```
cd frontend && npm run typecheck 2>&1 | grep "error TS" | sed -E 's/\(.*$//' | sort -u
```
Mong đợi: chỉ còn danh sách file lỗi đã biết trước Kế hoạch 3 (`src/types/index.ts`,
`src/mock/doctor-appointments.ts`) — **không** còn `DoctorDashboard.tsx`, `AppointmentList.tsx`,
`DoctorAppointmentGroupList.tsx` trong danh sách (đã vá ở Task 7), và không xuất hiện file mới nào
khác ngoài 2 file nợ kỹ thuật kể trên.

```
cd frontend && npm run lint
```
Mong đợi: thoát mã 0 trên các file Kế hoạch 3 đã sửa (lint không bị ảnh hưởng bởi nợ kỹ thuật
typecheck ở trên).

- [ ] **Step 3: Dọn dẹp**

Xác nhận không còn script tạm nào trong `backend/scripts/` hay file `_tmp-*` sót lại từ quá trình
thực thi kế hoạch này.

- [ ] **Step 4: Báo cáo hoàn tất**

Tổng hợp: 3 bug backend đã vá + test xác nhận, `AppointmentStatus`/nhãn/màu đã có 1 nguồn đúng đủ 10
giá trị, service layer cho 9 endpoint Kế hoạch 2 đã sẵn sàng cho Kế hoạch 4 (UI hàng đợi/phòng khám).
Đề xuất bước tiếp theo: Kế hoạch 4.
