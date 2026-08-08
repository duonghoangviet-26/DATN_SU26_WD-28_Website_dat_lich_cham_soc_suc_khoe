import mongoose from 'mongoose'
import {
  BacSi,
  HangDoi,
  HoSoBenhNhan,
  LichHen,
  LichLamViec,
} from '../models/index.js'
import { tinhMucUuTien } from '../models/HangDoi.js'
import { buildSlotDateTime, startOfDayUtc } from '../utils/clinicTime.js'
import { kiemTraQuaTai } from './queueOverflow.service.js'
import { notifyDoctorQueueUpdated } from './doctorQueueRealtime.service.js'
import { capSoThuTuCheckin } from './checkInNumber.service.js'
import { donDepSlotTruocKhiDoc } from './slotRelease.service.js'
import { cacKhungDuocBanTaiQuay, locSlotBanTaiQuay } from './walkInWindow.service.js'

const TRANG_THAI_GIU_CHO = ['dang_cho', 'da_goi', 'trong_phong', 'cho_dich_vu']

function loi(statusCode, message, data = null) {
  return Object.assign(new Error(message), { statusCode, data })
}

function khoangNgay(now) {
  const start = startOfDayUtc(now)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start, end }
}

function serializeSlot(schedule, slot) {
  return {
    schedule_id: schedule._id,
    slot_id: slot._id,
    doctor_id: schedule.doctor_id,
    specialty_id: slot.specialty_id,
    khung_index: slot.khung_index,
    gio_bat_dau: slot.gio_bat_dau,
    gio_ket_thuc: slot.gio_ket_thuc,
    phong_kham: slot.phong_kham,
    ngay: schedule.ngay,
  }
}

function sapXepSlot(a, b) {
  return buildSlotDateTime(a.ngay, a.gio_bat_dau) - buildSlotDateTime(b.ngay, b.gio_bat_dau)
}

function sapXepUngVien(a, b, quaTaiByDoctor) {
  const theoGio = sapXepSlot(a, b)
  if (theoGio !== 0) return theoGio

  const quaTaiA = quaTaiByDoctor.get(id(a.doctor_id)) ?? {}
  const quaTaiB = quaTaiByDoctor.get(id(b.doctor_id)) ?? {}
  const theoTre = (quaTaiA.doTrePhut ?? 0) - (quaTaiB.doTrePhut ?? 0)
  if (theoTre !== 0) return theoTre

  const theoHangDoi = (quaTaiA.soNguoiDangCho ?? 0) - (quaTaiB.soNguoiDangCho ?? 0)
  if (theoHangDoi !== 0) return theoHangDoi

  const theoBacSi = id(a.doctor_id).localeCompare(id(b.doctor_id))
  if (theoBacSi !== 0) return theoBacSi
  return id(a.slot_id).localeCompare(id(b.slot_id))
}

function id(value) {
  return value ? String(value) : null
}

