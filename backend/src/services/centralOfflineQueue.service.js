import mongoose from 'mongoose'
import { BacSi, ChuyenKhoa, HangDoi, HoSoBenhNhan, LichHen, LichLamViec, TrangThaiPhongKham, KetQuaKham, HoaDon, ThanhToan, Counter } from '../models/index.js'
import { buildSlotDateTime, startOfDayUtc } from '../utils/clinicTime.js'
import { MAC_DINH_THOI_GIAN_KHAM_PHUT } from '../utils/slotConfig.js'
import { capSoThuTuCheckin } from './checkInNumber.service.js'
import { layCauHinhHangDoiOffline } from './offlineQueueConfig.service.js'
import { ghiNhatKyLeTan } from './receptionistAudit.service.js'
import { notifyDoctorQueueUpdated } from './doctorQueueRealtime.service.js'
import { layGiaKhamChuyenKhoa } from './doctorAssignment.service.js'

export const TRANG_THAI_OFFLINE_TRUNG_TAM = 'cho_dieu_phoi'
export const TRANG_THAI_HANG_DOI_DANG_MO = [
  'cho_dieu_phoi',
  'dang_cho',
  'da_goi',
  'trong_phong',
  'cho_dich_vu',
]
export const TRANG_THAI_OFFLINE_THEO_DOI = [
  ...TRANG_THAI_HANG_DOI_DANG_MO,
  'skipped',
  'cancelled',
  'hoan_thanh',
]

const TRANG_THAI_LICH_HEN_DANG_MO = [
  'pending',
  'confirmed',
  'checked_in',
  'in_progress',
  'waiting_record',
  'waiting_doctor_confirm',
]

function id(value) {
  return value ? String(value) : null
}

function loi(statusCode, message, data = null) {
  return Object.assign(new Error(message), { statusCode, data })
}

function khoangNgay(now) {
  const start = startOfDayUtc(now)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start, end }
}

function normalizeObjectId(value, fieldName) {
  if (!value) return null
  if (!mongoose.Types.ObjectId.isValid(value)) throw loi(400, `${fieldName} không hợp lệ`)
  return value
}

function phutTuMs(ms) {
  return Math.max(0, Math.ceil(ms / 60_000))
}

function themPhut(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000)
}

async function thoiGianKhamTrungBinh(specialtyId) {
  if (!specialtyId) return MAC_DINH_THOI_GIAN_KHAM_PHUT
  const specialty = await ChuyenKhoa.findById(specialtyId).select('thoi_gian_kham_trung_binh_phut').lean()
  return Number(specialty?.thoi_gian_kham_trung_binh_phut) || MAC_DINH_THOI_GIAN_KHAM_PHUT
}

function slotPhuHop(slot, specialtyId) {
  if (!slot || slot.bi_khoa_boi_nghi_phep) return false
  if (specialtyId && String(slot.specialty_id) !== String(specialtyId)) return false
  return true
}

function doctorCoSlotPhuHop(schedule, specialtyId) {
  return (schedule.slots || []).some((slot) => slotPhuHop(slot, specialtyId))
}

function latestSlotEnd(schedule, specialtyId) {
  const ends = (schedule.slots || [])
    .filter((slot) => slotPhuHop(slot, specialtyId))
    .map((slot) => buildSlotDateTime(schedule.ngay, slot.gio_ket_thuc))
    .filter(Boolean)
    .sort((a, b) => b - a)
  return ends[0] ?? null
}

function slotHienTaiHoacKeTiep(schedule, specialtyId, now, config) {
  const limit = themPhut(now, config.shiftClosingBufferMinutes)
  return (schedule.slots || [])
    .filter((slot) => slotPhuHop(slot, specialtyId))
    .map((slot) => ({
      slot,
      start: buildSlotDateTime(schedule.ngay, slot.gio_bat_dau),
      end: buildSlotDateTime(schedule.ngay, slot.gio_ket_thuc),
    }))
    .filter((item) => item.start && item.end && item.end.getTime() > limit.getTime())
    .sort((a, b) => {
      const aCurrent = a.start.getTime() <= now.getTime() && now.getTime() < a.end.getTime()
      const bCurrent = b.start.getTime() <= now.getTime() && now.getTime() < b.end.getTime()
      if (aCurrent !== bCurrent) return aCurrent ? -1 : 1
      return a.start - b.start
    })[0] ?? null
}

async function layBacSiHopLeTheoLich({ specialtyId, now }) {
  const { start, end } = khoangNgay(now)
  const schedules = await LichLamViec.find({
    ngay: { $gte: start, $lt: end },
    trang_thai_ngay: 'lam_viec',
    trang_thai_xac_nhan: { $ne: 'tu_choi' },
  }).select('doctor_id ngay slots').lean()

  const usableSchedules = schedules.filter((schedule) => doctorCoSlotPhuHop(schedule, specialtyId))
  const doctorIds = [...new Set(usableSchedules.map((schedule) => id(schedule.doctor_id)).filter(Boolean))]
  if (doctorIds.length === 0) return []

  const doctors = await BacSi.find({
    _id: { $in: doctorIds },
    trang_thai: 'active',
    trang_thai_duyet: 'approved',
    la_hien: true,
    ...(specialtyId ? { specialties: specialtyId } : {}),
  }).select('_id user_id specialties phong_kham_mac_dinh').populate('user_id', 'ho_ten').lean()
  const doctorById = new Map(doctors.map((doctor) => [id(doctor._id), doctor]))

  return usableSchedules
    .map((schedule) => {
      const doctor = doctorById.get(id(schedule.doctor_id))
      if (!doctor) return null
      return {
        doctor,
        schedule,
        latestEnd: latestSlotEnd(schedule, specialtyId),
      }
    })
    .filter(Boolean)
}

function demTheoDoctor(rows) {
  const result = new Map()
  for (const row of rows) {
    const key = id(row.doctor_id)
    if (!key) continue
    result.set(key, (result.get(key) ?? 0) + 1)
  }
  return result
}

