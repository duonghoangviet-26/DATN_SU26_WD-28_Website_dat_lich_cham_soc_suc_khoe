import mongoose from 'mongoose'
import {
  BacSi,
  LichHen,
  LichLamViec,
  NguoiDung,
  NhatKyThaoTac,
  PhongKham,
} from '../../models/index.js'
import { ok, created, fail } from '../../utils/response.js'

const ROOM_STATUS = ['active', 'inactive']
const ACTIVE_APPOINTMENT_STATUSES = ['pending', 'confirmed', 'checked_in', 'in_progress', 'waiting_record', 'waiting_doctor_confirm']
const OCCUPIED_SLOT_STATUSES = ['booked', 'pending_payment']
const CLINIC_BUILDING_NAME = 'ViteFamily'

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value)
}

function todayStart() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function normalizeText(value, field, { required = false, max = 100 } = {}) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (required && !text) throw new Error(`${field} là bắt buộc`)
  if (text.length > max) throw new Error(`${field} tối đa ${max} ký tự`)
  return text || null
}

function normalizeRoomPayload(body, { partial = false } = {}) {
  const payload = {}

  if (!partial || body.ten !== undefined) {
    payload.ten = normalizeText(body.ten, 'Tên phòng', { required: true, max: 50 })
  }

  if (!partial || body.tang !== undefined) {
    const floor = Number(body.tang)
    if (!Number.isInteger(floor) || floor < 1 || floor > 99) {
      throw new Error('Tầng phải là số nguyên từ 1 đến 99')
    }
    payload.tang = floor
  }

  payload.toa = CLINIC_BUILDING_NAME

  if (!partial || body.loai !== undefined) {
    payload.loai = normalizeText(body.loai, 'Loại phòng', { required: true, max: 100 })
  }

  if (body.trang_thai !== undefined) {
    if (!ROOM_STATUS.includes(body.trang_thai)) throw new Error('Trạng thái phòng không hợp lệ')
    payload.trang_thai = body.trang_thai
  } else if (!partial) {
    payload.trang_thai = 'active'
  }

  if (body.doctor_ids !== undefined) {
    if (!Array.isArray(body.doctor_ids)) throw new Error('Danh sách bác sĩ không hợp lệ')
    payload.doctor_ids = uniqueIds(body.doctor_ids, 'Bác sĩ')
  }

  if (body.nurse_ids !== undefined) {
    if (!Array.isArray(body.nurse_ids)) throw new Error('Danh sách y tá không hợp lệ')
    payload.nurse_ids = uniqueIds(body.nurse_ids, 'Y tá')
  }

  return payload
}

function uniqueIds(ids, label) {
  const result = []
  for (const id of ids) {
    if (!isObjectId(id)) throw new Error(`${label} có mã không hợp lệ`)
    const text = String(id)
    if (!result.includes(text)) result.push(text)
  }
  return result
}

function roomFullName(room) {
  return `${room.ten}, Tầng ${room.tang}, Tòa ${room.toa}`
}

function toWindows1252Mojibake(value) {
  const cp1252 = {
    0x80: '\u20AC',
    0x82: '\u201A',
    0x83: '\u0192',
    0x84: '\u201E',
    0x85: '\u2026',
    0x86: '\u2020',
    0x87: '\u2021',
    0x88: '\u02C6',
    0x89: '\u2030',
    0x8A: '\u0160',
    0x8B: '\u2039',
    0x8C: '\u0152',
    0x8E: '\u017D',
    0x91: '\u2018',
    0x92: '\u2019',
    0x93: '\u201C',
    0x94: '\u201D',
    0x95: '\u2022',
    0x96: '\u2013',
    0x97: '\u2014',
    0x98: '\u02DC',
    0x99: '\u2122',
    0x9A: '\u0161',
    0x9B: '\u203A',
    0x9C: '\u0153',
    0x9E: '\u017E',
    0x9F: '\u0178',
  }
  return Array.from(Buffer.from(value, 'utf8'), (byte) => {
    if (cp1252[byte]) return cp1252[byte]
    return String.fromCharCode(byte)
  }).join('')
}

