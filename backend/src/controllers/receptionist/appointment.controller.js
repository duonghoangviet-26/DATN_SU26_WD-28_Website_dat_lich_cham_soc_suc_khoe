import mongoose from 'mongoose'
import LichHen from '../../models/LichHen.js'
import NguoiDung from '../../models/NguoiDung.js'
import LichLamViec from '../../models/LichLamViec.js'
import LichSuLichHen from '../../models/LichSuLichHen.js'
import NghiPhepBacSi from '../../models/NghiPhepBacSi.js'
import ThanhToan from '../../models/ThanhToan.js'
import ThongBao from '../../models/ThongBao.js'
import BacSi from '../../models/BacSi.js'
import HoSoBenhNhan from '../../models/HoSoBenhNhan.js'
import HangDoi from '../../models/HangDoi.js'
import TrangThaiPhongKham from '../../models/TrangThaiPhongKham.js'
import { emitDashboardAppointmentChanged } from '../../realtime/socket.js'
import { checkInLichHen, layLichChoTiepNhan } from '../../services/checkIn.service.js'
import { apDungPhuongAn, taoDeXuatDoiChoDonNghi } from '../../services/appointmentReschedule.service.js'
import { notifyAppointmentCustomerChange } from '../../services/appointmentCustomerNotification.service.js'
import { releaseAppointmentSlot } from '../../services/bookingPaymentState.service.js'
import { kiemTraQuaTai } from '../../services/queueOverflow.service.js'
import { sendNotificationEmail, isMailConfigured } from '../../services/mail.service.js'
import { buildSlotDateTime, cacMocCuaKhung, startOfDayUtc } from '../../utils/clinicTime.js'
import { caCuaKhung } from '../../models/MauLichLamViec.js'
import { soSanhThuTuHangDoi } from '../../models/HangDoi.js'
import {
  AFFECTED_BY_LEAVE_STATUSES,
  RECEPTIONIST_APPOINTMENT_ACTIONS,
  assertReceptionistAppointmentAction,
  buildReceptionistAppointmentActions,
} from '../../utils/appointmentStatus.js'

function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.startsWith('84') ? `0${digits.slice(2)}` : digits
}

function normalizeName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

export function appointmentBelongsToProfile(appointment, profile) {
  const profileId = String(profile._id)
  const exactProfile = appointment.ho_so_benh_nhan_id && String(appointment.ho_so_benh_nhan_id) === profileId
  const memberMatch = appointment.member_id && profile.member_id
    && String(appointment.member_id) === String(profile.member_id)
  const isProxyAppointment = Boolean(appointment.member_id || appointment.nguoi_dat_ho_id || appointment.dat_ho)
  const accountMatch = !isProxyAppointment && appointment.user_id && profile.tai_khoan_id
    && String(appointment.user_id) === String(profile.tai_khoan_id)

  if (exactProfile || memberMatch || accountMatch) return true

  // Lá»‹ch Ä‘áº·t há»™ ngÆ°á»i chÆ°a cÃ³ há»“ sÆ¡ liÃªn káº¿t: chá»‰ nháº­n khi cáº£ tÃªn vÃ  sá»‘ Ä‘iá»‡n thoáº¡i
  // trÃªn lá»‹ch khá»›p vá»›i há»“ sÆ¡ mÃ  lá»… tÃ¢n vá»«a xÃ¡c nháº­n.
  return Boolean(
    appointment.ten_khach
      && normalizeName(appointment.ten_khach) === normalizeName(profile.ho_ten)
      && normalizePhone(appointment.so_dien_thoai_khach) === normalizePhone(profile.so_dien_thoai_tim_kiem || profile.so_dien_thoai),
  )
}

function getActorUserId(req) {
  return req.user?._id ?? req.user?.id ?? null
}

function getActorRole(req) {
  return req.user?.role === 'admin' ? 'admin' : 'receptionist'
}

function nextDayUtc(date) {
  const value = new Date(date)
  value.setUTCDate(value.getUTCDate() + 1)
  value.setUTCHours(0, 0, 0, 0)
  return value
}