async function coOnlineCanBaoVe(doctorId, now, config) {
  const { start, end } = khoangNgay(now)
  const appointments = await LichHen.find({
    doctor_id: doctorId,
    loai_kham: 'clinic',
    ngay_kham: { $gte: start, $lt: end },
    status: { $in: TRANG_THAI_LICH_HEN_DANG_MO },
  }).select('ngay_kham gio_kham status').lean()

  const windowEnd = themPhut(now, config.minOnlineProtectionMinutes + config.dispatchBufferMinutes)
  return appointments.some((appointment) => {
    const startTime = buildSlotDateTime(appointment.ngay_kham, appointment.gio_kham)
    if (!startTime) return false
    return startTime.getTime() >= now.getTime() && startTime.getTime() <= windowEnd.getTime()
  })
}

async function coOnlineTrongHangDoiCanBaoVe(doctorId, now, config, session = null) {
  const { start, end } = khoangNgay(now)
  const windowEnd = themPhut(now, config.minOnlineProtectionMinutes + config.dispatchBufferMinutes)
  const query = HangDoi.find({
    doctor_id: doctorId,
    nguon: 'online',
    trang_thai: { $in: ['dang_cho', 'da_goi'] },
    checkin_time: { $gte: start, $lt: end },
    gio_hen_goc: { $lte: windowEnd },
  }).select('_id gio_hen_goc trang_thai')
  const rows = session ? await query.session(session).lean() : await query.lean()
  return rows.some((row) => !row.gio_hen_goc || new Date(row.gio_hen_goc).getTime() <= windowEnd.getTime())
}

async function coDangTrongPhong(doctorId, now, session = null) {
  const { start, end } = khoangNgay(now)
  const query = HangDoi.exists({
    doctor_id: doctorId,
    trang_thai: 'trong_phong',
    checkin_time: { $gte: start, $lt: end },
  })
  return Boolean(session ? await query.session(session) : await query)
}

async function layTrangThaiPhong(doctorId, now, session = null) {
  const { start } = khoangNgay(now)
  const query = TrangThaiPhongKham.findOne({ doctor_id: doctorId, ngay: start })
    .select('trang_thai benh_nhan_hien_tai_id phong_kham')
  return session ? query.session(session).lean() : query.lean()
}

function tinhUocLuongCho({ centralAhead, activeDoctorRows, doctorCards, averageMinutes, now, config }) {
  const usableCards = doctorCards.filter((card) => {
    if (!card.latestEnd) return false
    return card.latestEnd.getTime() - now.getTime() > config.shiftClosingBufferMinutes * 60_000
  })
  if (usableCards.length === 0) {
    return { estimatedWaitMinutes: null, usableCards, doctorLoads: [] }
  }

  const activeByDoctor = demTheoDoctor(activeDoctorRows)
  const doctorLoads = usableCards.map((card) => ({
    doctor_id: id(card.doctor._id),
    bac_si: card.doctor.user_id?.ho_ten ?? null,
    latest_end: card.latestEnd,
    loadMinutes: (activeByDoctor.get(id(card.doctor._id)) ?? 0) * averageMinutes,
  }))

  for (let i = 0; i < centralAhead; i += 1) {
    doctorLoads.sort((a, b) => a.loadMinutes - b.loadMinutes || a.doctor_id.localeCompare(b.doctor_id))
    doctorLoads[0].loadMinutes += averageMinutes
  }

  doctorLoads.sort((a, b) => a.loadMinutes - b.loadMinutes || a.doctor_id.localeCompare(b.doctor_id))
  return {
    estimatedWaitMinutes: doctorLoads.length ? doctorLoads[0].loadMinutes : null,
    usableCards,
    doctorLoads,
  }
}

export function ketLuanSucChuaHangDoiOfflineTrungTam({
  doctorCount,
  usableDoctorCount,
  centralAhead,
  maxCentralOfflineQueueSize,
  maxOfflinePerShiftPerSpecialty,
  estimatedWaitMinutes,
  maxOfflineWaitMinutes,
  offlineWarningWaitMinutes,
} = {}) {
  if (doctorCount === 0) {
    return {
      trangThai: 'tam_dung_nhan',
      lyDo: 'Không có bác sĩ hợp lệ đang làm việc theo chuyên khoa hôm nay.',
    }
  }
  if (usableDoctorCount === 0) {
    return {
      trangThai: 'tam_dung_nhan',
      lyDo: 'Không còn bác sĩ có đủ thời gian an toàn để nhận thêm khách vãng lai.',
    }
  }
  if (centralAhead >= maxCentralOfflineQueueSize) {
    return {
      trangThai: 'tam_dung_nhan',
      lyDo: 'Hàng đợi trung tâm đã đạt giới hạn số khách đang chờ.',
    }
  }
  if (centralAhead >= maxOfflinePerShiftPerSpecialty) {
    return {
      trangThai: 'tam_dung_nhan',
      lyDo: 'Chuyên khoa đã đạt giới hạn khách vãng lai trong ca.',
    }
  }
  if (estimatedWaitMinutes !== null && estimatedWaitMinutes > maxOfflineWaitMinutes) {
    return {
      trangThai: 'tam_dung_nhan',
      lyDo: `Thời gian chờ ước tính ${estimatedWaitMinutes} phút vượt ngưỡng ${maxOfflineWaitMinutes} phút.`,
    }
  }
  if (estimatedWaitMinutes !== null && estimatedWaitMinutes >= offlineWarningWaitMinutes) {
    return {
      trangThai: 'canh_bao_day',
      lyDo: `Thời gian chờ ước tính ${estimatedWaitMinutes} phút, cần thông báo khách trước khi tiếp nhận.`,
    }
  }
  return { trangThai: 'co_the_nhan', lyDo: null }
}

