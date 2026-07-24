# Xóa hoàn toàn role Nurse — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xóa hoàn toàn role `nurse` khỏi hệ thống (DB, API, UI, business logic), chuyển check-in
sang Lễ tân và các thao tác vận hành hàng đợi (gọi/vào phòng/kết thúc) sang Bác sĩ, gỡ luồng
"bác sĩ xác nhận / yêu cầu chỉnh sửa" (chỉ tồn tại để phục vụ hồ sơ do y tá nhập).

**Architecture:** Backend Express + Mongoose, frontend React + Vite + TS + Tailwind. Di dời logic
từ `backend/src/{routes,controllers}/nurse/*` sang `receptionist`/`doctor` tương ứng, xóa hẳn
namespace `nurse`. Migration script riêng chạy trực tiếp lên MongoDB Cloud (DATN_VITAFAMILY).

**Tech Stack:** Node.js/Express/Mongoose (backend), React/TS/Tailwind/axios (frontend), Mongo
`node --test` (backend không có test suite hiện tại — xác minh bằng khởi động server + gọi thử
API thủ công thay vì TDD, vì codebase chưa có test infra cho controller).

## Global Constraints

- Comment tiếng Việt cho logic phức tạp (theo CLAUDE.md).
- Async/await + try/catch trong mọi controller, không viết logic trong route (theo CLAUDE.md).
- Response format chuẩn `{ success, message, data }` qua `utils/response.js` (`ok/created/fail`).
- Trường dữ liệu tiếng Việt khớp DB hiện có — không đổi tên field đang dùng trừ khi spec yêu cầu.
- KHÔNG đụng nghiệp vụ Ca→Khung giờ→Slot, quota online/walk-in, ưu tiên hàng đợi
  (`.claude/rules/lich-lam-viec-bac-si.md` mục 1–8) — chỉ đổi ai gọi API, không đổi thuật toán.
- Spec đầy đủ: `docs/Y tá/Thiet ke - Xoa hoan toan role Nurse khoi he thong (2026-07-24).md`.

---

### Task 1: Room-status service dùng chung (thay `nurse/room-status.controller.js`)

**Files:**
- Create: `backend/src/services/roomStatus.service.js`
- Modify: `backend/src/models/TrangThaiPhongKham.js`

**Interfaces:**
- Produces: `findOrCreateRoomStatus(doctorId)` → Promise<TrangThaiPhongKham document>. Dùng bởi
  Task 3 (doctor queue controller).

- [ ] **Step 1: Sửa model `TrangThaiPhongKham` — bỏ field liên quan nurse**

Mở `backend/src/models/TrangThaiPhongKham.js`. Thay toàn bộ nội dung bằng:

```javascript
import mongoose from 'mongoose'

// ============================================================
// TRANG THAI PHONG KHAM (DoctorRoomStatus) — trạng thái phòng/bác sĩ realtime
// 1 bản ghi / bác sĩ / ngày. Bác sĩ tự điều khiển trạng thái phòng của chính mình
// qua các hành động trong hàng đợi khám (call/into-room/finish) — không còn vai trò
// y tá trung gian (2026-07-24, xem docs/Y tá/Thiet ke - Xoa hoan toan role Nurse).
// Ràng buộc flow (enforce ở controller, KHÔNG ở schema):
//   dang_kham → dang_don_phong → san_sang ⇄ tam_nghi
//   - không cho dang_kham → san_sang trực tiếp
//   - không cho tam_nghi khi benh_nhan_hien_tai_id != null
// ============================================================

const roomStatusSchema = new mongoose.Schema(
  {
    doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BacSi', required: true },
    ngay: { type: Date, required: true },
    schedule_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LichLamViec', default: null },
    phong_kham: { type: String, default: null },
    trang_thai: {
      type: String,
      enum: ['dang_kham', 'dang_don_phong', 'san_sang', 'tam_nghi'],
      default: 'san_sang',
    },
    benh_nhan_hien_tai_id: { type: mongoose.Schema.Types.ObjectId, ref: 'HangDoi', default: null },
    thoi_diem_doi: { type: Date, default: Date.now },
    thoi_gian_kham_tb_phut: { type: Number, default: 20, min: 0 },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'trang_thai_phong_kham',
  }
)

roomStatusSchema.index({ doctor_id: 1, ngay: 1 }, { unique: true })
roomStatusSchema.index({ ngay: 1, trang_thai: 1 })

export default mongoose.model('TrangThaiPhongKham', roomStatusSchema)
```

Field bỏ so với bản cũ: `nurse_id`, `nguoi_dieu_khien_id`, `nguoi_dieu_khien_vai_tro`,
`y_ta_co_mat` (toàn bộ đều gắn với khái niệm "y tá dự phòng" không còn tồn tại).

- [ ] **Step 2: Tạo service dùng chung**

Tạo `backend/src/services/roomStatus.service.js`:

```javascript
import { TrangThaiPhongKham, LichLamViec, BacSi } from '../models/index.js'

// ============================================================
// Tạo lười (lazy upsert) bản ghi trạng thái phòng cho 1 bác sĩ/ngày — dùng chung cho
// doctor/queue.controller.js (into-room/finish) và doctor/room-status.controller.js.
// ============================================================

function todayStart() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return start
}

export async function findOrCreateRoomStatus(doctorId) {
  const start = todayStart()
  let room = await TrangThaiPhongKham.findOne({ doctor_id: doctorId, ngay: start })
  if (room) return room

  const schedule = await LichLamViec.findOne({ doctor_id: doctorId, ngay: start })
  const bacSi = await BacSi.findOne({ _id: doctorId }).select('phong_kham_mac_dinh').lean()
  const phongKham = schedule?.slots?.[0]?.phong_kham ?? bacSi?.phong_kham_mac_dinh ?? null

  room = await TrangThaiPhongKham.create({
    doctor_id: doctorId,
    ngay: start,
    schedule_id: schedule?._id ?? null,
    phong_kham: phongKham,
  })
  return room
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/roomStatus.service.js backend/src/models/TrangThaiPhongKham.js
git commit -m "refactor: tach findOrCreateRoomStatus thanh service dung chung, bo field nurse"
```

---

### Task 2: Module hàng đợi cho Lễ tân (checkin + list)

**Files:**
- Create: `backend/src/controllers/receptionist/queue.controller.js`
- Create: `backend/src/routes/receptionist/queue.routes.js`
- Modify: `backend/src/routes/receptionist/index.js`

**Interfaces:**
- Consumes: `HangDoi`, `LichHen`, `LichLamViec`, `ThanhVien` models (`models/index.js`);
  `tinhMucUuTien` từ `models/HangDoi.js`; `emitDashboardAppointmentChanged` từ
  `realtime/socket.js`; `ok/created/fail` từ `utils/response.js`.
- Produces: `POST /api/receptionist/queue/checkin`, `GET /api/receptionist/queue`.

- [ ] **Step 1: Viết controller**

Tạo `backend/src/controllers/receptionist/queue.controller.js`:

```javascript
import mongoose from 'mongoose'
import { HangDoi, LichHen, LichLamViec, ThanhVien } from '../../models/index.js'
import { tinhMucUuTien } from '../../models/HangDoi.js'
import { ok, created, fail } from '../../utils/response.js'
import { emitDashboardAppointmentChanged } from '../../realtime/socket.js'

// ============================================================
// Hàng đợi động (Lễ tân) — Routes: /api/receptionist/queue
// Lễ tân nhận check-in online (theo LichHen đã đặt) và tạo lượt cho khách vãng lai
// (offline). Sau khi check-in, bác sĩ tự vận hành hàng đợi của mình (gọi/vào phòng/
// kết thúc — xem doctor/queue.controller.js). Thay cho nurse/queue.controller.js
// (2026-07-24, xem docs/Y tá/Thiet ke - Xoa hoan toan role Nurse).
// ============================================================

const UU_TIEN_WEIGHT = { online_uu_tien: 0, online_thuong: 1, offline: 2 }
const CON_HIEN_DIEN = ['dang_cho', 'da_goi']

function todayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

async function getDoctorIdsWorkingToday() {
  const { start, end } = todayRange()
  const ids = await LichLamViec.find({ ngay: { $gte: start, $lt: end } }).distinct('doctor_id')
  return ids.map(String)
}

function buildGioHenGoc(ngayKham, gioKham) {
  if (!gioKham) return null
  const [h, m] = gioKham.split(':').map(Number)
  const d = new Date(ngayKham)
  d.setHours(h, m, 0, 0)
  return d
}

function sapXepHangDoi(list) {
  return [...list].sort((a, b) => {
    const w = UU_TIEN_WEIGHT[a.muc_uu_tien] - UU_TIEN_WEIGHT[b.muc_uu_tien]
    if (w !== 0) return w
    return new Date(a.checkin_time) - new Date(b.checkin_time)
  })
}

// ─── POST /api/receptionist/queue/checkin ────────────────────────────────────
export async function checkin(req, res) {
  try {
    const { appointment_id, doctor_id, ten_benh_nhan, so_dien_thoai, tuoi, gioi_tinh, specialty_id } = req.body
    const doctorIds = await getDoctorIdsWorkingToday()
    const { start: todayStart, end: todayEnd } = todayRange()
    const now = new Date()

    let payload
    let appt = null
    let apptOldStatus = null

    if (appointment_id) {
      // ── Online: bám theo LichHen đã đặt trước ──────────────────────────
      appt = await LichHen.findById(appointment_id)
      if (!appt) return fail(res, 404, 'Không tìm thấy lịch hẹn')
      if (!doctorIds.includes(String(appt.doctor_id))) {
        return fail(res, 403, 'Bác sĩ của lịch hẹn này không có ca làm hôm nay')
      }
      if (appt.ngay_kham < todayStart || appt.ngay_kham >= todayEnd) {
        return fail(res, 409, 'Lịch hẹn không phải của hôm nay')
      }
      if (['cancelled', 'no_show', 'completed', 'skipped'].includes(appt.status)) {
        return fail(res, 409, `Không thể check-in lịch hẹn đang ở trạng thái ${appt.status}`)
      }
      const exists = await HangDoi.findOne({ appointment_id: appt._id })
      if (exists) return fail(res, 409, 'Lịch hẹn này đã có trong hàng đợi')

      const member = appt.member_id ? await ThanhVien.findById(appt.member_id).select('ho_ten ngay_sinh gioi_tinh').lean() : null
      const gioHenGoc = buildGioHenGoc(appt.ngay_kham, appt.gio_kham)
      const mucUuTien = tinhMucUuTien('online', now, gioHenGoc)

      payload = {
        nguon: 'online',
        appointment_id: appt._id,
        member_id: appt.member_id ?? null,
        ten_benh_nhan: member?.ho_ten ?? appt.ten_khach ?? 'Không rõ',
        so_dien_thoai: appt.so_dien_thoai_khach ?? null,
        tuoi: member?.ngay_sinh ? new Date().getFullYear() - new Date(member.ngay_sinh).getFullYear() : null,
        gioi_tinh: member?.gioi_tinh ?? null,
        specialty_id: appt.specialty_id,
        doctor_id: appt.doctor_id,
        phong_kham: appt.phong_kham,
        muc_uu_tien: mucUuTien,
        gio_hen_goc: gioHenGoc,
        checkin_time: now,
        nguoi_tiep_nhan_id: req.user.id,
        vai_tro_tiep_nhan: 'receptionist',
      }

      apptOldStatus = appt.status
      appt.gio_den_thuc_te = now
      appt.trang_thai_den = 'da_den'
      if (appt.status === 'pending') appt.status = 'confirmed'
    } else {
      // ── Offline: khách vãng lai / đến trực tiếp ────────────────────────
      if (!doctor_id || !doctorIds.includes(String(doctor_id))) {
        return fail(res, 403, 'Bác sĩ này không có ca làm hôm nay')
      }
      if (!ten_benh_nhan?.trim() || !so_dien_thoai?.trim()) {
        return fail(res, 400, 'Offline bắt buộc có ten_benh_nhan và so_dien_thoai')
      }
      const schedule = await LichLamViec.findOne({ doctor_id, ngay: todayStart }).lean()
      const phongKham = schedule?.slots?.[0]?.phong_kham ?? null
      const resolvedSpecialtyId = specialty_id ?? schedule?.slots?.[0]?.specialty_id ?? null
      if (!resolvedSpecialtyId) return fail(res, 400, 'Không xác định được chuyên khoa cho lịch offline')

      payload = {
        nguon: 'offline',
        ten_benh_nhan: ten_benh_nhan.trim(),
        so_dien_thoai: so_dien_thoai.trim(),
        tuoi: tuoi ?? null,
        gioi_tinh: gioi_tinh ?? null,
        specialty_id: resolvedSpecialtyId,
        doctor_id,
        phong_kham: phongKham,
        muc_uu_tien: tinhMucUuTien('offline', now, null),
        gio_hen_goc: null,
        checkin_time: now,
        nguoi_tiep_nhan_id: req.user.id,
        vai_tro_tiep_nhan: 'receptionist',
      }
    }

    // Online: LichHen + HangDoi.create phải NGUYÊN TỬ (rollback cả hai nếu 1 bước lỗi).
    let entry
    if (appt) {
      const session = await mongoose.startSession()
      try {
        await session.withTransaction(async () => {
          await appt.save({ session })
          const [e] = await HangDoi.create([payload], { session })
          entry = e
        })
      } finally {
        await session.endSession()
      }
    } else {
      entry = await HangDoi.create(payload)
    }

    if (appt) emitDashboardAppointmentChanged(apptOldStatus, appt.status)

    return created(res, { entry }, 'Đã check-in vào hàng đợi')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/receptionist/queue?status= ─────────────────────────────────────
// Toàn bộ hàng đợi hôm nay, mọi bác sĩ có lịch làm — lễ tân cần thấy tổng quan cả phòng khám.
export async function list(req, res) {
  try {
    const { start, end } = todayRange()
    const { status } = req.query
    const filter = { checkin_time: { $gte: start, $lt: end } }
    if (status) filter.trang_thai = status

    const entries = await HangDoi.find(filter).lean()
    const sorted = sapXepHangDoi(entries)

    const data = sorted.map((e) => ({
      id: e._id,
      nguon: e.nguon,
      ten_benh_nhan: e.ten_benh_nhan,
      tuoi: e.tuoi,
      gioi_tinh: e.gioi_tinh,
      doctor_id: e.doctor_id,
      phong_kham: e.phong_kham,
      muc_uu_tien: e.muc_uu_tien,
      trang_thai: e.trang_thai,
      checkin_time: e.checkin_time,
      so_lan_goi: e.so_lan_goi,
    }))
    return ok(res, data)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
```

- [ ] **Step 2: Viết route**

Tạo `backend/src/routes/receptionist/queue.routes.js`:

```javascript
import { Router } from 'express'
import * as queue from '../../controllers/receptionist/queue.controller.js'

const router = Router()

router.get('/', queue.list)
router.post('/checkin', queue.checkin)

export default router
```

- [ ] **Step 3: Mount route**

Trong `backend/src/routes/receptionist/index.js`, thêm import và mount:

```javascript
import { Router } from 'express'
import appointmentRoutes from './appointment.routes.js'
import paymentRoutes from './payment.routes.js'
import bookingRoutes from './booking.routes.js'
import queueRoutes from './queue.routes.js'

import notificationRoutes from './notification.routes.js'

import userRoutes from './user.routes.js'

const router = Router()

// Bọc middleware kiểm tra quyền lễ tân tại đây sau (ví dụ: role === 'admin' || role === 'receptionist')
router.use('/appointments', appointmentRoutes)
router.use('/payments', paymentRoutes)
router.use('/booking', bookingRoutes)
router.use('/queue', queueRoutes)
router.use('/notifications', notificationRoutes)
router.use('/users', userRoutes)

export default router
```

- [ ] **Step 4: Khởi động backend, gọi thử API thủ công**

Run: `cd backend && npm run dev` (để chạy nền), sau đó dùng token receptionist thật (đăng nhập
qua `/api/auth/login`) gọi:
```
GET /api/receptionist/queue
```
Expected: HTTP 200, `{ success: true, data: [] }` (hoặc danh sách nếu đã có check-in hôm nay).
Dừng server sau khi xác minh xong (Ctrl+C hoặc kill background job).

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/receptionist/queue.controller.js backend/src/routes/receptionist/queue.routes.js backend/src/routes/receptionist/index.js
git commit -m "feat: chuyen check-in hang doi sang le tan (thay nurse/queue.controller checkin+list)"
```

---

### Task 3: Module hàng đợi cho Bác sĩ (call/into-room/finish/skip/cancel)

**Files:**
- Create: `backend/src/controllers/doctor/queue.controller.js`
- Modify: `backend/src/routes/doctor/index.js`

**Interfaces:**
- Consumes: `findOrCreateRoomStatus(doctorId)` từ Task 1 (`services/roomStatus.service.js`);
  `getDocId(userId)` — copy logic từ `doctor/appointments.controller.js:14-17` (không import
  chéo controller, viết lại tại chỗ, đúng pattern hiện có của các controller doctor khác).
- Produces: `PATCH /api/doctor/queue/:id/call`, `.../into-room`, `.../finish`, `.../skip`,
  `.../cancel`.

- [ ] **Step 1: Viết controller**

Tạo `backend/src/controllers/doctor/queue.controller.js`:

```javascript
import mongoose from 'mongoose'
import { HangDoi, LichHen, BacSi, NhatKyThaoTac, ThongBao, NguoiDung } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'
import { findOrCreateRoomStatus } from '../../services/roomStatus.service.js'
import { emitDashboardAppointmentChanged } from '../../realtime/socket.js'

// ============================================================
// Hàng đợi động (Bác sĩ) — Routes: /api/doctor/queue/:id/{call,into-room,finish,skip,cancel}
// Bác sĩ tự vận hành hàng đợi của chính mình (gọi bệnh nhân, cho vào phòng, kết thúc
// khám). Check-in do Lễ tân thực hiện (receptionist/queue.controller.js) — bác sĩ chỉ
// thấy và xử lý hàng đợi ĐÃ check-in (thay nurse/queue.controller.js, 2026-07-24).
// ============================================================

const CON_HIEN_DIEN = ['dang_cho', 'da_goi']

async function getDocId(userId) {
  const d = await BacSi.findOne({ user_id: userId }).select('_id').lean()
  return d?._id ?? null
}

async function updateAppointmentStatus(appointmentId, nextStatus) {
  const appointment = await LichHen.findById(appointmentId).select('status')
  if (!appointment) return
  const oldStatus = appointment.status
  appointment.status = nextStatus
  await appointment.save()
  emitDashboardAppointmentChanged(oldStatus, nextStatus)
}

async function ghiAuditQueue(userId, hanhDong, entryId, duLieuCu, duLieuMoi) {
  await NhatKyThaoTac.create({
    nguoi_thuc_hien_id: userId,
    vai_tro: 'doctor',
    hanh_dong: hanhDong,
    loai_doi_tuong: 'queue_entry',
    doi_tuong_id: entryId,
    du_lieu_cu: duLieuCu,
    du_lieu_moi: duLieuMoi,
  })
}

// Chỉ cho thao tác trên hàng đợi của CHÍNH bác sĩ đang đăng nhập.
async function timEntryCuaBacSi(entryId, docId) {
  const entry = await HangDoi.findById(entryId)
  if (!entry) return { entry: null, error: [404, 'Không tìm thấy hàng đợi'] }
  if (String(entry.doctor_id) !== String(docId)) {
    return { entry: null, error: [403, 'Hàng đợi này không thuộc bác sĩ đang đăng nhập'] }
  }
  return { entry, error: null }
}

// ─── PATCH /api/doctor/queue/:id/call ─────────────────────────────────────────
export async function call(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')
    const { entry, error } = await timEntryCuaBacSi(req.params.id, docId)
    if (error) return fail(res, ...error)
    if (!CON_HIEN_DIEN.includes(entry.trang_thai)) {
      return fail(res, 409, 'Chỉ gọi được bệnh nhân đang chờ hoặc đã gọi trước đó')
    }

    const tu = entry.trang_thai
    entry.trang_thai = 'da_goi'
    entry.so_lan_goi += 1
    entry.thoi_diem_goi = new Date()
    await entry.save()

    await ghiAuditQueue(req.user.id, 'CALL_PATIENT', entry._id, { trang_thai: tu }, { trang_thai: 'da_goi', so_lan_goi: entry.so_lan_goi })

    const reception = await NguoiDung.findOne({ role: 'receptionist' }).select('_id').lean()
    if (reception) {
      const room = await findOrCreateRoomStatus(docId)
      await ThongBao.create({
        user_id: reception._id,
        tieu_de: 'Gọi bệnh nhân vào phòng',
        noi_dung: `${entry.ten_benh_nhan} — Phòng ${room.phong_kham ?? '?'} — mời dẫn bệnh nhân vào.`,
        loai: 'appointment',
        related_id: entry._id,
        related_type: 'hang_doi',
        ngay_gui_du_kien: new Date(),
      })
    }

    return ok(res, { id: entry._id, trang_thai: entry.trang_thai, so_lan_goi: entry.so_lan_goi }, 'Đã gọi bệnh nhân')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/doctor/queue/:id/into-room ────────────────────────────────────
export async function intoRoom(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')
    const { entry, error } = await timEntryCuaBacSi(req.params.id, docId)
    if (error) return fail(res, ...error)
    if (!CON_HIEN_DIEN.includes(entry.trang_thai)) {
      return fail(res, 409, 'Bệnh nhân phải đang có mặt (chờ hoặc đã gọi) mới vào được phòng')
    }

    const room = await findOrCreateRoomStatus(docId)
    if (room.trang_thai !== 'san_sang') {
      return fail(res, 409, `Phòng chưa sẵn sàng (đang: ${room.trang_thai})`)
    }

    const tuRoom = room.trang_thai
    let apptOldStatus = null
    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        entry.trang_thai = 'trong_phong'
        entry.thoi_diem_vao_phong = new Date()
        await entry.save({ session })

        room.trang_thai = 'dang_kham'
        room.benh_nhan_hien_tai_id = entry._id
        room.thoi_diem_doi = new Date()
        await room.save({ session })

        if (entry.appointment_id) {
          const appt = await LichHen.findById(entry.appointment_id).select('status').session(session)
          if (appt) {
            apptOldStatus = appt.status
            appt.status = 'in_progress'
            await appt.save({ session })
          }
        }
      })
    } finally {
      await session.endSession()
    }
    if (apptOldStatus) emitDashboardAppointmentChanged(apptOldStatus, 'in_progress')

    await ghiAuditQueue(req.user.id, 'CALL_PATIENT', entry._id, { trang_thai: 'da_goi' }, { trang_thai: 'trong_phong' })
    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: req.user.id, vai_tro: 'doctor', hanh_dong: 'CHANGE_DOCTOR_STATUS',
      loai_doi_tuong: 'room_status', doi_tuong_id: docId,
      du_lieu_cu: { trang_thai: tuRoom }, du_lieu_moi: { trang_thai: 'dang_kham' },
    })

    return ok(res, { id: entry._id, trang_thai: entry.trang_thai }, 'Bệnh nhân đã vào phòng')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/doctor/queue/:id/finish ───────────────────────────────────────
// Kết thúc lượt khám trong hàng đợi — KHÔNG còn chuyển LichHen sang 'waiting_record' (status
// đó đã bị gỡ cùng luồng xác nhận/yêu cầu chỉnh sửa của y tá). Bác sĩ tự gọi createResult/
// complete khi sẵn sàng nhập hồ sơ — cả 2 endpoint đó đã chấp nhận status 'in_progress'.
export async function finish(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')
    const { entry, error } = await timEntryCuaBacSi(req.params.id, docId)
    if (error) return fail(res, ...error)
    if (entry.trang_thai !== 'trong_phong') {
      return fail(res, 409, 'Chỉ kết thúc được lịch đang trong phòng')
    }

    const room = await findOrCreateRoomStatus(docId)
    if (String(room.benh_nhan_hien_tai_id) !== String(entry._id)) {
      return fail(res, 409, 'Bệnh nhân này không khớp với người đang trong phòng')
    }

    const tuRoom = room.trang_thai
    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        entry.trang_thai = 'hoan_thanh'
        entry.thoi_diem_ket_thuc = new Date()
        await entry.save({ session })

        room.trang_thai = 'dang_don_phong'
        room.benh_nhan_hien_tai_id = null
        room.thoi_diem_doi = new Date()
        if (entry.thoi_diem_vao_phong) {
          const phutThucTe = Math.max(1, Math.round((entry.thoi_diem_ket_thuc - entry.thoi_diem_vao_phong) / 60000))
          room.thoi_gian_kham_tb_phut = Math.round(0.7 * room.thoi_gian_kham_tb_phut + 0.3 * phutThucTe)
        }
        await room.save({ session })
      })
    } finally {
      await session.endSession()
    }

    await ghiAuditQueue(req.user.id, 'CALL_PATIENT', entry._id, { trang_thai: 'trong_phong' }, { trang_thai: 'hoan_thanh' })
    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: req.user.id, vai_tro: 'doctor', hanh_dong: 'CHANGE_DOCTOR_STATUS',
      loai_doi_tuong: 'room_status', doi_tuong_id: docId,
      du_lieu_cu: { trang_thai: tuRoom }, du_lieu_moi: { trang_thai: 'dang_don_phong' },
    })

    return ok(res, { id: entry._id, trang_thai: entry.trang_thai }, 'Đã kết thúc khám')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/doctor/queue/:id/skip ─────────────────────────────────────────