function validHHMM(value) {
  return !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function leaveSlotInRange(leave, slot) {
  return !leave.gio_bat_dau || !leave.gio_ket_thuc
    ? true
    : slot.gio_bat_dau < leave.gio_ket_thuc && slot.gio_ket_thuc > leave.gio_bat_dau
}

async function lockSlotsForSuddenLeave(leave, session) {
  const schedules = await LichLamViec.find({
    doctor_id: leave.bac_si_id,
    ngay: { $gte: startOfDayUtc(leave.tu_ngay), $lt: nextDayUtc(leave.den_ngay) },
  }).session(session)

  let slotsLocked = 0
  for (const schedule of schedules) {
    let changed = false
    for (const slot of schedule.slots) {
      if (!leaveSlotInRange(leave, slot) || slot.status !== 'active') continue
      slot.status = 'locked'
      slot.bi_khoa_boi_nghi_phep = true
      slot.nghi_phep_id = leave._id
      slotsLocked += 1
      changed = true
    }
    if (!leave.gio_bat_dau && schedule.trang_thai_ngay === 'lam_viec') {
      schedule.trang_thai_ngay = 'nghi_phep'
      changed = true
    }
    if (changed) await schedule.save({ session })
  }
  return slotsLocked
}

async function findAppointmentsAffectedBySuddenLeave(leave, session, appointmentIds = null) {
  const query = {
    doctor_id: leave.bac_si_id,
    status: { $in: AFFECTED_BY_LEAVE_STATUSES },
    ngay_kham: { $gte: startOfDayUtc(leave.tu_ngay), $lt: nextDayUtc(leave.den_ngay) },
  }
  if (Array.isArray(appointmentIds) && appointmentIds.length > 0) {
    query._id = { $in: appointmentIds }
  }

  let appointments = await LichHen.find(query)
    .select('_id ma_lich_hen ngay_kham gio_kham status ten_khach so_dien_thoai_khach user_id doctor_id specialty_id schedule_id slot_id payment_status de_xuat_doi')
    .session(session)

  if (leave.gio_bat_dau && leave.gio_ket_thuc) {
    appointments = appointments.filter((appointment) => (
      appointment.gio_kham >= leave.gio_bat_dau && appointment.gio_kham < leave.gio_ket_thuc
    ))
  }
  return appointments
}

function summarizeSuddenLeaveProposal(result) {
  return {
    appointment_id: result.appointment_id,
    so_phuong_an: result.so_phuong_an,
    cho_admin_duyet: result.cho_admin_duyet,
    can_lien_he_thu_cong: result.so_phuong_an === 0 || result.cho_admin_duyet,
  }
}

async function getQueueEntryForAppointment(appointmentId, session = null) {
  const query = HangDoi.findOne({ appointment_id: appointmentId })
    .select('_id appointment_id trang_thai checkin_time thoi_diem_vao_phong so_thu_tu_checkin ma_so_thu_tu ngay_checkin_key')
  if (session) query.session(session)
  return query.lean()
}

export const getAppointments = async (req, res) => {
  try {
    const { date, status, timeframe, search, doctor_id, page = 1, limit = 10 } = req.query
    const pageNum = parseInt(page) || 1
    const limitNum = parseInt(limit) || 10
    const query = { loai_kham: 'clinic' }

    if (search) {
      const users = await NguoiDung.find({
        $or: [
          { ho_ten: { $regex: search, $options: 'i' } },
          { so_dien_thoai: { $regex: search, $options: 'i' } }
        ]
      }).select('_id')

      const userIds = users.map(u => u._id)

      query.$or = [
        { ma_lich_hen: { $regex: search, $options: 'i' } },
        { ten_khach: { $regex: search, $options: 'i' } },
        { so_dien_thoai_khach: { $regex: search, $options: 'i' } },
        { user_id: { $in: userIds } }
      ]
    }

    if (date) {
      query.ngay_kham = new Date(`${date}T00:00:00.000Z`)
    } else {
      const now = new Date()
      // Ã‰p chuáº©n vá» mÃºi giá» Viá»‡t Nam (UTC+7) Ä‘á»ƒ Server khÃ´ng bá»‹ láº¡c ngÃ y
      const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000)
      const todayString = vnTime.toISOString().split('T')[0]
      const todayUTC = new Date(`${todayString}T00:00:00.000Z`)

      const tomorrowVn = new Date(vnTime.getTime() + 24 * 60 * 60 * 1000)
      const tomorrowString = tomorrowVn.toISOString().split('T')[0]
      const tomorrowUTC = new Date(`${tomorrowString}T00:00:00.000Z`)

      if (timeframe === 'today') {
        query.ngay_kham = todayUTC
      } else if (timeframe === 'tomorrow') {
        query.ngay_kham = tomorrowUTC
      } else if (timeframe === 'upcoming') {
        query.ngay_kham = { $gt: todayUTC }
      } else if (timeframe === 'past') {
        query.ngay_kham = { $lt: todayUTC }
      }
    }

    if (status) query.status = status
    if (doctor_id) query.doctor_id = doctor_id

    let sortOption = { ngay_kham: 1, gio_kham: 1 }
    if (timeframe === 'past') {
      sortOption = { ngay_kham: -1, gio_kham: -1 }
    }

    const totalDocs = await LichHen.countDocuments(query)
    const totalPages = Math.ceil(totalDocs / limitNum)

    const appointments = await LichHen.find(query)
      .populate('user_id', 'ho_ten so_dien_thoai email anh_dai_dien')
      .populate({
        path: 'doctor_id',
        populate: { path: 'user_id', select: 'ho_ten' }
      })
      .sort(sortOption)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean()

    const queueEntries = appointments.length
      ? await HangDoi.find({ appointment_id: { $in: appointments.map((appointment) => appointment._id) } })
        .select('_id appointment_id trang_thai checkin_time thoi_diem_vao_phong so_thu_tu_checkin ma_so_thu_tu ngay_checkin_key')
        .lean()
      : []
    const queueByAppointment = new Map(queueEntries.map((entry) => [String(entry.appointment_id), entry]))
    const data = appointments.map((appointment) => ({
      ...appointment,
      ...buildReceptionistAppointmentActions(
        appointment,
        queueByAppointment.get(String(appointment._id)) ?? null,
      ),
    }))

    res.status(200).json({
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalDocs,
        totalPages
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// Lá»… tÃ¢n tiáº¿p nháº­n bá»‡nh nhÃ¢n tá»›i quáº§y.
//
// âš ï¸ TrÆ°á»›c 2026-07-26 hÃ m nÃ y CHá»ˆ Ä‘á»•i `status = 'checked_in'`. Bá»‡nh nhÃ¢n Ä‘áº·t online, Ä‘Ã£ thanh
// toÃ¡n, tá»›i quáº§y, lá»… tÃ¢n báº¥m "Ä‘Ã£ Ä‘áº¿n" â€” vÃ  khÃ´ng bao giá» xuáº¥t hiá»‡n trong hÃ ng Ä‘á»£i cá»§a bÃ¡c sÄ©,
// vÃ¬ hÃ ng Ä‘á»£i neo trÃªn collection `HangDoi` chá»© khÃ´ng trÃªn `LichHen.status`. BÃ¡c sÄ© khÃ´ng cÃ³
// cÃ¡ch nÃ o tiáº¿p nháº­n há»; tá»‡ hÆ¡n, rule má»¥c 8 Ä‘á»‹nh nghÄ©a `no_show` = "háº¿t ca mÃ  khÃ´ng cÃ³ báº£n ghi
// HangDoi" nÃªn ngÆ°á»i Ä‘Ã£ tá»›i quáº§y váº«n bá»‹ coi lÃ  khÃ´ng Ä‘áº¿n vÃ  máº¥t 100% tiá»n (má»¥c 5).
//
// Nay gá»i CHUNG service check-in vá»›i bÃ¡c sÄ© (rule má»¥c 7). KhÃ¡c biá»‡t duy nháº¥t: lá»… tÃ¢n tiáº¿p nháº­n
// cho cáº£ phÃ²ng khÃ¡m nÃªn khÃ´ng truyá»n `restrictToDoctorId`.
export const markAsArrived = async (req, res) => {
  try {
    const { ho_so_benh_nhan_id, so_dien_thoai, ho_ten } = req.body ?? {}
    if (!ho_so_benh_nhan_id || !so_dien_thoai || !ho_ten) {
      return res.status(400).json({
        success: false,
        message: 'Check-in pháº£i tra cá»©u vÃ  xÃ¡c nháº­n há»“ sÆ¡ báº±ng sá»‘ Ä‘iá»‡n thoáº¡i, há» tÃªn bá»‡nh nhÃ¢n trÆ°á»›c.',
      })
    }

    const profile = await HoSoBenhNhan.findOne({ _id: ho_so_benh_nhan_id, trang_thai: 'active' }).lean()
    if (!profile) return res.status(404).json({ success: false, message: 'KhÃ´ng tÃ¬m tháº¥y há»“ sÆ¡ bá»‡nh nhÃ¢n Ä‘Ã£ xÃ¡c nháº­n.' })
    if (normalizePhone(so_dien_thoai) !== normalizePhone(profile.so_dien_thoai_tim_kiem || profile.so_dien_thoai)
      || normalizeName(ho_ten) !== normalizeName(profile.ho_ten)) {
      return res.status(409).json({ success: false, message: 'ThÃ´ng tin check-in khÃ´ng khá»›p vá»›i há»“ sÆ¡ bá»‡nh nhÃ¢n Ä‘Ã£ tra cá»©u.' })
    }

    const checkedAppointment = await LichHen.findById(req.params.id)
      .select('ho_so_benh_nhan_id member_id user_id nguoi_dat_ho_id dat_ho ten_khach so_dien_thoai_khach')
      .lean()
    if (!checkedAppointment || !appointmentBelongsToProfile(checkedAppointment, profile)) {
      return res.status(409).json({ success: false, message: 'Lá»‹ch háº¹n khÃ´ng thuá»™c Ä‘Ãºng bá»‡nh nhÃ¢n vá»«a Ä‘Æ°á»£c xÃ¡c nháº­n.' })
    }

    // Náº¿u Ä‘Ã¢y lÃ  láº§n Ä‘áº§u há»“ sÆ¡ táº¡i quáº§y gáº·p láº¡i tÃ i khoáº£n online, liÃªn káº¿t ngay
    // sau khi lá»… tÃ¢n Ä‘Ã£ xÃ¡c minh Ä‘Ãºng ngÆ°á»i. KhÃ´ng ghi Ä‘Ã¨ liÃªn káº¿t cÅ© vÃ  phÃ¢n biá»‡t
    // tÃ i khoáº£n bá»‡nh nhÃ¢n vá»›i tÃ i khoáº£n ngÆ°á»i Ä‘áº·t há»™.
    if (checkedAppointment.user_id && !profile.tai_khoan_id && !profile.nguoi_giam_ho_id) {
      const linkField = checkedAppointment.dat_ho || checkedAppointment.member_id || checkedAppointment.nguoi_dat_ho_id
        ? 'nguoi_giam_ho_id'
        : 'tai_khoan_id'
      await HoSoBenhNhan.updateOne(
        { _id: profile._id, tai_khoan_id: null, nguoi_giam_ho_id: null },
        { $set: { [linkField]: checkedAppointment.user_id } },
      )
    }

    const { entry, appointment, trang_thai_cu, canh_bao } = await checkInLichHen({
      appointmentId: req.params.id,
      actorUserId: req.user?._id ?? req.user?.id ?? null,
      actorRole: 'receptionist',
      patientProfileId: profile._id,
    })

    // Create ThanhToan record if it doesn't exist
    const existingPayment = await ThanhToan.findOne({ appointment_id: appointment._id })
    if (!existingPayment && appointment.payment_status === 'unpaid') {
      await ThanhToan.create({
        appointment_id: appointment._id,
        benh_nhan_id: appointment.user_id,
        ma_giao_dich: `TXN${Date.now().toString().slice(-6)}`,
        so_tien: appointment.gia_kham || 200000,
        loai_thanh_toan: 'phi_dat_lich',
        phuong_thuc: 'tien_mat',
        status: 'pending',
        ngay_tao: new Date()
      })
    }

    emitDashboardAppointmentChanged(trang_thai_cu, appointment.status)

    res.status(200).json({
      success: true,
      message: 'ÄÃ£ check-in bá»‡nh nhÃ¢n vÃ o hÃ ng Ä‘á»£i',
      data: appointment,
      hang_doi: {
        id: entry._id,
        doctor_id: entry.doctor_id,
        phong_kham: entry.phong_kham,
        gio_hen_goc: entry.gio_hen_goc,
        checkin_time: entry.checkin_time,
        so_thu_tu_checkin: entry.so_thu_tu_checkin,
        ma_so_thu_tu: entry.ma_so_thu_tu,
      },
      canh_bao,
    })
  } catch (error) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message })
  }
}

// GET /api/receptionist/appointments/pending-checkin â€” khÃ¡ch Ä‘Ã£ Ä‘áº·t hÃ´m nay, chÆ°a vÃ o hÃ ng Ä‘á»£i.
// CÃ¹ng nguá»“n dá»¯ liá»‡u vá»›i danh sÃ¡ch cá»§a bÃ¡c sÄ©, chá»‰ khÃ¡c lÃ  khÃ´ng giá»›i háº¡n theo má»™t bÃ¡c sÄ©.
export const getPendingCheckin = async (req, res) => {
  try {
    const rows = await layLichChoTiepNhan({ ngay: req.query.date ?? null })
    res.status(200).json({ success: true, data: rows })
  } catch (error) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message })
  }
}