export async function tinhSucChuaHangDoiOfflineTrungTam({
  specialtyId = null,
  includeNewPatient = true,
  now = new Date(),
} = {}) {
  const normalizedSpecialtyId = normalizeObjectId(specialtyId, 'specialty_id')
  const config = layCauHinhHangDoiOffline()
  const { start, end } = khoangNgay(now)
  const averageMinutes = await thoiGianKhamTrungBinh(normalizedSpecialtyId)

  const centralFilter = {
    nguon: 'offline',
    trang_thai: TRANG_THAI_OFFLINE_TRUNG_TAM,
    checkin_time: { $gte: start, $lt: end },
    ...(normalizedSpecialtyId ? { specialty_id: normalizedSpecialtyId } : {}),
  }
  const activeDoctorFilter = {
    trang_thai: { $in: ['dang_cho', 'da_goi', 'trong_phong', 'cho_dich_vu'] },
    checkin_time: { $gte: start, $lt: end },
    ...(normalizedSpecialtyId ? { specialty_id: normalizedSpecialtyId } : {}),
  }

  const [centralAhead, activeDoctorRows, doctorCards] = await Promise.all([
    HangDoi.countDocuments(centralFilter),
    HangDoi.find(activeDoctorFilter).select('doctor_id trang_thai specialty_id').lean(),
    layBacSiHopLeTheoLich({ specialtyId: normalizedSpecialtyId, now }),
  ])

  const protectedFlags = await Promise.all(
    doctorCards.map(async (card) => [id(card.doctor._id), await coOnlineCanBaoVe(card.doctor._id, now, config)]),
  )
  const protectedByDoctor = new Map(protectedFlags)
  const unprotectedDoctorCards = doctorCards.filter((card) => !protectedByDoctor.get(id(card.doctor._id)))

  const centralCountForEstimate = centralAhead + (includeNewPatient ? 1 : 0)
  const estimate = tinhUocLuongCho({
    centralAhead: centralCountForEstimate,
    activeDoctorRows,
    doctorCards: unprotectedDoctorCards,
    averageMinutes,
    now,
    config,
  })

  const estimatedWaitMinutes = estimate.estimatedWaitMinutes
  const remainingCentralSlots = Math.max(0, config.maxCentralOfflineQueueSize - centralAhead)
  const remainingShiftSlots = Math.max(0, config.maxOfflinePerShiftPerSpecialty - centralAhead)

  const { trangThai, lyDo } = ketLuanSucChuaHangDoiOfflineTrungTam({
    doctorCount: doctorCards.length,
    usableDoctorCount: estimate.usableCards.length,
    centralAhead,
    maxCentralOfflineQueueSize: config.maxCentralOfflineQueueSize,
    maxOfflinePerShiftPerSpecialty: config.maxOfflinePerShiftPerSpecialty,
    estimatedWaitMinutes,
    maxOfflineWaitMinutes: config.maxOfflineWaitMinutes,
    offlineWarningWaitMinutes: config.offlineWarningWaitMinutes,
  })

  return {
    trang_thai: trangThai,
    co_the_nhan: trangThai !== 'tam_dung_nhan',
    can_xac_nhan_qua_tai: trangThai === 'canh_bao_day',
    ly_do: lyDo,
    specialty_id: normalizedSpecialtyId ? String(normalizedSpecialtyId) : null,
    checked_at: now,
    cau_hinh: config,
    thong_ke: {
      so_khach_cho_trung_tam: centralAhead,
      suc_chua_trung_tam_con_lai: remainingCentralSlots,
      suc_chua_ca_con_lai: remainingShiftSlots,
      so_bac_si_co_lich: doctorCards.length,
      so_bac_si_co_the_dieu_phoi: estimate.usableCards.length,
      thoi_gian_kham_trung_binh_phut: averageMinutes,
      thoi_gian_cho_uoc_tinh_phut: estimatedWaitMinutes,
    },
    minh_chung: {
      bac_si_bi_bao_ve_online: [...protectedByDoctor.entries()]
        .filter(([, protectedOnline]) => protectedOnline)
        .map(([doctorId]) => doctorId),
      tai_theo_bac_si: estimate.doctorLoads.map((row) => ({
        doctor_id: row.doctor_id,
        bac_si: row.bac_si,
        tai_uoc_tinh_phut: row.loadMinutes,
        ket_thuc_ca: row.latest_end,
      })),
    },
  }
}

function ngayHoaDonPart(date) {
  return `${String(date.getUTCFullYear()).slice(-2)}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`
}

async function nextInvoiceNumber(date) {
  const part = ngayHoaDonPart(date)
  const seq = await Counter.nextSeq(`so_hoa_don_${part}`)
  return `HD-${part}-${String(seq).padStart(4, '0')}`
}