function compactDoctor(doctor) {
  return {
    _id: doctor._id,
    ho_ten: doctor.user_id?.ho_ten ?? 'Không rõ',
    email: doctor.user_id?.email ?? null,
    trang_thai_duyet: doctor.trang_thai_duyet,
    trang_thai: doctor.trang_thai,
    phong_kham_mac_dinh: doctor.phong_kham_mac_dinh ?? null,
    specialties: doctor.specialties ?? [],
  }
}

function compactNurse(nurse) {
  return {
    _id: nurse._id,
    ho_ten: nurse.ho_ten,
    email: nurse.email,
    so_dien_thoai: nurse.so_dien_thoai ?? null,
    status: nurse.status,
  }
}

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

async function assertUniqueRoom({ ten, tang, toa, excludeId = null }) {
  if (!ten || !tang || !toa) return
  const query = { ten, tang, toa }
  if (excludeId) query._id = { $ne: excludeId }
  const existed = await PhongKham.findOne(query).select('_id').lean()
  if (existed) throw new Error('Phòng này đã tồn tại trong cùng tòa')
}

async function writeRoomAudit(req, action, roomId, before, after, note) {
  try {
    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: req.user?.id ?? null,
      vai_tro: req.user?.role ?? 'admin',
      hanh_dong: action,
      loai_doi_tuong: 'clinic_room',
      doi_tuong_id: roomId,
      du_lieu_cu: before,
      du_lieu_moi: after,
      ly_do: note,
    })
  } catch (_) {
    // Audit logging must not block room management.
  }
}

async function countRoomUsage(fullName) {
  const start = todayStart()
  const [futureSchedules, activeAppointments] = await Promise.all([
    LichLamViec.countDocuments({ ngay: { $gte: start }, 'slots.phong_kham': fullName }),
    LichHen.countDocuments({
      phong_kham: fullName,
      ngay_kham: { $gte: start },
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    }),
  ])
  return { futureSchedules, activeAppointments }
}

async function normalizeClinicBuildingData() {
  const rooms = await PhongKham.find()
  for (const room of rooms) {
    const possibleOldNames = Array.from(new Set([
      room.full_name,
      `${room.ten}, Tầng ${room.tang}, Tòa ${room.toa}`,
      `${room.ten}, Tầng ${room.tang}, Tòa VitaFamily`,
      `${room.ten}, Tầng ${room.tang}, Tòa A`,
      `${room.ten}, Tầng ${room.tang}, Tòa B`,
    ].flatMap((name) => [name, toWindows1252Mojibake(name)])))

    room.toa = CLINIC_BUILDING_NAME
    if (room.isModified('toa')) await room.save()
    const newFullName = room.full_name

    for (const oldFullName of possibleOldNames.filter((name) => name && name !== newFullName)) {
      await Promise.all([
        BacSi.updateMany(
          { phong_kham_mac_dinh: oldFullName },
          { $set: { phong_kham_mac_dinh: newFullName } }
        ),
        LichHen.updateMany(
          { phong_kham: oldFullName },
          { $set: { phong_kham: newFullName } }
        ),
        LichLamViec.updateMany(
          { 'slots.phong_kham': oldFullName },
          { $set: { 'slots.$[slot].phong_kham': newFullName } },
          { arrayFilters: [{ 'slot.phong_kham': oldFullName }] }
        ),
      ])
    }
  }
}