export const getDoctorOperationalStatuses = async (req, res) => {
  try {
    const now = new Date()
    const todayStart = startOfDayUtc(req.query.date ?? now)
    const todayEnd = new Date(todayStart)
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1)

    const doctors = await BacSi.find({
      trang_thai_duyet: 'approved',
      la_hien: true,
    })
      .select('_id user_id specialties trang_thai phong_kham_mac_dinh')
      .populate('user_id', 'ho_ten')
      .populate('specialties', 'ten')
      .lean()

    const doctorIds = doctors.map((doctor) => doctor._id)
    const [schedules, rooms, queues, unarrivedAppointments] = await Promise.all([
      doctorIds.length
        ? LichLamViec.find({
          doctor_id: { $in: doctorIds },
          ngay: { $gte: todayStart, $lt: todayEnd },
          trang_thai_ngay: 'lam_viec',
          trang_thai_xac_nhan: { $ne: 'tu_choi' },
        }).select('_id doctor_id slots').lean()
        : [],
      doctorIds.length
        ? TrangThaiPhongKham.find({
          doctor_id: { $in: doctorIds },
          ngay: { $gte: todayStart, $lt: todayEnd },
        }).lean()
        : [],
      doctorIds.length
        ? HangDoi.find({
          doctor_id: { $in: doctorIds },
          checkin_time: { $gte: todayStart, $lt: todayEnd },
          trang_thai: { $in: ['dang_cho', 'da_goi', 'trong_phong', 'cho_dich_vu'] },
        }).select('_id appointment_id doctor_id trang_thai ten_benh_nhan checkin_time gio_hen_goc thoi_diem_goi thoi_diem_vao_phong ma_so_thu_tu so_thu_tu_checkin nguon').lean()
        : [],
      doctorIds.length
        ? LichHen.find({
          doctor_id: { $in: doctorIds },
          ngay_kham: { $gte: todayStart, $lt: todayEnd },
          status: { $in: ['pending', 'confirmed'] },
        }).select('_id doctor_id ma_lich_hen ten_khach so_dien_thoai_khach ngay_kham gio_kham status user_id').populate('user_id', 'ho_ten so_dien_thoai').lean()
        : [],
    ])

    const scheduleByDoctor = new Map()
    for (const schedule of schedules) {
      scheduleByDoctor.set(String(schedule.doctor_id), schedule)
    }

    const roomByDoctor = new Map(rooms.map((room) => [String(room.doctor_id), room]))
    const queuesByDoctor = new Map()
    for (const queue of queues) {
      const key = String(queue.doctor_id)
      if (!queuesByDoctor.has(key)) queuesByDoctor.set(key, [])
      queuesByDoctor.get(key).push(queue)
    }
    const unarrivedByDoctor = new Map()
    for (const appointment of unarrivedAppointments) {
      const key = String(appointment.doctor_id)
      if (!unarrivedByDoctor.has(key)) unarrivedByDoctor.set(key, [])
      unarrivedByDoctor.get(key).push(appointment)
    }

    const data = await Promise.all(doctors.map(async (doctor) => {
      const key = String(doctor._id)
      const schedule = scheduleByDoctor.get(key) ?? null
      const room = roomByDoctor.get(key) ?? null
      const doctorQueues = queuesByDoctor.get(key) ?? []
      const inRoom = doctorQueues.find((queue) => queue.trang_thai === 'trong_phong') ?? null
      const waitingCount = doctorQueues.filter((queue) => ['dang_cho', 'da_goi'].includes(queue.trang_thai)).length
      const currentStartedAt = inRoom?.thoi_diem_vao_phong ?? room?.thoi_diem_doi ?? null
      const currentExamMinutes = currentStartedAt
        ? Math.max(0, Math.floor((now.getTime() - new Date(currentStartedAt).getTime()) / 60000))
        : null
      const overflow = await kiemTraQuaTai(doctor._id, now)
      const averageExamMinutes = room?.thoi_gian_kham_tb_phut ?? 20
      const waitingEntries = doctorQueues
        .filter((queue) => ['dang_cho', 'da_goi'].includes(queue.trang_thai))
        .sort((a, b) => soSanhThuTuHangDoi(a, b, now))
      const affectedUnarrivedAppointments = (unarrivedByDoctor.get(key) ?? [])
        .filter((appointment) => {
          const slotTime = buildSlotDateTime(appointment.ngay_kham, appointment.gio_kham)
          return !slotTime || slotTime.getTime() >= now.getTime()
        })
        .sort((a, b) => String(a.gio_kham).localeCompare(String(b.gio_kham)))
        .slice(0, 5)
        .map((appointment) => ({
          appointment_id: appointment._id,
          ma_lich_hen: appointment.ma_lich_hen ?? null,
          ten_benh_nhan: appointment.user_id?.ho_ten ?? appointment.ten_khach ?? 'Khach hang',
          so_dien_thoai: appointment.user_id?.so_dien_thoai ?? appointment.so_dien_thoai_khach ?? null,
          gio_kham: appointment.gio_kham,
          status: appointment.status,
          thoi_gian_tre_uoc_tinh_phut: overflow.doTrePhut,
          can_goi_bao: Boolean(overflow.ngungBanWalkIn || overflow.chanDatOnline || (currentExamMinutes !== null && currentExamMinutes >= 60)),
        }))
      const affectedWaitingSlots = waitingEntries.slice(0, 5).map((queue, index) => {
        const estimatedWait = Math.max(
          0,
          Math.round((currentExamMinutes ?? 0) + (index + 1) * averageExamMinutes),
        )
        return {
          hang_doi_id: queue._id,
          appointment_id: queue.appointment_id ?? null,
          ten_benh_nhan: queue.ten_benh_nhan,
          ma_so_thu_tu: queue.ma_so_thu_tu ?? null,
          so_thu_tu_checkin: queue.so_thu_tu_checkin ?? null,
          trang_thai: queue.trang_thai,
          nguon: queue.nguon,
          gio_hen_goc: queue.gio_hen_goc ?? null,
          checkin_time: queue.checkin_time,
          thoi_gian_cho_uoc_tinh_phut: estimatedWait,
          can_dieu_phoi: Boolean(overflow.ngungBanWalkIn || overflow.chanDatOnline || (currentExamMinutes !== null && currentExamMinutes >= 60)),
        }
      })

      let operationalStatus = room?.trang_thai ?? (schedule ? 'san_sang' : 'khong_co_lich')
      if (doctor.trang_thai !== 'active') operationalStatus = doctor.trang_thai
      if (inRoom) operationalStatus = 'dang_kham'
      if (operationalStatus === 'dang_kham' && (overflow.ngungBanWalkIn || overflow.chanDatOnline)) {
        operationalStatus = 'qua_tai_tam_thoi'
      }
      const canhBaoQuaTai = (
        (currentExamMinutes !== null && currentExamMinutes >= 60)
        || overflow.ngungBanWalkIn
        || overflow.chanDatOnline
      )

      return {
        doctor_id: doctor._id,
        ten_bac_si: doctor.user_id?.ho_ten ?? 'Bác sĩ',
        specialties: (doctor.specialties ?? []).map((specialty) => ({
          id: specialty._id,
          ten: specialty.ten,
        })),
        phong_kham: room?.phong_kham ?? schedule?.slots?.[0]?.phong_kham ?? doctor.phong_kham_mac_dinh ?? null,
        schedule_id: schedule?._id ?? null,
        trang_thai_bac_si: doctor.trang_thai,
        trang_thai_van_hanh: operationalStatus,
        thoi_diem_doi: room?.thoi_diem_doi ?? null,
        so_dang_cho: waitingCount,
        co_benh_nhan_trong_phong: Boolean(inRoom),
        benh_nhan_hien_tai: inRoom
          ? {
            hang_doi_id: inRoom._id,
            ten_benh_nhan: inRoom.ten_benh_nhan,
            ma_so_thu_tu: inRoom.ma_so_thu_tu ?? null,
            thoi_diem_vao_phong: inRoom.thoi_diem_vao_phong ?? null,
          }
          : null,
        thoi_gian_kham_hien_tai_phut: currentExamMinutes,
        do_tre_ca_phut: overflow.doTrePhut,
        nguyen_nhan_do_tre: overflow.nguyenNhanDoTre,
        ngung_nhan_walkin: overflow.ngungBanWalkIn,
        chan_dat_online: overflow.chanDatOnline,
        canh_bao_dieu_phoi: overflow.canhBao,
        luot_cho_bi_anh_huong: affectedWaitingSlots,
        lich_chua_checkin_bi_anh_huong: affectedUnarrivedAppointments,
        canh_bao_qua_tai: canhBaoQuaTai,
      }
    }))

    res.status(200).json({ success: true, data, checked_at: now })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// Tráº§n sá»‘ láº§n khÃ¡ch tá»± xin dá»i (rule má»¥c 5) â€” giá»‘ng `patient/reschedule.controller.js`.
const TRAN_DOI_KHACH_YEU_CAU = 1

// Slot cÃ²n nháº­n Ä‘Æ°á»£c ngÆ°á»i má»›i. CÃ¹ng Ä‘á»‹nh nghÄ©a vá»›i `appointmentReschedule.service.js`.
function slotConTrong(slot) {
  return slot.status === 'active' && !slot.benh_nhan_id && !slot.bi_khoa_boi_nghi_phep
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000)
}

function hhmmToMinutes(value) {
  const [hours, minutes] = String(value || '').split(':').map(Number)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  return hours * 60 + minutes
}

function normalizeDateOnly(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setUTCHours(0, 0, 0, 0)
  return date
}

async function bookedSlotIdsForSchedule(scheduleId, appointmentId) {
  const appointments = await LichHen.find({
    schedule_id: scheduleId,
    status: { $ne: 'cancelled' },
    _id: { $ne: appointmentId },
  }).select('slot_id').lean()
  return new Set(appointments.filter((appointment) => appointment.slot_id).map((appointment) => String(appointment.slot_id)))
}

function getAvailableFutureSlots(schedule, bookedSlotIds, appointment, now) {
  return (schedule.slots || [])
    .filter((slot) => {
      if (!slotConTrong(slot) || bookedSlotIds.has(String(slot._id))) return false
      if (String(slot._id) === String(appointment.slot_id)) return false
      const slotTime = buildSlotDateTime(schedule.ngay, slot.gio_bat_dau)
      return slotTime && slotTime.getTime() > now.getTime()
    })
    .sort((a, b) => a.gio_bat_dau.localeCompare(b.gio_bat_dau))
}