async function taoMinhChungSucChua(schedules, slotDaGiu, quaTaiByDoctor, now) {
  const scheduleIds = schedules.map((schedule) => schedule._id)
  const doctorIds = [...new Set(schedules.map((schedule) => id(schedule.doctor_id)).filter(Boolean))]

  const [doctors, appointments, queueEntries] = await Promise.all([
    BacSi.find({ _id: { $in: doctorIds } })
      .select('user_id phong_kham_mac_dinh trang_thai trang_thai_duyet la_hien')
      .populate('user_id', 'ho_ten')
      .lean(),
    LichHen.find({
      schedule_id: { $in: scheduleIds },
      status: { $nin: ['cancelled', 'no_show', 'skipped'] },
    }).select('schedule_id slot_id status').lean(),
    HangDoi.find({
      schedule_id: { $in: scheduleIds },
      trang_thai: { $in: TRANG_THAI_GIU_CHO },
    }).select('schedule_id slot_id doctor_id trang_thai').lean(),
  ])

  const doctorById = new Map(doctors.map((doctor) => [id(doctor._id), doctor]))
  const appointmentsBySlot = new Map()
  for (const appointment of appointments) {
    if (!appointment.schedule_id || !appointment.slot_id) continue
    const key = `${id(appointment.schedule_id)}:${id(appointment.slot_id)}`
    appointmentsBySlot.set(key, (appointmentsBySlot.get(key) ?? 0) + 1)
  }
  const queuesBySlot = new Map()
  const queuesByDoctor = new Map()
  for (const queue of queueEntries) {
    if (queue.schedule_id && queue.slot_id) {
      const key = `${id(queue.schedule_id)}:${id(queue.slot_id)}`
      queuesBySlot.set(key, (queuesBySlot.get(key) ?? 0) + 1)
    }
    if (queue.doctor_id) queuesByDoctor.set(id(queue.doctor_id), (queuesByDoctor.get(id(queue.doctor_id)) ?? 0) + 1)
  }

  return schedules.map((schedule) => {
    const doctorId = id(schedule.doctor_id)
    const doctor = doctorById.get(doctorId)
    const allowedWindows = cacKhungDuocBanTaiQuay(schedule.slots, schedule.ngay, now)
    const windowSlots = (schedule.slots || []).filter((slot) => allowedWindows.has(slot.khung_index))
    const walkInSlots = windowSlots.filter((slot) => slot.loai_slot === 'walk_in' && !slot.bi_khoa_boi_nghi_phep)
    const availableWalkInSlots = walkInSlots.filter((slot) =>
      slot.status === 'active'
      && !slot.benh_nhan_id
      && !slot.benh_nhan_tam_giu_id
      && !slotDaGiu.has(`${id(schedule._id)}:${id(slot._id)}`),
    )
    const onlineSlots = windowSlots.filter((slot) => slot.loai_slot !== 'walk_in')
    const onlineBooked = onlineSlots.reduce(
      (total, slot) => total + (appointmentsBySlot.get(`${id(schedule._id)}:${id(slot._id)}`) ?? 0),
      0,
    )
    const walkInReserved = walkInSlots.reduce(
      (total, slot) => total + (queuesBySlot.get(`${id(schedule._id)}:${id(slot._id)}`) ?? 0),
      0,
    )
    const overload = quaTaiByDoctor.get(doctorId) ?? {
      doTrePhut: 0,
      nguyenNhanDoTre: 'khong_tre',
      soNguoiDangCho: 0,
      ngungBanWalkIn: false,
      canhBao: null,
    }

    let ketLuan = 'co_the_tiep_nhan'
    let lyDo = 'Còn slot walk-in trong khung được phép tiếp nhận.'
    if (allowedWindows.size === 0) {
      ketLuan = 'khong_co_khung_gan'
      lyDo = 'Chưa có khung hiện tại hoặc kế tiếp được mở cho khách tại quầy.'
    } else if (overload.ngungBanWalkIn) {
      ketLuan = 'tam_dung_qua_tai'
      lyDo = overload.canhBao || `Bác sĩ đang trễ ${overload.doTrePhut} phút.`
    } else if (availableWalkInSlots.length === 0) {
      ketLuan = 'da_day_walk_in'
      lyDo = 'Các slot walk-in trong khung gần nhất đã được giữ hoặc đã hết.'
    }

    return {
      doctor_id: doctorId,
      bac_si: doctor?.user_id?.ho_ten ?? 'Chưa xác định bác sĩ',
      phong_mac_dinh: doctor?.phong_kham_mac_dinh ?? null,
      schedule_id: id(schedule._id),
      lich_ngay: schedule.ngay,
      lich_cap_nhat_luc: schedule.ngay_cap_nhat ?? null,
      khung_gan_nhat: windowSlots
        .map((slot) => serializeSlot(schedule, slot))
        .sort(sapXepSlot)[0] ?? null,
      tong_slot_trong_khung: windowSlots.length,
      online_da_dat: onlineBooked,
      walk_in_tong: walkInSlots.length,
      walk_in_da_giu: walkInReserved,
      walk_in_con_lai: availableWalkInSlots.length,
      dang_cho: overload.soNguoiDangCho ?? queuesByDoctor.get(doctorId) ?? 0,
      do_tre_phut: overload.doTrePhut,
      nguyenNhanDoTre: overload.nguyenNhanDoTre,
      nguong_dung_walk_in_phut: Number(process.env.OVERFLOW_NGUNG_WALKIN_PHUT || 30),
      ket_luan: ketLuan,
      ly_do: lyDo,
    }
  })
}

