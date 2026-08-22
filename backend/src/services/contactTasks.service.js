import mongoose from 'mongoose'
import { HangDoi, LichHen, NhatKyThaoTac } from '../models/index.js'
import { buildSlotDateTime, startOfDayUtc } from '../utils/clinicTime.js'

// ============================================================
// E-3 — Màn "Cần gọi thủ công". `NhatKyThaoTac` chỉ INSERT (immutable log), nên "đánh dấu
// đã gọi" KHÔNG được sửa bản ghi CUSTOMER_CONTACT_REQUIRED gốc — thay vào đó insert một bản
// ghi CUSTOMER_CONTACTED mới trỏ cùng doi_tuong_id. "Chưa gọi" = có CUSTOMER_CONTACT_REQUIRED
// mà CHƯA có CUSTOMER_CONTACTED nào mới hơn (phương án A, chốt trong kế hoạch task).
// ============================================================

const MAC_DINH_SO_NGAY = 7
const PHUT_TRE_CAN_LIEN_HE = Number(process.env.CONTACT_LATE_ARRIVAL_MINUTES || 10)
const ACTION_XAC_NHAN_DEN_MUON = 'late_arrival_check'

function congPhut(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000)
}

function snapshotLichHen(appointment) {
  return {
    appointment_id: appointment._id,
    ma_lich_hen: appointment.ma_lich_hen ?? null,
    user_id: appointment.user_id ?? null,
    ten_khach: appointment.ten_khach ?? null,
    so_dien_thoai_khach: appointment.so_dien_thoai_khach ?? null,
    email_khach: appointment.email_khach ?? null,
    ngay_kham: appointment.ngay_kham,
    gio_kham: appointment.gio_kham ?? null,
    status: appointment.status,
  }
}

function taoYeuCauLienHeTreHen(appointment, now) {
  const gioHen = buildSlotDateTime(appointment.ngay_kham, appointment.gio_kham)
  const mocCanLienHe = congPhut(gioHen, PHUT_TRE_CAN_LIEN_HE)
  const phutTre = Math.max(0, Math.floor((now.getTime() - gioHen.getTime()) / 60_000))
  const ma = appointment.ma_lich_hen ? ` (${appointment.ma_lich_hen})` : ''
  const title = 'Xác nhận bệnh nhân có đến khám không'
  const content = `Lịch khám${ma} lúc ${appointment.gio_kham} đã qua ${phutTre} phút nhưng chưa check-in tại quầy. Lễ tân cần liên hệ để xác nhận khách có đến hay không.`

  return {
    _id: `late:${appointment._id}`,
    nguoi_thuc_hien_id: null,
    vai_tro: 'system',
    hanh_dong: 'CUSTOMER_CONTACT_REQUIRED',
    loai_doi_tuong: 'appointment',
    doi_tuong_id: appointment._id,
    ly_do: `Khách đã quá giờ khám ${PHUT_TRE_CAN_LIEN_HE} phút nhưng chưa check-in`,
    ngay_tao: mocCanLienHe,
    du_lieu_moi: {
      action: ACTION_XAC_NHAN_DEN_MUON,
      title,
      content,
      phut_tre: phutTre,
      moc_can_lien_he: mocCanLienHe,
      appointment: snapshotLichHen(appointment),
    },
  }
}

async function layYeuCauLienHeTreHen(now = new Date()) {
  const start = startOfDayUtc(now)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)

  const appointments = await LichHen.find({
    loai_kham: 'clinic',
    status: 'confirmed',
    ngay_kham: { $gte: start, $lt: end },
    gio_kham: { $ne: null },
  })
    .select('ma_lich_hen user_id ten_khach so_dien_thoai_khach email_khach ngay_kham gio_kham status doctor_id')
    .lean()

  const lateAppointments = appointments.filter((appointment) => {
    const gioHen = buildSlotDateTime(appointment.ngay_kham, appointment.gio_kham)
    return gioHen && congPhut(gioHen, PHUT_TRE_CAN_LIEN_HE).getTime() <= now.getTime()
  })

  if (lateAppointments.length === 0) return []

  const appointmentIds = lateAppointments.map((appointment) => appointment._id)
  const queueRows = await HangDoi.find({ appointment_id: { $in: appointmentIds } })
    .select('appointment_id')
    .lean()
  const checkedInIds = new Set(queueRows.map((row) => String(row.appointment_id)))

  return lateAppointments
    .filter((appointment) => !checkedInIds.has(String(appointment._id)))
    .map((appointment) => taoYeuCauLienHeTreHen(appointment, now))
}