async function findLateArrivalTargetSlot({ appointment, policy, now = new Date() }) {
  const day = normalizeDateOnly(appointment.ngay_kham)
  if (!day) {
    throw Object.assign(new Error('Ngay kham hien tai khong hop le'), { statusCode: 400 })
  }

  const requestedPolicy = ['end_of_shift', 'nearest_available', 'tomorrow'].includes(policy)
    ? policy
    : 'nearest_available'

  const todaySchedule = await LichLamViec.findOne({
    doctor_id: appointment.doctor_id,
    ngay: { $gte: day, $lt: addDays(day, 1) },
    trang_thai_ngay: 'lam_viec',
    trang_thai_xac_nhan: { $ne: 'tu_choi' },
  }).lean()

  if (requestedPolicy !== 'tomorrow' && todaySchedule) {
    const bookedSlotIds = await bookedSlotIdsForSchedule(todaySchedule._id, appointment._id)
    let slots = getAvailableFutureSlots(todaySchedule, bookedSlotIds, appointment, now)

    if (requestedPolicy === 'end_of_shift') {
      const currentSlot = (todaySchedule.slots || []).find((slot) => String(slot._id) === String(appointment.slot_id))
      const currentShift = currentSlot?.khung_index !== null && currentSlot?.khung_index !== undefined
        ? caCuaKhung(currentSlot.khung_index)
        : null
      if (currentShift) {
        slots = slots.filter((slot) => slot.khung_index !== null && slot.khung_index !== undefined && caCuaKhung(slot.khung_index) === currentShift)
      }
      slots.sort((a, b) => (hhmmToMinutes(b.gio_bat_dau) ?? 0) - (hhmmToMinutes(a.gio_bat_dau) ?? 0))
    }

    if (slots.length > 0) {
      const slot = slots[0]
      return {
        policy: requestedPolicy,
        doctor_id: todaySchedule.doctor_id,
        schedule_id: todaySchedule._id,
        slot_id: slot._id,
        ngay: todaySchedule.ngay,
        gio_bat_dau: slot.gio_bat_dau,
        phong_kham: slot.phong_kham || null,
      }
    }

    if (requestedPolicy === 'end_of_shift') {
      throw Object.assign(new Error('Khong con slot trong o cuoi ca hien tai. Hay chon slot trong gan nhat hoac doi sang ngay hom sau.'), { statusCode: 409 })
    }
  }

  const start = requestedPolicy === 'tomorrow' ? addDays(day, 1) : day
  const schedules = await LichLamViec.find({
    doctor_id: appointment.doctor_id,
    ngay: { $gte: start, $lt: addDays(start, 14) },
    trang_thai_ngay: 'lam_viec',
    trang_thai_xac_nhan: { $ne: 'tu_choi' },
  }).sort({ ngay: 1 }).lean()

  for (const schedule of schedules) {
    const bookedSlotIds = await bookedSlotIdsForSchedule(schedule._id, appointment._id)
    const slots = getAvailableFutureSlots(schedule, bookedSlotIds, appointment, now)
    if (slots.length > 0) {
      const slot = slots[0]
      return {
        policy: requestedPolicy,
        doctor_id: schedule.doctor_id,
        schedule_id: schedule._id,
        slot_id: slot._id,
        ngay: schedule.ngay,
        gio_bat_dau: slot.gio_bat_dau,
        phong_kham: slot.phong_kham || null,
      }
    }
  }

  throw Object.assign(new Error('Khong tim thay slot trong de xu ly khach den muon trong 14 ngay toi.'), { statusCode: 409 })
}