export async function tiepNhanOfflineVaoHangDoiTrungTam({
  hoSoBenhNhanId,
  specialtyId,
  lich_hen_goc_id = null,
  ket_qua_kham_id = null,
  xacNhanCanhBao = false,
  forceDoctorId = null,
  actorUserId = null,
  actorRole = null,
  now = new Date(),
} = {}) {
  const normalizedProfileId = normalizeObjectId(hoSoBenhNhanId, 'ho_so_benh_nhan_id')
  const normalizedSpecialtyId = normalizeObjectId(specialtyId, 'specialty_id')
  if (!normalizedProfileId) throw loi(400, 'Cần chọn hồ sơ bệnh nhân')
  if (!normalizedSpecialtyId) throw loi(400, 'Cần chọn chuyên khoa')

  const profile = await HoSoBenhNhan.findOne({ _id: normalizedProfileId, trang_thai: 'active' }).lean()
  if (!profile) throw loi(404, 'Hồ sơ bệnh nhân không hợp lệ')
  if (!profile.so_dien_thoai) throw loi(400, 'Hồ sơ bệnh nhân chưa có số điện thoại')

  const specialty = await ChuyenKhoa.findById(normalizedSpecialtyId).lean()
  if (!specialty) throw loi(404, 'Chuyên khoa không hợp lệ')

  const { start, end } = khoangNgay(now)
  const activeVisit = await HangDoi.findOne({
    ho_so_benh_nhan_id: profile._id,
    checkin_time: { $gte: start, $lt: end },
    trang_thai: { $in: TRANG_THAI_HANG_DOI_DANG_MO },
  }).select('_id trang_thai doctor_id phong_kham ma_so_thu_tu').lean()
  if (activeVisit) {
    throw loi(409, 'Hồ sơ này đã có một lượt khám đang được tiếp nhận trong ngày hôm nay', { entry: activeVisit })
  }

  const capacity = await tinhSucChuaHangDoiOfflineTrungTam({
    specialtyId: normalizedSpecialtyId,
    includeNewPatient: true,
    now,
  })
  if (!capacity.co_the_nhan) throw loi(409, capacity.ly_do || 'Tạm dừng nhận khách vãng lai', { capacity })
  if (capacity.can_xac_nhan_qua_tai && !xacNhanCanhBao) {
    throw loi(409, 'Hàng đợi đang gần đầy, cần xác nhận với khách trước khi tiếp nhận', { capacity, require_confirmation: true })
  }

  let resolvedLichHenGocId = lich_hen_goc_id || null
  let isFollowUpPatient = Boolean(lich_hen_goc_id || ket_qua_kham_id)
  let lastExamDoctorId = null

  // Tự động nhận diện tái khám nếu hồ sơ đã từng có kết quả khám hoặc lịch hẹn trước đó
  const prevRecord = await KetQuaKham.findOne({
    ho_so_benh_nhan_id: profile._id,
    $or: [{ status: 'da_xac_nhan' }, { buoc_hien_tai: 'hoan_tat' }]
  }).sort({ ngay_tao: -1 }).lean()

  if (prevRecord) {
    let isValidFollowUp = false
    if (prevRecord.chi_dinh_tai_kham && !prevRecord.da_dat_lich_tai_kham) {
      const ngayTaiKham = prevRecord.ngay_tai_kham ? new Date(prevRecord.ngay_tai_kham) : null
      if (ngayTaiKham) {
        ngayTaiKham.setUTCHours(0, 0, 0, 0)
        const hanCuoi = new Date(ngayTaiKham.getTime() + 14 * 86400000)
        if (now.getTime() <= hanCuoi.getTime()) {
          isValidFollowUp = true
        }
      }
    }
    
    if (isValidFollowUp || isFollowUpPatient) {
      isFollowUpPatient = true
      if (!resolvedLichHenGocId) {
        resolvedLichHenGocId = prevRecord.appointment_id || null
      }
      lastExamDoctorId = prevRecord.bac_si_phu_trach_id || null
      
      if (isValidFollowUp && prevRecord._id) {
        ket_qua_kham_id = prevRecord._id
      }
    } else {
      isFollowUpPatient = false
    }
  } else {
    const prevAppt = await LichHen.findOne({
      ho_so_benh_nhan_id: profile._id,
      status: 'completed'
    }).sort({ ngay_kham: -1 }).lean()

    if (prevAppt) {
      const ngayKham = new Date(prevAppt.ngay_kham)
      ngayKham.setUTCHours(0, 0, 0, 0)
      const hanCuoi = new Date(ngayKham.getTime() + 14 * 86400000)
      
      if (now.getTime() <= hanCuoi.getTime() || isFollowUpPatient) {
        isFollowUpPatient = true
        if (!resolvedLichHenGocId) {
          resolvedLichHenGocId = prevAppt._id
        }
        lastExamDoctorId = prevAppt.doctor_id || null
      } else {
        isFollowUpPatient = false
      }
    }
  }

  let autoAssignedDoctorId = null
  let autoAssignedPhongKham = null
  let autoAssignedScheduleId = null
  let autoAssignedSlotId = null
  let autoAssignedKhungIndex = null
  
  const targetDoctorId = forceDoctorId || (isFollowUpPatient ? lastExamDoctorId : null)

  if (targetDoctorId) {
    const candidates = await layUngVienBacSiChoDieuPhoi({ specialty_id: normalizedSpecialtyId }, now)
    const targetCandidate = candidates.find((c) => String(c.doctor_id) === String(targetDoctorId))
    
    if (targetCandidate && targetCandidate.hop_le) {
      autoAssignedDoctorId = targetCandidate.doctor_id
      autoAssignedPhongKham = targetCandidate.phong_kham || null
      autoAssignedScheduleId = targetCandidate.schedule_id || null
      autoAssignedSlotId = targetCandidate.slot_id || null
      autoAssignedKhungIndex = targetCandidate.khung_index || null
    } else if (forceDoctorId) {
      if (!targetCandidate) {
        throw loi(400, 'Bác sĩ không hợp lệ hoặc không thuộc chuyên khoa này')
      }
      if (!targetCandidate.hop_le) {
        throw loi(409, 'Bác sĩ hiện không thể tiếp nhận thêm bệnh nhân', { ly_do_chan: targetCandidate.ly_do_chan })
      }
    }
  }

  let entry
  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      const profileLock = await HoSoBenhNhan.findOneAndUpdate(
        { _id: profile._id, trang_thai: 'active' },
        { $set: { ngay_cap_nhat: now } },
        { new: false, session },
      ).select('_id').lean()
      if (!profileLock) throw loi(409, 'Hồ sơ bệnh nhân vừa thay đổi, vui lòng tải lại dữ liệu')

      const activeInTransaction = await HangDoi.findOne({
        ho_so_benh_nhan_id: profile._id,
        checkin_time: { $gte: start, $lt: end },
        trang_thai: { $in: TRANG_THAI_HANG_DOI_DANG_MO },
      }).session(session).select('_id').lean()
      if (activeInTransaction) {
        throw loi(409, 'Hồ sơ này vừa được tiếp nhận ở một lượt khác, vui lòng tải lại hàng đợi')
      }

      const checkInNumber = await capSoThuTuCheckin(now)
      
      const bangGia = await layGiaKhamChuyenKhoa(normalizedSpecialtyId, session)
      const gia_kham = isFollowUpPatient ? 0 : bangGia.gia_kham
      const payment_status = isFollowUpPatient ? 'paid' : 'unpaid'

      const appointmentCode = `LH-${String(now.getUTCFullYear()).slice(-2)}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}-${String(await Counter.nextSeq('lich_hen')).padStart(4, '0')}`
      const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000)
      const currentGioKham = `${String(vnTime.getUTCHours()).padStart(2, '0')}:${String(vnTime.getUTCMinutes()).padStart(2, '0')}`

      const [createdAppt] = await LichHen.create([{
        ho_so_benh_nhan_id: profile._id,
        ten_khach: profile.ho_ten,
        so_dien_thoai_khach: profile.so_dien_thoai,
        nguoi_tao_id: actorUserId,
        hinh_thuc_dat_lich: 'offline',
        ma_lich_hen: appointmentCode,
        loai_lich_hen: isFollowUpPatient ? 'tai_kham' : 'kham_moi',
        lich_hen_goc_id: resolvedLichHenGocId,
        loai_kham: 'clinic',
        ngay_kham: now,
        gio_kham: currentGioKham,
        status: 'checked_in',
        payment_status: payment_status,
        gia_kham: gia_kham,
        phong_kham: autoAssignedPhongKham || null,
        doctor_id: autoAssignedDoctorId || null,
        specialty_id: normalizedSpecialtyId,
        ten_dich_vu: specialty?.ten ?? null,
        ghi_chu_tiep_nhan: 'Khách vãng lai đăng ký trực tiếp tại quầy',
      }], { session })

      const [createdEntry] = await HangDoi.create([{
        nguon: 'offline',
        appointment_id: createdAppt._id,
        ho_so_benh_nhan_id: profile._id,
        ten_benh_nhan: profile.ho_ten,
        so_dien_thoai: profile.so_dien_thoai,
        ngay_sinh: profile.ngay_sinh,
        tuoi: profile.ngay_sinh ? Math.max(0, now.getUTCFullYear() - new Date(profile.ngay_sinh).getUTCFullYear()) : null,
        gioi_tinh: profile.gioi_tinh,
        nhom_mau: profile.nhom_mau,
        di_ung: profile.di_ung,
        benh_nen: profile.benh_nen,
        dia_chi: profile.dia_chi,
        ghi_chu: profile.ghi_chu,
        specialty_id: normalizedSpecialtyId,
        muc_uu_tien: 'offline',
        trang_thai: autoAssignedDoctorId ? 'dang_cho' : TRANG_THAI_OFFLINE_TRUNG_TAM,
        doctor_id: autoAssignedDoctorId || null,
        phong_kham: autoAssignedPhongKham || null,
        schedule_id: autoAssignedScheduleId || null,
        slot_id: autoAssignedSlotId || null,
        khung_index: autoAssignedKhungIndex || null,
        thoi_diem_vao_hang_doi_trung_tam: autoAssignedDoctorId ? null : now,
        thoi_diem_dieu_phoi_bac_si: autoAssignedDoctorId ? now : null,
        thoi_gian_cho_uoc_tinh_phut: capacity.thong_ke.thoi_gian_cho_uoc_tinh_phut,
        loai_lich_hen: isFollowUpPatient ? 'tai_kham' : 'kham_moi',
        lich_hen_goc_id: resolvedLichHenGocId,
        ...checkInNumber,
        checkin_time: now,
        nguoi_tiep_nhan_id: actorUserId,
        vai_tro_tiep_nhan: actorRole,
      }], { session })
      entry = createdEntry

      if (ket_qua_kham_id) {
        await KetQuaKham.updateOne(
          { _id: ket_qua_kham_id },
          { $set: { da_dat_lich_tai_kham: true } },
          { session }
        )
      }

      if (isFollowUpPatient) {
        const soHoaDon = await nextInvoiceNumber(now)
        const [invoice] = await HoaDon.create([{
          hang_doi_id: entry._id,
          appointment_id: createdAppt._id,
          ho_so_benh_nhan_id: profile._id,
          so_hoa_don: soHoaDon,
          specialty_id: normalizedSpecialtyId,
          tong_tien_kham: 0,
          chi_tiet_thu_phi: [{ loai: 'phi_kham', ten: 'Phí khám Tái khám (Miễn phí)', so_tien: 0, so_luong: 1, thanh_tien: 0, created_at: now }],
          tong_tien_phat_sinh: 0,
          tong_thanh_toan: 0,
          trang_thai_hoa_don: 'da_thanh_toan_du',
        }], { session })

        await ThanhToan.create([{
          hoa_don_id: invoice._id,
          hang_doi_id: entry._id,
          appointment_id: createdAppt._id,
          ho_so_benh_nhan_id: profile._id,
          so_tien: 0,
          loai_thanh_toan: 'thanh_toan_bo_sung',
          phuong_thuc: 'mien_phi_tai_kham',
          status: 'paid',
          ngay_thanh_toan: now,
          thoi_diem_thanh_toan: now,
          nguoi_thu_id: actorUserId,
        }], { session })
      }
    })
  } finally {
    await session.endSession()
  }

  await ghiNhatKyLeTan({
    hanhDong: 'LT_OFFLINE_INTAKE_CENTRAL',
    actorUserId,
    actorRole,
    loaiDoiTuong: 'central_offline_queue',
    doiTuongId: entry._id,
    duLieuMoi: {
      ma_so_thu_tu: entry.ma_so_thu_tu ?? null,
      so_thu_tu: entry.so_thu_tu_checkin ?? null,
      ten_benh_nhan: entry.ten_benh_nhan,
      so_dien_thoai: entry.so_dien_thoai ?? null,
      specialty_id: String(entry.specialty_id),
      thoi_gian_cho_uoc_tinh_phut: entry.thoi_gian_cho_uoc_tinh_phut ?? null,
      trang_thai: entry.trang_thai,
    },
  })

  // Ném thông báo webhook tới frontend cho doctor (vì status = dang_cho thay vì cho_dieu_phoi)
  if (autoAssignedDoctorId) {
    // Notify doctor so their queue updates instantly in UI
    await notifyDoctorQueueUpdated(autoAssignedDoctorId, {
      action: 'central_offline_assigned',
      queue_id: entry._id,
      nguon: 'offline',
    })
  }

  return {
    entry,
    capacity,
    phieu_cho: {
      ma_so_thu_tu: entry.ma_so_thu_tu ?? null,
      trang_thai: autoAssignedDoctorId ? 'da_gan_bac_si' : 'cho_dieu_phoi_bac_si',
      thong_bao: autoAssignedDoctorId
        ? `Đã xếp vào phòng ${entry.phong_kham}. Vui lòng chờ đến lượt.`
        : 'Khách đang ở hàng đợi trung tâm, lễ tân sẽ điều phối khi có bác sĩ phù hợp.',
    },
  }
}