async function layLichLamViecHomNay(now) {
  const { start, end } = khoangNgay(now)
  const rawSchedules = await LichLamViec.find({
    ngay: { $gte: start, $lt: end },
    trang_thai_ngay: 'lam_viec',
    trang_thai_xac_nhan: { $ne: 'tu_choi' },
  })

  const doctorIds = [...new Set(rawSchedules.map((schedule) => id(schedule.doctor_id)).filter(Boolean))]
  const validDoctors = await BacSi.find({
    _id: { $in: doctorIds },
    trang_thai: 'active',
    trang_thai_duyet: 'approved',
    la_hien: true,
  }).select('_id').lean()
  const validDoctorIds = new Set(validDoctors.map((doctor) => id(doctor._id)))
  const schedules = rawSchedules.filter((schedule) => validDoctorIds.has(id(schedule.doctor_id)))

  for (const schedule of schedules) {
    await donDepSlotTruocKhiDoc(schedule, now)
  }
  return schedules
}

async function laySlotDaGiu(scheduleIds) {
  const rows = await HangDoi.find({
    schedule_id: { $in: scheduleIds },
    slot_id: { $ne: null },
    trang_thai: { $in: TRANG_THAI_GIU_CHO },
  }).select('schedule_id slot_id').lean()
  return new Set(rows.map((row) => `${row.schedule_id}:${row.slot_id}`))
}

function locTheoChuyenKhoa(slots, specialtyId) {
  if (!specialtyId) return slots
  return slots.filter((slot) => String(slot.specialty_id) === String(specialtyId))
}

function taoDeXuatQuayLai(schedules, slotDaGiu, now, specialtyId) {
  return schedules
    .flatMap((schedule) => (schedule.slots || [])
      .filter((slot) => slot.status === 'active'
        && slot.loai_slot === 'walk_in'
        && !slot.bi_khoa_boi_nghi_phep
        && !slot.benh_nhan_id
        && !slot.benh_nhan_tam_giu_id
        && !slotDaGiu.has(`${id(schedule._id)}:${id(slot._id)}`)
        && buildSlotDateTime(schedule.ngay, slot.gio_bat_dau)?.getTime() > now.getTime())
      .map((slot) => serializeSlot(schedule, slot)))
    .filter((slot) => !specialtyId || String(slot.specialty_id) === String(specialtyId))
    .sort(sapXepSlot)[0] ?? null
}