/**
 * Ghép mỗi yêu cầu gọi với bản ghi "đã gọi" mới nhất phát sinh SAU nó (nếu có).
 * Tách riêng để test được mà không cần Mongo — logic ghép là phần dễ sai nhất.
 */
export function ganTrangThaiLienHe(requests, contacted) {
  const contactedByTarget = new Map()
  for (const record of contacted) {
    const key = String(record.doi_tuong_id)
    if (!contactedByTarget.has(key)) contactedByTarget.set(key, [])
    contactedByTarget.get(key).push(record)
  }

  return requests.map((request) => {
    const laterContacts = (contactedByTarget.get(String(request.doi_tuong_id)) ?? [])
      .filter((record) => new Date(record.ngay_tao).getTime() > new Date(request.ngay_tao).getTime())
      .sort((a, b) => new Date(a.ngay_tao).getTime() - new Date(b.ngay_tao).getTime())

    return {
      request,
      daGoi: laterContacts.length > 0,
      // Người gọi ĐẦU TIÊN sau yêu cầu — nếu hai lễ tân cùng gọi, người thứ hai vẫn được ghi
      // nhận (insert-only, không chặn), nhưng danh sách ưu tiên hiện người xử lý trước.
      contactedRecord: laterContacts[0] ?? null,
    }
  })
}

function serializeTask({ request, daGoi, contactedRecord }, appointmentById) {
  const appointment = appointmentById.get(String(request.doi_tuong_id)) ?? null
  const snapshot = request.du_lieu_moi?.appointment ?? {}
  const action = request.du_lieu_moi?.action ?? null
  return {
    audit_id: String(request._id),
    appointment_id: String(request.doi_tuong_id),
    loai_viec: action === ACTION_XAC_NHAN_DEN_MUON ? 'xac_nhan_den_muon' : 'thong_bao_thu_cong',
    trang_thai: daGoi ? 'da_goi' : 'chua_goi',
    ten_khach: appointment?.ten_khach ?? snapshot.ten_khach ?? null,
    so_dien_thoai: appointment?.so_dien_thoai_khach ?? snapshot.so_dien_thoai_khach ?? null,
    ma_lich_hen: appointment?.ma_lich_hen ?? snapshot.ma_lich_hen ?? null,
    gio_kham_cu: snapshot.gio_kham ?? null,
    gio_kham_moi: appointment?.gio_kham ?? null,
    bac_si: appointment?.doctor_id?.user_id?.ho_ten ?? null,
    tieu_de: request.du_lieu_moi?.title ?? null,
    noi_dung: request.du_lieu_moi?.content ?? null,
    ly_do_can_goi: request.ly_do ?? null,
    phut_tre: request.du_lieu_moi?.phut_tre ?? null,
    ngay_tao: request.ngay_tao,
    da_goi_luc: contactedRecord?.ngay_tao ?? null,
    da_goi_boi: contactedRecord?.nguoi_thuc_hien_id?.ho_ten ?? null,
    ghi_chu_cuoc_goi: contactedRecord?.ly_do ?? null,
    ket_qua_cuoc_goi: contactedRecord?.du_lieu_moi?.ket_qua ?? null,
  }
}

