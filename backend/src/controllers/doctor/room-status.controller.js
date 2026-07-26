import { TrangThaiPhongKham, LichLamViec, BacSi, NhatKyThaoTac } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'

// ============================================================
// Trạng thái phòng khám (Bác sĩ) — Routes: /api/doctor/room-status
// 1 bản ghi / bác sĩ / ngày, tạo LƯỜI (lazy upsert) khi bác sĩ thao tác lần đầu.
// dang_kham CHỈ set được qua queue.controller.js (into-room) — cần benh_nhan_hien_tai_id
// kèm theo (presence-gate) nên không cho set trực tiếp ở đây.
// ============================================================

const MANUAL_STATUSES = ['san_sang', 'tam_nghi', 'dang_don_phong']

async function getDocId(userId) {
  const d = await BacSi.findOne({ user_id: userId }).select('_id').lean()
  return d?._id ?? null
}

function getTodayStart() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return start
}

async function ghiAudit(doctorUserId, doctorId, tuTrangThai, denTrangThai) {
  await NhatKyThaoTac.create({
    nguoi_thuc_hien_id: doctorUserId,
    vai_tro: 'doctor',
    hanh_dong: 'CHANGE_DOCTOR_STATUS',
    loai_doi_tuong: 'room_status',
    doi_tuong_id: doctorId,
    du_lieu_cu: { trang_thai: tuTrangThai },
    du_lieu_moi: { trang_thai: denTrangThai },
  })
}

// Tạo lười — dùng chung cho GET list và queue.controller.js (vào phòng/kết thúc khám).
export async function findOrCreateRoomStatus(doctorId) {
  const start = getTodayStart()
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

// ─── GET /api/doctor/room-status ─────────────────────────────────────────────
export async function list(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    const room = await findOrCreateRoomStatus(docId)
    return ok(res, {
      doctor_id: room.doctor_id,
      phong_kham: room.phong_kham,
      trang_thai: room.trang_thai,
      benh_nhan_hien_tai_id: room.benh_nhan_hien_tai_id,
      thoi_gian_kham_tb_phut: room.thoi_gian_kham_tb_phut,
      thoi_diem_doi: room.thoi_diem_doi,
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/doctor/room-status ───────────────────────────────────────────
export async function updateStatus(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    const { trang_thai } = req.body
    if (!MANUAL_STATUSES.includes(trang_thai)) {
      return fail(res, 400, `trang_thai không hợp lệ cho thao tác thủ công. Chỉ nhận: ${MANUAL_STATUSES.join(', ')}`)
    }

    const room = await findOrCreateRoomStatus(docId)
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
    room.nguoi_dieu_khien_vai_tro = 'doctor'
    await room.save()

    await ghiAudit(req.user.id, docId, tu, trang_thai)

    return ok(res, { doctor_id: docId, trang_thai: room.trang_thai }, 'Đã cập nhật trạng thái phòng')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