export function sapXepHangDoiTrungTam(a, b) {
  const priorityRank = { cap_cuu: 0, uu_tien: 1, binh_thuong: 2 }
  const priorityA = priorityRank[a.muc_uu_tien_tiep_nhan] ?? priorityRank.binh_thuong
  const priorityB = priorityRank[b.muc_uu_tien_tiep_nhan] ?? priorityRank.binh_thuong
  if (priorityA !== priorityB) return priorityA - priorityB

  return new Date(a.thoi_diem_vao_hang_doi_trung_tam ?? a.checkin_time)
    - new Date(b.thoi_diem_vao_hang_doi_trung_tam ?? b.checkin_time)
}

export async function layUngVienBacSiChoDieuPhoi(entry, now) {
  const config = layCauHinhHangDoiOffline()
  const cards = await layBacSiHopLeTheoLich({ specialtyId: entry.specialty_id, now })
  const activeRows = await HangDoi.find({
    doctor_id: { $in: cards.map((card) => card.doctor._id) },
    trang_thai: { $in: ['dang_cho', 'da_goi', 'trong_phong', 'cho_dich_vu'] },
  }).select('doctor_id trang_thai').lean()
  const loadByDoctor = demTheoDoctor(activeRows)

  const rows = []
  for (const card of cards) {
    const doctorId = id(card.doctor._id)
    const slotInfo = slotHienTaiHoacKeTiep(card.schedule, entry.specialty_id, now, config)
    const room = await layTrangThaiPhong(card.doctor._id, now)
    const inRoom = await coDangTrongPhong(card.doctor._id, now)
    const protectedOnline = await coOnlineCanBaoVe(card.doctor._id, now, config)
      || await coOnlineTrongHangDoiCanBaoVe(card.doctor._id, now, config)
    const lyDoChan = []
    if (!slotInfo) lyDoChan.push('khong_con_khung_an_toan')
    if (room?.trang_thai && room.trang_thai !== 'san_sang') lyDoChan.push(`phong_${room.trang_thai}`)
    if (room?.benh_nhan_hien_tai_id || inRoom) lyDoChan.push('dang_co_benh_nhan_trong_phong')
    if (protectedOnline) lyDoChan.push('dang_bao_ve_lich_online_gan')

    rows.push({
      doctor_id: doctorId,
      bac_si: card.doctor.user_id?.ho_ten ?? null,
      schedule_id: id(card.schedule._id),
      slot_id: slotInfo?.slot?._id ? String(slotInfo.slot._id) : null,
      khung_index: slotInfo?.slot?.khung_index ?? null,
      gio_bat_dau: slotInfo?.slot?.gio_bat_dau ?? null,
      gio_ket_thuc: slotInfo?.slot?.gio_ket_thuc ?? null,
      phong_kham: slotInfo?.slot?.phong_kham ?? card.doctor.phong_kham_mac_dinh ?? room?.phong_kham ?? null,
      so_luot_dang_xu_ly: loadByDoctor.get(doctorId) ?? 0,
      hop_le: lyDoChan.length === 0,
      ly_do_chan: lyDoChan,
      diem_tai: (loadByDoctor.get(doctorId) ?? 0) * MAC_DINH_THOI_GIAN_KHAM_PHUT,
    })
  }

  return rows.sort((a, b) => {
    if (a.hop_le !== b.hop_le) return a.hop_le ? -1 : 1
    if (a.diem_tai !== b.diem_tai) return a.diem_tai - b.diem_tai
    return a.doctor_id.localeCompare(b.doctor_id)
  })
}

