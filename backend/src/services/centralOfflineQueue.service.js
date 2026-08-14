import mongoose from 'mongoose'
import { BacSi, ChuyenKhoa, HangDoi, HoSoBenhNhan, LichHen, LichLamViec, TrangThaiPhongKham } from '../models/index.js'
import { buildSlotDateTime, startOfDayUtc } from '../utils/clinicTime.js'
import { MAC_DINH_THOI_GIAN_KHAM_PHUT } from '../utils/slotConfig.js'
import { capSoThuTuCheckin } from './checkInNumber.service.js'
import { notifyDoctorQueueUpdated } from './doctorQueueRealtime.service.js'
import { layCauHinhHangDoiOffline } from './offlineQueueConfig.service.js'
import { ghiNhatKyLeTan } from './receptionistAudit.service.js'

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
  if (!mongoose.Types.ObjectId.isValid(value)) throw loi(400, `${fieldName} khong hop le`)
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
      lyDo: 'Khong co bac si hop le dang lam viec theo chuyen khoa hom nay.',
    }
  }
  if (usableDoctorCount === 0) {
    return {
      trangThai: 'tam_dung_nhan',
      lyDo: 'Khong con bac si co du thoi gian an toan de nhan them khach vang lai.',
    }
  }
  if (centralAhead >= maxCentralOfflineQueueSize) {
    return {
      trangThai: 'tam_dung_nhan',
      lyDo: 'Hang doi trung tam da dat gioi han so khach dang cho.',
    }
  }
  if (centralAhead >= maxOfflinePerShiftPerSpecialty) {
    return {
      trangThai: 'tam_dung_nhan',
      lyDo: 'Chuyen khoa da dat gioi han khach vang lai trong ca.',
    }
  }
  if (estimatedWaitMinutes !== null && estimatedWaitMinutes > maxOfflineWaitMinutes) {
    return {
      trangThai: 'tam_dung_nhan',
      lyDo: `Thoi gian cho uoc tinh ${estimatedWaitMinutes} phut vuot nguong ${maxOfflineWaitMinutes} phut.`,
    }
  }
  if (estimatedWaitMinutes !== null && estimatedWaitMinutes >= offlineWarningWaitMinutes) {
    return {
      trangThai: 'canh_bao_day',
      lyDo: `Thoi gian cho uoc tinh ${estimatedWaitMinutes} phut, can thong bao khach truoc khi tiep nhan.`,
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

export async function tiepNhanOfflineVaoHangDoiTrungTam({
  hoSoBenhNhanId,
  specialtyId,
  bacSiUuTienId = null,
  lyDoUuTien = null,
  mucUuTienTiepNhan = 'binh_thuong',
  xacNhanCanhBao = false,
  actorUserId = null,
  actorRole = 'receptionist',
  now = new Date(),
} = {}) {
  const normalizedProfileId = normalizeObjectId(hoSoBenhNhanId, 'ho_so_benh_nhan_id')
  const normalizedSpecialtyId = normalizeObjectId(specialtyId, 'specialty_id')
  const normalizedPreferredDoctorId = normalizeObjectId(bacSiUuTienId, 'bac_si_uu_tien_id')
  if (!normalizedProfileId) throw loi(400, 'Can chon ho so benh nhan')
  if (!normalizedSpecialtyId) throw loi(400, 'Can chon chuyen khoa')

  const profile = await HoSoBenhNhan.findOne({ _id: normalizedProfileId, trang_thai: 'active' }).lean()
  if (!profile) throw loi(404, 'Ho so benh nhan khong hop le')
  // D81 — ho so tam (khong SDT) duoc nhan neu co ma_tam thay the (xem HangDoi.pre('validate')).
  if (!profile.so_dien_thoai && !profile.ma_tam) throw loi(400, 'Ho so benh nhan chua co so dien thoai')

  const { start, end } = khoangNgay(now)
  const activeVisit = await HangDoi.findOne({
    ho_so_benh_nhan_id: profile._id,
    checkin_time: { $gte: start, $lt: end },
    trang_thai: { $in: TRANG_THAI_HANG_DOI_DANG_MO },
  }).select('_id trang_thai doctor_id phong_kham ma_so_thu_tu').lean()
  if (activeVisit) {
    throw loi(409, 'Ho so nay da co mot luot kham dang duoc tiep nhan trong ngay hom nay', { entry: activeVisit })
  }

  const capacity = await tinhSucChuaHangDoiOfflineTrungTam({
    specialtyId: normalizedSpecialtyId,
    includeNewPatient: true,
    now,
  })
  if (!capacity.co_the_nhan) throw loi(409, capacity.ly_do || 'Tam dung nhan khach vang lai', { capacity })
  if (capacity.can_xac_nhan_qua_tai && !xacNhanCanhBao) {
    throw loi(409, 'Hang doi dang gan day, can xac nhan voi khach truoc khi tiep nhan', { capacity, require_confirmation: true })
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
      if (!profileLock) throw loi(409, 'Ho so benh nhan vua thay doi, vui long tai lai du lieu')

      const activeInTransaction = await HangDoi.findOne({
        ho_so_benh_nhan_id: profile._id,
        checkin_time: { $gte: start, $lt: end },
        trang_thai: { $in: TRANG_THAI_HANG_DOI_DANG_MO },
      }).session(session).select('_id').lean()
      if (activeInTransaction) {
        throw loi(409, 'Ho so nay vua duoc tiep nhan o mot luot khac, vui long tai lai hang doi')
      }

      const checkInNumber = await capSoThuTuCheckin(now)
      const [createdEntry] = await HangDoi.create([{
        nguon: 'offline',
        ho_so_benh_nhan_id: profile._id,
        ten_benh_nhan: profile.ho_ten,
        so_dien_thoai: profile.so_dien_thoai,
        ma_tam: profile.ma_tam ?? null,
        ngay_sinh: profile.ngay_sinh,
        tuoi: profile.ngay_sinh ? Math.max(0, now.getUTCFullYear() - new Date(profile.ngay_sinh).getUTCFullYear()) : null,
        gioi_tinh: profile.gioi_tinh,
        nhom_mau: profile.nhom_mau,
        di_ung: profile.di_ung,
        benh_nen: profile.benh_nen,
        dia_chi: profile.dia_chi,
        ghi_chu: profile.ghi_chu,
        specialty_id: normalizedSpecialtyId,
        bac_si_uu_tien_id: normalizedPreferredDoctorId,
        ly_do_uu_tien: lyDoUuTien ? String(lyDoUuTien).trim() : null,
        muc_uu_tien_tiep_nhan: mucUuTienTiepNhan || 'binh_thuong',
        muc_uu_tien: 'offline',
        trang_thai: TRANG_THAI_OFFLINE_TRUNG_TAM,
        thoi_diem_vao_hang_doi_trung_tam: now,
        thoi_gian_cho_uoc_tinh_phut: capacity.thong_ke.thoi_gian_cho_uoc_tinh_phut,
        ...checkInNumber,
        checkin_time: now,
        nguoi_tiep_nhan_id: actorUserId,
        vai_tro_tiep_nhan: actorRole,
      }], { session })
      entry = createdEntry
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
      // Mức ưu tiên đi kèm nhật ký chung (không phải cơ chế riêng) — phòng khám nhỏ không giữ
      // biên bản/báo cáo ca khẩn, chỉ cần bệnh nhân được khám trước ngay lúc đó.
      muc_uu_tien_tiep_nhan: entry.muc_uu_tien_tiep_nhan,
      ly_do_uu_tien: entry.ly_do_uu_tien ?? null,
    },
  })

  // Báo khẩn tới bác sĩ đang trong ca CÙNG chuyên khoa, NGAY LÚC TIẾP NHẬN — sớm hơn mốc điều
  // phối (ganKhachOfflineChoBacSi) vốn chỉ báo đúng MỘT bác sĩ sau khi đã chọn. Cấp cứu cần
  // được biết sớm để bác sĩ chủ động, không chờ lễ tân điều phối xong mới hay.
  // Best-effort: lỗi ở đây không được phép làm hỏng việc tiếp nhận đã ghi nhận xong.
  if (mucUuTienTiepNhan === 'cap_cuu') {
    try {
      const cards = await layBacSiHopLeTheoLich({ specialtyId: normalizedSpecialtyId, now })
      await Promise.all(cards.map((card) => notifyDoctorQueueUpdated(card.doctor._id, {
        action: 'central_offline_cap_cuu',
        queue_id: entry._id,
        ten_benh_nhan: entry.ten_benh_nhan,
        ly_do_uu_tien: entry.ly_do_uu_tien ?? null,
      })))
    } catch (err) {
      console.error('[centralOfflineQueue] Khong bao duoc cap cuu cho bac si:', err.message)
    }
  }

  return {
    entry,
    capacity,
    phieu_cho: {
      ma_so_thu_tu: entry.ma_so_thu_tu ?? null,
      trang_thai: 'cho_dieu_phoi_bac_si',
      thong_bao: 'Khach dang o hang doi trung tam, le tan se dieu phoi khi co bac si phu hop.',
    },
  }
}