export async function layKhaNangTiepNhanTaiQuay({ specialtyId = null, now = new Date() }) {
  const schedules = await layLichLamViecHomNay(now)
  const slotDaGiu = await laySlotDaGiu(schedules.map((schedule) => schedule._id))
  const candidates = schedules.flatMap((schedule) => locTheoChuyenKhoa(
    locSlotBanTaiQuay(schedule, now),
    specialtyId,
  )
    .filter((slot) => !slotDaGiu.has(`${schedule._id}:${slot._id}`))
    .map((slot) => serializeSlot(schedule, slot)))
    .sort(sapXepSlot)

  const doTreTheoBacSi = await Promise.all(
    [...new Set(candidates.map((candidate) => String(candidate.doctor_id)))].map(async (doctorId) => [
      doctorId,
      await kiemTraQuaTai(doctorId, now),
    ]),
  )
  const quaTaiByDoctor = new Map(doTreTheoBacSi)
  const slotChoXuLy = candidates.slice().sort((a, b) => sapXepUngVien(a, b, quaTaiByDoctor))
  const duocNhan = slotChoXuLy.filter((candidate) => !quaTaiByDoctor.get(String(candidate.doctor_id))?.ngungBanWalkIn)
  const biChanQuaTai = candidates.length > 0 && duocNhan.length === 0
  const minhChung = await taoMinhChungSucChua(schedules, slotDaGiu, quaTaiByDoctor, now)
  const slotDeXuat = duocNhan[0] ?? null
  const minhChungDeXuat = slotDeXuat
    ? minhChung.find((row) => row.doctor_id === id(slotDeXuat.doctor_id))
    : null
  const khongCoKhungGan = minhChung.length > 0 && minhChung.every((row) => row.ket_luan === 'khong_co_khung_gan')
  const goiYQuayLai = taoDeXuatQuayLai(schedules, slotDaGiu, now, specialtyId)
  const lyDoDeXuat = slotDeXuat && minhChungDeXuat
    ? `Chọn ${minhChungDeXuat.bac_si} vì có khung gần nhất ${slotDeXuat.gio_bat_dau}–${slotDeXuat.gio_ket_thuc}, còn ${minhChungDeXuat.walk_in_con_lai} slot walk-in, đang chờ ${minhChungDeXuat.dang_cho} người và độ trễ ${minhChungDeXuat.do_tre_phut} phút.`
    : null

  return {
    ngay: startOfDayUtc(now),
    slots: duocNhan,
    slot_cho_xu_ly: slotChoXuLy,
    slot_de_xuat: slotDeXuat,
    ly_do_de_xuat: lyDoDeXuat,
    minh_chung_suc_chua: minhChung,
    checked_at: now,
    trang_thai_kiem_tra: schedules.length === 0
      ? 'khong_co_lich_bac_si'
      : duocNhan.length > 0
        ? 'co_the_tiep_nhan'
        : biChanQuaTai
          ? 'tam_dung_qua_tai'
          : khongCoKhungGan
            ? 'khong_co_khung_gan'
            : 'da_day_walk_in',
    goi_y_quay_lai: goiYQuayLai,
    bi_chan_qua_tai: biChanQuaTai,
    thong_bao: khongCoKhungGan
      ? `Hiện đang ngoài khung tiếp nhận. Mời khách quay lại từ ${goiYQuayLai?.gio_bat_dau ?? 'ca làm việc tiếp theo'}.`
      : biChanQuaTai
      ? 'Ca đang trễ, tạm dừng nhận thêm khách tại quầy.'
      : schedules.length === 0
        ? 'Không có lịch bác sĩ hợp lệ đang làm việc hôm nay.'
        : duocNhan.length > 0
        ? null
        : 'Hiện chưa còn slot tiếp nhận tại quầy trong khung gần nhất.',
  }
}