export async function layGoiYDieuPhoiOffline({
  specialtyId = null,
  entryId = null,
  now = new Date(),
} = {}) {
  const normalizedSpecialtyId = normalizeObjectId(specialtyId, 'specialty_id')
  const normalizedEntryId = normalizeObjectId(entryId, 'queue_id')
  const { start, end } = khoangNgay(now)
  const filter = {
    nguon: 'offline',
    trang_thai: TRANG_THAI_OFFLINE_TRUNG_TAM,
    checkin_time: { $gte: start, $lt: end },
    ...(normalizedSpecialtyId ? { specialty_id: normalizedSpecialtyId } : {}),
    ...(normalizedEntryId ? { _id: normalizedEntryId } : {}),
  }
  const entries = (await HangDoi.find(filter)
    .select('ten_benh_nhan so_dien_thoai specialty_id thoi_diem_vao_hang_doi_trung_tam checkin_time ma_so_thu_tu so_thu_tu_checkin')
    .populate('specialty_id', 'ten')
    .lean()).sort(sapXepHangDoiTrungTam)

  const suggestions = []
  for (const entry of entries.slice(0, 20)) {
    // `entry.specialty_id` da bi populate() thanh object {_id, ten}
    // o tren de phuc vu hien thi ben duoi. Neu truyen thang entry nay vao
    // layUngVienBacSiChoDieuPhoi(), moi so sanh String(specialtyId) trong slotPhuHop se
    // ra "[object Object]" va KHONG BAO GIO khop — goi y dieu phoi luon rong. Phai go lai
    // ve ObjectId thuan truoc khi dua vao logic ghep bac si.
    const rawEntry = {
      ...entry,
      specialty_id: entry.specialty_id?._id ?? entry.specialty_id,
    }
    const candidates = await layUngVienBacSiChoDieuPhoi(rawEntry, now)
    suggestions.push({
      queue_id: String(entry._id),
      ten_benh_nhan: entry.ten_benh_nhan,
      so_dien_thoai: entry.so_dien_thoai ?? null,
      ma_so_thu_tu: entry.ma_so_thu_tu ?? null,
      specialty: entry.specialty_id
        ? { id: String(entry.specialty_id._id ?? entry.specialty_id), ten: entry.specialty_id.ten ?? null }
        : null,
      thoi_gian_cho_phut: phutTuMs(now.getTime() - new Date(entry.thoi_diem_vao_hang_doi_trung_tam ?? entry.checkin_time).getTime()),
      ung_vien: candidates,
      de_xuat_tot_nhat: candidates.find((candidate) => candidate.hop_le) ?? null,
    })
  }

  return { checked_at: now, total: entries.length, suggestions }
}