export function sapXepHangDoiTrungTam(a, b) {
  const muc = { cap_cuu: 0, uu_tien: 1, binh_thuong: 2 }
  const theoUuTien = (muc[a.muc_uu_tien_tiep_nhan] ?? 2) - (muc[b.muc_uu_tien_tiep_nhan] ?? 2)
  if (theoUuTien !== 0) return theoUuTien
  return new Date(a.thoi_diem_vao_hang_doi_trung_tam ?? a.checkin_time)
    - new Date(b.thoi_diem_vao_hang_doi_trung_tam ?? b.checkin_time)
}

async function layUngVienBacSiChoDieuPhoi(entry, now) {
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
    const preferA = entry.bac_si_uu_tien_id && String(entry.bac_si_uu_tien_id) === a.doctor_id
    const preferB = entry.bac_si_uu_tien_id && String(entry.bac_si_uu_tien_id) === b.doctor_id
    if (preferA !== preferB) return preferA ? -1 : 1
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
    .select('ten_benh_nhan so_dien_thoai specialty_id bac_si_uu_tien_id muc_uu_tien_tiep_nhan thoi_diem_vao_hang_doi_trung_tam checkin_time ma_so_thu_tu so_thu_tu_checkin')
    .populate('specialty_id', 'ten')
    .populate({ path: 'bac_si_uu_tien_id', select: 'user_id', populate: { path: 'user_id', select: 'ho_ten' } })
    .lean()).sort(sapXepHangDoiTrungTam)

  const suggestions = []
  for (const entry of entries.slice(0, 20)) {
    // `entry.specialty_id`/`bac_si_uu_tien_id` da bi populate() thanh object {_id, ten}
    // o tren de phuc vu hien thi ben duoi. Neu truyen thang entry nay vao
    // layUngVienBacSiChoDieuPhoi(), moi so sanh String(specialtyId) trong slotPhuHop se
    // ra "[object Object]" va KHONG BAO GIO khop — goi y dieu phoi luon rong. Phai go lai
    // ve ObjectId thuan truoc khi dua vao logic ghep bac si.
    const rawEntry = {
      ...entry,
      specialty_id: entry.specialty_id?._id ?? entry.specialty_id,
      bac_si_uu_tien_id: entry.bac_si_uu_tien_id?._id ?? entry.bac_si_uu_tien_id,
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
      bac_si_uu_tien: entry.bac_si_uu_tien_id
        ? {
            id: String(entry.bac_si_uu_tien_id._id ?? entry.bac_si_uu_tien_id),
            ho_ten: entry.bac_si_uu_tien_id.user_id?.ho_ten ?? null,
          }
        : null,
      thoi_gian_cho_phut: phutTuMs(now.getTime() - new Date(entry.thoi_diem_vao_hang_doi_trung_tam ?? entry.checkin_time).getTime()),
      ung_vien: candidates,
      de_xuat_tot_nhat: candidates.find((candidate) => candidate.hop_le) ?? null,
    })
  }

  return { checked_at: now, total: entries.length, suggestions }
}