// Lá»… tÃ¢n dá»i lá»‹ch há»™ khÃ¡ch.
//
// âš ï¸ Báº£n trÆ°á»›c bá» qua gáº§n háº¿t má»¥c 5/11 vÃ  cÃ³ thá»ƒ lÃ m há»ng dá»¯ liá»‡u:
//   - KhÃ´ng kiá»ƒm má»‘c `T-30'` â†’ khÃ¡ch sáº¯p trá»… nhá» lá»… tÃ¢n dá»i lÃºc `T-5'`, phÃ²ng khÃ¡m máº¥t
//     tráº¯ng chá»— vÃ¬ khÃ´ng ká»‹p bÃ¡n láº¡i (Ä‘Ãºng chiÃªu mÃ  má»¥c 11 dá»±ng má»‘c Ä‘Ã³ Ä‘á»ƒ cháº·n).
//   - `slots.find(s => s.gio_bat_dau === gio_kham)` láº¥y slot Äáº¦U TIÃŠN trÃ¹ng giá»: má»™t khung
//     cÃ³ nhiá»u slot (TMH 2 slot/khung) nÃªn slot Ä‘áº§u cÃ³ thá»ƒ Ä‘Ã£ kÃ­n trong khi slot bÃªn cáº¡nh
//     cÃ²n trá»‘ng â†’ bÃ¡o "Ä‘Ã£ kÃ­n" oan. NgÆ°á»£c láº¡i nÃ³ cÅ©ng nháº­n cáº£ slot `walk_in` vÃ  slot ngÆ°á»i
//     khÃ¡c Ä‘ang giá»¯ chá»—, trong khi má»¥c 5 chá»‘t khÃ¡ch tá»± dá»i KHÃ”NG BAO GIá»œ Ä‘Æ°á»£c láº¥n walk-in.
//   - KhÃ´ng kiá»ƒm lá»‹ch háº¹n nÃ o khÃ¡c Ä‘Ã£ trá» vÃ o slot Ä‘Ã³ â†’ Ä‘á»¥ng unique index
//     `uniq_lich_hen_theo_slot` vÃ  tráº£ 500 thay vÃ¬ thÃ´ng bÃ¡o Ä‘á»c Ä‘Æ°á»£c.
//   - Äáº¿m háº¡n má»©c báº±ng `so_lan_thay_doi` (Ä‘áº¿m Má»ŒI thay Ä‘á»•i) thay vÃ¬
//     `so_lan_doi_khach_yeu_cau`, nÃªn má»™t láº§n dá»i do lá»—i phÃ²ng khÃ¡m cÅ©ng Äƒn máº¥t quyá»n dá»i
//     cá»§a khÃ¡ch â€” trÃ¡i má»¥c 5 ("lá»—i phÃ²ng khÃ¡m KHÃ”NG tÃ­nh vÃ o háº¡n má»©c").
//   - Tráº£ slot cÅ© vá» `active` ngay trong cÃ¹ng transaction, ká»ƒ cáº£ khi khung Ä‘Ã£ sÃ¡t giá».
//
// Nay dÃ¹ng CHUNG `apDungPhuongAn()` vá»›i luá»“ng bá»‡nh nhÃ¢n tá»± dá»i: má»™t chá»— quyáº¿t Ä‘á»‹nh cÃ¡ch
// chiáº¿m slot, khoÃ¡ slot cÅ©, Ä‘áº·t `ly_do_doi`, Ä‘áº¿m háº¡n má»©c vÃ  ghi nháº­t kÃ½.
export const rescheduleAppointment = async (req, res) => {
  try {
    const { ngay_kham, gio_kham, ly_do_doi_lich, ly_do_doi } = req.body

    if (!ngay_kham || !gio_kham) {
      return res.status(400).json({ success: false, message: 'Vui lÃ²ng cung cáº¥p ngÃ y vÃ  giá» khÃ¡m má»›i' })
    }

    const appointment = await LichHen.findById(req.params.id).populate('user_id', 'email')
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'KhÃ´ng tÃ¬m tháº¥y lá»‹ch háº¹n' })
    }
    const queueEntry = await getQueueEntryForAppointment(appointment._id)
    assertReceptionistAppointmentAction(
      appointment,
      queueEntry,
      RECEPTIONIST_APPOINTMENT_ACTIONS.RESCHEDULE,
    )

    // Äang cÃ³ Ä‘á» xuáº¥t cá»§a phÃ²ng khÃ¡m (bÃ¡c sÄ© nghá»‰/báº­n â€” má»¥c 14, 15) thÃ¬ pháº£i xá»­ lÃ½ Ä‘á» xuáº¥t Ä‘Ã³,
    // khÃ´ng dá»i tay chá»“ng lÃªn: chá»— cá»§a phÆ°Æ¡ng Ã¡n Ä‘ang Ä‘Æ°á»£c giá»¯ sáºµn cho khÃ¡ch.
    const deXuat = appointment.de_xuat_doi
    if (deXuat && ['cho_khach_chon', 'cho_admin_duyet'].includes(deXuat.trang_thai)) {
      return res.status(409).json({
        success: false,
        message: 'Lá»‹ch nÃ y Ä‘ang cÃ³ phÆ°Æ¡ng Ã¡n dá»i do phÃ²ng khÃ¡m Ä‘á» xuáº¥t. HÃ£y xá»­ lÃ½ Ä‘á» xuáº¥t Ä‘Ã³ trÆ°á»›c.',
      })
    }

    // `ly_do_doi` lÃ  trÆ°á»ng Báº®T BUá»˜C khi dá»i (má»¥c 10.D) vÃ  quyáº¿t Ä‘á»‹nh háº¡n má»©c:
    //   khach_yeu_cau â†’ tÃ­nh vÃ o tráº§n 1 láº§n cá»§a khÃ¡ch, pháº£i trÆ°á»›c `T-30'`
    //   phong_kham    â†’ KHÃ”NG tÃ­nh háº¡n má»©c, khÃ´ng Ã¡p má»‘c `T-30'` (má»¥c 15), nhÆ°ng pháº£i cÃ³
    //                   ngÆ°á»i duyá»‡t + lÃ½ do vÃ  Ä‘Æ°á»£c ghi nháº­t kÃ½
    // Máº·c Ä‘á»‹nh `khach_yeu_cau`: lá»… tÃ¢n dá»i há»™ thÃ¬ gáº§n nhÆ° luÃ´n lÃ  khÃ¡ch yÃªu cáº§u, vÃ  chá»n
    // máº·c Ä‘á»‹nh nÃ y KHÃ”NG thá»ƒ bá»‹ dÃ¹ng Ä‘á»ƒ lÃ¡ch tráº§n. Muá»‘n `phong_kham` thÃ¬ pháº£i nÃ³i rÃµ.
    const laLoiPhongKham = ly_do_doi === 'phong_kham'
    const lyDoDoi = laLoiPhongKham ? 'phong_kham' : 'khach_yeu_cau'

    if (laLoiPhongKham && !ly_do_doi_lich?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Dá»i do lá»—i phÃ²ng khÃ¡m báº¯t buá»™c ghi lÃ½ do cá»¥ thá»ƒ (rule má»¥c 5).',
      })
    }

    if (!laLoiPhongKham) {
      const daDung = appointment.so_lan_doi_khach_yeu_cau ?? 0
      if (daDung >= TRAN_DOI_KHACH_YEU_CAU) {
        return res.status(409).json({
          success: false,
          message: `KhÃ¡ch Ä‘Ã£ dÃ¹ng háº¿t ${TRAN_DOI_KHACH_YEU_CAU} láº§n dá»i lá»‹ch. Náº¿u Ä‘Ã¢y lÃ  lá»—i phÃ²ng khÃ¡m, `
            + 'chá»n lÃ½ do "phÃ²ng khÃ¡m" kÃ¨m giáº£i trÃ¬nh.',
        })
      }

      // Má»‘c `T-30'` cá»§a khung CÅ¨ (má»¥c 11). Cháº·n chiÃªu nÃ© máº¥t tiá»n: sáº¯p trá»… má»›i xin dá»i thÃ¬
      // slot khÃ´ng ká»‹p bÃ¡n cho ai.
      const moc = cacMocCuaKhung(appointment.ngay_kham, appointment.gio_kham)
      if (!moc || Date.now() >= moc.dongDatOnline.getTime()) {
        return res.status(409).json({
          success: false,
          message: 'ÄÃ£ quÃ¡ háº¡n xin dá»i (trÆ°á»›c giá» khÃ¡m 30 phÃºt). KhÃ¡ch váº«n Ä‘Æ°á»£c khÃ¡m náº¿u tá»›i trong ca '
            + 'vÃ  KHÃ”NG máº¥t tiá»n.',
        })
      }
    }

    // â”€â”€ TÃ¬m slot Ä‘Ã­ch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const ngayMoi = new Date(ngay_kham)
    if (Number.isNaN(ngayMoi.getTime())) {
      return res.status(400).json({ success: false, message: 'ngay_kham khÃ´ng há»£p lá»‡' })
    }
    ngayMoi.setUTCHours(0, 0, 0, 0)

    const scheduleMoi = await LichLamViec.findOne({
      doctor_id: appointment.doctor_id,
      ngay: { $gte: ngayMoi, $lt: new Date(ngayMoi.getTime() + 86400000) },
      trang_thai_ngay: 'lam_viec',
      trang_thai_xac_nhan: { $ne: 'tu_choi' },
    }).lean()

    if (!scheduleMoi) {
      return res.status(400).json({ success: false, message: 'BÃ¡c sÄ© khÃ´ng cÃ³ lá»‹ch lÃ m viá»‡c vÃ o ngÃ y nÃ y' })
    }

    // Lá»‹ch háº¹n khÃ¡c Ä‘Ã£ trá» vÃ o slot nÃ o thÃ¬ slot Ä‘Ã³ háº¿t chá»—, dÃ¹ `status` trong lá»‹ch cÃ³ lá»‡ch.
    const slotDaCoLich = new Set(
      (await LichHen.find({
        schedule_id: scheduleMoi._id,
        status: { $ne: 'cancelled' },
        _id: { $ne: appointment._id },
      }).select('slot_id').lean())
        .filter((a) => a.slot_id).map((a) => String(a.slot_id)),
    )

    // QuÃ©t Má»ŒI slot trÃ¹ng giá», khÃ´ng láº¥y slot Ä‘áº§u tiÃªn: má»™t khung cÃ³ nhiá»u slot.
    const slotTrungGio = scheduleMoi.slots.filter((s) => s.gio_bat_dau === gio_kham)
    if (slotTrungGio.length === 0) {
      return res.status(400).json({ success: false, message: `BÃ¡c sÄ© khÃ´ng cÃ³ khung ${gio_kham} trong ngÃ y nÃ y` })
    }
    if (slotTrungGio.some((s) => String(s._id) === String(appointment.slot_id))) {
      return res.status(400).json({ success: false, message: 'Vui lÃ²ng chá»n ngÃ y vÃ  giá» khÃ¡c vá»›i lá»‹ch háº¹n hiá»‡n táº¡i' })
    }

    // KhÃ¡ch tá»± dá»i KHÃ”NG BAO GIá»œ Ä‘Æ°á»£c láº¥n slot walk-in (má»¥c 5, 15). Lá»—i phÃ²ng khÃ¡m thÃ¬ má»¥c 15
    // cho láº¥n nhÆ°ng cÃ³ tráº§n 1 slot/khung vÃ  pháº£i ghi nháº­t kÃ½ â€” chÆ°a hiá»‡n thá»±c á»Ÿ mÃ n hÃ¬nh nÃ y,
    // nÃªn táº¡m thá»i cháº·n cáº£ hai chiá»u thay vÃ¬ láº¥n khÃ´ng kiá»ƒm soÃ¡t.
    const slotMoi = slotTrungGio.find(
      (s) => slotConTrong(s) && s.loai_slot !== 'walk_in' && !slotDaCoLich.has(String(s._id)),
    )
    if (!slotMoi) {
      const coWalkIn = slotTrungGio.some((s) => slotConTrong(s) && s.loai_slot === 'walk_in')
      return res.status(409).json({
        success: false,
        message: coWalkIn
          ? `Khung ${gio_kham} chá»‰ cÃ²n chá»— dÃ nh cho khÃ¡ch tá»›i quáº§y, khÃ´ng dÃ¹ng Ä‘á»ƒ dá»i lá»‹ch Ä‘áº·t trÆ°á»›c.`
          : `Khung ${gio_kham} Ä‘Ã£ kÃ­n, vui lÃ²ng chá»n khung khÃ¡c.`,
      })
    }

    // â”€â”€ Ghi â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const gioCu = appointment.gio_kham
    const ngayCu = appointment.ngay_kham
    const trangThaiCu = appointment.status
    const paymentStatusCu = appointment.payment_status
    const bacSiCuId = appointment.doctor_id
    const specialtyCuId = appointment.specialty_id
    const scheduleCuId = appointment.schedule_id
    const slotCuId = appointment.slot_id

    let phongKhamCu = null
    if (appointment.schedule_id && appointment.slot_id) {
      const scheduleCu = await LichLamViec.findById(appointment.schedule_id).lean()
      if (scheduleCu && scheduleCu.slots) {
        const slotCu = scheduleCu.slots.find(s => String(s._id) === String(appointment.slot_id))
        if (slotCu) phongKhamCu = slotCu.phong_kham
      }
    }
    const phongKhamMoi = slotMoi.phong_kham || null

    await apDungPhuongAn({
      appointment,
      phuongAn: {
        loai: 'doi_khung',
        doctor_id: appointment.doctor_id,
        schedule_id: scheduleMoi._id,
        slot_id: slotMoi._id,
        ngay: scheduleMoi.ngay,
        gio_bat_dau: slotMoi.gio_bat_dau,
        lan_walk_in: false,
      },
      lyDoDoi,
      actorUserId: getActorUserId(req),
      actorRole: getActorRole(req),
    })

    // `ly_do_doi_lich` lÃ  mÃ´ táº£ tá»± do cho lá»… tÃ¢n Ä‘á»c láº¡i; `ly_do_doi` lÃ  phÃ¢n loáº¡i nghiá»‡p vá»¥.
    appointment.ly_do_doi_lich = ly_do_doi_lich?.trim()
      || (laLoiPhongKham ? 'PhÃ²ng khÃ¡m dá»i lá»‹ch' : 'KhÃ¡ch yÃªu cáº§u dá»i lá»‹ch')
    await appointment.save()

    await LichSuLichHen.create([{
      appointment_id: appointment._id,
      tu_trang_thai: trangThaiCu,
      den_trang_thai: appointment.status,
      tu_payment_status: paymentStatusCu,
      den_payment_status: appointment.payment_status,
      loai_thay_doi: 'reschedule',
      ly_do_thay_doi: appointment.ly_do_doi_lich,
      bac_si_cu_id: bacSiCuId,
      bac_si_moi_id: appointment.doctor_id,
      specialty_cu_id: specialtyCuId,
      specialty_moi_id: appointment.specialty_id,
      schedule_cu_id: scheduleCuId,
      schedule_moi_id: appointment.schedule_id,
      slot_cu_id: slotCuId,
      slot_moi_id: appointment.slot_id,
      vai_tro: getActorRole(req),
      kenh_thay_doi: getActorRole(req),
      ngay_kham_cu: ngayCu,
      ngay_kham_moi: appointment.ngay_kham,
      gio_kham_cu: gioCu,
      gio_kham_moi: appointment.gio_kham,
      phong_kham_cu: phongKhamCu,
      phong_kham_moi: phongKhamMoi,
      ly_do: `ly_do_doi=${lyDoDoi}`,
      nguoi_thay_doi_id: getActorUserId(req) ?? appointment.user_id,
      nguoi_thuc_hien_id: getActorUserId(req),
    }])

    const notificationResult = await notifyAppointmentCustomerChange({
      appointment,
      action: 'reschedule',
      reason: appointment.ly_do_doi_lich,
      actorUserId: getActorUserId(req),
      actorRole: getActorRole(req),
    })

    res.status(200).json({
      success: true,
      message: laLoiPhongKham
        ? 'ÄÃ£ dá»i lá»‹ch háº¹n (lá»—i phÃ²ng khÃ¡m â€” khÃ´ng tÃ­nh vÃ o háº¡n má»©c cá»§a khÃ¡ch)'
        : `ÄÃ£ dá»i lá»‹ch háº¹n. KhÃ¡ch Ä‘Ã£ dÃ¹ng ${appointment.so_lan_doi_khach_yeu_cau}/${TRAN_DOI_KHACH_YEU_CAU} láº§n dá»i.`,
      data: appointment,
      ly_do_doi: lyDoDoi,
      so_lan_doi_khach_yeu_cau: appointment.so_lan_doi_khach_yeu_cau,
      notification: notificationResult,
    })
  } catch (error) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message })
  }
}