// `nguon = 'offline'` giu nguyen hanh vi cu (trang OfflineQueue.tsx chi xem khach vang lai).
// Truyen `nguon: null` de lay CA HAI nguon — dung cho tab "Danh sach da kham" (gom online + offline).
// `date`: ngay can xem (tuy chinh, mac dinh hom nay) — tab "Danh sach da kham" cho phep tra cuu
// bat ky ngay nao, khong con khoa cung "hom nay" nhu ban cu.
export async function layDanhSachHangDoiOffline({
  specialtyId = null,
  status = null,
  doctorId = null,
  nguon = 'offline',
  search = null,
  date = null,
  now = new Date(),
} = {}) {
  const normalizedSpecialtyId = normalizeObjectId(specialtyId, 'specialty_id')
  const normalizedDoctorId = normalizeObjectId(doctorId, 'doctor_id')
  const { start, end } = khoangNgay(date ? new Date(date) : now)
  const statuses = status
    ? String(status).split(',').map((item) => item.trim()).filter(Boolean)
    : TRANG_THAI_OFFLINE_THEO_DOI
  const searchTerm = String(search ?? '').trim()
  const rows = await HangDoi.find({
    checkin_time: { $gte: start, $lt: end },
    trang_thai: { $in: statuses },
    ...(nguon ? { nguon } : {}),
    ...(normalizedSpecialtyId ? { specialty_id: normalizedSpecialtyId } : {}),
    ...(normalizedDoctorId ? { doctor_id: normalizedDoctorId } : {}),
    ...(searchTerm
      ? {
          $or: [
            { ten_benh_nhan: { $regex: searchTerm, $options: 'i' } },
            { so_dien_thoai: { $regex: searchTerm, $options: 'i' } },
            { ma_so_thu_tu: { $regex: searchTerm, $options: 'i' } },
          ],
        }
      : {}),
  })
    .select('nguon appointment_id ten_benh_nhan so_dien_thoai specialty_id doctor_id phong_kham trang_thai checkin_time thoi_diem_vao_hang_doi_trung_tam thoi_diem_duoc_dieu_phoi ma_so_thu_tu so_thu_tu_checkin thoi_gian_cho_uoc_tinh_phut loai_lich_hen lich_hen_goc_id')
    .populate('specialty_id', 'ten')
    .populate({ path: 'doctor_id', select: 'user_id phong_kham_mac_dinh', populate: { path: 'user_id', select: 'ho_ten' } })
    .lean()

  return rows
    .sort((a, b) => new Date(a.thoi_diem_vao_hang_doi_trung_tam ?? a.checkin_time) - new Date(b.thoi_diem_vao_hang_doi_trung_tam ?? b.checkin_time))
    .map((row) => ({
      id: String(row._id),
      nguon: row.nguon,
      appointment_id: row.appointment_id ? String(row.appointment_id) : null,
      ten_benh_nhan: row.ten_benh_nhan,
      so_dien_thoai: row.so_dien_thoai ?? null,
      ma_so_thu_tu: row.ma_so_thu_tu ?? null,
      trang_thai: row.trang_thai,
      loai_lich_hen: row.loai_lich_hen ?? null,
      lich_hen_goc_id: row.lich_hen_goc_id ? String(row.lich_hen_goc_id) : null,
      checkin_time: row.checkin_time,
      thoi_diem_vao_hang_doi_trung_tam: row.thoi_diem_vao_hang_doi_trung_tam ?? row.checkin_time,
      thoi_diem_duoc_dieu_phoi: row.thoi_diem_duoc_dieu_phoi ?? null,
      thoi_gian_cho_uoc_tinh_phut: row.thoi_gian_cho_uoc_tinh_phut ?? null,
      specialty: row.specialty_id
        ? { id: String(row.specialty_id._id ?? row.specialty_id), ten: row.specialty_id.ten ?? null }
        : null,
      doctor: row.doctor_id
        ? {
            id: String(row.doctor_id._id ?? row.doctor_id),
            ho_ten: row.doctor_id.user_id?.ho_ten ?? null,
            phong_kham_mac_dinh: row.doctor_id.phong_kham_mac_dinh ?? null,
          }
        : null,
      phong_kham: row.phong_kham ?? null,
    }))
}

export async function ganKhachOfflineChoBacSi({
  entryId,
  doctorId,
  lyDo = null,
  actorUserId = null,
  actorRole = 'receptionist',
  now = new Date(),
} = {}) {
  const normalizedEntryId = normalizeObjectId(entryId, 'queue_id')
  const normalizedDoctorId = normalizeObjectId(doctorId, 'doctor_id')
  if (!normalizedEntryId) throw loi(400, 'Cần chọn lượt hàng đợi')
  if (!normalizedDoctorId) throw loi(400, 'Cần chọn bác sĩ')

  const entryBefore = await HangDoi.findById(normalizedEntryId).lean()
  if (!entryBefore) throw loi(404, 'Không tìm thấy lượt hàng đợi')
  if (entryBefore.trang_thai !== TRANG_THAI_OFFLINE_TRUNG_TAM) {
    throw loi(409, `Lượt này đang ở trạng thái "${entryBefore.trang_thai}", không thể điều phối`)
  }

  const candidates = await layUngVienBacSiChoDieuPhoi(entryBefore, now)
  const selected = candidates.find((candidate) => candidate.doctor_id === String(normalizedDoctorId))
  if (!selected) throw loi(409, 'Bác sĩ không phù hợp với chuyên khoa của lượt này')
  if (!selected.hop_le) {
    throw loi(409, `Chưa thể điều phối cho bác sĩ này: ${selected.ly_do_chan.join(', ')}`, { candidate: selected })
  }

  let updatedEntry
  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      if (await coDangTrongPhong(normalizedDoctorId, now, session)) {
        throw loi(409, 'Bác sĩ vừa có bệnh nhân vào phòng, vui lòng tải lại gợi ý điều phối')
      }
      const config = layCauHinhHangDoiOffline()
      if (await coOnlineTrongHangDoiCanBaoVe(normalizedDoctorId, now, config, session)) {
        throw loi(409, 'Vừa có khách online cần ưu tiên, vui lòng tải lại gợi ý điều phối')
      }

      updatedEntry = await HangDoi.findOneAndUpdate(
        { _id: normalizedEntryId, trang_thai: TRANG_THAI_OFFLINE_TRUNG_TAM, doctor_id: null },
        {
          $set: {
            doctor_id: normalizedDoctorId,
            schedule_id: selected.schedule_id,
            slot_id: selected.slot_id,
            khung_index: selected.khung_index,
            phong_kham: selected.phong_kham,
            gio_hen_goc: now,
            trang_thai: 'dang_cho',
            thoi_diem_duoc_dieu_phoi: now,
            dieu_phoi_cuoi: {
              doctor_id: normalizedDoctorId,
              schedule_id: selected.schedule_id,
              slot_id: selected.slot_id,
              phong_kham: selected.phong_kham,
              thoi_diem: now,
              nguoi_dieu_phoi_id: actorUserId,
              ly_do: String(lyDo ?? '').trim() || null,
            },
          },
          $inc: { so_lan_dieu_phoi: 1 },
        },
        { new: true, session },
      )
      if (!updatedEntry) throw loi(409, 'Lượt này vừa được người khác xử lý, vui lòng tải lại')

      if (updatedEntry.appointment_id) {
        await LichHen.updateOne(
          { _id: updatedEntry.appointment_id },
          { $set: { doctor_id: normalizedDoctorId, phong_kham: selected.phong_kham } },
          { session }
        )
      }
    })
  } finally {
    await session.endSession()
  }

  await notifyDoctorQueueUpdated(normalizedDoctorId, {
    action: 'central_offline_assigned',
    queue_id: updatedEntry._id,
    nguon: 'offline',
  })

  await ghiNhatKyLeTan({
    hanhDong: 'LT_OFFLINE_ASSIGN_DOCTOR',
    actorUserId,
    actorRole,
    loaiDoiTuong: 'central_offline_queue',
    doiTuongId: updatedEntry._id,
    duLieuCu: { trang_thai: entryBefore.trang_thai, doctor_id: null },
    duLieuMoi: {
      trang_thai: updatedEntry.trang_thai,
      doctor_id: String(updatedEntry.doctor_id),
      phong_kham: updatedEntry.phong_kham ?? null,
      ly_do: String(lyDo ?? '').trim() || null,
    },
  })

  return { entry: updatedEntry }
}