export async function layDanhSachHangDoiOffline({ specialtyId = null, status = null, now = new Date() } = {}) {
  const normalizedSpecialtyId = normalizeObjectId(specialtyId, 'specialty_id')
  const { start, end } = khoangNgay(now)
  const statuses = status
    ? String(status).split(',').map((item) => item.trim()).filter(Boolean)
    : TRANG_THAI_OFFLINE_THEO_DOI
  const rows = await HangDoi.find({
    nguon: 'offline',
    checkin_time: { $gte: start, $lt: end },
    trang_thai: { $in: statuses },
    ...(normalizedSpecialtyId ? { specialty_id: normalizedSpecialtyId } : {}),
  })
    .select('ten_benh_nhan so_dien_thoai specialty_id doctor_id phong_kham trang_thai checkin_time thoi_diem_vao_hang_doi_trung_tam thoi_diem_duoc_dieu_phoi ma_so_thu_tu so_thu_tu_checkin thoi_gian_cho_uoc_tinh_phut')
    .populate('specialty_id', 'ten')
    .populate({ path: 'doctor_id', select: 'user_id phong_kham_mac_dinh', populate: { path: 'user_id', select: 'ho_ten' } })
    .lean()

  return rows
    .sort((a, b) => new Date(a.thoi_diem_vao_hang_doi_trung_tam ?? a.checkin_time) - new Date(b.thoi_diem_vao_hang_doi_trung_tam ?? b.checkin_time))
    .map((row) => ({
      id: String(row._id),
      ten_benh_nhan: row.ten_benh_nhan,
      so_dien_thoai: row.so_dien_thoai ?? null,
      ma_so_thu_tu: row.ma_so_thu_tu ?? null,
      trang_thai: row.trang_thai,
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
  if (!normalizedEntryId) throw loi(400, 'Can chon luot hang doi')
  if (!normalizedDoctorId) throw loi(400, 'Can chon bac si')

  const entryBefore = await HangDoi.findById(normalizedEntryId).lean()
  if (!entryBefore) throw loi(404, 'Khong tim thay luot hang doi')
  if (entryBefore.trang_thai !== TRANG_THAI_OFFLINE_TRUNG_TAM) {
    throw loi(409, `Luot nay dang o trang thai "${entryBefore.trang_thai}", khong the dieu phoi`)
  }

  const candidates = await layUngVienBacSiChoDieuPhoi(entryBefore, now)
  const selected = candidates.find((candidate) => candidate.doctor_id === String(normalizedDoctorId))
  if (!selected) throw loi(409, 'Bac si khong phu hop voi chuyen khoa cua luot nay')
  if (!selected.hop_le) {
    throw loi(409, `Chua the dieu phoi cho bac si nay: ${selected.ly_do_chan.join(', ')}`, { candidate: selected })
  }

  let updatedEntry
  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      if (await coDangTrongPhong(normalizedDoctorId, now, session)) {
        throw loi(409, 'Bac si vua co benh nhan vao phong, vui long tai lai goi y dieu phoi')
      }
      const config = layCauHinhHangDoiOffline()
      if (await coOnlineTrongHangDoiCanBaoVe(normalizedDoctorId, now, config, session)) {
        throw loi(409, 'Vua co khach online can uu tien, vui long tai lai goi y dieu phoi')
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
      if (!updatedEntry) throw loi(409, 'Luot nay vua duoc nguoi khac xu ly, vui long tai lai')
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
  if (!normalizedEntryId) throw loi(400, 'Can chon luot hang doi')
  const reason = String(lyDo ?? '').trim()
  if (!reason) throw loi(400, 'Can nhap ly do tra khach ve hang doi trung tam')

  const entry = await HangDoi.findById(normalizedEntryId).lean()
  if (!entry) throw loi(404, 'Khong tim thay luot hang doi')
  if (entry.nguon !== 'offline') throw loi(409, 'Chi khach offline moi co the tra ve hang doi trung tam')
  if (entry.trang_thai !== 'dang_cho') {
    throw loi(409, `Luot nay dang o trang thai "${entry.trang_thai}", khong the tra ve hang doi trung tam`)
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
  if (!updated) throw loi(409, 'Luot nay vua duoc nguoi khac xu ly, vui long tai lai')

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
  if (!normalizedEntryId) throw loi(400, 'Can chon luot hang doi')
  const reason = String(lyDo ?? '').trim()
  if (!reason) throw loi(400, 'Can nhap ly do huy luot cho')

  const entry = await HangDoi.findById(normalizedEntryId).lean()
  if (!entry) throw loi(404, 'Khong tim thay luot hang doi')
  if (entry.nguon !== 'offline' || entry.trang_thai !== TRANG_THAI_OFFLINE_TRUNG_TAM) {
    throw loi(409, `Luot nay dang o trang thai "${entry.trang_thai}", khong the huy theo hang doi trung tam`)
  }

  const updated = await HangDoi.findOneAndUpdate(
    { _id: normalizedEntryId, trang_thai: TRANG_THAI_OFFLINE_TRUNG_TAM },
    { $set: { trang_thai: 'cancelled' } },
    { new: true },
  )
  if (!updated) throw loi(409, 'Luot nay vua duoc nguoi khac xu ly, vui long tai lai')

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