export const markLateArrival = async (req, res) => {
  try {
    const { policy = 'nearest_available', reason } = req.body ?? {}
    const now = new Date()

    const appointment = await LichHen.findById(req.params.id).populate('user_id', 'email')
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Khong tim thay lich hen' })
    }

    const queueEntry = await getQueueEntryForAppointment(appointment._id)
    assertReceptionistAppointmentAction(
      appointment,
      queueEntry,
      RECEPTIONIST_APPOINTMENT_ACTIONS.LATE_RESCHEDULE,
    )

    const moc = cacMocCuaKhung(appointment.ngay_kham, appointment.gio_kham)
    if (!moc || now.getTime() < moc.T.getTime()) {
      return res.status(409).json({ success: false, message: 'Lich hen chua qua gio kham, khong the ghi nhan khach den muon.' })
    }

    const target = await findLateArrivalTargetSlot({ appointment, policy, now })
    const gioCu = appointment.gio_kham
    const ngayCu = appointment.ngay_kham
    const trangThaiCu = appointment.status
    const paymentStatusCu = appointment.payment_status
    const bacSiCuId = appointment.doctor_id
    const specialtyCuId = appointment.specialty_id
    const scheduleCuId = appointment.schedule_id
    const slotCuId = appointment.slot_id
    let phongKhamCu = null

    if (appointment.schedule_id && appointment.slot_id) {
      const scheduleCu = await LichLamViec.findById(appointment.schedule_id).lean()
      const slotCu = scheduleCu?.slots?.find((slot) => String(slot._id) === String(appointment.slot_id))
      phongKhamCu = slotCu?.phong_kham || null
    }

    await apDungPhuongAn({
      appointment,
      phuongAn: {
        loai: 'doi_khung',
        doctor_id: target.doctor_id,
        schedule_id: target.schedule_id,
        slot_id: target.slot_id,
        ngay: target.ngay,
        gio_bat_dau: target.gio_bat_dau,
        lan_walk_in: false,
      },
      lyDoDoi: 'khach_den_muon',
      actorUserId: getActorUserId(req),
      actorRole: getActorRole(req),
    })

    appointment.trang_thai_den = 'den_muon'
    appointment.gio_den_thuc_te = now
    appointment.ly_do_doi_lich = reason?.trim() || 'Khach den muon, le tan dieu phoi sang slot phu hop.'
    await appointment.save()

    await LichSuLichHen.create([{
      appointment_id: appointment._id,
      tu_trang_thai: trangThaiCu,
      den_trang_thai: appointment.status,
      tu_payment_status: paymentStatusCu,
      den_payment_status: appointment.payment_status,
      loai_thay_doi: 'late_reschedule',
      ly_do_thay_doi: appointment.ly_do_doi_lich,
      bac_si_cu_id: bacSiCuId,
      bac_si_moi_id: appointment.doctor_id,
      specialty_cu_id: specialtyCuId,
      specialty_moi_id: appointment.specialty_id,
      schedule_cu_id: scheduleCuId,
      schedule_moi_id: appointment.schedule_id,
      slot_cu_id: slotCuId,
      slot_moi_id: appointment.slot_id,
      vai_tro: getActorRole(req),
      kenh_thay_doi: getActorRole(req),
      ngay_kham_cu: ngayCu,
      ngay_kham_moi: appointment.ngay_kham,
      gio_kham_cu: gioCu,
      gio_kham_moi: appointment.gio_kham,
      phong_kham_cu: phongKhamCu,
      phong_kham_moi: target.phong_kham,
      ly_do: `late_policy=${target.policy}`,
      nguoi_thay_doi_id: getActorUserId(req) ?? appointment.user_id,
      nguoi_thuc_hien_id: getActorUserId(req),
    }])

    const notificationResult = await notifyAppointmentCustomerChange({
      appointment,
      action: 'reschedule',
      reason: appointment.ly_do_doi_lich,
      actorUserId: getActorUserId(req),
      actorRole: getActorRole(req),
    })

    res.status(200).json({
      success: true,
      message: `Da xu ly khach den muon: chuyen tu ${gioCu} sang ${appointment.gio_kham}.`,
      data: appointment,
      late_policy: target.policy,
      notification: notificationResult,
    })
  } catch (error) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message })
  }
}

export const cancelAppointment = async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const { id } = req.params
    const { ly_do_huy } = req.body

    const appointment = await LichHen.findById(id).session(session)
    if (!appointment) {
      await session.abortTransaction()
      session.endSession()
      return res.status(404).json({ success: false, message: 'KhÃ´ng tÃ¬m tháº¥y lá»‹ch háº¹n' })
    }

    const queueEntry = await getQueueEntryForAppointment(appointment._id, session)
    try {
      assertReceptionistAppointmentAction(
        appointment,
        queueEntry,
        RECEPTIONIST_APPOINTMENT_ACTIONS.CANCEL,
      )
    } catch (error) {
      await session.abortTransaction()
      session.endSession()
      return res.status(error.statusCode ?? 409).json({
        success: false,
        message: error.message,
        permissions: error.permissions,
      })
    }

    const oldStatus = appointment.status
    const oldPaymentStatus = appointment.payment_status
    const oldDoctorId = appointment.doctor_id
    const oldSpecialtyId = appointment.specialty_id
    const oldScheduleId = appointment.schedule_id
    const oldSlotId = appointment.slot_id
    const oldDate = appointment.ngay_kham
    const oldTime = appointment.gio_kham
    appointment.status = 'cancelled'
    appointment.ly_do_huy = ly_do_huy || 'Lá»… tÃ¢n há»§y lá»‹ch'
    appointment.huy_boi = getActorRole(req)
    if (getActorUserId(req)) appointment.nguoi_huy_id = getActorUserId(req)
    appointment.thoi_diem_huy = new Date()

    const releasedSlot = await releaseAppointmentSlot({ appointment, session })

    await appointment.save({ session })
    await LichSuLichHen.create([{
      appointment_id: appointment._id,
      tu_trang_thai: oldStatus,
      den_trang_thai: appointment.status,
      tu_payment_status: oldPaymentStatus,
      den_payment_status: appointment.payment_status,
      loai_thay_doi: 'cancel',
      ly_do_thay_doi: appointment.ly_do_huy,
      bac_si_cu_id: oldDoctorId,
      bac_si_moi_id: appointment.doctor_id,
      specialty_cu_id: oldSpecialtyId,
      specialty_moi_id: appointment.specialty_id,
      schedule_cu_id: oldScheduleId,
      schedule_moi_id: appointment.schedule_id,
      slot_cu_id: oldSlotId,
      slot_moi_id: appointment.slot_id,
      ngay_kham_cu: oldDate,
      ngay_kham_moi: appointment.ngay_kham,
      gio_kham_cu: oldTime,
      gio_kham_moi: appointment.gio_kham,
      vai_tro: getActorRole(req),
      kenh_thay_doi: getActorRole(req),
      ly_do: appointment.ly_do_huy,
      nguoi_thay_doi_id: getActorUserId(req) ?? appointment.user_id,
      nguoi_thuc_hien_id: getActorUserId(req),
    }], { session })

    const notificationResult = await notifyAppointmentCustomerChange({
      appointment,
      action: 'cancel',
      reason: appointment.ly_do_huy,
      actorUserId: getActorUserId(req),
      actorRole: getActorRole(req),
      session,
    })
    await session.commitTransaction()
    session.endSession()

    emitDashboardAppointmentChanged(oldStatus, appointment.status)

    res.status(200).json({
      success: true,
      message: 'ÄÃ£ há»§y lá»‹ch háº¹n',
      data: appointment,
      notification: notificationResult,
      slot_released: Boolean(releasedSlot),
    })
  } catch (error) {
    await session.abortTransaction()
    session.endSession()
    res.status(500).json({ success: false, message: error.message })
  }
}