export async function skip(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')
    const { entry, error } = await timEntryCuaBacSi(req.params.id, docId)
    if (error) return fail(res, ...error)
    if (!CON_HIEN_DIEN.includes(entry.trang_thai)) {
      return fail(res, 409, 'Chỉ bỏ lượt được bệnh nhân đang chờ hoặc đã gọi')
    }

    const tu = entry.trang_thai
    entry.trang_thai = 'skipped'
    await entry.save()

    if (entry.appointment_id) await updateAppointmentStatus(entry.appointment_id, 'skipped')

    await ghiAuditQueue(req.user.id, 'SKIP_PATIENT', entry._id, { trang_thai: tu }, { trang_thai: 'skipped' })

    return ok(res, { id: entry._id, trang_thai: entry.trang_thai }, 'Đã bỏ lượt bệnh nhân')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/doctor/queue/:id/cancel ───────────────────────────────────────
export async function cancel(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')
    const { entry, error } = await timEntryCuaBacSi(req.params.id, docId)
    if (error) return fail(res, ...error)
    if (!CON_HIEN_DIEN.includes(entry.trang_thai)) {
      return fail(res, 409, 'Chỉ hủy được bệnh nhân đang chờ hoặc đã gọi')
    }

    const tu = entry.trang_thai
    entry.trang_thai = 'cancelled'
    await entry.save()

    if (entry.appointment_id) await updateAppointmentStatus(entry.appointment_id, 'cancelled')

    await ghiAuditQueue(req.user.id, 'SKIP_PATIENT', entry._id, { trang_thai: tu }, { trang_thai: 'cancelled' })

    return ok(res, { id: entry._id, trang_thai: entry.trang_thai }, 'Đã hủy lượt khám')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
```

- [ ] **Step 2: Mount route trong `backend/src/routes/doctor/index.js`**

File hiện tại (đọc lại trước khi sửa — đường dẫn `backend/src/routes/doctor/index.js`):
```javascript
import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import profileRoutes      from './profile.routes.js'
import scheduleRoutes     from './schedule.routes.js'
import appointmentRoutes  from './appointments.routes.js'
import statsRoutes        from './stats.routes.js'
import leavesRoutes       from './leaves.routes.js'
import { examQueue }      from '../../controllers/doctor/appointments.controller.js'

const router = Router()
router.use(verifyToken, requireRole('doctor'))

router.get('/queue',         examQueue) // Hồ sơ chờ khám — GET /api/doctor/queue
router.use('/profile',       profileRoutes)
router.use('/schedule',      scheduleRoutes)
router.use('/appointments',  appointmentRoutes)
router.use('/stats',         statsRoutes)
router.use('/leaves',        leavesRoutes)

export default router
```

Sửa thành (thêm import + 5 route PATCH `/queue/:id/...` — đặt SAU `router.get('/queue', ...)`
vì đó là route tĩnh, không đụng path có `:id`):

```javascript
import { Router } from 'express'
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js'
import profileRoutes      from './profile.routes.js'
import scheduleRoutes     from './schedule.routes.js'
import appointmentRoutes  from './appointments.routes.js'
import statsRoutes        from './stats.routes.js'
import leavesRoutes       from './leaves.routes.js'
import { examQueue }      from '../../controllers/doctor/appointments.controller.js'
import * as queue         from '../../controllers/doctor/queue.controller.js'

const router = Router()
router.use(verifyToken, requireRole('doctor'))

router.get('/queue',                 examQueue) // Hồ sơ chờ khám — GET /api/doctor/queue
router.patch('/queue/:id/call',      queue.call)
router.patch('/queue/:id/into-room', queue.intoRoom)
router.patch('/queue/:id/finish',    queue.finish)
router.patch('/queue/:id/skip',      queue.skip)
router.patch('/queue/:id/cancel',    queue.cancel)
router.use('/profile',       profileRoutes)
router.use('/schedule',      scheduleRoutes)
router.use('/appointments',  appointmentRoutes)
router.use('/stats',         statsRoutes)
router.use('/leaves',        leavesRoutes)

export default router
```

- [ ] **Step 3: Khởi động backend, gọi thử API thủ công**

Run: `cd backend && npm run dev`. Với token bác sĩ thật, tạo 1 entry qua
`POST /api/receptionist/queue/checkin` (offline, `ten_benh_nhan`+`so_dien_thoai`+`doctor_id`
hợp lệ) rồi gọi `PATCH /api/doctor/queue/:id/call` với `:id` là `entry._id` vừa tạo.
Expected: HTTP 200, `trang_thai: 'da_goi'`. Dừng server sau khi xác minh.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/doctor/queue.controller.js backend/src/routes/doctor/index.js
git commit -m "feat: chuyen thao tac hang doi (call/into-room/finish/skip/cancel) sang bac si"
```

---

### Task 4: Gỡ luồng "Bác sĩ xác nhận / yêu cầu chỉnh sửa" (backend)

**Files:**
- Modify: `backend/src/controllers/doctor/appointments.controller.js`
- Modify: `backend/src/routes/doctor/appointments.routes.js`
- Modify: `backend/src/models/LichHen.js`
- Modify: `backend/src/models/KetQuaKham.js`

**Interfaces:**
- Produces: `updateResult()` giữ nguyên chữ ký, khóa hẳn khi `status === 'da_xac_nhan'`
  (không còn đường mở khóa qua "yêu cầu chỉnh sửa").

- [ ] **Step 1: Sửa `LichHen.status` enum**

Trong `backend/src/models/LichHen.js`, dòng 47, đổi:
```javascript
      enum: ['pending', 'confirmed', 'checked_in', 'in_progress', 'waiting_record', 'waiting_doctor_confirm', 'completed', 'cancelled', 'no_show', 'skipped'],
```
thành:
```javascript
      enum: ['pending', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show', 'skipped'],
```

Đồng thời sửa comment dòng 8-9 (field `nurse_id`) — xem Task 5 (field này bị xóa hẳn ở đó, không
sửa trùng ở task này).

- [ ] **Step 2: Sửa `KetQuaKham.status` enum + bỏ comment nhắc luồng y tá**

Trong `backend/src/models/KetQuaKham.js`, dòng 67-77, đổi khối comment + enum:
```javascript
    // Luồng xác nhận hồ sơ khám (B4): hồ sơ do Y TÁ nhập luôn bắt đầu 'ban_nhap' → gửi
    // 'cho_xac_nhan' → bác sĩ "Xác nhận hồ sơ" (→ da_xac_nhan) hoặc "Yêu cầu chỉnh sửa"
    // (→ yeu_cau_chinh_sua). Hồ sơ do chính BÁC SĨ tự nhập (createResult, không qua y tá)
    // vào thẳng 'da_xac_nhan' luôn — bác sĩ không cần tự xác nhận lại hồ sơ do chính mình
    // viết (quyết định 2026-07-11, xem docs/Bác sĩ/Kiem tra - Luong nghiep vu Ho so xac
    // nhan hien tai). Default schema 'cho_xac_nhan' chỉ áp dụng khi không truyền status rõ ràng.
    status: {
      type: String,
      enum: ['ban_nhap', 'cho_xac_nhan', 'da_xac_nhan', 'yeu_cau_chinh_sua'],
      default: 'cho_xac_nhan',
    },
```
thành:
```javascript
    // Bác sĩ tự nhập hồ sơ khám (createResult) → thẳng 'da_xac_nhan' ngay, không qua bước
    // xác nhận riêng (2026-07-24: gỡ luồng nhập nháp + xác nhận vốn phục vụ hồ sơ do y tá
    // nhập, xem docs/Y tá/Thiet ke - Xoa hoan toan role Nurse). 'ban_nhap' giữ lại làm trạng
    // thái trung gian nội bộ nếu sau này cần, hiện tại createResult() luôn tạo thẳng 'da_xac_nhan'.
    status: {
      type: String,
      enum: ['ban_nhap', 'da_xac_nhan'],
      default: 'ban_nhap',
    },
```

Cũng sửa dòng 90-93 (bỏ nhắc "y tá"):
```javascript
    // Phần y tá nhập khi tiếp nhận ban đầu (trước khi bác sĩ kết luận) — tách riêng khỏi
    // ghi_chu/huong_dan_dieu_tri (thuộc chuyên môn bác sĩ) để không lẫn 2 vai trò.
    trieu_chung_ban_dau: { type: String, default: null },
    ghi_chu_dieu_duong: { type: String, default: null },
```
thành:
```javascript
    trieu_chung_ban_dau: { type: String, default: null },
    ghi_chu_dieu_duong: { type: String, default: null },
```

Và dòng 31 (`them_boi_y_ta_id` trong `dichVuPhatSinhSchema`):
```javascript
    chi_dinh_boi_bac_si_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BacSi', default: null },
    them_boi_y_ta_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
```
thành (xóa dòng `them_boi_y_ta_id` — không còn actor y tá thêm dịch vụ phát sinh):
```javascript
    chi_dinh_boi_bac_si_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BacSi', default: null },
```

- [ ] **Step 3: Sửa `doctor/appointments.controller.js` — bỏ 3 hàm + sửa guard + khóa `updateResult`**

Mở `backend/src/controllers/doctor/appointments.controller.js`.

3a. Xóa toàn bộ hàm `confirmResult`, `confirmResultByRecord`, `requestRevision` (từ dòng
`// ─── PATCH /api/doctor/appointments/:id/result/confirm ──────────────────────`
tới hết hàm `requestRevision` — bao gồm cả `PATCH /result/:ketQuaId/confirm-by-record`).

3b. Sửa `updateResult()` — bỏ dòng comment/logic tham chiếu "yêu cầu chỉnh sửa (nurse)", khóa
hẳn khi đã `da_xac_nhan` (giữ nguyên hành vi hiện tại — hàm này ĐÃ chặn sửa khi `da_xac_nhan`
ở dòng `if (result.status === 'da_xac_nhan') return fail(...)`, chỉ cần sửa comment):

Tìm đoạn:
```javascript
    // Hồ sơ đã xác nhận là CHỐT — khóa ngay lập tức, không chờ mốc 24h nào cả (trước đây chỉ
    // dựa vào co_the_sua, nhưng field này chưa từng được cron nào set false trong thực tế nên
    // hồ sơ đã xác nhận vẫn sửa được vô thời hạn — xem docs/Bác sĩ/Audit tong the, GAP-001).
    // Muốn sửa hồ sơ đã xác nhận phải qua luồng "yêu cầu chỉnh sửa" (nurse) đã có sẵn.
    if (result.status === 'da_xac_nhan') return fail(res, 403, 'Hồ sơ đã xác nhận, không thể sửa trực tiếp')
```
Thay bằng:
```javascript
    // Hồ sơ đã xác nhận là CHỐT — khóa hẳn, không có đường sửa lại qua API thông thường
    // (2026-07-24: gỡ luồng "yêu cầu chỉnh sửa" vốn chỉ phục vụ hồ sơ do y tá nhập).
    if (result.status === 'da_xac_nhan') return fail(res, 403, 'Hồ sơ đã xác nhận, không thể sửa trực tiếp')
```

Xóa đoạn ngay sau (không còn cần vì trạng thái `yeu_cau_chinh_sua` đã gỡ):
```javascript
    // Sửa xong hồ sơ đang "cần chỉnh sửa" → tự động quay lại "chờ xác nhận" (trước đây không có
    // đường quay lại, hồ sơ bị kẹt vĩnh viễn ở yeu_cau_chinh_sua — xem audit trước, mục 12.1).
    if (result.status === 'yeu_cau_chinh_sua') {
      result.status = 'cho_xac_nhan'
      result.submitted_at = new Date()
    }
```

3c. Sửa guard trong `cancel()` — dòng:
```javascript
    const CANCELLABLE_STATUSES = ['pending', 'confirmed', 'checked_in', 'in_progress', 'waiting_record', 'waiting_doctor_confirm']
```
thành:
```javascript
    const CANCELLABLE_STATUSES = ['pending', 'confirmed', 'checked_in', 'in_progress']
```

3d. Sửa guard trong `complete()` — dòng:
```javascript
    // Cho phép complete() từ 'in_progress'/'waiting_record' — 2 trạng thái này giờ đạt được qua
    // hàng đợi động của y tá (Kế hoạch 2: queue.controller.js intoRoom()/finish()), KHÔNG chỉ qua
    // luồng xác nhận cũ ('confirmed'). Bác sĩ vẫn có thể tự đánh dấu hoàn thành bất kể y tá đã
    // nhập hồ sơ hay chưa (giữ nguyên hành vi "không bắt buộc đã nhập kết quả" đã có từ trước).
    if (!['confirmed', 'in_progress', 'waiting_record'].includes(a.status)) {
      return fail(res, 409, 'Chỉ đánh dấu hoàn thành cho lịch hẹn đã xác nhận, đang khám, hoặc đang chờ nhập hồ sơ')
    }
```
thành:
```javascript
    // Bác sĩ tự đánh dấu hoàn thành bất kể đã nhập kết quả khám hay chưa.
    if (!['confirmed', 'in_progress'].includes(a.status)) {
      return fail(res, 409, 'Chỉ đánh dấu hoàn thành cho lịch hẹn đã xác nhận hoặc đang khám')
    }
```

3e. Sửa guard trong `createResult()` — dòng:
```javascript
    // Cho phép cả 'completed' — bác sĩ có thể đã bấm "Hoàn thành" (complete()) trước
    // khi nhập kết quả khám, xem comment tại complete() ở trên.
    // Cho phép cả 'in_progress'/'waiting_record' — bác sĩ có thể tự nhập kết quả trực tiếp (bỏ
    // qua luồng nháp của y tá) ngay sau khi bệnh nhân đã vào phòng qua hàng đợi động (Kế hoạch 2).
    if (!['confirmed', 'in_progress', 'waiting_record', 'completed'].includes(a.status)) {
      return fail(res, 409, 'Chỉ nhập kết quả khi lịch hẹn đã xác nhận, đang khám, chờ nhập hồ sơ, hoặc đã hoàn thành')
    }
```
thành:
```javascript
    // Cho phép cả 'completed' — bác sĩ có thể đã bấm "Hoàn thành" (complete()) trước
    // khi nhập kết quả khám, xem comment tại complete() ở trên.
    if (!['confirmed', 'in_progress', 'completed'].includes(a.status)) {
      return fail(res, 409, 'Chỉ nhập kết quả khi lịch hẹn đã xác nhận, đang khám, hoặc đã hoàn thành')
    }
```

3f. Sửa comment trong `createResult()` nhắc "y tá":
```javascript
    // Bác sĩ tự nhập hồ sơ (không qua y tá) → coi như đã xác nhận ngay, không bắt bác sĩ
    // tự xác nhận lại hồ sơ do chính mình viết (quyết định 2026-07-11 — khác luồng y tá
    // nhập, vốn luôn bắt đầu 'ban_nhap' và bắt buộc qua bước bác sĩ xác nhận ở createDraft()).
```
thành:
```javascript
    // Bác sĩ tự nhập hồ sơ khám → coi như đã xác nhận ngay, không cần bước xác nhận riêng
    // (quyết định 2026-07-11, mở rộng 2026-07-24: đây giờ là đường DUY NHẤT tạo hồ sơ).
```

3g. Sửa `trangThaiTongHop()` trong `examQueue()` — dòng:
```javascript
  if (!kq || kq.status === 'ban_nhap') return 'cho_nhap_ho_so'
  if (kq.status === 'cho_xac_nhan' || kq.status === 'yeu_cau_chinh_sua') return 'cho_xac_nhan'
  if (kq.status === 'da_xac_nhan') return 'da_xong'
  return 'cho_nhap_ho_so'
```
thành:
```javascript
  if (!kq || kq.status === 'ban_nhap') return 'cho_nhap_ho_so'
  if (kq.status === 'da_xac_nhan') return 'da_xong'
  return 'cho_nhap_ho_so'
```

- [ ] **Step 4: Sửa route file**

Trong `backend/src/routes/doctor/appointments.routes.js`, xóa 3 dòng:
```javascript
router.patch('/:id/result/confirm',          appointments.confirmResult)
// KHÔI PHỤC 2026-07-19 (QĐ-1/A, PROMPT 28): bác sĩ đẩy hồ sơ về y tá chỉnh sửa (song song với
// confirmResult "Lưu & Xác nhận"). Xem requestRevision trong controller.
router.patch('/:id/result/request-revision', appointments.requestRevision)

// Xác nhận hồ sơ theo ket_qua_id — dùng cho lượt khám offline (không có LichHen, xem
// confirmResultByRecord trong controller). Path 3 đoạn bắt đầu literal 'result' nên không
// đụng '/:id' (1 đoạn) hay '/:id/result/confirm' (đoạn 3 là 'confirm' khác 'confirm-by-record').
router.patch('/result/:ketQuaId/confirm-by-record', appointments.confirmResultByRecord)
```
File còn lại:
```javascript
import { Router } from 'express'
import * as appointments from '../../controllers/doctor/appointments.controller.js'

const router = Router()

router.get('/',                  appointments.list)
router.get('/pending-results',   appointments.listPendingResults) // phải đứng trước '/:id'
router.get('/:id',               appointments.getById)
router.patch('/:id/confirm',     appointments.confirm)
router.patch('/:id/cancel',      appointments.cancel)
router.patch('/:id/complete',    appointments.complete)
router.get('/:id/result',        appointments.getResult)
router.post('/:id/result',       appointments.createResult)
router.put('/:id/result',        appointments.updateResult)

export default router
```

- [ ] **Step 5: Kiểm tra `listPendingResults` còn dùng status nào đã gỡ**

Đọc hàm `listPendingResults` trong `doctor/appointments.controller.js` (chưa đọc ở bước
brainstorm — subagent thực hiện task này PHẢI tự đọc trước khi sửa). Nếu hàm này filter theo
`cho_xac_nhan`/`yeu_cau_chinh_sua`, sửa lại chỉ còn filter theo `ban_nhap` (hồ sơ do bác sĩ tạo
nhưng có thể coi là "chưa xong" nếu có field nào khác đánh dấu — nếu không tìm thấy ý nghĩa
tương đương, đổi hàm trả về danh sách rỗng có kèm comment giải thích lý do, KHÔNG tự bịa logic
mới). Nếu hàm không filter theo 2 status này, không cần sửa.

- [ ] **Step 6: Khởi động backend, kiểm tra không lỗi cú pháp/import**

Run: `cd backend && node -e "import('./src/app.js').then(() => console.log('OK')).catch(e => { console.error(e); process.exit(1) })"`
(hoặc `npm run dev` rồi Ctrl+C sau khi thấy log "Đã kết nối MongoDB" không lỗi).
Expected: không có `SyntaxError`/`ReferenceError` khi require các file đã sửa.

- [ ] **Step 7: Commit**

```bash
git add backend/src/controllers/doctor/appointments.controller.js backend/src/routes/doctor/appointments.routes.js backend/src/models/LichHen.js backend/src/models/KetQuaKham.js
git commit -m "refactor: go luong bac si xac nhan/yeu cau chinh sua ho so (chi phuc vu y ta nhap)"
```

---

### Task 5: Vai trò & model — bỏ field/enum liên quan Nurse

**Files:**
- Modify: `backend/src/models/NguoiDung.js`
- Modify: `backend/src/models/LichHen.js`
- Modify: `backend/src/models/LichLamViec.js`
- Modify: `backend/src/models/PhongKham.js`
- Delete: `backend/src/models/NghiPhepYTa.js`
- Modify: `backend/src/models/index.js`

- [ ] **Step 1: `NguoiDung.role` enum**

Trong `backend/src/models/NguoiDung.js`, dòng 27-31, đổi:
```javascript
    role: {
      type: String,
      enum: ['user', 'patient', 'doctor', 'admin', 'receptionist', 'nurse'],
      default: 'user',
    },
```
thành:
```javascript
    role: {
      type: String,
      enum: ['user', 'patient', 'doctor', 'admin', 'receptionist'],
      default: 'user',
    },
```

- [ ] **Step 2: `LichHen.nurse_id`**

Trong `backend/src/models/LichHen.js`, xóa dòng 7-10:
```javascript
    doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BacSi', default: null },
    // Y tá phụ trách lịch hẹn này — copy từ LichLamViec.nurse_id tại thời điểm đặt lịch, giữ
    // lịch sử đúng nếu sau này ca đó đổi y tá (không phải ref model YTa — chưa có model riêng).
    nurse_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
    schedule_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LichLamViec', default: null },
```
thành:
```javascript
    doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BacSi', default: null },
    schedule_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LichLamViec', default: null },
```

- [ ] **Step 3: `LichLamViec.nurse_id`**

Đọc `backend/src/models/LichLamViec.js` dòng 61-90 để xác định đúng vị trí (đã biết dòng 68-74
là field `nurse_id`). Xóa khối:
```javascript
    // Y tá phụ trách cả ngày làm việc này (1 y tá/ngày, không tách theo slot/ca) — optional,
    // gán bởi admin. Ref 'NguoiDung' (không phải model YTa riêng — hệ thống chưa có model đó).
    nurse_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: null,
    },
```
Chỉ xóa đúng khối field này, giữ nguyên `doctor_id` phía trên và `chi_nhanh_id` phía dưới.

- [ ] **Step 4: `PhongKham.nurse_ids`**

Trong `backend/src/models/PhongKham.js`, xóa khối:
```javascript
    nurse_ids: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NguoiDung',
      default: [],
    }],
```
(Giữ nguyên `doctor_ids` phía trên.)

- [ ] **Step 5: Xóa model `NghiPhepYTa`**

```bash
rm backend/src/models/NghiPhepYTa.js
```

Trong `backend/src/models/index.js`, xóa dòng:
```javascript
export { default as NghiPhepYTa }        from './NghiPhepYTa.js'
```

- [ ] **Step 6: Grep xác nhận không còn nơi nào import `NghiPhepYTa`**

Run: `grep -rn "NghiPhepYTa" backend/src`
Expected: không có kết quả nào (nếu có, phải xử lý trước khi tiếp tục — không có trong scope
phân tích trước đó, nghĩa là không có route/controller nào dùng ngoài model + barrel export).

- [ ] **Step 7: Commit**

```bash
git add backend/src/models/NguoiDung.js backend/src/models/LichHen.js backend/src/models/LichLamViec.js backend/src/models/PhongKham.js backend/src/models/index.js
git rm backend/src/models/NghiPhepYTa.js
git commit -m "refactor: bo role nurse va cac field/model lien quan (nurse_id, nurse_ids, NghiPhepYTa)"
```

---

### Task 6: Admin — Quản lý phòng khám bỏ gán y tá (backend)

**Files:**
- Modify: `backend/src/controllers/admin/clinic-room.controller.js`

- [ ] **Step 1: Bỏ import `NguoiDung` nếu không còn dùng cho gì khác**

Đọc lại phần đầu file sau khi sửa các bước dưới — nếu `NguoiDung` không còn được dùng ở đâu
khác trong file, xóa khỏi import ở dòng 2-9. (Kiểm tra bằng `grep -n "NguoiDung" backend/src/controllers/admin/clinic-room.controller.js` sau khi hoàn tất Step 2-6.)

- [ ] **Step 2: Bỏ `compactNurse()`**

Xóa hàm (dòng 137-145):
```javascript
function compactNurse(nurse) {
  return {
    _id: nurse._id,
    ho_ten: nurse.ho_ten,
    email: nurse.email,
    so_dien_thoai: nurse.so_dien_thoai ?? null,
    status: nurse.status,
  }
}
```

- [ ] **Step 3: Sửa `formatRoom()` — bỏ `nurse_ids`/`nurse_count`**

Đổi:
```javascript
function formatRoom(room, { futureSchedules = 0, activeAppointments = 0 } = {}) {
  const plain = typeof room.toObject === 'function' ? room.toObject({ virtuals: true }) : room
  return {
    _id: plain._id,
    ten: plain.ten,
    tang: plain.tang,
    toa: plain.toa,
    loai: plain.loai,
    trang_thai: plain.trang_thai,
    full_name: plain.full_name ?? roomFullName(plain),
    doctor_ids: (plain.doctor_ids ?? []).map(compactDoctor),
    nurse_ids: (plain.nurse_ids ?? []).map(compactNurse),
    doctor_count: plain.doctor_ids?.length ?? 0,
    nurse_count: plain.nurse_ids?.length ?? 0,
    future_schedule_count: futureSchedules,
    active_appointment_count: activeAppointments,
    ngay_tao: plain.ngay_tao ?? null,
    ngay_cap_nhat: plain.ngay_cap_nhat ?? null,
  }
}
```
thành:
```javascript
function formatRoom(room, { futureSchedules = 0, activeAppointments = 0 } = {}) {
  const plain = typeof room.toObject === 'function' ? room.toObject({ virtuals: true }) : room
  return {
    _id: plain._id,
    ten: plain.ten,
    tang: plain.tang,
    toa: plain.toa,
    loai: plain.loai,
    trang_thai: plain.trang_thai,
    full_name: plain.full_name ?? roomFullName(plain),
    doctor_ids: (plain.doctor_ids ?? []).map(compactDoctor),
    doctor_count: plain.doctor_ids?.length ?? 0,
    future_schedule_count: futureSchedules,
    active_appointment_count: activeAppointments,
    ngay_tao: plain.ngay_tao ?? null,
    ngay_cap_nhat: plain.ngay_cap_nhat ?? null,
  }
}
```

- [ ] **Step 4: Sửa `normalizeRoomPayload()` — bỏ nhánh `nurse_ids`**

Xóa khối:
```javascript
  if (body.nurse_ids !== undefined) {
    if (!Array.isArray(body.nurse_ids)) throw new Error('Danh sách y tá không hợp lệ')
    payload.nurse_ids = uniqueIds(body.nurse_ids, 'Y tá')
  }
```

- [ ] **Step 5: Sửa `validateStaff()` — bỏ tham số/logic `nurse_ids`**

Đổi:
```javascript
async function validateStaff({ doctor_ids = [], nurse_ids = [] }) {
  if (doctor_ids.length > 0) {
    const doctors = await BacSi.find({
      _id: { $in: doctor_ids },
      trang_thai_duyet: 'approved',
      la_hien: true,
    }).select('_id').lean()
    if (doctors.length !== doctor_ids.length) {
      throw new Error('Danh sách bác sĩ có hồ sơ không tồn tại hoặc chưa được duyệt')
    }
  }

  if (nurse_ids.length > 0) {
    const nurses = await NguoiDung.find({
      _id: { $in: nurse_ids },
      role: 'nurse',
      status: 'active',
      ngay_xoa: null,
    }).select('_id').lean()
    if (nurses.length !== nurse_ids.length) {
      throw new Error('Danh sách y tá có tài khoản không tồn tại hoặc đang bị khóa')
    }
  }
}
```
thành:
```javascript
async function validateStaff({ doctor_ids = [] }) {
  if (doctor_ids.length > 0) {
    const doctors = await BacSi.find({
      _id: { $in: doctor_ids },
      trang_thai_duyet: 'approved',
      la_hien: true,
    }).select('_id').lean()
    if (doctors.length !== doctor_ids.length) {
      throw new Error('Danh sách bác sĩ có hồ sơ không tồn tại hoặc chưa được duyệt')
    }
  }
}
```

- [ ] **Step 6: Sửa `getRoomOptions()` — bỏ trả về `nurses`**

Đổi:
```javascript
export async function getRoomOptions(_req, res) {
  try {
    const [doctors, nurses] = await Promise.all([
      BacSi.find({ trang_thai_duyet: 'approved', la_hien: true })
        .populate('user_id', 'ho_ten email')
        .populate('specialties', 'ten')
        .sort({ ngay_tao: -1 })
        .lean(),
      NguoiDung.find({ role: 'nurse', status: 'active', ngay_xoa: null })
        .select('ho_ten email so_dien_thoai status')
        .sort({ ho_ten: 1 })
        .lean(),
    ])

    return ok(res, {
      doctors: doctors.map(compactDoctor),
      nurses: nurses.map(compactNurse),
    })
  } catch (error) {
    return fail(res, 500, 'Không thể tải danh sách nhân sự: ' + error.message)
  }
}
```
thành:
```javascript
export async function getRoomOptions(_req, res) {
  try {
    const doctors = await BacSi.find({ trang_thai_duyet: 'approved', la_hien: true })
      .populate('user_id', 'ho_ten email')
      .populate('specialties', 'ten')
      .sort({ ngay_tao: -1 })
      .lean()

    return ok(res, { doctors: doctors.map(compactDoctor) })
  } catch (error) {
    return fail(res, 500, 'Không thể tải danh sách nhân sự: ' + error.message)
  }
}
```

- [ ] **Step 7: Sửa `getRooms()` — bỏ `.populate('nurse_ids', ...)`**

Xóa dòng `.populate('nurse_ids', 'ho_ten email so_dien_thoai status')` trong `getRooms()`
(sau `.populate({ path: 'doctor_ids', ... })`).

- [ ] **Step 8: Sửa `createRoom()` — bỏ `validateStaff` truyền `nurse_ids` (đã tự bỏ do đổi
chữ ký ở Step 5, không cần sửa call site — `await validateStaff(payload)` vẫn hợp lệ vì
`payload` không còn có field `nurse_ids` sau Step 4).**

Không cần sửa gì thêm ở `createRoom()`.

- [ ] **Step 9: Sửa `updateRoom()` — bỏ nhánh xử lý `nurse_ids`**

Đổi:
```javascript
    const previousDoctorIds = room.doctor_ids.map(String)
    const payload = normalizeRoomPayload(req.body, { partial: true })
    await validateStaff({
      doctor_ids: payload.doctor_ids ?? previousDoctorIds,
      nurse_ids: payload.nurse_ids ?? room.nurse_ids.map(String),
    })
```
thành:
```javascript
    const previousDoctorIds = room.doctor_ids.map(String)
    const payload = normalizeRoomPayload(req.body, { partial: true })
    await validateStaff({ doctor_ids: payload.doctor_ids ?? previousDoctorIds })
```

Xóa khối:
```javascript
    if (payload.nurse_ids !== undefined) {
      await PhongKham.updateMany({ _id: { $ne: room._id } }, { $pull: { nurse_ids: { $in: payload.nurse_ids } } })
    }
```

- [ ] **Step 10: Sửa `populateRoom()` — bỏ `.populate('nurse_ids', ...)`**

Xóa dòng `.populate('nurse_ids', 'ho_ten email so_dien_thoai status')` cuối hàm `populateRoom()`.

- [ ] **Step 11: Xóa import `NguoiDung` nếu không còn dùng**

Chạy `grep -n "NguoiDung" backend/src/controllers/admin/clinic-room.controller.js` — nếu 0 kết
quả ngoài dòng import, xóa `NguoiDung,` khỏi import ở đầu file.

- [ ] **Step 12: Khởi động backend, kiểm tra không lỗi**

Run: `cd backend && npm run dev`, xác nhận log "Đã kết nối MongoDB" không kèm lỗi import, sau
đó dừng server.

- [ ] **Step 13: Commit**

```bash
git add backend/src/controllers/admin/clinic-room.controller.js
git commit -m "refactor: bo gan y ta cho phong kham (admin clinic-room)"
```

---

### Task 7: Xóa toàn bộ backend namespace `nurse`

**Files:**
- Delete: `backend/src/routes/nurse/` (toàn bộ thư mục: `dashboard.routes.js`, `appointments.routes.js`, `medical-records.routes.js`, `room-status.routes.js`, `queue.routes.js`, `schedule.routes.js`, `index.js`)
- Delete: `backend/src/controllers/nurse/` (toàn bộ thư mục: `dashboard.controller.js`, `appointments.controller.js`, `medical-records.controller.js`, `room-status.controller.js`, `queue.controller.js`, `schedule.controller.js`)
- Delete: `backend/src/utils/nurse-scope.js`
- Modify: `backend/src/routes/index.js`

- [ ] **Step 1: Sửa `backend/src/routes/index.js` — bỏ mount `/nurse`**

Đổi:
```javascript
import { Router } from 'express'
import authRoutes         from './admin/auth.routes.js'
import adminRoutes        from './admin/index.js'
import clinicsRoutes      from './admin/clinics.routes.js'
import notificationRoutes from './admin/notifications.routes.js'
import appointmentRoutes  from './admin/appointment.routes.js'
import specialtiesRoutes  from './admin/specialties.routes.js'
import uploadRoutes       from './admin/upload.routes.js'
import doctorRoutes       from './doctor/index.js'
import adminDoctorRoutes  from './doctor.routes.js'
import nurseRoutes        from './nurse/index.js'
import receptionistRoutes from './receptionist/index.js'
import patientRoutes      from './patient/index.js'
import thongKeRoutes      from './thong-ke.routes.js'

const router = Router()

router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'API is working fine' })
})

router.use('/auth', authRoutes)
router.use('/doctor', doctorRoutes)
router.use('/nurse', nurseRoutes)
router.use('/patient', patientRoutes)
```
thành:
```javascript
import { Router } from 'express'
import authRoutes         from './admin/auth.routes.js'
import adminRoutes        from './admin/index.js'
import clinicsRoutes      from './admin/clinics.routes.js'
import notificationRoutes from './admin/notifications.routes.js'
import appointmentRoutes  from './admin/appointment.routes.js'
import specialtiesRoutes  from './admin/specialties.routes.js'
import uploadRoutes       from './admin/upload.routes.js'
import doctorRoutes       from './doctor/index.js'
import adminDoctorRoutes  from './doctor.routes.js'
import receptionistRoutes from './receptionist/index.js'
import patientRoutes      from './patient/index.js'
import thongKeRoutes      from './thong-ke.routes.js'

const router = Router()

router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'API is working fine' })
})

router.use('/auth', authRoutes)
router.use('/doctor', doctorRoutes)
router.use('/patient', patientRoutes)
```
(Phần còn lại của file giữ nguyên không đổi.)

- [ ] **Step 2: Xóa các file/thư mục**

```bash
rm -rf backend/src/routes/nurse
rm -rf backend/src/controllers/nurse
rm backend/src/utils/nurse-scope.js
```

- [ ] **Step 3: Grep xác nhận không còn import nào trỏ tới các file đã xóa**

Run: `grep -rn "routes/nurse\|controllers/nurse\|nurse-scope" backend/src`
Expected: không có kết quả.

- [ ] **Step 4: Khởi động backend xác nhận không lỗi**

Run: `cd backend && npm run dev`. Expected: log "✅ Đã kết nối MongoDB Cloud" không kèm lỗi
`Cannot find module`. Dừng server sau khi xác nhận.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/index.js
git rm -r backend/src/routes/nurse backend/src/controllers/nurse
git rm backend/src/utils/nurse-scope.js
git commit -m "refactor: xoa toan bo backend namespace nurse (routes/controllers/utils)"
```

---

### Task 8: Dọn seed/demo script nurse-specific

**Files:**
- Delete: `backend/src/scripts/seed-nurse-test-data.js`
- Delete: `backend/src/scripts/seed-khang-nurse-live-flow.js`
- Delete: `backend/src/scripts/seed-khang-nurse-history.js`
- Delete: `backend/src/scripts/link-nurse-to-khang-data.js`
- Delete: `backend/src/scripts/verify-khang-nurse-live-flow.js`
- Modify: `backend/src/scripts/seed-all.js`

- [ ] **Step 1: Xóa script**

```bash
rm backend/src/scripts/seed-nurse-test-data.js
rm backend/src/scripts/seed-khang-nurse-live-flow.js
rm backend/src/scripts/seed-khang-nurse-history.js
rm backend/src/scripts/link-nurse-to-khang-data.js
rm backend/src/scripts/verify-khang-nurse-live-flow.js
```

- [ ] **Step 2: Sửa `seed-all.js`**

Đọc toàn bộ `backend/src/scripts/seed-all.js` trước khi sửa (subagent thực hiện task này phải
Read file — plan này chỉ định vị trí đã biết chính xác, không lặp lại toàn bộ nội dung file vì
quá dài để trích dẫn hết).

Tại dòng ~208-211 (khai báo user nurse trong mảng users seed), xóa object có `role: 'nurse'`,
`email: 'nurse@vitafamily.vn'` khỏi mảng.

Tại dòng ~276 (`const nurse = users[2]`), xóa dòng này. Vì index mảng `users` dịch chuyển sau
khi xóa phần tử nurse, RÀ SOÁT LẠI toàn bộ các chỗ dùng `users[N]` sau vị trí đó trong file —
đảm bảo index vẫn trỏ đúng người dùng dự kiến (bác sĩ demo) sau khi bỏ 1 phần tử khỏi mảng. Nếu
mảng dùng tên biến (`const doctor = users.find(u => u.role === 'doctor')` v.v.) thay vì index
cứng, không cần sửa gì thêm ngoài xóa dòng khai báo `nurse`.

Tại các dòng dùng biến `nurse` làm `nguoi_nhap_id`/`nguoi_do_id`/`nguoi_sua_id`/`nguoi_cap_nhat_id`
(dòng ~1031, 1048, 1065, 1078, 1139, 1142, 1152, 1155, 1165, 1168) — thay biến `nurse` bằng biến
đại diện cho bác sĩ demo đã có sẵn trong file (tên biến chính xác phải đọc từ file thật, ví dụ
có thể là `doctor` hoặc `bacSi` — dùng đúng biến đã seed bác sĩ ở phần trên file). Comment liên
quan (nếu có nhắc "y tá nhập") sửa thành "bác sĩ tự nhập".

- [ ] **Step 3: Grep xác nhận không còn biến `nurse` mồ côi**

Run: `grep -n "nurse" backend/src/scripts/seed-all.js`
Expected: không có kết quả (hoặc chỉ còn trong comment lịch sử nếu cố ý giữ — ưu tiên xóa sạch).

- [ ] **Step 4: Chạy thử seed script (nếu an toàn — CHỈ chạy nếu user xác nhận muốn seed lại
demo data; mặc định bỏ qua bước chạy thật, chỉ kiểm tra cú pháp)**

Run: `cd backend && node --check src/scripts/seed-all.js`
Expected: không có lỗi cú pháp (không thực sự kết nối DB hay ghi dữ liệu).

- [ ] **Step 5: Commit**

```bash
git add backend/src/scripts/seed-all.js
git rm backend/src/scripts/seed-nurse-test-data.js backend/src/scripts/seed-khang-nurse-live-flow.js backend/src/scripts/seed-khang-nurse-history.js backend/src/scripts/link-nurse-to-khang-data.js backend/src/scripts/verify-khang-nurse-live-flow.js
git commit -m "chore: xoa script seed/demo rieng cho nurse, sua seed-all.js dung bac si thay the"
```

---

### Task 9: Migration dữ liệu trên MongoDB Cloud (DATN_VITAFAMILY)

**Files:**
- Create: `backend/src/scripts/migrate-remove-nurse.js`

- [ ] **Step 1: Viết script migration**

Tạo `backend/src/scripts/migrate-remove-nurse.js`:

```javascript
// ============================================================
// Migration: xóa dữ liệu liên quan role Nurse khỏi MongoDB Cloud (DATN_VITAFAMILY).
// Chạy dry-run mặc định (chỉ đếm, KHÔNG ghi). Thêm --apply để thực thi thật.
// Usage:
//   node src/scripts/migrate-remove-nurse.js            (dry-run)
//   node src/scripts/migrate-remove-nurse.js --apply     (thực thi)
// ============================================================
import 'dotenv/config'
import mongoose from 'mongoose'
import { NguoiDung, LichHen, LichLamViec, PhongKham, KetQuaKham } from '../models/index.js'

const APPLY = process.argv.includes('--apply')

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('Thiếu MONGODB_URI trong file .env')
  await mongoose.connect(uri)
  console.log(`✅ Đã kết nối MongoDB Cloud — chế độ: ${APPLY ? 'APPLY (sẽ ghi dữ liệu)' : 'DRY-RUN (chỉ đếm)'}`)

  const nurseCount = await NguoiDung.countDocuments({ role: 'nurse' })
  console.log(`1. User role='nurse' sẽ bị xóa: ${nurseCount}`)
  if (APPLY && nurseCount > 0) {
    const r = await NguoiDung.deleteMany({ role: 'nurse' })
    console.log(`   → Đã xóa ${r.deletedCount} user`)
  }

  // 2. Collection NghiPhepYTa — model đã bị xóa khỏi code (Task 5), thao tác trực tiếp qua
  // driver Mongo native vì không còn model Mongoose để gọi.
  const nghiPhepYTaCount = await mongoose.connection.db.collection('nghi_phep_y_ta').countDocuments().catch(() => 0)
  console.log(`2. Document collection nghi_phep_y_ta sẽ bị xóa: ${nghiPhepYTaCount}`)
  if (APPLY && nghiPhepYTaCount > 0) {
    await mongoose.connection.db.collection('nghi_phep_y_ta').drop().catch(() => {})
    console.log('   → Đã xóa collection nghi_phep_y_ta')
  }

  const lichHenNurseCount = await mongoose.connection.db.collection('lich_hen').countDocuments({ nurse_id: { $exists: true } })
  console.log(`3a. LichHen có field nurse_id sẽ được $unset: ${lichHenNurseCount}`)
  if (APPLY && lichHenNurseCount > 0) {
    const r = await mongoose.connection.db.collection('lich_hen').updateMany({ nurse_id: { $exists: true } }, { $unset: { nurse_id: 1 } })
    console.log(`   → Đã sửa ${r.modifiedCount} document`)
  }

  const lichLamViecNurseCount = await mongoose.connection.db.collection('lich_lam_viec').countDocuments({ nurse_id: { $exists: true } })
  console.log(`3b. LichLamViec có field nurse_id sẽ được $unset: ${lichLamViecNurseCount}`)
  if (APPLY && lichLamViecNurseCount > 0) {
    const r = await mongoose.connection.db.collection('lich_lam_viec').updateMany({ nurse_id: { $exists: true } }, { $unset: { nurse_id: 1 } })
    console.log(`   → Đã sửa ${r.modifiedCount} document`)
  }

  const phongKhamNurseCount = await mongoose.connection.db.collection('phong_kham').countDocuments({ nurse_ids: { $exists: true } })
  console.log(`4. PhongKham có field nurse_ids sẽ được $unset: ${phongKhamNurseCount}`)
  if (APPLY && phongKhamNurseCount > 0) {
    const r = await mongoose.connection.db.collection('phong_kham').updateMany({ nurse_ids: { $exists: true } }, { $unset: { nurse_ids: 1 } })
    console.log(`   → Đã sửa ${r.modifiedCount} document`)
  }

  const lichHenOldStatusCount = await LichHen.countDocuments({ status: { $in: ['waiting_record', 'waiting_doctor_confirm'] } })
  console.log(`5. LichHen có status waiting_record/waiting_doctor_confirm sẽ chuyển 'in_progress': ${lichHenOldStatusCount}`)
  if (APPLY && lichHenOldStatusCount > 0) {
    const r = await LichHen.updateMany({ status: { $in: ['waiting_record', 'waiting_doctor_confirm'] } }, { $set: { status: 'in_progress' } })
    console.log(`   → Đã sửa ${r.modifiedCount} document`)
  }

  const ketQuaOldStatusCount = await KetQuaKham.countDocuments({ status: { $in: ['cho_xac_nhan', 'yeu_cau_chinh_sua'] } })
  console.log(`6. KetQuaKham có status cho_xac_nhan/yeu_cau_chinh_sua sẽ chuyển 'ban_nhap': ${ketQuaOldStatusCount}`)
  if (APPLY && ketQuaOldStatusCount > 0) {
    const r = await KetQuaKham.updateMany({ status: { $in: ['cho_xac_nhan', 'yeu_cau_chinh_sua'] } }, { $set: { status: 'ban_nhap' } })
    console.log(`   → Đã sửa ${r.modifiedCount} document`)
  }

  console.log('7. NhatKyThaoTac có vai_tro="nurse": KHÔNG đụng (giữ nguyên nhật ký lịch sử).')

  console.log(APPLY ? '\n✅ Hoàn tất migration (APPLY).' : '\nDry-run xong — chạy lại với --apply để thực thi.')
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('❌ Lỗi migration:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Chạy dry-run**

Run: `cd backend && node src/scripts/migrate-remove-nurse.js`
Expected: in ra 7 dòng số liệu (1-7), không ghi gì vào DB. Đọc kỹ số liệu — nếu số lượng bất
thường lớn (vd hàng nghìn document `LichHen` có `nurse_id`, trong khi hệ thống demo/dev thường
chỉ có vài chục), DỪNG LẠI và báo cáo cho user trước khi chạy Step 3, KHÔNG tự ý apply.

- [ ] **Step 3: Chạy apply (chỉ sau khi Step 2 cho số liệu hợp lý)**

Run: `cd backend && node src/scripts/migrate-remove-nurse.js --apply`
Expected: các dòng "→ Đã xóa/sửa N document" khớp với số liệu dry-run ở Step 2, kết thúc bằng
"✅ Hoàn tất migration (APPLY)."

- [ ] **Step 4: Chạy lại dry-run để xác minh migration idempotent**

Run: `cd backend && node src/scripts/migrate-remove-nurse.js`
Expected: toàn bộ 7 số liệu đều là `0` (trừ mục 7 luôn là "KHÔNG đụng").

- [ ] **Step 5: Commit**

```bash
git add backend/src/scripts/migrate-remove-nurse.js
git commit -m "feat: them script migration xoa du lieu nurse tren MongoDB Cloud (dry-run + apply)"
```

---

### Task 10: Frontend `types/index.ts` — bỏ Role nurse + interface Nurse*

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Sửa `Role` type**

Tìm dòng (đầu file, dòng 4):
```typescript
export type Role = "user" | "doctor" | "admin" | "receptionist" | "nurse";
```
đổi thành:
```typescript
export type Role = "user" | "doctor" | "admin" | "receptionist";
```

- [ ] **Step 2: Xóa field `nurse_id`/`nurse` khỏi `DoctorSlot`**

Đổi (dòng 658-683):
```typescript
export interface DoctorSlot {
    id: string;
    schedule_id: string; // cần để update slot qua API
    ngay: string; // 'YYYY-MM-DD'
    gio_bat_dau: string; // 'HH:MM'
    gio_ket_thuc: string;
    phong_kham?: string | null;
    benh_nhan?: string | null;
    benh_nhan_id?: string | null;
    // pending_payment: slot bị BN giữ 15 phút trong khi thanh toán VNPay (soft-lock)
    status:
        | "active"
        | "pending_payment"
        | "booked"
        | "locked"
        | "cancelled"
        | "expired";
    lock_expires_at?: string | null; // ISO datetime — set khi pending_payment, null các trạng thái khác
    cancel_requested?: boolean;
    // Dữ liệu cấp NGÀY, lặp lại trên mỗi slot cùng ngày — backend trả từ Prompt 2
    // (GET /doctor/schedule). null = chưa phân công y tá (dữ liệu thật, không hardcode).
    trang_thai_ngay?: DoctorScheduleDayStatus | null;
    chi_nhanh_id?: string | null;
    nurse_id?: string | null;
    nurse?: string | null;
}
```
thành:
```typescript
export interface DoctorSlot {
    id: string;
    schedule_id: string; // cần để update slot qua API
    ngay: string; // 'YYYY-MM-DD'
    gio_bat_dau: string; // 'HH:MM'
    gio_ket_thuc: string;
    phong_kham?: string | null;
    benh_nhan?: string | null;
    benh_nhan_id?: string | null;
    // pending_payment: slot bị BN giữ 15 phút trong khi thanh toán VNPay (soft-lock)
    status:
        | "active"
        | "pending_payment"
        | "booked"
        | "locked"
        | "cancelled"
        | "expired";
    lock_expires_at?: string | null; // ISO datetime — set khi pending_payment, null các trạng thái khác
    cancel_requested?: boolean;
    // Dữ liệu cấp NGÀY, lặp lại trên mỗi slot cùng ngày — backend trả từ Prompt 2 (GET /doctor/schedule).
    trang_thai_ngay?: DoctorScheduleDayStatus | null;
    chi_nhanh_id?: string | null;
}
```

- [ ] **Step 3: Xóa field `nurse_id`/`nurse` khỏi `DoctorScheduleDetail`**

Đổi (dòng 762-773):
```typescript
export interface DoctorScheduleDetail {
    id: string;
    ngay: string;
    trang_thai_ngay: DoctorScheduleDayStatus | null;
    ghi_chu_ngay: string | null;
    chi_nhanh_id: string | null;
    nurse_id: string | null;
    nurse: string | null;
    slots: DoctorScheduleDetailSlot[];
    lich_hen: DoctorScheduleAppointmentItem[];
    thong_ke: DoctorScheduleStats;
}
```
thành:
```typescript
export interface DoctorScheduleDetail {
    id: string;
    ngay: string;
    trang_thai_ngay: DoctorScheduleDayStatus | null;
    ghi_chu_ngay: string | null;
    chi_nhanh_id: string | null;
    slots: DoctorScheduleDetailSlot[];
    lich_hen: DoctorScheduleAppointmentItem[];
    thong_ke: DoctorScheduleStats;
}
```

Cũng sửa comment dòng 724-725 (bỏ nhắc "nurse" trong comment của `DoctorScheduleDetailSlot`):
```typescript
// 1 slot trong chi tiết ca — tương tự DoctorSlot nhưng KHÔNG lặp lại field cấp ngày
// (ngay/schedule_id/nurse/trang_thai_ngay đã nằm ở DoctorScheduleDetail cấp cha).
```
thành:
```typescript
// 1 slot trong chi tiết ca — tương tự DoctorSlot nhưng KHÔNG lặp lại field cấp ngày
// (ngay/schedule_id/trang_thai_ngay đã nằm ở DoctorScheduleDetail cấp cha).
```

- [ ] **Step 4: Sửa comment trong `KetQuaKhamStatus` (dòng ~775-778) và `ExaminationResult`
(dòng 883-897) — bỏ nhắc "y tá"**

Đổi comment ngay trên `KetQuaKhamStatus`:
```typescript
// Trạng thái xác nhận hồ sơ khám (KetQuaKham.status) — xem docs/Bác sĩ/Audit - Truong du lieu
// thieu va thua trong DB. cho_xac_nhan = "WAITING_DOCTOR_CONFIRM" theo yêu cầu nghiệp vụ.
// ban_nhap = "DRAFT" — chỉ dùng cho luồng y tá nhập hồ sơ (lưu nháp trước khi gửi bác sĩ).
export type KetQuaKhamStatus =
    | "ban_nhap"
```
Đọc tiếp phần còn lại của union type này (chưa đọc hết trong batch trước — subagent PHẢI đọc
đủ context xung quanh dòng 778 trước khi sửa) và bỏ các giá trị `"cho_xac_nhan"` /
`"yeu_cau_chinh_sua"` khỏi union nếu có, giữ lại `"da_xac_nhan"`. Sửa comment thành:
```typescript
// Trạng thái hồ sơ khám (KetQuaKham.status). ban_nhap = nháp, da_xac_nhan = đã chốt.
export type KetQuaKhamStatus =
    | "ban_nhap"
    | "da_xac_nhan";
```
(Nếu union gốc chứa thêm giá trị khác không liên quan Nurse, GIỮ LẠI — chỉ xóa đúng 2 giá trị
`cho_xac_nhan`/`yeu_cau_chinh_sua`.)

Trong `ExaminationResult`, sửa 2 dòng comment:
```typescript
    trieu_chung_ban_dau?: string | null; // y tá ghi khi tiếp nhận — bác sĩ tham khảo để chẩn đoán
    ghi_chu_dieu_duong?: string | null; // ghi chú điều dưỡng (y tá) — tách khỏi ghi chú chuyên môn BS
```
thành:
```typescript
    trieu_chung_ban_dau?: string | null; // ghi nhận khi tiếp nhận — bác sĩ tham khảo để chẩn đoán
    ghi_chu_dieu_duong?: string | null; // ghi chú điều dưỡng — tách khỏi ghi chú chuyên môn BS
```

- [ ] **Step 5: Xóa toàn bộ khối "Trang Y tá (Nurse Portal)"**

Xóa từ comment header:
```typescript
// ============================================================
// Trang Y tá (Nurse Portal) — khớp response backend routes/nurse/*
// ============================================================
```
cho tới hết interface `NurseQueueCheckinResult`/`NurseQueueActionResult` (toàn bộ khối chứa
`NurseDashboardDoctorSupport`, `NurseDashboardQueueItem`, `NurseDashboard`, `NurseShift`,
`NurseQueueItem`, `NursePendingStage`, `NursePendingRecord`, `NurseQueuePage`,
`NurseAppointmentDetail`, `NurseVitalSigns`, `NurseMedicalRecord`, `NurseRevisionItem`,
`NurseMedicalRecordDraftPayload`, và tiếp theo là khối "Hàng đợi động + Trạng thái phòng"
chứa `PhongKhamTrangThai`, `NurseRoomStatus`, `HangDoiMucUuTien`, `HangDoiTrangThai`,
`NurseQueueEntry`, `NurseQueueCheckinPayload`, `NurseQueueCheckinEntry`,
`NurseQueueCheckinResult`, `NurseQueueActionResult`).

**QUAN TRỌNG — không xóa nhầm 2 type được dùng ở nơi khác:** `HangDoiTrangThai` được tham
chiếu trong `NurseAppointmentDetail.hang_doi_trang_thai` (đang bị xóa) — kiểm tra bằng
`grep -n "HangDoiTrangThai\|HangDoiMucUuTien\|PhongKhamTrangThai" frontend/src` SAU khi xóa
khối này. Nếu các type đó còn được dùng ở file khác (ví dụ trong service mới ở Task 11/12),
GIỮ LẠI 3 type đó (`PhongKhamTrangThai`, `HangDoiMucUuTien`, `HangDoiTrangThai`) và chỉ xóa các
interface có prefix `Nurse`. Task 11 và 12 dưới đây SẼ cần `HangDoiTrangThai`/`HangDoiMucUuTien`
— vì vậy khi thực hiện Task 10, giữ lại 2 type này (di chuyển ra ngoài khối bị xóa, đặt ngay
trước khối, không xóa) và định nghĩa lại `ReceptionQueueEntry`/`DoctorQueueEntry` ở Task 11/12
dựa trên chúng thay vì định nghĩa lại từ đầu.

- [ ] **Step 6: Build kiểm tra TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: lỗi xuất hiện CHỈ ở các file còn import `Nurse*` type (sẽ sửa ở Task 11-16) — không
có lỗi nào phát sinh từ chính `types/index.ts`. Ghi lại danh sách file lỗi để xử lý ở các task
sau.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "refactor: bo Role nurse va toan bo interface Nurse* khoi types/index.ts"
```

---

### Task 11: Frontend — Trang check-in hàng đợi cho Lễ tân

**Files:**
- Create: `frontend/src/services/receptionist-queue.service.ts`
- Create: `frontend/src/pages/receptionist/Queue.tsx`
- Modify: `frontend/src/routes/AppRoutes.tsx`
- Modify: `frontend/src/pages/receptionist/Layout.tsx`

**Interfaces:**
- Consumes: `axiosInstance` (`@/services/axiosInstance`), `ApiResponse` (`@/types`), `Badge`/
  `Button`/`PageHeader`/`Icon` components (đã dùng ở `ClinicRoomsTab.tsx`/`DoctorExamQueue.tsx`).
- Produces: `receptionistQueueService.checkin(payload)`, `receptionistQueueService.list()`.

- [ ] **Step 1: Đọc `frontend/src/pages/receptionist/Layout.tsx` để biết cấu trúc menu hiện tại**

Subagent PHẢI Read file này trước khi sửa (chưa đọc trong quá trình lập kế hoạch) — layout lễ
tân có menu điều hướng riêng, cần thêm mục "Hàng đợi" theo đúng pattern đang dùng (component
menu item, icon, active state) — sao chép cấu trúc của mục "Lịch hẹn"/"Thanh toán" đã có, đổi
label/path/icon.

- [ ] **Step 2: Viết service**

Tạo `frontend/src/services/receptionist-queue.service.ts`:

```typescript
import axiosInstance from './axiosInstance'
import type { ApiResponse, HangDoiMucUuTien, HangDoiTrangThai } from '@/types'

export interface ReceptionQueueEntry {
  id: string
  nguon: 'online' | 'offline'
  ten_benh_nhan: string
  tuoi: number | null
  gioi_tinh: 'nam' | 'nu' | 'khac' | null
  doctor_id: string
  phong_kham: string | null
  muc_uu_tien: HangDoiMucUuTien
  trang_thai: HangDoiTrangThai
  checkin_time: string
  so_lan_goi: number
}

export interface ReceptionCheckinPayload {
  appointment_id?: string
  doctor_id?: string
  ten_benh_nhan?: string
  so_dien_thoai?: string
  tuoi?: number
  gioi_tinh?: 'nam' | 'nu' | 'khac'
  specialty_id?: string
}

export const receptionistQueueService = {
  async list(): Promise<ReceptionQueueEntry[]> {
    const res = await axiosInstance.get<ApiResponse<ReceptionQueueEntry[]>>('/receptionist/queue')
    return res.data.data
  },

  async checkin(payload: ReceptionCheckinPayload): Promise<{ entry: ReceptionQueueEntry }> {
    const res = await axiosInstance.post<ApiResponse<{ entry: ReceptionQueueEntry }>>('/receptionist/queue/checkin', payload)
    return res.data.data
  },
}
```

- [ ] **Step 3: Viết trang Queue.tsx**

Tạo `frontend/src/pages/receptionist/Queue.tsx`:

```tsx
import { useEffect, useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Icon from '@/components/admin/icons'
import { receptionistQueueService } from '@/services/receptionist-queue.service'
import type { ReceptionQueueEntry } from '@/services/receptionist-queue.service'
import { formatDateTime } from '@/utils/format'

const TRANG_THAI_LABEL: Record<ReceptionQueueEntry['trang_thai'], string> = {
  dang_cho: 'Đang chờ', da_goi: 'Đã gọi', trong_phong: 'Trong phòng',
  skipped: 'Bỏ lượt', cancelled: 'Đã hủy', hoan_thanh: 'Hoàn thành',
}
const TRANG_THAI_COLOR: Record<ReceptionQueueEntry['trang_thai'], 'green' | 'red' | 'blue' | 'yellow' | 'gray'> = {
  dang_cho: 'gray', da_goi: 'blue', trong_phong: 'blue', skipped: 'gray', cancelled: 'red', hoan_thanh: 'green',
}

export default function ReceptionistQueue() {
  const [entries, setEntries] = useState<ReceptionQueueEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form check-in offline (khách vãng lai)
  const [tenBenhNhan, setTenBenhNhan] = useState('')
  const [soDienThoai, setSoDienThoai] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function load() {
    setLoading(true)
    receptionistQueueService.list()
      .then(setEntries)
      .catch(() => setError('Không tải được hàng đợi.'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function handleCheckinOffline(e: React.FormEvent) {
    e.preventDefault()
    if (!tenBenhNhan.trim() || !soDienThoai.trim() || !doctorId.trim()) {
      setError('Vui lòng nhập đủ tên, số điện thoại và mã bác sĩ.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await receptionistQueueService.checkin({
        ten_benh_nhan: tenBenhNhan.trim(),
        so_dien_thoai: soDienThoai.trim(),
        doctor_id: doctorId.trim(),
      })
      setTenBenhNhan(''); setSoDienThoai(''); setDoctorId('')
      load()
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Check-in thất bại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader title="Hàng đợi khám" description="Check-in bệnh nhân online (theo lịch hẹn) hoặc vãng lai (walk-in)." />

      <div className="card mb-4 p-4">
        <h3 className="mb-3 font-semibold text-slate-800">Check-in khách vãng lai</h3>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <form onSubmit={handleCheckinOffline} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Tên bệnh nhân</label>
            <input value={tenBenhNhan} onChange={(e) => setTenBenhNhan(e.target.value)} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Số điện thoại</label>
            <input value={soDienThoai} onChange={(e) => setSoDienThoai(e.target.value)} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Mã bác sĩ</label>
            <input value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="input" placeholder="ID bác sĩ đang trực" />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Đang check-in...' : 'Check-in'}
          </button>
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3">
          <h3 className="font-semibold text-slate-800">Hàng đợi hôm nay ({entries.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold">Bệnh nhân</th>
                <th className="px-4 py-3 text-xs font-semibold">Nguồn</th>
                <th className="px-4 py-3 text-xs font-semibold">Phòng</th>
                <th className="px-4 py-3 text-xs font-semibold">Check-in lúc</th>
                <th className="px-4 py-3 text-xs font-semibold">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Đang tải...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Chưa có ai check-in hôm nay.</td></tr>
              ) : entries.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{e.ten_benh_nhan}</td>
                  <td className="px-4 py-3">
                    <Badge color={e.nguon === 'online' ? 'blue' : 'gray'}>{e.nguon === 'online' ? 'Online' : 'Vãng lai'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.phong_kham ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(e.checkin_time)}</td>
                  <td className="px-4 py-3">
                    <Badge color={TRANG_THAI_COLOR[e.trang_thai]}>{TRANG_THAI_LABEL[e.trang_thai]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

(Nếu `formatDateTime` hoặc `Icon` không tồn tại đúng named export như dùng ở
`ClinicRoomsTab.tsx`/`SendNotificationTab.tsx`, sửa import cho khớp thực tế trong repo — 2 file
đó đã xác nhận `import { formatDateTime } from '@/utils/format'` và
`import Icon from '@/components/admin/icons'` hoạt động đúng, dùng y hệt.)

- [ ] **Step 4: Thêm route trong `AppRoutes.tsx`**

Thêm import:
```typescript
import ReceptionistQueue from '@/pages/receptionist/Queue'
```
Thêm route con trong khối `/receptionist` (sau `<Route path="booking" element={<ReceptionistBooking />} />`):
```tsx
        <Route path="queue" element={<ReceptionistQueue />} />
```

- [ ] **Step 5: Thêm mục menu trong `Layout.tsx`** (theo cấu trúc đã đọc ở Step 1 — thêm entry
"Hàng đợi" trỏ tới `/receptionist/queue`, dùng icon phù hợp đã có sẵn trong bộ icon dùng chung).

- [ ] **Step 6: Chạy dev server, kiểm tra bằng trình duyệt**

Run: `cd frontend && npm run dev`. Mở `/receptionist/queue` (đăng nhập tài khoản lễ tân), xác
nhận trang render không lỗi console, danh sách rỗng hiển thị đúng thông báo, form check-in hiển
thị đủ 3 field. Dừng dev server sau khi xác nhận.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/services/receptionist-queue.service.ts frontend/src/pages/receptionist/Queue.tsx frontend/src/routes/AppRoutes.tsx frontend/src/pages/receptionist/Layout.tsx
git commit -m "feat: them trang check-in hang doi cho le tan"
```

---

### Task 12: Frontend — Thao tác hàng đợi cho Bác sĩ

**Files:**
- Modify: `frontend/src/services/doctor-appointment.service.ts`
- Modify: `frontend/src/pages/doctor/DoctorExamQueue.tsx`

**Interfaces:**
- Produces: `doctorAppointmentService.callPatient(queueId)`, `.intoRoom(queueId)`,
  `.finishExam(queueId)`, `.skipPatient(queueId)`, `.cancelQueueEntry(queueId)`.

- [ ] **Step 1: Thêm hàm service, xóa hàm confirm/revision đã lỗi thời**

Trong `frontend/src/services/doctor-appointment.service.ts`, xóa 3 hàm `confirmResult`,
`requestRevision`, `confirmResultByRecord` (backend đã gỡ endpoint ở Task 4 — giữ lại sẽ gọi
API 404).

Thêm import `HangDoiTrangThai` vào dòng import đầu file:
```typescript
import type { ApiResponse, DoctorAppointmentDetail, AppointmentStatus, PaymentStatus, KetQuaKhamStatus, DoctorPendingRecord, ExamResultEditPayload, DoctorExamQueueRow, HangDoiTrangThai } from '@/types'
```

Thêm 5 hàm mới vào cuối object `doctorAppointmentService` (trước dấu `}` đóng cuối file):
```typescript
  // Gọi bệnh nhân trong hàng đợi (hàng đợi khám, khác appointment_id).
  async callPatient(queueId: string): Promise<{ id: string; trang_thai: HangDoiTrangThai; so_lan_goi: number }> {
    const res = await axiosInstance.patch<ApiResponse<{ id: string; trang_thai: HangDoiTrangThai; so_lan_goi: number }>>(`/doctor/queue/${queueId}/call`)
    return res.data.data
  },

  async intoRoom(queueId: string): Promise<{ id: string; trang_thai: HangDoiTrangThai }> {
    const res = await axiosInstance.patch<ApiResponse<{ id: string; trang_thai: HangDoiTrangThai }>>(`/doctor/queue/${queueId}/into-room`)
    return res.data.data
  },

  async finishExam(queueId: string): Promise<{ id: string; trang_thai: HangDoiTrangThai }> {
    const res = await axiosInstance.patch<ApiResponse<{ id: string; trang_thai: HangDoiTrangThai }>>(`/doctor/queue/${queueId}/finish`)
    return res.data.data
  },

  async skipPatient(queueId: string): Promise<{ id: string; trang_thai: HangDoiTrangThai }> {
    const res = await axiosInstance.patch<ApiResponse<{ id: string; trang_thai: HangDoiTrangThai }>>(`/doctor/queue/${queueId}/skip`)
    return res.data.data
  },

  async cancelQueueEntry(queueId: string): Promise<{ id: string; trang_thai: HangDoiTrangThai }> {
    const res = await axiosInstance.patch<ApiResponse<{ id: string; trang_thai: HangDoiTrangThai }>>(`/doctor/queue/${queueId}/cancel`)
    return res.data.data
  },
```

- [ ] **Step 2: Sửa `DoctorExamQueue.tsx` — bỏ luồng confirm, thêm nút thao tác hàng đợi**

Mở `frontend/src/pages/doctor/DoctorExamQueue.tsx`. Đây là sửa đổi có điều kiện phụ thuộc cấu
trúc `DoctorExamQueueRow` (kiểu dữ liệu trả về từ `GET /doctor/queue`, định nghĩa trong
`types/index.ts` — subagent PHẢI đọc định nghĩa `DoctorExamQueueRow` và `ExamQueueStatus` trước
khi sửa, vì các type này chưa được đọc đầy đủ trong quá trình lập kế hoạch).

Việc cần làm (mô tả hành vi đích, subagent tự viết code khớp field thật của
`DoctorExamQueueRow`):
1. Xóa nhánh `cho_xac_nhan`/`Chờ bạn xác nhận` khỏi `STATUS_LABEL`/`STATUS_COLOR` (trạng thái
   này không còn xảy ra được — `KetQuaKham.status` chỉ còn `ban_nhap`/`da_xac_nhan`).
2. Xóa hàm `openConfirm()` và mọi chỗ gọi `confirmResultByRecord`.
3. Xóa việc mở `ExamResultModal` với `mode="confirm"` — modal giờ chỉ dùng `mode="edit"` (tạo/
   sửa hồ sơ trực tiếp, không còn khái niệm "xác nhận hồ sơ y tá nhập").
4. Với mỗi dòng hàng đợi có `id` (queue entry id — field `id` trên `DoctorExamQueueRow`, khác
   `appointment_id`), thêm các nút thao tác tương ứng trạng thái `hang_doi_trang_thai` (nếu field
   này có mặt trên `DoctorExamQueueRow` — nếu backend `examQueue()` hiện KHÔNG trả field trạng
   thái hàng đợi thô (`dang_cho`/`da_goi`/`trong_phong`), bổ sung field đó vào response của
   `examQueue()` trong `backend/src/controllers/doctor/appointments.controller.js` — đọc lại
   hàm `examQueue()` đã có sẵn `hang_doi_trang_thai: e.trang_thai` KHÔNG, nếu chưa có thì thêm):
   - `dang_cho`/`da_goi` → nút "Gọi bệnh nhân" (gọi `callPatient`), nút "Vào phòng" (gọi
     `intoRoom`, chỉ enable sau khi đã gọi ít nhất 1 lần hoặc cho phép gọi thẳng — theo đúng
     ràng buộc backend: cả `dang_cho` và `da_goi` đều được phép `into-room`), nút "Bỏ lượt"
     (gọi `skipPatient`).
   - `trong_phong` → nút "Kết thúc khám" (gọi `finishExam`).
   - Sau mỗi thao tác thành công, gọi lại `load()` để làm mới danh sách.
5. Sửa mô tả `PageHeader` — bỏ câu "Xác nhận hồ sơ khi y tá đã nhập xong." (dòng 67), thay bằng
   mô tả phù hợp luồng mới (vd: "Vận hành hàng đợi khám và nhập kết quả trực tiếp.").
6. Sửa comment dòng 39 (`// Chỉ mở modal xác nhận khi tới bước của bác sĩ...`) cho khớp hành vi
   mới hoặc xóa nếu không còn áp dụng.

- [ ] **Step 3: Sửa `ExamResultModal.tsx` — bỏ `mode='confirm'` và luồng revision**

Trong `frontend/src/components/doctor/ExamResultModal.tsx`:
- Xóa prop `mode`, `onConfirmed`, `onRevisionRequested` khỏi `ExamResultModalProps` — modal chỉ
  còn 1 chế độ (tạo/sửa trực tiếp qua `examinationService.save`).
- Xóa biến `canConfirm`, hàm `handleConfirm`, hàm `handleRequestRevision`, state
  `revisionReason`.
- Xóa khối JSX hiển thị "Lý do yêu cầu chỉnh sửa" (dòng 316-324) và nút "Yêu cầu chỉnh sửa"
  (dòng 328-333).
- Sửa `primaryLabel` — bỏ nhánh `canConfirm`:
  ```typescript
  const primaryLabel = saving ? 'Đang lưu...' : (existing ? 'Cập nhật' : 'Lưu kết quả')
  ```
- Sửa `<form onSubmit={canConfirm ? handleConfirm : handleSave} ...>` thành
  `<form onSubmit={handleSave} ...>`.
- Sửa tiêu đề modal (dòng 182) — bỏ nhánh `canConfirm ? 'Xác nhận hồ sơ khám' : 'Kết quả khám'`,
  giữ cố định `'Kết quả khám'`.
- Sửa comment "Triệu chứng (y tá ghi)" (dòng 59) thành "Triệu chứng ghi nhận ban đầu".
- Cập nhật mọi nơi gọi `<ExamResultModal ... mode="confirm" onConfirmed={...} onRevisionRequested={...} />`
  trong `DoctorExamQueue.tsx` (đã sửa ở Step 2) — bỏ 3 prop này khỏi lời gọi component.

- [ ] **Step 4: Build kiểm tra TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: không còn lỗi liên quan `confirmResult`/`requestRevision`/`confirmResultByRecord`/
`mode='confirm'`. Nếu còn lỗi ở file khác gọi các hàm đã xóa, sửa nốt (không thuộc phạm vi
Task 12 nếu file đó thuộc Task 13-16 — ghi chú lại để xử lý ở task tương ứng).

- [ ] **Step 5: Chạy dev server, kiểm tra bằng trình duyệt**

Run: `cd frontend && npm run dev`. Đăng nhập bác sĩ, mở `/doctor/pending-records`, xác nhận
trang không lỗi console, nút thao tác hàng đợi hiển thị đúng theo trạng thái mẫu (nếu có dữ
liệu test). Dừng dev server sau khi xác nhận.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/services/doctor-appointment.service.ts frontend/src/pages/doctor/DoctorExamQueue.tsx frontend/src/components/doctor/ExamResultModal.tsx
git commit -m "feat: them thao tac hang doi (goi/vao phong/ket thuc/bo luot) cho bac si, go luong xac nhan/yeu cau chinh sua"
```

---

### Task 13: Xóa toàn bộ frontend namespace Nurse

**Files:**
- Delete: `frontend/src/layouts/NurseLayout.tsx`
- Delete: `frontend/src/components/nurse/` (`NurseSidebar.tsx`, `NurseHeader.tsx`)
- Delete: `frontend/src/pages/nurse/` (6 file: `NurseDashboard.tsx`, `NurseSchedule.tsx`, `NurseQueue.tsx`, `NursePendingRecords.tsx`, `NurseAppointmentDetail.tsx`, `NurseRevisions.tsx`)
- Delete: `frontend/src/services/nurse.service.ts`
- Delete: `frontend/src/routes/nurseMenu.ts`
- Delete: `frontend/src/__tests__/services/nurse.service.test.ts`
- Modify: `frontend/src/routes/AppRoutes.tsx`
- Modify: `frontend/src/pages/auth/Login.tsx`

- [ ] **Step 1: Xóa file/thư mục**

```bash
rm frontend/src/layouts/NurseLayout.tsx
rm -rf frontend/src/components/nurse
rm -rf frontend/src/pages/nurse
rm frontend/src/services/nurse.service.ts
rm frontend/src/routes/nurseMenu.ts
rm frontend/src/__tests__/services/nurse.service.test.ts
```

- [ ] **Step 2: Sửa `AppRoutes.tsx`**

Xóa import (dòng 5, 47-52):
```typescript
import NurseLayout from '@/layouts/NurseLayout'
```
```typescript
import NurseDashboard from '@/pages/nurse/NurseDashboard'
import NurseSchedule from '@/pages/nurse/NurseSchedule'
import NurseQueue from '@/pages/nurse/NurseQueue'
import NursePendingRecords from '@/pages/nurse/NursePendingRecords'
import NurseAppointmentDetail from '@/pages/nurse/NurseAppointmentDetail'
import NurseRevisions from '@/pages/nurse/NurseRevisions'
```

Xóa toàn bộ khối route (dòng 147-162):
```tsx
      {/* Khu vực Nurse — yêu cầu role = nurse */}
      <Route
        path="/nurse"
        element={
          <ProtectedRoute roles={['nurse']}>
            <NurseLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<NurseDashboard />} />
        <Route path="schedule" element={<NurseSchedule />} />
        <Route path="queue" element={<NurseQueue />} />
        <Route path="pending-records" element={<NursePendingRecords />} />
        <Route path="appointments/:id" element={<NurseAppointmentDetail />} />
        <Route path="revisions" element={<NurseRevisions />} />
      </Route>
```

- [ ] **Step 3: Sửa `Login.tsx`**

Đổi mảng `demoAccounts` (xóa dòng `{ role: 'Y tá', email: 'ducluong140606@gmail.com' },`):
```typescript
const demoAccounts = [
  { role: 'Admin', email: 'admin@vitafamily.vn' },
  { role: 'Bác sĩ', email: 'haiv5634@gmail.com' },
  { role: 'Bệnh nhân', email: 'lt14062006meitu@gmail.com' },
  { role: 'Lễ tân', email: 'luongtran140606@gmail.com' },
]
```

Xóa nhánh redirect trong `handleSubmit`:
```typescript
      } else if (user.role === 'nurse') {
        navigate(from?.startsWith('/nurse') ? from : '/nurse', { replace: true })
```
(Giữ nguyên các nhánh `admin`/`receptionist`/`doctor`/`else` xung quanh.)

- [ ] **Step 4: Grep xác nhận không còn tham chiếu**

Run: `grep -rn "nurse\|Nurse" frontend/src --include="*.ts" --include="*.tsx" | grep -v "__tests__"`
Expected: không còn kết quả nào (nếu Task 11/12 để sót biến/comment nào nhắc "y tá" không cố ý,
xử lý nốt ở đây).

- [ ] **Step 5: Build kiểm tra**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: build thành công, không lỗi import file đã xóa.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/routes/AppRoutes.tsx frontend/src/pages/auth/Login.tsx
git rm -r frontend/src/layouts/NurseLayout.tsx frontend/src/components/nurse frontend/src/pages/nurse frontend/src/services/nurse.service.ts frontend/src/routes/nurseMenu.ts frontend/src/__tests__/services/nurse.service.test.ts
git commit -m "refactor: xoa toan bo frontend namespace nurse (pages/components/layout/service/routes)"
```

---

### Task 14: DoctorDashboard.tsx / DoctorSchedule.tsx — bỏ "Y tá hỗ trợ"

**Files:**
- Modify: `frontend/src/pages/doctor/DoctorDashboard.tsx`
- Modify: `frontend/src/pages/doctor/DoctorSchedule.tsx`

- [ ] **Step 1: Sửa `DoctorDashboard.tsx`**

Xóa khối (dòng 141-146):
```tsx
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Y tá hỗ trợ</p>
                <p className="mt-0.5 text-sm font-medium text-slate-700">
                  {overview!.y_ta_ho_tro?.ho_ten ?? 'Chưa phân công y tá'}
                </p>
              </div>
```
Subagent thực hiện task này phải đọc kiểu `DoctorDashboardOverview` (hoặc tên tương đương) ở
`types/index.ts` để xóa field `y_ta_ho_tro` khỏi interface đó, và kiểm tra
`backend/src/controllers/doctor/stats.controller.js` xem có trả field `y_ta_ho_tro` trong
response `getDashboard`/tương đương không — nếu có, xóa field đó khỏi response backend luôn
(để không gửi dữ liệu thừa/gây nhầm lẫn). Chạy `grep -rn "y_ta_ho_tro" backend/src frontend/src`
trước khi sửa để xác định toàn bộ vị trí.

- [ ] **Step 2: Sửa `DoctorSchedule.tsx`**

Xóa dòng (dòng 164, subagent tự xác định context — đây là 1 dòng trong khối hiển thị chi tiết
lịch làm việc):
```tsx
              Y tá hỗ trợ: <span className="font-medium text-slate-800">{detail.nurse ?? 'Chưa phân công'}</span>
```
Đọc context xung quanh (khối cha chứa dòng này, có thể là 1 `<p>`/`<div>` liệt kê nhiều thông
tin ca làm việc) để xóa đúng — không để lại phần tử JSX rỗng hay dấu phẩy/separator thừa.

- [ ] **Step 3: Grep xác nhận sạch**

Run: `grep -rn "y_ta_ho_tro\|Y tá hỗ trợ\|detail.nurse\b" frontend/src backend/src`
Expected: không còn kết quả.

- [ ] **Step 4: Build + kiểm tra trình duyệt**

Run: `cd frontend && npx tsc --noEmit`. Sau đó `npm run dev`, mở `/doctor` và `/doctor/schedule`
bằng tài khoản bác sĩ, xác nhận không lỗi console, layout không bị vỡ (không còn khoảng trống
kỳ lạ ở vị trí đã xóa). Dừng dev server sau khi xác nhận.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/doctor/DoctorDashboard.tsx frontend/src/pages/doctor/DoctorSchedule.tsx frontend/src/types/index.ts backend/src/controllers/doctor/stats.controller.js backend/src/controllers/doctor/schedule.controller.js
git commit -m "refactor: bo hien thi Y ta ho tro tren dashboard va lich lam viec bac si"
```

---

### Task 15: Admin — Quản lý phòng khám bỏ gán y tá (frontend)

**Files:**
- Modify: `frontend/src/pages/admin/ManageClinics/ClinicRoomsTab.tsx`
- Modify: `frontend/src/types/index.ts` (nếu `ClinicRoomItem`/`ClinicRoomPayload`/
  `ClinicRoomOptions`/`ClinicRoomNurse` định nghĩa ở đây — subagent tự xác định file đúng bằng
  `grep -rn "ClinicRoomNurse\|ClinicRoomOptions\|ClinicRoomPayload\|ClinicRoomItem" frontend/src/types`)

- [ ] **Step 1: Đọc định nghĩa type `ClinicRoom*`**

Chạy `grep -n "ClinicRoom" frontend/src/types/index.ts` để tìm đúng vị trí, Read đoạn đó.

- [ ] **Step 2: Sửa type — xóa `nurse_ids`/`nurse_count`/`ClinicRoomNurse`/`nurses` khỏi
`ClinicRoomItem`, `ClinicRoomPayload`, `ClinicRoomOptions`**

Xóa interface `ClinicRoomNurse` hoàn toàn. Xóa field `nurse_ids: string[]` khỏi
`ClinicRoomPayload`, field `nurse_ids: ClinicRoomNurse[]` + `nurse_count: number` khỏi
`ClinicRoomItem`, field `nurses: ClinicRoomNurse[]` khỏi `ClinicRoomOptions`.

- [ ] **Step 3: Sửa `ClinicRoomsTab.tsx`**

3a. Xóa import `ClinicRoomNurse` khỏi dòng import type (giữ `ClinicRoomDoctor`,
`ClinicRoomItem`, `ClinicRoomOptions`, `ClinicRoomPayload`).

3b. Sửa `emptyForm`:
```typescript
const emptyForm: ClinicRoomPayload = {
  ten: '',
  tang: 1,
  toa: CLINIC_BUILDING_NAME,
  loai: '',
  trang_thai: 'active',
  doctor_ids: [],
  nurse_ids: [],
}
```
thành:
```typescript
const emptyForm: ClinicRoomPayload = {
  ten: '',
  tang: 1,
  toa: CLINIC_BUILDING_NAME,
  loai: '',
  trang_thai: 'active',
  doctor_ids: [],
}
```

3c. Xóa cột "Y tá" trong `<thead>` (dòng `<th className="px-5 py-3 font-medium">Y tá</th>`) và
ô `<td>` tương ứng (chứa `<StaffPreview people={room.nurse_ids} fallback="Chưa gán y tá" />`).
Sửa `colSpan={8}` → `colSpan={7}` ở 3 chỗ (loading/loadError/empty state trong `<tbody>`).

3d. Sửa mô tả header:
```tsx
            <p className="mt-0.5 text-xs text-slate-400">
              Quản lý phòng vật lý, bác sĩ và y tá phụ trách trong từng phòng.
            </p>
```
thành:
```tsx
            <p className="mt-0.5 text-xs text-slate-400">
              Quản lý phòng vật lý và bác sĩ phụ trách trong từng phòng.
            </p>
```

3e. Sửa `toggleId()` — bỏ `'nurse_ids'` khỏi type tham số:
```typescript
  function toggleId(field: 'doctor_ids' | 'nurse_ids', id: string) {
```
thành:
```typescript
  function toggleId(field: 'doctor_ids', id: string) {
```

3f. Sửa `StaffPreview` — bỏ union `ClinicRoomNurse`:
```typescript
function StaffPreview({ people, fallback }: { people: Array<ClinicRoomDoctor | ClinicRoomNurse>; fallback: string }) {
```
thành:
```typescript
function StaffPreview({ people, fallback }: { people: ClinicRoomDoctor[]; fallback: string }) {
```

3g. Xóa khối `<StaffPicker title="Y tá trong phòng" ... />` (StaffPicker thứ 2 trong
`RoomEditorModal`, đổi `grid gap-5 lg:grid-cols-2` bao quanh 2 StaffPicker thành layout 1 cột
hợp lý — ví dụ đổi `lg:grid-cols-2` thành không còn cần grid 2 cột, dùng 1 `<div>` đơn hoặc giữ
`StaffPicker` bác sĩ full-width).

3h. Sửa `StaffPicker<T>` generic — bỏ union `ClinicRoomNurse`:
```typescript
function StaffPicker<T extends ClinicRoomDoctor | ClinicRoomNurse>({
```
thành:
```typescript
function StaffPicker<T extends ClinicRoomDoctor>({
```

3i. Sửa `roomToForm()` — xóa dòng `nurse_ids: room.nurse_ids.map((nurse) => nurse._id),`.

- [ ] **Step 4: Kiểm tra `ManageClinics.tsx` (component cha) có fetch/truyền `options.nurses`
không**

Chạy `grep -n "nurse" frontend/src/pages/admin/ManageClinics/ManageClinics.tsx` — nếu có
tham chiếu (vd gọi API lấy `options` rồi truyền xuống `ClinicRoomsTab`), không cần sửa gì thêm
vì backend `getRoomOptions()` (Task 6) đã không còn trả `nurses` — object `options.nurses` sẽ tự
nhiên là `undefined`, và vì type đã bỏ field này (Step 2) nên TypeScript sẽ tự bắt lỗi ở bất kỳ
chỗ nào còn đọc `options.nurses`.

- [ ] **Step 5: Build kiểm tra TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: không còn lỗi liên quan `ClinicRoomNurse`/`nurse_ids`/`nurses` trong toàn bộ
`ManageClinics` module.

- [ ] **Step 6: Chạy dev server, kiểm tra trình duyệt**

Run: `cd frontend && npm run dev`. Đăng nhập admin, mở `/admin/clinics` tab "Phòng khám nhỏ",
mở modal "Thêm phòng" — xác nhận chỉ còn 1 khối chọn "Bác sĩ trong phòng", không còn "Y tá
trong phòng". Bảng danh sách phòng không còn cột "Y tá". Dừng dev server sau khi xác nhận.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/admin/ManageClinics/ClinicRoomsTab.tsx frontend/src/types/index.ts
git commit -m "refactor: bo gan y ta cho phong kham (admin clinic rooms UI)"
```

---

### Task 16: SendNotificationTab.tsx — bỏ nhóm "Y tá"

**Files:**
- Modify: `frontend/src/pages/admin/ManageNotifications/SendNotificationTab.tsx`
- Modify: `frontend/src/types/index.ts` (`NotificationTargetAPI` — xác định vị trí bằng
  `grep -n "NotificationTargetAPI" frontend/src/types/index.ts`)
- Modify: `backend/src/controllers/admin/notifications.controller.js` (hoặc file tương đương xử
  lý `doi_tuong` khi gửi thông báo — xác định bằng `grep -rln "y_ta" backend/src/controllers backend/src/services`)

- [ ] **Step 1: Sửa `NotificationTargetAPI` type**

Đọc định nghĩa hiện tại (union string chứa `"y_ta"` cùng `"tat_ca" | "benh_nhan" | "bac_si" |
"le_tan"`), xóa `"y_ta"` khỏi union.

- [ ] **Step 2: Sửa `SendNotificationTab.tsx`**

Xóa entry `y_ta` khỏi 3 record: `TARGET_COLOR`, `TARGET_LABEL`, `TARGET_ROLE`:
```typescript
const TARGET_COLOR: Record<NotificationTargetAPI, 'gray' | 'blue' | 'green' | 'yellow'> = {
  tat_ca: 'gray',
  benh_nhan: 'blue',
  bac_si: 'green',
  le_tan: 'yellow',
  y_ta: 'green',
}

const TARGET_LABEL: Record<NotificationTargetAPI, string> = {
  tat_ca: 'Tất cả',
  benh_nhan: 'Bệnh nhân',
  bac_si: 'Bác sĩ',
  le_tan: 'Lễ tân',
  y_ta: 'Y tá',
}

const TARGET_ROLE: Partial<Record<NotificationTargetAPI, string>> = {
  benh_nhan: 'user',
  bac_si: 'doctor',
  le_tan: 'receptionist',
  y_ta: 'nurse',
}
```
thành:
```typescript
const TARGET_COLOR: Record<NotificationTargetAPI, 'gray' | 'blue' | 'green' | 'yellow'> = {
  tat_ca: 'gray',
  benh_nhan: 'blue',
  bac_si: 'green',
  le_tan: 'yellow',
}

const TARGET_LABEL: Record<NotificationTargetAPI, string> = {
  tat_ca: 'Tất cả',
  benh_nhan: 'Bệnh nhân',
  bac_si: 'Bác sĩ',
  le_tan: 'Lễ tân',
}

const TARGET_ROLE: Partial<Record<NotificationTargetAPI, string>> = {
  benh_nhan: 'user',
  bac_si: 'doctor',
  le_tan: 'receptionist',
}
```

Sửa `<select>` chọn đối tượng — xóa `<option value="y_ta">Chỉ Y tá</option>` và sửa nhãn
"Tất cả":
```tsx
                <option value="tat_ca">Tất cả (Bệnh nhân, Bác sĩ, Lễ tân & Y tá)</option>
                <option value="benh_nhan">Chỉ Bệnh nhân</option>
                <option value="bac_si">Chỉ Bác sĩ</option>
                <option value="le_tan">Chỉ Lễ tân</option>
                <option value="y_ta">Chỉ Y tá</option>
```
thành:
```tsx
                <option value="tat_ca">Tất cả (Bệnh nhân, Bác sĩ & Lễ tân)</option>
                <option value="benh_nhan">Chỉ Bệnh nhân</option>
                <option value="bac_si">Chỉ Bác sĩ</option>
                <option value="le_tan">Chỉ Lễ tân</option>
```

- [ ] **Step 3: Sửa backend xử lý `doi_tuong='y_ta'` khi gửi thông báo**

Đọc kết quả `grep -rln "y_ta" backend/src/controllers backend/src/services` từ Step 0 của
task này. Với mỗi file khớp, xóa nhánh xử lý `doi_tuong === 'y_ta'` (hoặc case tương đương
trong switch/if), và xóa `'y_ta'` khỏi bất kỳ enum Mongoose nào định nghĩa field `doi_tuong`
của model thông báo (`ThongBao`/`ThongBaoHeThong` — xác định bằng
`grep -n "doi_tuong" backend/src/models/ThongBao*.js`).

- [ ] **Step 4: Build + kiểm tra trình duyệt**

Run: `cd frontend && npx tsc --noEmit`. Sau đó `npm run dev`, mở `/admin/notifications`, kiểm
tra dropdown "Đối tượng nhận" không còn "Chỉ Y tá". Gửi thử 1 thông báo tới "Tất cả" — xác nhận
không lỗi. Dừng dev server sau khi xác nhận.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/ManageNotifications/SendNotificationTab.tsx frontend/src/types/index.ts backend/src/controllers/admin/notifications.controller.js backend/src/models/ThongBao.js
git commit -m "refactor: bo nhom Y ta khoi doi tuong nhan thong bao"
```

---

### Task 17: Xác minh toàn repo + build cuối cùng

**Files:** (không tạo/sửa file — chỉ chạy lệnh xác minh)

- [ ] **Step 1: Grep toàn repo (code, loại trừ docs lịch sử)**

Run:
```bash
grep -rilE "nurse" --include="*.js" --include="*.ts" --include="*.tsx" --include="*.jsx" backend/src frontend/src
```
Expected: không có kết quả nào (0 file).

- [ ] **Step 2: Grep "y tá" tiếng Việt trong code**

Run:
```bash
grep -rilE "y[ _]?t[áa]" --include="*.js" --include="*.ts" --include="*.tsx" --include="*.jsx" backend/src frontend/src
```
Expected: không có kết quả nào (loại trừ false-positive kiểu `ngay_tao` nếu regex khớp nhầm —
kiểm tra thủ công từng match nếu có).

- [ ] **Step 3: Backend — khởi động và giữ chạy đủ lâu để xác nhận ổn định**

Run: `cd backend && npm run dev` (background), đợi log "✅ Đã kết nối MongoDB Cloud" xuất hiện,
không có lỗi phía sau. Gọi `GET /api/health` xác nhận `{ success: true }`. Dừng server.

- [ ] **Step 4: Frontend — build production**

Run: `cd frontend && npm run build`
Expected: build thành công, không lỗi TypeScript/import.

- [ ] **Step 5: Frontend — chạy test suite hiện có**

Run: `cd frontend && npm run test`
Expected: toàn bộ test pass (test của `nurse.service.ts` đã xóa ở Task 13; các test khác không
liên quan Nurse phải vẫn pass nguyên trạng — nếu có test nào fail do thay đổi ở Task 12/14/15/16,
sửa test đó cho khớp hành vi mới, KHÔNG bỏ qua/skip test để né lỗi).

- [ ] **Step 6: Rà soát thủ công 1 lượt qua trình duyệt (golden path)**

Run: `cd frontend && npm run dev` + backend `npm run dev` song song. Kiểm tra bằng trình duyệt
theo đúng thứ tự luồng nghiệp vụ mới:
1. Đăng nhập Lễ tân → `/receptionist/queue` → check-in 1 khách vãng lai.
2. Đăng nhập Bác sĩ → `/doctor/pending-records` → thấy bệnh nhân vừa check-in → "Gọi bệnh nhân"
   → "Vào phòng" → "Kết thúc khám" → nhập kết quả khám qua modal (mode edit duy nhất) → lưu.
3. Xác nhận `LichHen.status`/`KetQuaKham.status` cuối cùng hợp lý (không kẹt ở trạng thái cũ).
Dừng cả 2 server sau khi xác nhận xong.

- [ ] **Step 7: Cập nhật spec — đánh dấu hoàn tất**

Trong `docs/Y tá/Thiet ke - Xoa hoan toan role Nurse khoi he thong (2026-07-24).md`, sửa dòng
đầu:
```markdown
> Trạng thái: Approved by user (2026-07-24)
```
thành:
```markdown
> Trạng thái: Đã triển khai xong (2026-07-24) — xem docs/Y tá/Ke hoach thuc thi - Xoa hoan toan role Nurse (2026-07-24).md
```

- [ ] **Step 8: Commit cuối**

```bash
git add "docs/Y tá/Thiet ke - Xoa hoan toan role Nurse khoi he thong (2026-07-24).md"
git commit -m "docs: danh dau spec xoa Nurse da trien khai xong"
```

---

## Ghi chú rủi ro đã biết (không phải bug cần sửa trong plan này)

- `receptionist/appointment.controller.js:markAsArrived` (`PATCH /receptionist/appointments/:id/arrived`)
  là cơ chế check-in KHÁC, chỉ set `LichHen.status='checked_in'`, KHÔNG tạo `HangDoi` entry —
  tồn tại song song với `POST /receptionist/queue/checkin` mới (Task 2) mà không tích hợp với
  nhau. Đây là bất nhất kiến trúc có TỪ TRƯỚC, không thuộc phạm vi xóa Nurse — không sửa trong
  plan này, chỉ ghi nhận để tránh nhầm lẫn khi QA.
- `updateResult()` khóa hẳn sau `da_xac_nhan`, không còn đường "yêu cầu chỉnh sửa" — nếu bác sĩ
  nhập sai sau khi chốt, chỉ sửa được qua thao tác DB thủ công. Đã xác nhận với user (Task 4,
  theo spec mục 3.2).