export async function layDanhSachCanGoi({ trangThai = null, tuNgay = null, denNgay = null, now = new Date() } = {}) {
  const tu = tuNgay ? new Date(tuNgay) : new Date(now.getTime() - MAC_DINH_SO_NGAY * 86400000)
  const den = denNgay ? new Date(denNgay) : now

  const manualRequests = await NhatKyThaoTac.find({
    hanh_dong: 'CUSTOMER_CONTACT_REQUIRED',
    ngay_tao: { $gte: tu, $lte: den },
  }).sort({ ngay_tao: -1 }).lean()

  const lateRequests = (await layYeuCauLienHeTreHen(now))
    .filter((request) => new Date(request.ngay_tao).getTime() >= tu.getTime() && new Date(request.ngay_tao).getTime() <= den.getTime())
  const requests = [...manualRequests, ...lateRequests]
  if (requests.length === 0) return []

  const targetIds = requests.map((request) => request.doi_tuong_id)
  const contacted = await NhatKyThaoTac.find({
    hanh_dong: 'CUSTOMER_CONTACTED',
    doi_tuong_id: { $in: targetIds },
  })
    .populate('nguoi_thuc_hien_id', 'ho_ten')
    .lean()

  const appointments = await LichHen.find({ _id: { $in: targetIds } })
    .select('ma_lich_hen ten_khach so_dien_thoai_khach gio_kham doctor_id')
    .populate({ path: 'doctor_id', select: 'user_id', populate: { path: 'user_id', select: 'ho_ten' } })
    .lean()
  const appointmentById = new Map(appointments.map((appointment) => [String(appointment._id), appointment]))

  const merged = ganTrangThaiLienHe(requests, contacted)
  const filtered = trangThai === 'da_goi' || trangThai === 'chua_goi'
    ? merged.filter((item) => (trangThai === 'da_goi' ? item.daGoi : !item.daGoi))
    : merged

  return filtered
    .map((item) => serializeTask(item, appointmentById))
    .sort((a, b) => new Date(b.ngay_tao).getTime() - new Date(a.ngay_tao).getTime())
}

export async function danhDauDaGoi({ auditId, actorUserId, ghiChu = null, ketQua = null }) {
  if (String(auditId).startsWith('late:')) {
    const appointmentId = String(auditId).slice('late:'.length)
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      throw Object.assign(new Error('Mã lịch hẹn cần liên hệ không hợp lệ'), { statusCode: 400 })
    }
    const appointment = await LichHen.findById(appointmentId).select('_id').lean()
    if (!appointment) throw Object.assign(new Error('Không tìm thấy lịch hẹn cần liên hệ'), { statusCode: 404 })

    const audit = await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: actorUserId,
      vai_tro: 'receptionist',
      hanh_dong: 'CUSTOMER_CONTACTED',
      loai_doi_tuong: 'appointment',
      doi_tuong_id: appointment._id,
      ly_do: ghiChu?.trim() || null,
      du_lieu_moi: {
        action: ACTION_XAC_NHAN_DEN_MUON,
        ket_qua: ketQua?.trim() || null,
      },
    })

    return { id: String(audit._id) }
  }

  if (!mongoose.Types.ObjectId.isValid(auditId)) {
    throw Object.assign(new Error('Mã việc cần gọi không hợp lệ'), { statusCode: 400 })
  }
  const request = await NhatKyThaoTac.findOne({ _id: auditId, hanh_dong: 'CUSTOMER_CONTACT_REQUIRED' }).lean()
  if (!request) throw Object.assign(new Error('Không tìm thấy việc cần gọi'), { statusCode: 404 })

  // KHÔNG kiểm tra "đã có ai đánh dấu chưa" rồi chặn — log chỉ insert, hai lễ tân cùng gọi
  // một khách thì được chấp nhận trùng, hiển thị đủ cả hai (đã ghi trong tài liệu thiết kế).
  const audit = await NhatKyThaoTac.create({
    nguoi_thuc_hien_id: actorUserId,
    vai_tro: 'receptionist',
    hanh_dong: 'CUSTOMER_CONTACTED',
    loai_doi_tuong: 'appointment',
    doi_tuong_id: request.doi_tuong_id,
    ly_do: ghiChu?.trim() || null,
    du_lieu_moi: {
      ket_qua: ketQua?.trim() || null,
    },
  })

  return { id: String(audit._id) }
}