export const getRescheduleHistory = async (req, res) => {
  try {
    const { id } = req.params
    const history = await LichSuLichHen.find({
      appointment_id: id,
      loai_thay_doi: 'reschedule'
    }).populate('nguoi_thay_doi_id', 'ho_ten')
      .sort({ thoi_diem: 1 })

    res.status(200).json({ success: true, data: history })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const bulkCancelAppointments = async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const { ids, reason } = req.body
    if (!ids || !ids.length) {
      return res.status(400).json({ success: false, message: 'KhÃ´ng cÃ³ lá»‹ch háº¹n nÃ o Ä‘Æ°á»£c chá»n' })
    }

    const appointments = await LichHen.find({ _id: { $in: ids }, status: { $in: ['pending', 'confirmed'] } }).populate('user_id', 'email')

    for (const appointment of appointments) {
      const oldStatus = appointment.status
      appointment.status = 'cancelled'
      appointment.ly_do_huy = reason || 'Há»§y lá»‹ch hÃ ng loáº¡t'

      // Giai phong slot if needed
      if (appointment.schedule_id && appointment.slot_id) {
        const schedule = await LichLamViec.findById(appointment.schedule_id).session(session)
        if (schedule) {
          const slot = schedule.slots.id(appointment.slot_id)
          if (slot && String(slot.benh_nhan_id) === String(appointment.user_id?._id || appointment.user_id)) {
            slot.benh_nhan_id = null
            slot.benh_nhan_tam_giu_id = null
            slot.status = 'active'
            await schedule.save({ session })
          }
        }
      }

      await appointment.save({ session })

      await LichSuLichHen.create([{
        appointment_id: appointment._id,
        tu_trang_thai: oldStatus,
        den_trang_thai: 'cancelled',
        loai_thay_doi: 'cancel',
        ly_do_thay_doi: appointment.ly_do_huy,
        vai_tro: 'admin',
        kenh_thay_doi: 'web',
        nguoi_thay_doi_id: req.user?.id ?? req.user?._id ?? null,
      }], { session })

      emitDashboardAppointmentChanged(oldStatus, 'cancelled')

      // Notification
      const tieuDe = 'Lá»‹ch háº¹n cá»§a báº¡n Ä‘Ã£ bá»‹ há»§y'
      const noiDung = `PhÃ²ng khÃ¡m Ä‘Ã£ há»§y lá»‹ch háº¹n ngÃ y ${appointment.ngay_kham.toLocaleDateString('vi-VN')} lÃºc ${appointment.gio_kham}. LÃ½ do: ${appointment.ly_do_huy}`

      if (appointment.user_id) {
        await ThongBao.create([{
          user_id: appointment.user_id._id,
          tieu_de: tieuDe,
          noi_dung: noiDung,
          loai: 'appointment',
          related_id: appointment._id,
          related_type: 'LichHen',
        }], { session })
      }

      const emailNhan = appointment.user_id?.email || appointment.email_khach
      if (emailNhan && isMailConfigured()) {
        sendNotificationEmail({
          to: emailNhan,
          title: tieuDe,
          content: noiDung,
        }).catch(err => console.error(err))
      }
    }

    await session.commitTransaction()
    session.endSession()
    res.status(200).json({ success: true, message: `ÄÃ£ há»§y ${appointments.length} lá»‹ch háº¹n` })
  } catch (error) {
    await session.abortTransaction()
    session.endSession()
    res.status(500).json({ success: false, message: error.message })
  }
}

export const bulkRescheduleAppointments = async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const { ids, startDate, startTime, reason } = req.body
    if (!ids || !ids.length || !startDate) {
      return res.status(400).json({ success: false, message: 'Thiáº¿u thÃ´ng tin dá»i lá»‹ch' })
    }

    const appointments = await LichHen.find({ _id: { $in: ids }, status: { $in: ['pending', 'confirmed'] } })
      .populate('user_id', 'email')
      .sort({ ngay_kham: 1, gio_kham: 1 })

    let assignedCount = 0
    let startSearchDate = new Date(startDate)
    startSearchDate.setHours(0, 0, 0, 0)

    // Find booked slots to avoid conflict
    const getBookedSlotIds = async () => {
      const booked = await LichHen.find({ status: { $ne: 'cancelled' } }).select('slot_id').lean()
      return new Set(booked.filter(a => a.slot_id).map(a => String(a.slot_id)))
    }

    const bookedSlots = await getBookedSlotIds()

    for (const appointment of appointments) {
      const oldStatus = appointment.status
      const ngayCu = appointment.ngay_kham
      const gioCu = appointment.gio_kham

      // Giáº£i phÃ³ng slot cÅ© trÆ°á»›c (cá»¥c bá»™ trong memory/session) Ä‘á»ƒ náº¿u chÃ­nh nÃ³ Ä‘Æ°á»£c xáº¿p láº¡i cÃ¹ng lá»‹ch thÃ¬ ko bá»‹ lá»—i
      if (appointment.schedule_id && appointment.slot_id) {
        const schedule = await LichLamViec.findById(appointment.schedule_id).session(session)
        if (schedule) {
          const slot = schedule.slots.id(appointment.slot_id)
          if (slot) {
            slot.benh_nhan_id = null
            slot.benh_nhan_tam_giu_id = null
            slot.status = 'active'
            await schedule.save({ session })
            bookedSlots.delete(String(slot._id))
          }
        }
      }

      // Auto-fill spill-over logic
      let newSlotFound = false
      let searchDate = new Date(startSearchDate)
      const maxDaysToSearch = 14 // Try up to 14 days forward

      for (let dayOffset = 0; dayOffset < maxDaysToSearch; dayOffset++) {
        const currentDate = new Date(searchDate.getTime() + dayOffset * 86400000)

        // Láº¥y táº¥t cáº£ lá»‹ch lÃ m viá»‡c trong ngÃ y nÃ y cho chuyÃªn khoa cá»§a appointment
        const schedules = await LichLamViec.find({
          ngay: { $gte: currentDate, $lt: new Date(currentDate.getTime() + 86400000) },
          trang_thai_ngay: 'lam_viec',
          trang_thai_xac_nhan: { $ne: 'tu_choi' }
        }).populate('doctor_id').session(session)

        for (const schedule of schedules) {
          // Bá» qua náº¿u ko Ä‘Ãºng chuyÃªn khoa (náº¿u appointment cÃ³ specialty_id)
          if (appointment.specialty_id) {
             const bacSi = await BacSi.findById(schedule.doctor_id).session(session)
             if (!bacSi || !bacSi.specialties.includes(appointment.specialty_id)) continue
          }

          const availableSlot = schedule.slots.find(s => {
            if (dayOffset === 0 && startTime && s.gio_bat_dau < startTime) {
              return false;
            }
            return s.status === 'active' &&
                   !s.benh_nhan_id &&
                   !s.bi_khoa_boi_nghi_phep &&
                   !bookedSlots.has(String(s._id));
          })

          if (availableSlot) {
            // Assign this slot
            availableSlot.benh_nhan_id = appointment.user_id?._id || appointment.user_id
            await schedule.save({ session })
            bookedSlots.add(String(availableSlot._id))

            appointment.schedule_id = schedule._id
            appointment.slot_id = availableSlot._id
            appointment.doctor_id = schedule.doctor_id
            appointment.ngay_kham = schedule.ngay
            appointment.gio_kham = availableSlot.gio_bat_dau
            appointment.ly_do_doi_lich = reason || 'Dá»i lá»‹ch hÃ ng loáº¡t (Auto-fill)'

            // Xá»­ lÃ½ phÃ²ng khÃ¡m
            const phongKhamMoi = availableSlot.phong_id ? (await mongoose.model('MauLichLamViec').findOne({'ca_kham.phong_id': availableSlot.phong_id})).ca_kham.find(c => String(c.phong_id) === String(availableSlot.phong_id))?.ten_phong : null;

            await appointment.save({ session })

            await LichSuLichHen.create([{
              appointment_id: appointment._id,
              tu_trang_thai: oldStatus,
              den_trang_thai: appointment.status,
              loai_thay_doi: 'reschedule',
              ly_do_thay_doi: appointment.ly_do_doi_lich,
              vai_tro: 'admin',
              kenh_thay_doi: 'web',
              ngay_kham_cu: ngayCu,
              ngay_kham_moi: appointment.ngay_kham,
              gio_kham_cu: gioCu,
              gio_kham_moi: appointment.gio_kham,
              phong_kham_moi: phongKhamMoi,
              nguoi_thay_doi_id: req.user?.id ?? req.user?._id ?? null,
            }], { session })

            // Notify
            const tieuDe = 'Lá»‹ch háº¹n cá»§a báº¡n Ä‘Ã£ Ä‘Æ°á»£c thay Ä‘á»•i'
            const noiDung = `PhÃ²ng khÃ¡m Ä‘Ã£ tá»± Ä‘á»™ng dá»i lá»‹ch háº¹n cá»§a báº¡n sang ngÃ y ${new Date(appointment.ngay_kham).toLocaleDateString('vi-VN')} lÃºc ${appointment.gio_kham}.`
            if (appointment.user_id) {
              await ThongBao.create([{
                user_id: appointment.user_id._id,
                tieu_de: tieuDe,
                noi_dung: noiDung,
                loai: 'appointment',
                related_id: appointment._id,
                related_type: 'LichHen',
              }], { session })
            }
            const emailNhan = appointment.user_id?.email || appointment.email_khach
            if (emailNhan && isMailConfigured()) {
               sendNotificationEmail({ to: emailNhan, title: tieuDe, content: noiDung }).catch(console.error)
            }

            newSlotFound = true
            assignedCount++
            break // Done with this appointment
          }
        }

        if (newSlotFound) break
      }
    }

    await session.commitTransaction()
    session.endSession()
    res.status(200).json({ success: true, message: `ÄÃ£ dá»i thÃ nh cÃ´ng ${assignedCount}/${appointments.length} lá»‹ch háº¹n` })
  } catch (error) {
    await session.abortTransaction()
    session.endSession()
    res.status(500).json({ success: false, message: error.message })
  }
}

