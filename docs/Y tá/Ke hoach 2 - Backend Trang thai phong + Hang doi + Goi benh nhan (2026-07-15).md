# Kế hoạch 2 — Backend Trạng thái phòng + Hàng đợi + Gọi bệnh nhân

> **Cho người thực thi:** Thực thi tuần tự từng Task, mỗi Task test xong mới sang Task sau.
> Gộp 2 plan trong roadmap ban đầu (Plan 2 "Trạng thái phòng" + Plan 3 "Hàng đợi") thành 1 đợt —
> vì Plan 2 cần `HangDoi` (presence-gate) mà `HangDoi` chỉ có dữ liệu khi Plan 3 chạy.
> Nguồn thiết kế: `Chot thiet ke DB...`, `Xu ly vang mat y ta...`, **`DB CHANGES - Nen tang trang Y ta (2026-07-15).md`** (bám đúng tên field).
> Phụ thuộc: Kế hoạch 1 (model `HangDoi`, `TrangThaiPhongKham` đã tồn tại + đã seed dữ liệu thật hôm nay).

**Mục tiêu:** Y tá check-in bệnh nhân vào hàng đợi động (online ưu tiên theo cửa sổ ±30', offline theo giờ đến), điều khiển 4 trạng thái phòng của từng bác sĩ mình phụ trách, gọi bệnh nhân vào phòng với ràng buộc "phải có mặt mới khám" (presence-gate), và đồng bộ trạng thái `LichHen`/audit log.

**Kiến trúc:** 2 controller mới (`queue.controller.js`, `room-status.controller.js`) dưới `/api/nurse/queue` và `/api/nurse/room-status`, dùng chung helper `nurse-scope.js` để xác định "bác sĩ mình phụ trách hôm nay" (`LichLamViec.nurse_id`). Route cũ `/api/nurse/appointments` **giữ nguyên, không đụng** — đây là hệ hàng đợi mới, chạy song song.

**Tech Stack:** Node.js ESM · Express 4 · Mongoose 8 · `node:test` (integration test qua HTTP thật).

## Ràng buộc toàn cục

- **KHÔNG tự `git commit`** — nhóm tự làm.
- Field/tên hàm tiếng Việt snake_case khớp `DB CHANGES...`. Không đổi tên field đã định nghĩa ở Kế hoạch 1.
- Mọi endpoint dưới `requireRole('nurse')` (đã áp ở `routes/nurse/index.js`), lọc theo `req.user.id` — không tin `nurseId`/`doctorId` từ body.
- Mọi thao tác đổi trạng thái phòng/hàng đợi phải ghi `NhatKyThaoTac` (`vai_tro:'nurse'`).
- **Không** làm phần dự phòng lễ tân/admin (đó là Kế hoạch 6) — Kế hoạch này chỉ nurse thao tác trên bác sĩ mình phụ trách.
- **Không** chặn cứng khi quá tải hàng đợi — chỉ cảnh báo (quyết định đã chốt: "cảnh báo, lễ tân quyết").
- Ngày "hôm nay" tính theo **local server timezone** bằng `new Date(); setHours(0,0,0,0)` — **giống hệt** pattern đã dùng ở `nurse/appointments.controller.js` và `nurse/dashboard.controller.js` (đã xác nhận qua debug thực tế: server chạy UTC+7 → "hôm nay" = `[hôm_qua 17:00Z, hôm_nay 17:00Z)`). Giờ hẹn `gio_hen_goc` dựng bằng `setHours` (local), **không** dùng `setUTCHours` — tránh lặp lại lỗi lệch múi giờ đã gặp khi seed dữ liệu.
- Test dùng dữ liệu THẬT đã seed ở phiên trước: bác sĩ `6a4fba7e001249319b047cae` (phòng 102), y tá **Điều dưỡng Thanh Hà** (`nurse@vitafamily.vn` / mật khẩu `123456`), 4 lịch hẹn hôm nay `TEST_TODAY_APT_01..04`.

---

## Cấu trúc file

| File | Trách nhiệm | Loại |
|---|---|---|
| `backend/src/utils/nurse-scope.js` | `getTodayRange()`, `getMyDoctorIdsToday(nurseId)` | Tạo mới |
| `backend/src/controllers/nurse/room-status.controller.js` | List + lazy-upsert + đổi trạng thái phòng (không gồm `dang_kham`) | Tạo mới |
| `backend/src/controllers/nurse/queue.controller.js` | Check-in, list hàng đợi, gọi/vào phòng/kết thúc/skip/cancel | Tạo mới |
| `backend/src/routes/nurse/room-status.routes.js` | Route `/nurse/room-status` | Tạo mới |
| `backend/src/routes/nurse/queue.routes.js` | Route `/nurse/queue` | Tạo mới |
| `backend/src/routes/nurse/index.js` | Mount 2 route mới | Sửa |
| `backend/tests/nurse-queue-room.test.js` | Integration test end-to-end qua HTTP thật | Tạo mới |

---

## Task 1: Helper `nurse-scope.js`

**Files:**
- Create: `backend/src/utils/nurse-scope.js`

**Interfaces:**
- Produces: `getTodayRange(): {start: Date, end: Date}`, `getMyDoctorIdsToday(nurseId): Promise<string[]>` — dùng chung ở Task 2, 3, 4.

- [ ] **Step 1: Tạo file**

```js
import { LichLamViec } from '../models/index.js'

// ============================================================
// Phạm vi bác sĩ y tá phụ trách "hôm nay" — dùng chung queue + room-status.
// "Hôm nay" tính local server time (setHours), KHÔNG dùng UTC — khớp pattern
// đã dùng ở nurse/appointments.controller.js và nurse/dashboard.controller.js.
// ============================================================

export function getTodayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

export async function getMyDoctorIdsToday(nurseId) {
  const { start, end } = getTodayRange()
  const ids = await LichLamViec.find({ nurse_id: nurseId, ngay: { $gte: start, $lt: end } }).distinct('doctor_id')
  return ids.map(String)
}
```

- [ ] **Step 2: Không có test riêng cho helper thuần** (được test gián tiếp qua Task 3/4 integration test) — bỏ qua bước test độc lập, xác nhận cú pháp bằng cách import thử:

```
node -e "import('./src/utils/nurse-scope.js').then(m => console.log(typeof m.getTodayRange, typeof m.getMyDoctorIdsToday))"
```
Chạy tại `backend/`. Mong đợi in ra: `function function`

- [ ] **Step 3: Checkpoint commit (nhóm tự làm)**
```
git add backend/src/utils/nurse-scope.js
git commit -m "feat(nurse): helper xac dinh bac si y ta phu trach hom nay"
```

---

## Task 2: `room-status.controller.js` — list + lazy-upsert + transitions không cần presence

**Files:**
- Create: `backend/src/controllers/nurse/room-status.controller.js`
- Create: `backend/src/routes/nurse/room-status.routes.js`
- Modify: `backend/src/routes/nurse/index.js`

**Interfaces:**
- Consumes: `getMyDoctorIdsToday` (Task 1), model `TrangThaiPhongKham`, `LichLamViec`, `BacSi`, `NhatKyThaoTac` (barrel `models/index.js`).
- Produces: `GET /api/nurse/room-status` (list), `PATCH /api/nurse/room-status/:doctorId` (body `{trang_thai}` — chỉ nhận `san_sang`, `tam_nghi`, `dang_don_phong`; **từ chối `dang_kham`** — chỉ set được qua `queue.controller.js` Task 4 vì cần `benh_nhan_hien_tai_id`).
- Hàm `findOrCreateRoomStatus(doctorId, nurseId)` export để Task 4 tái dùng khi vào phòng/kết thúc khám.

- [ ] **Step 1: Tạo controller**

```js
import { TrangThaiPhongKham, LichLamViec, BacSi, NhatKyThaoTac } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'
import { getTodayRange, getMyDoctorIdsToday } from '../../utils/nurse-scope.js'

// ============================================================
// Trạng thái phòng/bác sĩ (Y tá) — Routes: /api/nurse/room-status
// 1 bản ghi / bác sĩ / ngày, tạo LƯỜI (lazy upsert) khi y tá thao tác lần đầu.
// dang_kham CHỈ set được qua queue.controller.js (into-room) — cần benh_nhan_hien_tai_id
// kèm theo (presence-gate) nên không cho set trực tiếp ở đây.
// ============================================================

const MANUAL_STATUSES = ['san_sang', 'tam_nghi', 'dang_don_phong']

async function ghiAudit(nurseId, doctorId, tuTrangThai, denTrangThai) {
  await NhatKyThaoTac.create({
    nguoi_thuc_hien_id: nurseId,
    vai_tro: 'nurse',
    hanh_dong: 'CHANGE_DOCTOR_STATUS',
    loai_doi_tuong: 'room_status',
    doi_tuong_id: doctorId,
    du_lieu_cu: { trang_thai: tuTrangThai },
    du_lieu_moi: { trang_thai: denTrangThai },
  })
}

// Tạo lười — dùng chung cho GET list và queue.controller.js (vào phòng/kết thúc khám).
export async function findOrCreateRoomStatus(doctorId, nurseId) {
  const { start } = getTodayRange()
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
    nurse_id: nurseId,
  })
  return room
}

// ─── GET /api/nurse/room-status ──────────────────────────────────────────────
export async function list(req, res) {
  try {
    const doctorIds = await getMyDoctorIdsToday(req.user.id)
    if (doctorIds.length === 0) return ok(res, [])

    const rooms = await Promise.all(doctorIds.map((id) => findOrCreateRoomStatus(id, req.user.id)))
    const doctors = await BacSi.find({ _id: { $in: doctorIds } })
      .select('phong_kham_mac_dinh specialties')
      .populate([{ path: 'user_id', select: 'ho_ten' }, { path: 'specialties', select: 'ten' }])
      .lean()
    const doctorById = new Map(doctors.map((d) => [String(d._id), d]))

    const data = rooms.map((r) => {
      const d = doctorById.get(String(r.doctor_id))
      return {
        doctor_id: r.doctor_id,
        ten_bac_si: d?.user_id?.ho_ten ?? null,
        chuyen_khoa: (d?.specialties || []).map((s) => s.ten).join(', ') || null,
        phong_kham: r.phong_kham,
        trang_thai: r.trang_thai,
        benh_nhan_hien_tai_id: r.benh_nhan_hien_tai_id,
        y_ta_co_mat: r.y_ta_co_mat,
        thoi_gian_kham_tb_phut: r.thoi_gian_kham_tb_phut,
        thoi_diem_doi: r.thoi_diem_doi,
      }
    })
    return ok(res, data)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/nurse/room-status/:doctorId ─────────────────────────────────
export async function updateStatus(req, res) {
  try {
    const { doctorId } = req.params
    const { trang_thai } = req.body

    if (!MANUAL_STATUSES.includes(trang_thai)) {
      return fail(res, 400, `trang_thai không hợp lệ cho thao tác thủ công. Chỉ nhận: ${MANUAL_STATUSES.join(', ')}`)
    }

    const doctorIds = await getMyDoctorIdsToday(req.user.id)
    if (!doctorIds.includes(String(doctorId))) {
      return fail(res, 403, 'Bác sĩ này không thuộc ca bạn phụ trách hôm nay')
    }

    const room = await findOrCreateRoomStatus(doctorId, req.user.id)
    const tu = room.trang_thai

    if (trang_thai === 'tam_nghi' && room.benh_nhan_hien_tai_id) {
      return fail(res, 409, 'Không thể chuyển tạm nghỉ khi còn bệnh nhân trong phòng')
    }
    if (trang_thai === 'dang_don_phong' && tu !== 'dang_kham') {
      return fail(res, 409, 'Chỉ chuyển sang dọn phòng khi đang khám')
    }
    if (trang_thai === 'san_sang' && !['tam_nghi', 'dang_don_phong', 'san_sang'].includes(tu)) {
      return fail(res, 409, 'Không thể chuyển thẳng sang sẵn sàng từ trạng thái hiện tại')
    }

    room.trang_thai = trang_thai
    room.thoi_diem_doi = new Date()
    room.nguoi_dieu_khien_id = req.user.id
    room.nguoi_dieu_khien_vai_tro = 'nurse'
    await room.save()

    await ghiAudit(req.user.id, doctorId, tu, trang_thai)

    return ok(res, { doctor_id: doctorId, trang_thai: room.trang_thai }, 'Đã cập nhật trạng thái phòng')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
```

- [ ] **Step 2: Tạo route**

```js
import { Router } from 'express'
import * as roomStatus from '../../controllers/nurse/room-status.controller.js'

const router = Router()

router.get('/', roomStatus.list)
router.patch('/:doctorId', roomStatus.updateStatus)

export default router
```
Lưu tại `backend/src/routes/nurse/room-status.routes.js`.

- [ ] **Step 3: Mount route**

Trong `backend/src/routes/nurse/index.js`, thêm:
```js
import roomStatusRoutes from './room-status.routes.js'
// ...
router.use('/room-status', roomStatusRoutes)
```

- [ ] **Step 4: Kiểm tra cú pháp (chưa chạy HTTP — test đầy đủ ở Task 5)**
```
node -e "import('./src/controllers/nurse/room-status.controller.js').then(m => console.log(Object.keys(m)))"
```
Chạy tại `backend/`. Mong đợi: `[ 'findOrCreateRoomStatus', 'list', 'updateStatus' ]` (không lỗi import).

- [ ] **Step 5: Checkpoint commit (nhóm tự làm)**
```
git add backend/src/controllers/nurse/room-status.controller.js backend/src/routes/nurse/room-status.routes.js backend/src/routes/nurse/index.js
git commit -m "feat(nurse): controller trang thai phong (lazy upsert + 3 chuyen tiep thu cong)"
```

---

## Task 3: `queue.controller.js` — check-in + list hàng đợi

**Files:**
- Create: `backend/src/controllers/nurse/queue.controller.js`
- Create: `backend/src/routes/nurse/queue.routes.js`
- Modify: `backend/src/routes/nurse/index.js`

**Interfaces:**
- Consumes: `getMyDoctorIdsToday`, `getTodayRange` (Task 1); `tinhMucUuTien` từ `models/HangDoi.js` (named export, KHÔNG qua barrel).
- Produces: `POST /api/nurse/queue/checkin`, `GET /api/nurse/queue`.

- [ ] **Step 1: Tạo controller (phần check-in + list)**

```js
import { HangDoi, LichHen, LichLamViec, TrangThaiPhongKham, ThanhVien } from '../../models/index.js'
import { tinhMucUuTien } from '../../models/HangDoi.js'
import { ok, created, fail } from '../../utils/response.js'
import { getTodayRange, getMyDoctorIdsToday } from '../../utils/nurse-scope.js'

// ============================================================
// Hàng đợi động (Y tá) — Routes: /api/nurse/queue
// Online + offline ĐỒNG NHẤT trong 1 collection HangDoi — chỉ khác nhánh muc_uu_tien.
// KHÔNG lưu thu_tu — sort động app-side (muc_uu_tien -> checkin_time).
// ============================================================

const UU_TIEN_WEIGHT = { online_uu_tien: 0, online_thuong: 1, offline: 2 }
const CON_HIEN_DIEN = ['dang_cho', 'da_goi']
const DANG_XU_LY = ['dang_cho', 'da_goi', 'trong_phong']

function sapXepHangDoi(list) {
  return [...list].sort((a, b) => {
    const w = UU_TIEN_WEIGHT[a.muc_uu_tien] - UU_TIEN_WEIGHT[b.muc_uu_tien]
    if (w !== 0) return w
    return new Date(a.checkin_time) - new Date(b.checkin_time)
  })
}

function buildGioHenGoc(ngayKham, gioKham) {
  if (!gioKham) return null
  const [h, m] = gioKham.split(':').map(Number)
  const d = new Date(ngayKham)
  d.setHours(h, m, 0, 0) // local — KHÔNG dùng setUTCHours (tránh lệch múi giờ)
  return d
}

// ─── POST /api/nurse/queue/checkin ───────────────────────────────────────────
export async function checkin(req, res) {
  try {
    const { appointment_id, doctor_id, ten_benh_nhan, so_dien_thoai, tuoi, gioi_tinh, specialty_id } = req.body
    const doctorIds = await getMyDoctorIdsToday(req.user.id)
    const { start: todayStart, end: todayEnd } = getTodayRange()
    const now = new Date()

    let payload

    if (appointment_id) {
      // ── Online: bám theo LichHen đã đặt trước ──────────────────────────
      const appt = await LichHen.findById(appointment_id)
      if (!appt) return fail(res, 404, 'Không tìm thấy lịch hẹn')
      if (!doctorIds.includes(String(appt.doctor_id))) {
        return fail(res, 403, 'Lịch hẹn không thuộc bác sĩ bạn phụ trách hôm nay')
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
        vai_tro_tiep_nhan: 'nurse',
      }

      appt.gio_den_thuc_te = now
      appt.trang_thai_den = 'da_den'
      if (appt.status === 'pending') appt.status = 'confirmed'
      await appt.save()
    } else {
      // ── Offline: khách vãng lai / đến trực tiếp ────────────────────────
      if (!doctor_id || !doctorIds.includes(String(doctor_id))) {
        return fail(res, 403, 'Bác sĩ này không thuộc ca bạn phụ trách hôm nay')
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
        vai_tro_tiep_nhan: 'nurse',
      }
    }

    const entry = await HangDoi.create(payload)

    // Cảnh báo quá tải (không chặn — quyết định đã chốt)
    const canhBao = await tinhCanhBaoQuaTai(payload.doctor_id, todayStart)

    return created(res, { entry, canh_bao_qua_tai: canhBao }, 'Đã check-in vào hàng đợi')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

async function tinhCanhBaoQuaTai(doctorId, todayStart) {
  const schedule = await LichLamViec.findOne({ doctor_id: doctorId, ngay: todayStart }).lean()
  if (!schedule?.slots?.length) return null
  const gioKetThucCa = schedule.slots.reduce((max, s) => (s.gio_ket_thuc > max ? s.gio_ket_thuc : max), '00:00')
  const [h, m] = gioKetThucCa.split(':').map(Number)
  const ketThucCa = new Date(todayStart)
  ketThucCa.setHours(h, m, 0, 0)

  const room = await TrangThaiPhongKham.findOne({ doctor_id: doctorId, ngay: todayStart }).lean()
  const tbPhut = room?.thoi_gian_kham_tb_phut ?? 20
  const soDangPhucVu = await HangDoi.countDocuments({ doctor_id: doctorId, trang_thai: { $in: DANG_XU_LY } })
  const duKienXong = new Date(Date.now() + (soDangPhucVu + 1) * tbPhut * 60000)

  if (duKienXong > ketThucCa) {
    return `Dự kiến xong lúc ${duKienXong.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}, sau giờ kết thúc ca (${gioKetThucCa}). Cân nhắc hẹn đợt sau.`
  }
  return null
}

// ─── GET /api/nurse/queue?status= ────────────────────────────────────────────
export async function list(req, res) {
  try {
    const doctorIds = await getMyDoctorIdsToday(req.user.id)
    if (doctorIds.length === 0) return ok(res, [])

    const { status } = req.query
    const filter = { doctor_id: { $in: doctorIds } }
    filter.trang_thai = status || { $in: [...DANG_XU_LY, 'skipped', 'cancelled', 'hoan_thanh'] }

    const entries = await HangDoi.find(filter).lean()
    const grouped = new Map()
    for (const e of entries) {
      const key = String(e.doctor_id)
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key).push(e)
    }

    const rooms = await TrangThaiPhongKham.find({ doctor_id: { $in: doctorIds } }).lean()
    const roomByDoctor = new Map(rooms.map((r) => [String(r.doctor_id), r]))

    const result = []
    for (const [doctorId, list] of grouped) {
      const sorted = sapXepHangDoi(list)
      const tbPhut = roomByDoctor.get(doctorId)?.thoi_gian_kham_tb_phut ?? 20
      let viTriChoDangCho = 0
      for (const e of sorted) {
        const isWaiting = CON_HIEN_DIEN.includes(e.trang_thai)
        if (isWaiting) viTriChoDangCho++
        result.push({
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
          thoi_gian_cho_uoc_tinh_phut: isWaiting ? viTriChoDangCho * tbPhut : null,
        })
      }
    }
    return ok(res, result)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
```

- [ ] **Step 2: Tạo route (đủ 2 endpoint check-in + list — 4 hành động còn lại thêm ở Task 4)**

```js
import { Router } from 'express'
import * as queue from '../../controllers/nurse/queue.controller.js'

const router = Router()

router.get('/', queue.list)
router.post('/checkin', queue.checkin)

export default router
```
Lưu tại `backend/src/routes/nurse/queue.routes.js`.

- [ ] **Step 3: Mount route**

Trong `backend/src/routes/nurse/index.js`, thêm:
```js
import queueRoutes from './queue.routes.js'
// ...
router.use('/queue', queueRoutes)
```

- [ ] **Step 4: Kiểm tra cú pháp**
```
node -e "import('./src/controllers/nurse/queue.controller.js').then(m => console.log(Object.keys(m)))"
```
Chạy tại `backend/`. Mong đợi không lỗi import (danh sách export gồm ít nhất `checkin`, `list`).

- [ ] **Step 5: Checkpoint commit (nhóm tự làm)**
```
git add backend/src/controllers/nurse/queue.controller.js backend/src/routes/nurse/queue.routes.js backend/src/routes/nurse/index.js
git commit -m "feat(nurse): check-in hang doi online/offline + list co uu tien va uoc tinh cho"
```

---

## Task 4: Queue actions — call / into-room / finish / skip / cancel

**Files:**
- Modify: `backend/src/controllers/nurse/queue.controller.js` (thêm 5 hàm)
- Modify: `backend/src/routes/nurse/queue.routes.js` (thêm 5 route)

**Interfaces:**
- Consumes: `findOrCreateRoomStatus` từ `room-status.controller.js` (Task 2).
- Produces: `PATCH /api/nurse/queue/:id/call`, `.../into-room`, `.../finish`, `.../skip`, `.../cancel`.

- [ ] **Step 1: Thêm import + helper audit vào đầu `queue.controller.js`**

```js
import { NhatKyThaoTac, ThongBao, NguoiDung } from '../../models/index.js'
import { findOrCreateRoomStatus } from './room-status.controller.js'

async function ghiAuditQueue(nurseId, hanhDong, entryId, duLieuCu, duLieuMoi) {
  await NhatKyThaoTac.create({
    nguoi_thuc_hien_id: nurseId,
    vai_tro: 'nurse',
    hanh_dong: hanhDong,
    loai_doi_tuong: 'queue_entry',
    doi_tuong_id: entryId,
    du_lieu_cu: duLieuCu,
    du_lieu_moi: duLieuMoi,
  })
}

async function timEntryTrongCa(entryId, nurseId) {
  const doctorIds = await getMyDoctorIdsToday(nurseId)
  const entry = await HangDoi.findById(entryId)
  if (!entry) return { entry: null, error: [404, 'Không tìm thấy hàng đợi'] }
  if (!doctorIds.includes(String(entry.doctor_id))) {
    return { entry: null, error: [403, 'Hàng đợi này không thuộc bác sĩ bạn phụ trách hôm nay'] }
  }
  return { entry, error: null }
}
```

- [ ] **Step 2: Thêm 5 hàm vào cuối `queue.controller.js`**

```js
// ─── PATCH /api/nurse/queue/:id/call ─────────────────────────────────────────
export async function call(req, res) {
  try {
    const { entry, error } = await timEntryTrongCa(req.params.id, req.user.id)
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
      const room = await findOrCreateRoomStatus(entry.doctor_id, req.user.id)
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

// ─── PATCH /api/nurse/queue/:id/into-room ────────────────────────────────────
// Presence-gate: chỉ entry đang CON_HIEN_DIEN (dang_cho/da_goi) mới được vào phòng.
export async function intoRoom(req, res) {
  try {
    const { entry, error } = await timEntryTrongCa(req.params.id, req.user.id)
    if (error) return fail(res, ...error)
    if (!CON_HIEN_DIEN.includes(entry.trang_thai)) {
      return fail(res, 409, 'Bệnh nhân phải đang có mặt (chờ hoặc đã gọi) mới vào được phòng')
    }

    const room = await findOrCreateRoomStatus(entry.doctor_id, req.user.id)
    if (room.trang_thai !== 'san_sang') {
      return fail(res, 409, `Phòng chưa sẵn sàng (đang: ${room.trang_thai})`)
    }

    entry.trang_thai = 'trong_phong'
    entry.thoi_diem_vao_phong = new Date()
    await entry.save()

    const tuRoom = room.trang_thai
    room.trang_thai = 'dang_kham'
    room.benh_nhan_hien_tai_id = entry._id
    room.y_ta_co_mat = true
    room.nguoi_dieu_khien_id = req.user.id
    room.nguoi_dieu_khien_vai_tro = 'nurse'
    room.thoi_diem_doi = new Date()
    await room.save()

    if (entry.appointment_id) {
      await LichHen.updateOne({ _id: entry.appointment_id }, { $set: { status: 'in_progress' } })
    }

    await ghiAuditQueue(req.user.id, 'CALL_PATIENT', entry._id, { trang_thai: 'da_goi' }, { trang_thai: 'trong_phong' })
    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: req.user.id, vai_tro: 'nurse', hanh_dong: 'CHANGE_DOCTOR_STATUS',
      loai_doi_tuong: 'room_status', doi_tuong_id: entry.doctor_id,
      du_lieu_cu: { trang_thai: tuRoom }, du_lieu_moi: { trang_thai: 'dang_kham' },
    })

    return ok(res, { id: entry._id, trang_thai: entry.trang_thai }, 'Bệnh nhân đã vào phòng')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/nurse/queue/:id/finish ───────────────────────────────────────
export async function finish(req, res) {
  try {
    const { entry, error } = await timEntryTrongCa(req.params.id, req.user.id)
    if (error) return fail(res, ...error)
    if (entry.trang_thai !== 'trong_phong') {
      return fail(res, 409, 'Chỉ kết thúc được lịch đang trong phòng')
    }

    const room = await findOrCreateRoomStatus(entry.doctor_id, req.user.id)
    if (String(room.benh_nhan_hien_tai_id) !== String(entry._id)) {
      return fail(res, 409, 'Bệnh nhân này không khớp với người đang trong phòng')
    }

    entry.trang_thai = 'hoan_thanh'
    entry.thoi_diem_ket_thuc = new Date()
    await entry.save()

    const tuRoom = room.trang_thai
    room.trang_thai = 'dang_don_phong'
    room.benh_nhan_hien_tai_id = null
    room.thoi_diem_doi = new Date()
    if (entry.thoi_diem_vao_phong) {
      const phutThucTe = Math.max(1, Math.round((entry.thoi_diem_ket_thuc - entry.thoi_diem_vao_phong) / 60000))
      room.thoi_gian_kham_tb_phut = Math.round(0.7 * room.thoi_gian_kham_tb_phut + 0.3 * phutThucTe)
    }
    await room.save()

    if (entry.appointment_id) {
      await LichHen.updateOne({ _id: entry.appointment_id }, { $set: { status: 'waiting_record' } })
    }

    await ghiAuditQueue(req.user.id, 'CALL_PATIENT', entry._id, { trang_thai: 'trong_phong' }, { trang_thai: 'hoan_thanh' })
    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: req.user.id, vai_tro: 'nurse', hanh_dong: 'CHANGE_DOCTOR_STATUS',
      loai_doi_tuong: 'room_status', doi_tuong_id: entry.doctor_id,
      du_lieu_cu: { trang_thai: tuRoom }, du_lieu_moi: { trang_thai: 'dang_don_phong' },
    })

    return ok(res, { id: entry._id, trang_thai: entry.trang_thai }, 'Đã kết thúc khám, chờ nhập hồ sơ')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/nurse/queue/:id/skip ─────────────────────────────────────────
export async function skip(req, res) {
  try {
    const { entry, error } = await timEntryTrongCa(req.params.id, req.user.id)
    if (error) return fail(res, ...error)
    if (!CON_HIEN_DIEN.includes(entry.trang_thai)) {
      return fail(res, 409, 'Chỉ bỏ lượt được bệnh nhân đang chờ hoặc đã gọi')
    }

    const tu = entry.trang_thai
    entry.trang_thai = 'skipped'
    await entry.save()

    if (entry.appointment_id) {
      await LichHen.updateOne({ _id: entry.appointment_id }, { $set: { status: 'skipped' } })
    }

    await ghiAuditQueue(req.user.id, 'SKIP_PATIENT', entry._id, { trang_thai: tu }, { trang_thai: 'skipped' })

    return ok(res, { id: entry._id, trang_thai: entry.trang_thai }, 'Đã bỏ lượt bệnh nhân')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/nurse/queue/:id/cancel ───────────────────────────────────────
export async function cancel(req, res) {
  try {
    const { entry, error } = await timEntryTrongCa(req.params.id, req.user.id)
    if (error) return fail(res, ...error)
    if (!CON_HIEN_DIEN.includes(entry.trang_thai)) {
      return fail(res, 409, 'Chỉ hủy được bệnh nhân đang chờ hoặc đã gọi')
    }

    const tu = entry.trang_thai
    entry.trang_thai = 'cancelled'
    await entry.save()

    if (entry.appointment_id) {
      await LichHen.updateOne({ _id: entry.appointment_id }, { $set: { status: 'cancelled' } })
    }

    await ghiAuditQueue(req.user.id, 'SKIP_PATIENT', entry._id, { trang_thai: tu }, { trang_thai: 'cancelled' })

    return ok(res, { id: entry._id, trang_thai: entry.trang_thai }, 'Đã hủy lượt khám')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
```

- [ ] **Step 3: Thêm route vào `queue.routes.js`**

```js
router.patch('/:id/call', queue.call)
router.patch('/:id/into-room', queue.intoRoom)
router.patch('/:id/finish', queue.finish)
router.patch('/:id/skip', queue.skip)
router.patch('/:id/cancel', queue.cancel)
```
Thêm trước `export default router`.

- [ ] **Step 4: Kiểm tra cú pháp**
```
node -e "import('./src/controllers/nurse/queue.controller.js').then(m => console.log(Object.keys(m)))"
```
Mong đợi export đủ: `checkin, list, call, intoRoom, finish, skip, cancel`.

- [ ] **Step 5: Checkpoint commit (nhóm tự làm)**
```
git add backend/src/controllers/nurse/queue.controller.js backend/src/routes/nurse/queue.routes.js
git commit -m "feat(nurse): goi benh nhan, vao phong (presence-gate), ket thuc kham, skip, cancel"
```

---

## Task 5: Integration test end-to-end (dữ liệu thật)

**Files:**
- Create: `backend/tests/nurse-queue-room.test.js`

**Interfaces:**
- Consumes: server backend đang chạy tại `TEST_API_BASE_URL` (mặc định `http://localhost:5000/api`), tài khoản y tá thật.

- [ ] **Step 1: Tạo file test**

```js
import { test, before } from 'node:test'
import assert from 'node:assert/strict'

// ============================================================
// INTEGRATION TEST — Trạng thái phòng + Hàng đợi + Gọi bệnh nhân (Kế hoạch 2)
// Yêu cầu: backend chạy tại BASE_URL, dùng tài khoản y tá thật đã seed
//          (nurse@vitafamily.vn / 123456) và 4 lịch hẹn TEST_TODAY_APT_01..04
//          đã seed hôm nay cho bác sĩ 6a4fba7e001249319b047cae.
// ============================================================

const BASE_URL = process.env.TEST_API_BASE_URL || 'http://localhost:5000/api'
const NURSE_EMAIL = 'nurse@vitafamily.vn'
const NURSE_PASSWORD = '123456'
const DOCTOR_ID = '6a4fba7e001249319b047cae'

let token
let apt01Id // TEST_TODAY_APT_01 — dùng để test toàn bộ luồng checkin -> call -> into-room -> finish
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
  const login = await api('/auth/login', { method: 'POST', body: { email: NURSE_EMAIL, mat_khau: NURSE_PASSWORD } })
  assert.equal(login.status, 200, 'Đăng nhập y tá thất bại — kiểm tra seed-all.js đã chạy chưa')
  token = login.body.data.token
})

test('GET /nurse/room-status -> có bác sĩ mình phụ trách hôm nay, lazy-create OK', async () => {
  const res = await api('/nurse/room-status', { auth: token })
  assert.equal(res.status, 200)
  assert.ok(Array.isArray(res.body.data))
  const room = res.body.data.find((r) => String(r.doctor_id) === DOCTOR_ID)
  assert.ok(room, 'Không thấy trạng thái phòng của bác sĩ mục tiêu')
  assert.equal(room.trang_thai, 'san_sang')
})

test('GET /nurse/queue tìm ma_lich_hen TEST_TODAY_APT_01 qua nurse/appointments để lấy id', async () => {
  const res = await api('/nurse/appointments?date=' + new Date().toISOString().slice(0, 10), { auth: token })
  assert.equal(res.status, 200)
  const apt = res.body.data.find((a) => a.ma_lich_hen === 'TEST_TODAY_APT_01')
  assert.ok(apt, 'Không tìm thấy TEST_TODAY_APT_01 — kiểm tra dữ liệu seed hôm nay')
  apt01Id = apt.id
})

test('POST /nurse/queue/checkin (online) -> tạo entry, muc_uu_tien hợp lệ', async () => {
  const res = await api('/nurse/queue/checkin', { method: 'POST', auth: token, body: { appointment_id: apt01Id } })
  assert.equal(res.status, 201)
  assert.ok(['online_uu_tien', 'online_thuong', 'offline'].includes(res.body.data.entry.muc_uu_tien))
  queueEntryId = res.body.data.entry._id ?? res.body.data.entry.id
})

test('POST /nurse/queue/checkin lần 2 cùng appointment -> 409', async () => {
  const res = await api('/nurse/queue/checkin', { method: 'POST', auth: token, body: { appointment_id: apt01Id } })
  assert.equal(res.status, 409)
})

test('GET /nurse/queue -> thấy entry vừa tạo, có thoi_gian_cho_uoc_tinh_phut', async () => {
  const res = await api('/nurse/queue', { auth: token })
  assert.equal(res.status, 200)
  const entry = res.body.data.find((e) => String(e.id) === String(queueEntryId))
  assert.ok(entry)
  assert.equal(entry.trang_thai, 'dang_cho')
  assert.ok(entry.thoi_gian_cho_uoc_tinh_phut > 0)
})

test('PATCH /nurse/queue/:id/into-room khi CHƯA gọi -> vẫn OK (presence = dang_cho)', async () => {
  const res = await api(`/nurse/queue/${queueEntryId}/into-room`, { method: 'PATCH', auth: token })
  assert.equal(res.status, 200)
  assert.equal(res.body.data.trang_thai, 'trong_phong')
})

test('GET /nurse/room-status -> phòng chuyển dang_kham, benh_nhan_hien_tai_id = entry', async () => {
  const res = await api('/nurse/room-status', { auth: token })
  const room = res.body.data.find((r) => String(r.doctor_id) === DOCTOR_ID)
  assert.equal(room.trang_thai, 'dang_kham')
  assert.equal(String(room.benh_nhan_hien_tai_id), String(queueEntryId))
})

test('PATCH /nurse/room-status/:doctorId set tam_nghi khi còn bệnh nhân -> 409', async () => {
  const res = await api(`/nurse/room-status/${DOCTOR_ID}`, { method: 'PATCH', auth: token, body: { trang_thai: 'tam_nghi' } })
  assert.equal(res.status, 409)
})

test('PATCH /nurse/queue/:id/finish -> hoan_thanh, phòng chuyển dang_don_phong', async () => {
  const res = await api(`/nurse/queue/${queueEntryId}/finish`, { method: 'PATCH', auth: token })
  assert.equal(res.status, 200)
  assert.equal(res.body.data.trang_thai, 'hoan_thanh')

  const roomRes = await api('/nurse/room-status', { auth: token })
  const room = roomRes.body.data.find((r) => String(r.doctor_id) === DOCTOR_ID)
  assert.equal(room.trang_thai, 'dang_don_phong')
  assert.equal(room.benh_nhan_hien_tai_id, null)
})

test('PATCH /nurse/room-status/:doctorId set dang_kham thủ công -> 400 (chỉ qua into-room)', async () => {
  const res = await api(`/nurse/room-status/${DOCTOR_ID}`, { method: 'PATCH', auth: token, body: { trang_thai: 'dang_kham' } })
  assert.equal(res.status, 400)
})

test('PATCH /nurse/room-status/:doctorId dang_don_phong -> san_sang OK', async () => {
  const res = await api(`/nurse/room-status/${DOCTOR_ID}`, { method: 'PATCH', auth: token, body: { trang_thai: 'san_sang' } })
  assert.equal(res.status, 200)
  assert.equal(res.body.data.trang_thai, 'san_sang')
})

test('POST /nurse/queue/checkin offline -> muc_uu_tien = offline', async () => {
  const res = await api('/nurse/queue/checkin', {
    method: 'POST', auth: token,
    body: { doctor_id: DOCTOR_ID, ten_benh_nhan: 'TEST_WALKIN Khách Vãng Lai', so_dien_thoai: '0909999999' },
  })
  assert.equal(res.status, 201)
  assert.equal(res.body.data.entry.muc_uu_tien, 'offline')

  // Dọn: skip luôn entry offline vừa tạo để không lưu rác vĩnh viễn trong hàng đợi thật
  const offlineId = res.body.data.entry._id ?? res.body.data.entry.id
  const skipRes = await api(`/nurse/queue/${offlineId}/skip`, { method: 'PATCH', auth: token })
  assert.equal(skipRes.status, 200)
})

test('PATCH /nurse/queue/:id/into-room lần 2 (đã hoan_thanh) -> 409', async () => {
  const res = await api(`/nurse/queue/${queueEntryId}/into-room`, { method: 'PATCH', auth: token })
  assert.equal(res.status, 409)
})
```

- [ ] **Step 2: Chạy backend server thật (terminal riêng, không phải trong test)**
```
cd backend && npm run dev
```
Giữ chạy nền trong lúc test.

- [ ] **Step 3: Chạy test**
```
cd backend && node --test tests/nurse-queue-room.test.js
```
Mong đợi: tất cả test PASS. Nếu `before()` fail ở login → kiểm tra `seed-all.js` đã chạy trên DB đang trỏ tới (`MONGODB_URI` trong `.env`).

- [ ] **Step 4: Regression — chạy lại test model Kế hoạch 1 + test bác sĩ hiện có**
```
node --test tests/nurse-db.models.test.js
node --test tests/doctor.schedule.test.js tests/doctor.api.test.js
```
Mong đợi: không có test nào mới fail so với trước Kế hoạch 2 (route mới không đụng route/model cũ).

- [ ] **Step 5: Checkpoint commit (nhóm tự làm)**
```
git add backend/tests/nurse-queue-room.test.js
git commit -m "test(nurse): integration test trang thai phong + hang doi + goi benh nhan"
```

---

## Cập nhật tài liệu sau khi hoàn tất (bắt buộc theo feedback lưu memory)

- [ ] Cập nhật `docs/Y tá/DB CHANGES - Nen tang trang Y ta (2026-07-15).md` mục "F. Việc còn lại" (nếu Kế hoạch 2 phát sinh field mới ngoài dự kiến — hiện tại **không** phát sinh field mới, chỉ dùng field đã định nghĩa ở Kế hoạch 1).
- [ ] Ghi chú lại 4 dữ liệu test mới bị ảnh hưởng bởi Kế hoạch 2 khi chạy test thật: `TEST_TODAY_APT_01` sẽ có `status='waiting_record'` sau khi chạy hết test — **không phải bug**, là kết quả luồng thật. Nếu chạy lại test nhiều lần, `POST checkin` cho appointment đã ở `waiting_record` sẽ vẫn cho phép check-in lại (không nằm trong danh sách cấm) nhưng sẽ 409 do đã có `HangDoi` cũ (unique appointment_id) — **cần dọn `HangDoi` cũ trước khi chạy lại test**, hoặc chạy trên `TEST_TODAY_APT_02/03/04` thay thế nếu muốn test lại từ đầu.

---

## Tự rà (self-review)

- **Phủ spec:** Task 2 phủ mục "Trạng thái phòng phải qua đọn phòng" + "tạo lười". Task 3 phủ "hàng đợi đồng nhất online/offline" + "cửa sổ ưu tiên ±30'" + "ngưỡng nhận cảnh báo". Task 4 phủ "presence-gate", "gọi bệnh nhân báo lễ tân", "kết thúc khám → waiting_record", "skip/cancel". Đúng quyết định đã chốt: gán theo bác sĩ (A), bỏ `thu_tu` (B), tạo lười + presence-gate (C), cảnh báo không chặn (D — F4).
- **Không placeholder:** mọi Task có code đầy đủ, lệnh chạy cụ thể.
- **Nhất quán field:** toàn bộ tên field khớp `DB CHANGES - Nen tang trang Y ta (2026-07-15).md` — không đổi tên nào so với Kế hoạch 1 (`HangDoi.trang_thai`, `TrangThaiPhongKham.benh_nhan_hien_tai_id`, `LichHen.status` giá trị `waiting_record`/`skipped`...).
- **Chưa làm (đúng phạm vi, để Kế hoạch sau):** dự phòng lễ tân/admin (Kế hoạch 6), đơn thuốc/dịch vụ phát sinh (Kế hoạch 5), frontend Nurse Portal (Kế hoạch 7), cron tự động no-show 5'/10' (hiện y tá bấm skip thủ công).