export async function traKhachOfflineVeHangDoiTrungTam({
  entryId,
  lyDo = null,
  actorUserId = null,
  actorRole = 'receptionist',
  now = new Date(),
} = {}) {
  const normalizedEntryId = normalizeObjectId(entryId, 'queue_id')
  if (!normalizedEntryId) throw loi(400, 'Cần chọn lượt hàng đợi')
  const reason = String(lyDo ?? '').trim()
  if (!reason) throw loi(400, 'Cần nhập lý do trả khách về hàng đợi trung tâm')

  const entry = await HangDoi.findById(normalizedEntryId).lean()
  if (!entry) throw loi(404, 'Không tìm thấy lượt hàng đợi')
  if (entry.nguon !== 'offline') throw loi(409, 'Chỉ khách offline mới có thể trả về hàng đợi trung tâm')
  if (entry.trang_thai !== 'dang_cho') {
    throw loi(409, `Lượt này đang ở trạng thái "${entry.trang_thai}", không thể trả về hàng đợi trung tâm`)
  }

  const doctorIdCu = entry.doctor_id
  const updated = await HangDoi.findOneAndUpdate(
    { _id: normalizedEntryId, trang_thai: 'dang_cho' },
    {
      $set: {
        doctor_id: null,
        schedule_id: null,
        slot_id: null,
        khung_index: null,
        phong_kham: null,
        gio_hen_goc: null,
        trang_thai: TRANG_THAI_OFFLINE_TRUNG_TAM,
        thoi_diem_vao_hang_doi_trung_tam: entry.thoi_diem_vao_hang_doi_trung_tam ?? entry.checkin_time ?? now,
      },
    },
    { new: true },
  )
  if (!updated) throw loi(409, 'Lượt này vừa được người khác xử lý, vui lòng tải lại')

  await notifyDoctorQueueUpdated(doctorIdCu, {
    action: 'central_offline_returned',
    queue_id: updated._id,
    nguon: 'offline',
  })
  await ghiNhatKyLeTan({
    hanhDong: 'LT_OFFLINE_RETURN_CENTRAL',
    actorUserId,
    actorRole,
    loaiDoiTuong: 'central_offline_queue',
    doiTuongId: updated._id,
    duLieuCu: { trang_thai: 'dang_cho', doctor_id: doctorIdCu, phong_kham: entry.phong_kham ?? null },
    duLieuMoi: { trang_thai: updated.trang_thai, ly_do: reason },
  })

  return { entry: updated }
}

export async function huyKhachOfflineTrungTam({
  entryId,
  lyDo = null,
  actorUserId = null,
  actorRole = 'receptionist',
} = {}) {
  const normalizedEntryId = normalizeObjectId(entryId, 'queue_id')
  if (!normalizedEntryId) throw loi(400, 'Cần chọn lượt hàng đợi')
  const reason = String(lyDo ?? '').trim()
  if (!reason) throw loi(400, 'Cần nhập lý do hủy lượt chờ')

  const entry = await HangDoi.findById(normalizedEntryId).lean()
  if (!entry) throw loi(404, 'Không tìm thấy lượt hàng đợi')
  if (entry.nguon !== 'offline' || entry.trang_thai !== TRANG_THAI_OFFLINE_TRUNG_TAM) {
    throw loi(409, `Lượt này đang ở trạng thái "${entry.trang_thai}", không thể hủy theo hàng đợi trung tâm`)
  }

  const updated = await HangDoi.findOneAndUpdate(
    { _id: normalizedEntryId, trang_thai: TRANG_THAI_OFFLINE_TRUNG_TAM },
    { $set: { trang_thai: 'cancelled' } },
    { new: true },
  )
  if (!updated) throw loi(409, 'Lượt này vừa được người khác xử lý, vui lòng tải lại')

  await ghiNhatKyLeTan({
    hanhDong: 'LT_OFFLINE_CANCEL_CENTRAL',
    actorUserId,
    actorRole,
    loaiDoiTuong: 'central_offline_queue',
    doiTuongId: updated._id,
    duLieuCu: { trang_thai: TRANG_THAI_OFFLINE_TRUNG_TAM },
    duLieuMoi: { trang_thai: 'cancelled', ly_do: reason },
  })

  return { entry: updated }
}

export default {
  ketLuanSucChuaHangDoiOfflineTrungTam,
  sapXepHangDoiTrungTam,
  tinhSucChuaHangDoiOfflineTrungTam,
  tiepNhanOfflineVaoHangDoiTrungTam,
  layGoiYDieuPhoiOffline,
  layDanhSachHangDoiOffline,
  ganKhachOfflineChoBacSi,
  traKhachOfflineVeHangDoiTrungTam,
  huyKhachOfflineTrungTam,
}