export const reportDoctorUnavailable = async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const { doctor_id, date, tu_ngay, den_ngay, gio_bat_dau, gio_ket_thuc, reason, ghi_chu, appointment_ids } = req.body
    const appointmentIds = Array.isArray(appointment_ids)
      ? appointment_ids.filter((id) => mongoose.Types.ObjectId.isValid(id))
      : []
    const doctorId = doctor_id
    const startInput = tu_ngay || date
    const endInput = den_ngay || tu_ngay || date

    if (!doctorId || !startInput || !endInput) {
      await session.abortTransaction()
      session.endSession()
      return res.status(400).json({
        success: false,
        message: 'doctor_id, ngay bat dau va ngay ket thuc la bat buoc',
      })
    }
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      await session.abortTransaction()
      session.endSession()
      return res.status(400).json({ success: false, message: 'doctor_id khong hop le' })
    }
    if (!validHHMM(gio_bat_dau) || !validHHMM(gio_ket_thuc) || ((gio_bat_dau || gio_ket_thuc) && (!gio_bat_dau || !gio_ket_thuc || gio_ket_thuc <= gio_bat_dau))) {
      await session.abortTransaction()
      session.endSession()
      return res.status(400).json({ success: false, message: 'Khung gio nghi khong hop le' })
    }

    const doctor = await BacSi.findOne({
      _id: doctorId,
      trang_thai_duyet: 'approved',
      la_hien: true,
    }).session(session)
    if (!doctor) {
      await session.abortTransaction()
      session.endSession()
      return res.status(404).json({ success: false, message: 'Khong tim thay bac si dang hoat dong' })
    }

    const tuNgay = startOfDayUtc(new Date(startInput))
    const denNgay = startOfDayUtc(new Date(endInput))
    if (!tuNgay || !denNgay || denNgay < tuNgay) {
      await session.abortTransaction()
      session.endSession()
      return res.status(400).json({ success: false, message: 'Khoang ngay nghi khong hop le' })
    }

    const overlappingLeave = await NghiPhepBacSi.findOne({
      bac_si_id: doctorId,
      trang_thai: { $in: ['cho_duyet', 'da_duyet'] },
      tu_ngay: { $lt: nextDayUtc(denNgay) },
      den_ngay: { $gte: tuNgay },
    }).session(session)
    if (overlappingLeave) {
      await session.abortTransaction()
      session.endSession()
      return res.status(409).json({
        success: false,
        message: 'Bac si da co don nghi trong khoang ngay nay, vui long xu ly tren don hien co',
        leave_id: overlappingLeave._id,
      })
    }

    const now = new Date()
    const leave = await NghiPhepBacSi.create([{
      bac_si_id: doctorId,
      tu_ngay: tuNgay,
      den_ngay: denNgay,
      gio_bat_dau: gio_bat_dau || null,
      gio_ket_thuc: gio_ket_thuc || null,
      ly_do: reason || 'Bac si nghi dot xuat',
      trang_thai: 'da_duyet',
      nguoi_duyet_id: getActorUserId(req),
      thoi_diem_duyet: now,
      ghi_chu: ghi_chu || 'Le tan ghi nhan bac si nghi dot xuat va tao de xuat doi lich cho khach',
    }], { session })
    const suddenLeave = leave[0]

    const affectedAppointments = await findAppointmentsAffectedBySuddenLeave(suddenLeave, session, appointmentIds)
    const queueEntries = affectedAppointments.length
      ? await HangDoi.find({
          appointment_id: { $in: affectedAppointments.map((appointment) => appointment._id) },
          trang_thai: { $in: ['dang_cho', 'da_goi', 'trong_phong'] },
        }).select('appointment_id trang_thai ma_so_thu_tu ten_benh_nhan doctor_id').session(session).lean()
      : []
    const queueByAppointment = new Map(queueEntries.map((entry) => [String(entry.appointment_id), entry]))

    const appointmentsForProposal = affectedAppointments.filter((appointment) => (
      ['pending', 'confirmed'].includes(appointment.status)
      && !appointment.de_xuat_doi
      && !queueByAppointment.has(String(appointment._id))
    ))

    const skippedAppointments = affectedAppointments
      .filter((appointment) => !appointmentsForProposal.some((eligible) => String(eligible._id) === String(appointment._id)))
      .map((appointment) => {
        const queue = queueByAppointment.get(String(appointment._id))
        return {
          appointment_id: appointment._id,
          ma_lich_hen: appointment.ma_lich_hen ?? null,
          status: appointment.status,
          ten_khach: appointment.ten_khach ?? null,
          gio_kham: appointment.gio_kham,
          ly_do_bo_qua: queue?.trang_thai === 'trong_phong'
            ? 'benh_nhan_dang_trong_phong'
            : queue
              ? 'da_checkin_can_dieu_phoi_tai_quay'
              : appointment.de_xuat_doi
                ? 'dang_co_de_xuat_doi_mo'
                : 'trang_thai_khong_cho_phep_tao_de_xuat',
          hang_doi: queue
            ? {
                hang_doi_id: queue._id,
                trang_thai: queue.trang_thai,
                ma_so_thu_tu: queue.ma_so_thu_tu ?? null,
              }
            : null,
        }
      })

    const slotsLocked = await lockSlotsForSuddenLeave(suddenLeave, session)
    const proposals = appointmentsForProposal.length > 0
      ? await taoDeXuatDoiChoDonNghi(suddenLeave, {
          session,
          now,
          appointmentIds: appointmentsForProposal.map((appointment) => appointment._id),
        })
      : []

    const updatedAppointments = proposals.length > 0
      ? await LichHen.find({ _id: { $in: proposals.map((proposal) => proposal.appointment_id) } })
          .select('_id de_xuat_doi')
          .session(session)
      : []
    const affectedById = new Map(affectedAppointments.map((appointment) => [String(appointment._id), appointment]))
    const updatedById = new Map(updatedAppointments.map((appointment) => [String(appointment._id), appointment]))
    for (const proposal of proposals) {
      const appointment = affectedById.get(String(proposal.appointment_id))
      if (!appointment) continue
      const nextOption = updatedById.get(String(proposal.appointment_id))?.de_xuat_doi?.phuong_an?.[0] ?? null
      await LichSuLichHen.create([{
        appointment_id: appointment._id,
        tu_trang_thai: appointment.status,
        den_trang_thai: appointment.status,
        tu_payment_status: appointment.payment_status ?? null,
        den_payment_status: appointment.payment_status ?? null,
        loai_thay_doi: 'reschedule_proposal',
        ly_do_thay_doi: reason || 'Bac si nghi dot xuat',
        vai_tro: getActorRole(req),
        kenh_thay_doi: 'web',
        nguoi_thay_doi_id: getActorUserId(req),
        nguoi_thuc_hien_id: getActorUserId(req),
        bac_si_cu_id: appointment.doctor_id ?? null,
        bac_si_moi_id: nextOption?.doctor_id ?? null,
        specialty_cu_id: appointment.specialty_id ?? null,
        specialty_moi_id: appointment.specialty_id ?? null,
        schedule_cu_id: appointment.schedule_id ?? null,
        schedule_moi_id: nextOption?.schedule_id ?? null,
        slot_cu_id: appointment.slot_id ?? null,
        slot_moi_id: nextOption?.slot_id ?? null,
        ngay_kham_cu: appointment.ngay_kham ?? null,
        ngay_kham_moi: nextOption?.ngay ?? null,
        gio_kham_cu: appointment.gio_kham ?? null,
        gio_kham_moi: nextOption?.gio_bat_dau ?? null,
        ly_do: `Tao de xuat doi lich do bac si nghi dot xuat: ${reason || 'khong ghi ro ly do'}`,
      }], { session })
    }

    await session.commitTransaction()
    session.endSession()

    const proposalSummaries = proposals.map(summarizeSuddenLeaveProposal)
    const manualContactCount = proposalSummaries.filter((item) => item.can_lien_he_thu_cong).length
      + skippedAppointments.filter((item) => item.ly_do_bo_qua !== 'benh_nhan_dang_trong_phong').length

    return res.status(200).json({
      success: true,
      message: `Da ghi nhan bac si nghi dot xuat. Tao de xuat cho ${proposals.length}/${affectedAppointments.length} lich bi anh huong.`,
      data: {
        leave_id: suddenLeave._id,
        so_lich_bi_anh_huong: affectedAppointments.length,
        so_slot_da_khoa: slotsLocked,
        de_xuat_doi: proposalSummaries,
        can_dieu_phoi_tai_quay: skippedAppointments,
        so_luot_can_le_tan_lien_he: manualContactCount,
      },
    })
  } catch (error) {
    await session.abortTransaction().catch(() => {})
    session.endSession()
    return res.status(500).json({ success: false, message: error.message })
  }
}

export default {
  getAppointments,
  markAsArrived,
  getPendingCheckin,
  getDoctorOperationalStatuses,
  reportDoctorUnavailable,
  rescheduleAppointment,
  markLateArrival,
  cancelAppointment,
  getRescheduleHistory,
  bulkCancelAppointments,
  bulkRescheduleAppointments
}