async function syncDoctorRoomAssignments({ roomId, oldFullName = null, newFullName, doctorIds = [], previousDoctorIds = [] }) {
  const assigned = doctorIds.map(String)
  const previous = previousDoctorIds.map(String)
  const removed = previous.filter((id) => !assigned.includes(id))
  const changedName = oldFullName && oldFullName !== newFullName
  const start = todayStart()

  if (assigned.length > 0) {
    await BacSi.updateMany({ _id: { $in: assigned } }, { $set: { phong_kham_mac_dinh: newFullName } })
    await PhongKham.updateMany({ _id: { $ne: roomId } }, { $pull: { doctor_ids: { $in: assigned } } })
  }

  if (removed.length > 0 || changedName) {
    const clearDoctorIds = removed.length > 0 ? removed : []
    if (clearDoctorIds.length > 0) {
      await BacSi.updateMany(
        { _id: { $in: clearDoctorIds }, phong_kham_mac_dinh: oldFullName },
        { $set: { phong_kham_mac_dinh: null } }
      )
    }
  }

  const updates = []
  if (assigned.length > 0) updates.push({ doctorIds: assigned, from: oldFullName, to: newFullName })
  if (removed.length > 0 && oldFullName) updates.push({ doctorIds: removed, from: oldFullName, to: null })

  for (const item of updates) {
    await updateFutureEmptySlots(item.doctorIds, item.from, item.to, start)
  }
}

async function updateFutureEmptySlots(doctorIds, fromRoom, toRoom, start) {
  if (!doctorIds.length) return

  const query = {
    doctor_id: { $in: doctorIds },
    ngay: { $gte: start },
  }
  if (fromRoom) query['slots.phong_kham'] = fromRoom

  const schedules = await LichLamViec.find(query)
  for (const schedule of schedules) {
    let changed = false
    for (const slot of schedule.slots) {
      if (fromRoom && slot.phong_kham !== fromRoom) continue
      if (OCCUPIED_SLOT_STATUSES.includes(slot.status)) continue

      const hasAppointment = await LichHen.exists({
        doctor_id: schedule.doctor_id,
        status: { $in: ACTIVE_APPOINTMENT_STATUSES },
        $or: [
          { schedule_id: schedule._id, slot_id: slot._id },
          { ngay_kham: schedule.ngay, gio_kham: slot.gio_bat_dau },
        ],
      })
      if (hasAppointment) continue

      slot.phong_kham = toRoom
      changed = true
    }

    if (changed) await schedule.save()
  }
}

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

