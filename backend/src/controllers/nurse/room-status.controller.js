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