export async function tiepNhanHoSoVaoHangDoi({
  hoSoBenhNhanId,
  scheduleId = null,
  slotId = null,
  actorUserId = null,
  actorRole = 'receptionist',
  now = new Date(),
}) {
  if (!mongoose.Types.ObjectId.isValid(hoSoBenhNhanId)) throw loi(400, 'Mã hồ sơ bệnh nhân không hợp lệ')

  const profile = await HoSoBenhNhan.findOne({ _id: hoSoBenhNhanId, trang_thai: 'active' }).lean()
  if (!profile) throw loi(404, 'Ho so benh nhan khong hop le')
  if (!profile.so_dien_thoai) throw loi(400, 'Ho so benh nhan chua co so dien thoai')
  const { start: todayStart, end: tomorrowStart } = khoangNgay(now)
  const activeVisit = await HangDoi.findOne({
    ho_so_benh_nhan_id: profile?._id,
    checkin_time: { $gte: todayStart, $lt: tomorrowStart },
    trang_thai: { $in: TRANG_THAI_GIU_CHO },
  }).select('_id trang_thai gio_hen_goc').lean()
  if (activeVisit) {
    throw loi(409, 'Ho so nay da co mot luot kham dang duoc tiep nhan trong ngay hom nay', { entry: activeVisit })
  }
  const availability = await layKhaNangTiepNhanTaiQuay({ specialtyId: null, now })
  if (availability.bi_chan_qua_tai) {
    throw loi(409, availability.thong_bao, { availability })
  }

  const requested = scheduleId && slotId
    ? availability.slots.find((slot) => String(slot.schedule_id) === String(scheduleId) && String(slot.slot_id) === String(slotId))
    : availability.slots[0]
  if (!requested) {
    throw loi(409, availability.thong_bao, { availability })
  }

  const session = await mongoose.startSession()
  let entry
  try {
    await session.withTransaction(async () => {
      // Khóa logic trên cùng hồ sơ trong transaction để hai quầy không thể
      // đồng thời tạo hai lượt cho cùng một người trong cùng ngày.
      const profileLock = await HoSoBenhNhan.findOneAndUpdate(
        { _id: profile._id, trang_thai: 'active' },
        { $set: { ngay_cap_nhat: now } },
        { new: false, session },
      ).select('_id').lean()
      if (!profileLock) throw loi(409, 'Ho so benh nhan vua thay doi, vui long tai lai du lieu')

      const schedule = await LichLamViec.findOne({
        _id: requested.schedule_id,
        doctor_id: requested.doctor_id,
        ngay: { $gte: todayStart, $lt: tomorrowStart },
        trang_thai_ngay: 'lam_viec',
        trang_thai_xac_nhan: { $ne: 'tu_choi' },
        'slots._id': requested.slot_id,
      }).session(session)
      if (!schedule) throw loi(409, 'Lịch làm việc không còn khả dụng, vui lòng tải lại sức chứa')

      const slot = schedule.slots.id(requested.slot_id)
      const doctor = await BacSi.findOne({
        _id: schedule.doctor_id,
        trang_thai: 'active',
        trang_thai_duyet: 'approved',
        la_hien: true,
      }).session(session).select('_id').lean()
      if (!doctor) throw loi(409, 'Bac si vua khong con du dieu kien tiep nhan, vui long kiem tra lai')

      const activeInTransaction = await HangDoi.findOne({
        ho_so_benh_nhan_id: profile._id,
        checkin_time: { $gte: todayStart, $lt: tomorrowStart },
        trang_thai: { $in: TRANG_THAI_GIU_CHO },
      }).session(session).select('_id').lean()
      if (activeInTransaction) {
        throw loi(409, 'Ho so nay vua duoc tiep nhan o mot luot khac, vui long tai lai hang doi')
      }
      if (!slot
        || !locSlotBanTaiQuay(schedule, now).some((candidate) => String(candidate._id) === String(slot._id))
        || slot.status !== 'active'
        || slot.loai_slot !== 'walk_in'
        || slot.benh_nhan_id
        || slot.benh_nhan_tam_giu_id
        || slot.bi_khoa_boi_nghi_phep) {
        throw loi(409, 'Slot vừa được tiếp nhận bởi người khác, vui lòng chọn slot khác')
      }

      const overload = await kiemTraQuaTai(schedule.doctor_id, now, session)
      if (overload.ngungBanWalkIn) {
        throw loi(409, 'Ca vua vuot nguong tre cho phep, vui long tai lai minh chung va chon bac si khac', { overload })
      }

      const claimed = await LichLamViec.findOneAndUpdate(
        {
          _id: schedule._id,
          slots: {
            $elemMatch: {
              _id: slot._id,
              status: 'active',
              loai_slot: 'walk_in',
              benh_nhan_id: null,
              benh_nhan_tam_giu_id: null,
              bi_khoa_boi_nghi_phep: { $ne: true },
            },
          },
        },
        { $set: { 'slots.$.status': 'booked' } },
        { new: true, session },
      )
      if (!claimed) throw loi(409, 'Slot vừa được tiếp nhận bởi người khác, vui lòng chọn slot khác')

      const claimedSlot = claimed.slots.id(slot._id)
      const checkInNumber = await capSoThuTuCheckin(now)
      const [createdEntry] = await HangDoi.create([{
        nguon: 'offline',
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
        specialty_id: claimedSlot.specialty_id,
        doctor_id: schedule.doctor_id,
        phong_kham: claimedSlot.phong_kham,
        schedule_id: schedule._id,
        slot_id: slot._id,
        khung_index: claimedSlot.khung_index,
        muc_uu_tien: tinhMucUuTien('offline', now, buildSlotDateTime(schedule.ngay, claimedSlot.gio_bat_dau)),
        gio_hen_goc: buildSlotDateTime(schedule.ngay, claimedSlot.gio_bat_dau),
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

  await notifyDoctorQueueUpdated(entry.doctor_id, {
    action: 'checkin',
    queue_id: entry._id,
    nguon: entry.nguon,
  })

  return {
    entry,
    slot: requested,
    canh_bao: [],
  }
}

export async function traSlotVePool(entry) {
  if (!entry?.schedule_id || !entry?.slot_id || entry.trang_thai === 'trong_phong' || entry.trang_thai === 'hoan_thanh') return false
  const result = await LichLamViec.updateOne(
    { _id: entry.schedule_id, 'slots._id': entry.slot_id, 'slots.status': 'booked' },
    { $set: { 'slots.$.status': 'active' } },
  )
  return result.modifiedCount > 0
}