export async function getRooms(req, res) {
  try {
    await normalizeClinicBuildingData()

    const { status, keyword } = req.query
    const filter = {}
    if (status && ROOM_STATUS.includes(status)) filter.trang_thai = status
    if (keyword?.trim()) {
      const regex = new RegExp(keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [{ ten: regex }, { toa: regex }, { loai: regex }]
    }

    const rooms = await PhongKham.find(filter)
      .populate({
        path: 'doctor_ids',
        select: 'user_id trang_thai_duyet trang_thai phong_kham_mac_dinh specialties',
        populate: [
          { path: 'user_id', select: 'ho_ten email' },
          { path: 'specialties', select: 'ten' },
        ],
      })
      .populate('nurse_ids', 'ho_ten email so_dien_thoai status')
      .sort({ toa: 1, tang: 1, ten: 1 })

    const data = await Promise.all(
      rooms.map(async (room) => {
        const usage = await countRoomUsage(room.full_name)
        return formatRoom(room, usage)
      })
    )

    return ok(res, data, 'Lấy danh sách phòng khám nhỏ thành công')
  } catch (error) {
    return fail(res, 500, 'Không thể tải danh sách phòng khám nhỏ: ' + error.message)
  }
}

export async function createRoom(req, res) {
  try {
    const payload = normalizeRoomPayload(req.body)
    await validateStaff(payload)
    await assertUniqueRoom(payload)

    const room = await PhongKham.create(payload)
    await syncDoctorRoomAssignments({
      roomId: room._id,
      newFullName: room.full_name,
      doctorIds: payload.doctor_ids ?? [],
    })
    const populated = await populateRoom(room._id)
    await writeRoomAudit(req, 'CREATE_CLINIC_ROOM', room._id, null, formatRoom(populated), `Tạo phòng ${room.full_name}`)

    return created(res, formatRoom(populated), 'Tạo phòng khám nhỏ thành công')
  } catch (error) {
    const status = error.code === 11000 || error.message.includes('tồn tại') ? 409 : 400
    return fail(res, status, error.message)
  }
}

export async function updateRoom(req, res) {
  try {
    const { id } = req.params
    if (!isObjectId(id)) return fail(res, 400, 'Mã phòng không hợp lệ')

    const room = await PhongKham.findById(id)
    if (!room) return fail(res, 404, 'Không tìm thấy phòng khám nhỏ')

    const before = room.toObject({ virtuals: true })
    const oldFullName = room.full_name
    const previousDoctorIds = room.doctor_ids.map(String)
    const payload = normalizeRoomPayload(req.body, { partial: true })
    await validateStaff({
      doctor_ids: payload.doctor_ids ?? previousDoctorIds,
      nurse_ids: payload.nurse_ids ?? room.nurse_ids.map(String),
    })

    await assertUniqueRoom({
      ten: payload.ten ?? room.ten,
      tang: payload.tang ?? room.tang,
      toa: payload.toa ?? room.toa,
      excludeId: id,
    })

    Object.assign(room, payload)
    await room.save()

    const doctorIds = (payload.doctor_ids ?? room.doctor_ids).map(String)
    if (payload.doctor_ids !== undefined || oldFullName !== room.full_name) {
      await syncDoctorRoomAssignments({
        roomId: room._id,
        oldFullName,
        newFullName: room.full_name,
        doctorIds,
        previousDoctorIds,
      })
    }
    if (payload.nurse_ids !== undefined) {
      await PhongKham.updateMany({ _id: { $ne: room._id } }, { $pull: { nurse_ids: { $in: payload.nurse_ids } } })
    }

    const populated = await populateRoom(room._id)
    await writeRoomAudit(req, 'UPDATE_CLINIC_ROOM', room._id, before, formatRoom(populated), `Cập nhật phòng ${room.full_name}`)

    return ok(res, formatRoom(populated), 'Cập nhật phòng khám nhỏ thành công')
  } catch (error) {
    const status = error.code === 11000 || error.message.includes('tồn tại') ? 409 : 400
    return fail(res, status, error.message)
  }
}

export async function deleteRoom(req, res) {
  try {
    const { id } = req.params
    if (!isObjectId(id)) return fail(res, 400, 'Mã phòng không hợp lệ')

    const room = await PhongKham.findById(id)
    if (!room) return fail(res, 404, 'Không tìm thấy phòng khám nhỏ')

    const fullName = room.full_name
    const usage = await countRoomUsage(fullName)
    if (usage.activeAppointments > 0) {
      return fail(res, 409, `Không thể xóa phòng vì còn ${usage.activeAppointments} lịch hẹn đang xử lý trong phòng này.`)
    }

    const before = room.toObject({ virtuals: true })
    const scheduledDoctorIds = await LichLamViec.find({
      ngay: { $gte: todayStart() },
      'slots.phong_kham': fullName,
    }).distinct('doctor_id')
    const doctorIds = Array.from(new Set([...room.doctor_ids.map(String), ...scheduledDoctorIds.map(String)]))

    await syncDoctorRoomAssignments({
      roomId: room._id,
      oldFullName: fullName,
      newFullName: null,
      doctorIds: [],
      previousDoctorIds: doctorIds,
    })

    await PhongKham.findByIdAndDelete(id)
    await writeRoomAudit(req, 'DELETE_CLINIC_ROOM', room._id, before, null, `Xóa phòng ${fullName}`)

    return ok(res, { _id: id }, 'Xóa phòng khám nhỏ thành công')
  } catch (error) {
    return fail(res, 500, 'Không thể xóa phòng khám nhỏ: ' + error.message)
  }
}

async function populateRoom(id) {
  return PhongKham.findById(id)
    .populate({
      path: 'doctor_ids',
      select: 'user_id trang_thai_duyet trang_thai phong_kham_mac_dinh specialties',
      populate: [
        { path: 'user_id', select: 'ho_ten email' },
        { path: 'specialties', select: 'ten' },
      ],
    })
    .populate('nurse_ids', 'ho_ten email so_dien_thoai status')
}
