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

import { enrichAppointmentsWithPaymentData } from '../admin/appointment.controller.js'
import { checkInLichHen, layLichChoTiepNhan } from '../../services/checkIn.service.js'
import { apDungPhuongAn } from '../../services/appointmentReschedule.service.js'
import { duyetDonNghi, laDonNganHanChoLeTan, demAnhHuongCuaDonNghi } from '../../services/doctorLeaveApproval.service.js'
import { notifyAppointmentCustomerChange } from '../../services/appointmentCustomerNotification.service.js'
import { releaseAppointmentSlot } from '../../services/bookingPaymentState.service.js'
import { kiemTraQuaTai } from '../../services/queueOverflow.service.js'
import { sendNotificationEmail, isMailConfigured } from '../../services/mail.service.js'
import { layDongSuaGanNhatChoNhieuLichHen } from '../../services/receptionistTimeline.service.js'
import { ghiNhatKyLeTan } from '../../services/receptionistAudit.service.js'
import { buildSlotDateTime, cacMocCuaKhung, startOfDayUtc } from '../../utils/clinicTime.js'
import { caCuaKhung } from '../../models/MauLichLamViec.js'
import { soSanhThuTuHangDoi } from '../../models/HangDoi.js'
import {
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

  // Lịch đặt hộ người chưa có hồ sơ liên kết: chỉ nhận khi cả tên và số điện thoại
  // trên lịch khớp với hồ sơ mà lễ tân vừa xác nhận.
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
    const { date, status, timeframe, search, doctor_id, specialty_id, payment_status, from_date, to_date, page = 1, limit = 10, id } = req.query
    const pageNum = parseInt(page) || 1
    const limitNum = parseInt(limit) || 10
    const query = { loai_kham: 'clinic' }

    // Tra cứu đúng 1 lịch hẹn theo _id (vd: mở từ link thông báo "Có lịch khám mới!") — bỏ
    // qua mọi bộ lọc khác (ngày/trạng thái/khung thời gian...) để không bị lọc mất lịch cần tìm.
    if (id) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'id lịch hẹn không hợp lệ' })
      }
      query._id = id
    } else {
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
      } else if (from_date || to_date) {
        const range = {}
        if (from_date) range.$gte = new Date(`${from_date}T00:00:00.000Z`)
        if (to_date) range.$lte = new Date(`${to_date}T00:00:00.000Z`)
        query.ngay_kham = range
      } else {
        const now = new Date()
        // Ép chuẩn về múi giờ Việt Nam (UTC+7) để Server không bị lạc ngày
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

      // Mac dinh AN lich da huy — de tran nhieu lich huy lam kho tim lich con hieu luc.
      // status=all -> khong loc gi; status=<gia tri cu the> (ke ca 'cancelled') -> loc dung gia tri do.
      if (status === 'all') {
        // khong ap dieu kien status
      } else if (status) {
        query.status = status
      } else {
        query.status = { $ne: 'cancelled' }
      }
      if (doctor_id) query.doctor_id = doctor_id
      if (specialty_id) query.specialty_id = specialty_id
      if (payment_status && payment_status !== 'all') query.payment_status = payment_status
    }

    let sortOption = { ngay_kham: 1, gio_kham: 1 }
    if (timeframe === 'past') {
      sortOption = { ngay_kham: -1, gio_kham: -1 }
    }

    const totalDocs = await LichHen.countDocuments(query)
    const totalPages = Math.ceil(totalDocs / limitNum)

    const appointments = await LichHen.find(query)
      .populate('user_id', 'ho_ten so_dien_thoai email anh_dai_dien')
      // Bệnh nhân đến khám khi đặt hộ CHO thành viên gia đình (rule mục 5: giới hạn tính theo
      // member_id chứ không theo user_id). Thiếu populate này, FE không có cách nào phân biệt
      // "người đặt" (user_id, chủ tài khoản) với "người được khám" (member_id) khi ten_khach
      // trống — và sẽ hiển thị nhầm tên người đặt hộ thay vì bệnh nhân thực tế.
      .populate('member_id', 'ho_ten')
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
    // E-1: "sửa gần nhất" cho CẢ trang hiện tại trong 2 truy vấn — tránh N+1.
    const suaGanNhatByAppointment = await layDongSuaGanNhatChoNhieuLichHen(
      appointments.map((appointment) => appointment._id),
    )
    // Enrich payment data and save back to DB if needed
    const enrichedAppointments = await enrichAppointmentsWithPaymentData(appointments, { persist: true })

    const data = enrichedAppointments.map((appointment) => ({
      ...appointment,
      ...buildReceptionistAppointmentActions(
        appointment,
        queueByAppointment.get(String(appointment._id)) ?? null,
      ),
      sua_gan_nhat: suaGanNhatByAppointment.get(String(appointment._id)) ?? null,
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

// Lễ tân tiếp nhận bệnh nhân tới quầy.
//
// ⚠️ Trước 2026-07-26 hàm này CHỈ đổi `status = 'checked_in'`. Bệnh nhân đặt online, đã thanh
// toán, tới quầy, lễ tân bấm "đã đến" — và không bao giờ xuất hiện trong hàng đợi của bác sĩ,
// vì hàng đợi neo trên collection `HangDoi` chứ không trên `LichHen.status`. Bác sĩ không có
// cách nào tiếp nhận họ; tệ hơn, rule mục 8 định nghĩa `no_show` = "hết ca mà không có bản ghi
// HangDoi" nên người đã tới quầy vẫn bị coi là không đến và mất 100% tiền (mục 5).
//
// Nay gọi CHUNG service check-in với bác sĩ (rule mục 7). Khác biệt duy nhất: lễ tân tiếp nhận
// cho cả phòng khám nên không truyền `restrictToDoctorId`.
export const markAsArrived = async (req, res) => {
  try {
    const { ho_so_benh_nhan_id, so_dien_thoai, ho_ten } = req.body ?? {}
    if (!ho_so_benh_nhan_id || !so_dien_thoai || !ho_ten) {
      return res.status(400).json({
        success: false,
        message: 'Check-in phải tra cứu và xác nhận hồ sơ bằng số điện thoại, họ tên bệnh nhân trước.',
      })
    }

    const profile = await HoSoBenhNhan.findOne({ _id: ho_so_benh_nhan_id, trang_thai: 'active' }).lean()
    if (!profile) return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ bệnh nhân đã xác nhận.' })
    if (normalizePhone(so_dien_thoai) !== normalizePhone(profile.so_dien_thoai_tim_kiem || profile.so_dien_thoai)
      || normalizeName(ho_ten) !== normalizeName(profile.ho_ten)) {
      return res.status(409).json({ success: false, message: 'Thông tin check-in không khớp với hồ sơ bệnh nhân đã tra cứu.' })
    }

    const checkedAppointment = await LichHen.findById(req.params.id)
      .select('ho_so_benh_nhan_id member_id user_id nguoi_dat_ho_id dat_ho ten_khach so_dien_thoai_khach')
      .lean()
    if (!checkedAppointment || !appointmentBelongsToProfile(checkedAppointment, profile)) {
      return res.status(409).json({ success: false, message: 'Lịch hẹn không thuộc đúng bệnh nhân vừa được xác nhận.' })
    }

    // Nếu đây là lần đầu hồ sơ tại quầy gặp lại tài khoản online, liên kết ngay
    // sau khi lễ tân đã xác minh đúng người. Không ghi đè liên kết cũ và phân biệt
    // tài khoản bệnh nhân với tài khoản người đặt hộ.
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
      message: 'Đã check-in bệnh nhân vào hàng đợi',
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

// GET /api/receptionist/appointments/pending-checkin — khách đã đặt hôm nay, chưa vào hàng đợi.
// Cùng nguồn dữ liệu với danh sách của bác sĩ, chỉ khác là không giới hạn theo một bác sĩ.
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
        }).select('_id appointment_id doctor_id specialty_id trang_thai ten_benh_nhan checkin_time gio_hen_goc thoi_diem_goi thoi_diem_vao_phong ma_so_thu_tu so_thu_tu_checkin nguon').lean()
        : [],
      doctorIds.length
        ? LichHen.find({
          doctor_id: { $in: doctorIds },
          ngay_kham: { $gte: todayStart, $lt: todayEnd },
          status: { $in: ['pending', 'confirmed'] },
        }).select('_id doctor_id ma_lich_hen ten_khach so_dien_thoai_khach ngay_kham gio_kham status user_id member_id')
          .populate('user_id', 'ho_ten so_dien_thoai')
          .populate('member_id', 'ho_ten')
          .lean()
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
          ten_benh_nhan: appointment.member_id?.ho_ten ?? appointment.ten_khach ?? appointment.user_id?.ho_ten ?? 'Khach hang',
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
          specialty_id: queue.specialty_id ?? null,
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

// Trần số lần khách tự xin dời (rule mục 5) — giống `patient/reschedule.controller.js`.
// ─── E-6: danh sách lịch CHƯA check-in bị ảnh hưởng bởi ca đang trễ ──────────
// Thuần tính toán (filter + sort + map) — tách để unit test không cần Mongo.
// Cùng khái niệm với `lich_chua_checkin_bi_anh_huong` trong getDoctorOperationalStatuses,
// nhưng KHÔNG giới hạn top 5 (dashboard chỉ xem trước, màn điều phối lô cần đủ để chọn).
export function buildOverloadAffectedList(appointments, now, doTrePhut) {
  return appointments
    .filter((appointment) => {
      const slotTime = buildSlotDateTime(appointment.ngay_kham, appointment.gio_kham)
      return !slotTime || slotTime.getTime() >= now.getTime()
    })
    .sort((a, b) => String(a.gio_kham).localeCompare(String(b.gio_kham)))
    .map((appointment) => ({
      appointment_id: appointment._id,
      ma_lich_hen: appointment.ma_lich_hen ?? null,
      ten_benh_nhan: appointment.member_id?.ho_ten ?? appointment.ten_khach ?? appointment.user_id?.ho_ten ?? 'Khách hàng',
      so_dien_thoai: appointment.user_id?.so_dien_thoai ?? appointment.so_dien_thoai_khach ?? null,
      gio_kham: appointment.gio_kham,
      status: appointment.status,
      thoi_gian_tre_uoc_tinh_phut: doTrePhut,
    }))
}

// GET /api/receptionist/appointments/overload-affected?doctor_id=&date=
export async function getOverloadAffectedAppointments(req, res) {
  try {
    const { doctor_id: doctorId, date } = req.query
    if (!doctorId || !mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: 'Cần doctor_id hợp lệ' })
    }

    const todayStart = startOfDayUtc(date ?? new Date())
    const todayEnd = new Date(todayStart)
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1)
    const now = new Date()

    const appointments = await LichHen.find({
      doctor_id: doctorId,
      ngay_kham: { $gte: todayStart, $lt: todayEnd },
      status: { $in: ['pending', 'confirmed'] },
    })
      .select('_id ma_lich_hen ten_khach so_dien_thoai_khach ngay_kham gio_kham status user_id member_id')
      .populate('user_id', 'ho_ten so_dien_thoai')
      .populate('member_id', 'ho_ten')
      .lean()

    const overflow = await kiemTraQuaTai(doctorId, now)
    const lichHenBiAnhHuong = buildOverloadAffectedList(appointments, now, overflow.doTrePhut)

    res.status(200).json({
      success: true,
      data: {
        do_tre_ca_phut: overflow.doTrePhut,
        ngung_nhan_walkin: overflow.ngungBanWalkIn,
        chan_dat_online: overflow.chanDatOnline,
        lich_hen: lichHenBiAnhHuong,
      },
    })
  } catch (error) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message })
  }
}

const TRAN_DOI_KHACH_YEU_CAU = 1

// Slot còn nhận được người mới. Cùng định nghĩa với `appointmentReschedule.service.js`.
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

// Lễ tân dời lịch hộ khách.
//
// ⚠️ Bản trước bỏ qua gần hết mục 5/11 và có thể làm hỏng dữ liệu:
//   - Không kiểm mốc `T-30'` → khách sắp trễ nhờ lễ tân dời lúc `T-5'`, phòng khám mất
//     trắng chỗ vì không kịp bán lại (đúng chiêu mà mục 11 dựng mốc đó để chặn).
//   - `slots.find(s => s.gio_bat_dau === gio_kham)` lấy slot ĐẦU TIÊN trùng giờ: một khung
//     có nhiều slot (TMH 2 slot/khung) nên slot đầu có thể đã kín trong khi slot bên cạnh
//     còn trống → báo "đã kín" oan. Ngược lại nó cũng nhận cả slot `walk_in` và slot người
//     khác đang giữ chỗ, trong khi mục 5 chốt khách tự dời KHÔNG BAO GIỜ được lấn walk-in.
//   - Không kiểm lịch hẹn nào khác đã trỏ vào slot đó → đụng unique index
//     `uniq_lich_hen_theo_slot` và trả 500 thay vì thông báo đọc được.
//   - Đếm hạn mức bằng `so_lan_thay_doi` (đếm MỌI thay đổi) thay vì
//     `so_lan_doi_khach_yeu_cau`, nên một lần dời do lỗi phòng khám cũng ăn mất quyền dời
//     của khách — trái mục 5 ("lỗi phòng khám KHÔNG tính vào hạn mức").
//   - Trả slot cũ về `active` ngay trong cùng transaction, kể cả khi khung đã sát giờ.
//
// Nay dùng CHUNG `apDungPhuongAn()` với luồng bệnh nhân tự dời: một chỗ quyết định cách
// chiếm slot, khoá slot cũ, đặt `ly_do_doi`, đếm hạn mức và ghi nhật ký.
export const rescheduleAppointment = async (req, res) => {
  try {
    const { ngay_kham, gio_kham, ly_do_doi_lich, ly_do_doi } = req.body

    if (!ngay_kham || !gio_kham) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ngày và giờ khám mới' })
    }

    const appointment = await LichHen.findById(req.params.id).populate('user_id', 'email')
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' })
    }
    const queueEntry = await getQueueEntryForAppointment(appointment._id)
    assertReceptionistAppointmentAction(
      appointment,
      queueEntry,
      RECEPTIONIST_APPOINTMENT_ACTIONS.RESCHEDULE,
    )

    // Đang có đề xuất của phòng khám (bác sĩ nghỉ/bận — mục 14, 15) thì phải xử lý đề xuất đó,
    // không dời tay chồng lên: chỗ của phương án đang được giữ sẵn cho khách.
    const deXuat = appointment.de_xuat_doi
    if (deXuat && ['cho_khach_chon', 'cho_admin_duyet'].includes(deXuat.trang_thai)) {
      return res.status(409).json({
        success: false,
        message: 'Lịch này đang có phương án dời do phòng khám đề xuất. Hãy xử lý đề xuất đó trước.',
      })
    }

    // `ly_do_doi` là trường BẮT BUỘC khi dời (mục 10.D) và quyết định hạn mức:
    //   khach_yeu_cau → tính vào trần 1 lần của khách, phải trước `T-30'`
    //   phong_kham    → KHÔNG tính hạn mức, không áp mốc `T-30'` (mục 15), nhưng phải có
    //                   người duyệt + lý do và được ghi nhật ký
    // Mặc định `khach_yeu_cau`: lễ tân dời hộ thì gần như luôn là khách yêu cầu, và chọn
    // mặc định này KHÔNG thể bị dùng để lách trần. Muốn `phong_kham` thì phải nói rõ.
    const laLoiPhongKham = ly_do_doi === 'phong_kham'
    const lyDoDoi = laLoiPhongKham ? 'phong_kham' : 'khach_yeu_cau'

    if (laLoiPhongKham && !ly_do_doi_lich?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Dời do lỗi phòng khám bắt buộc ghi lý do cụ thể (rule mục 5).',
      })
    }

    if (!laLoiPhongKham) {
      const daDung = appointment.so_lan_doi_khach_yeu_cau ?? 0
      if (daDung >= TRAN_DOI_KHACH_YEU_CAU) {
        return res.status(409).json({
          success: false,
          message: `Khách đã dùng hết ${TRAN_DOI_KHACH_YEU_CAU} lần dời lịch. Nếu đây là lỗi phòng khám, `
            + 'chọn lý do "phòng khám" kèm giải trình.',
        })
      }

      // Mốc `T-30'` của khung CŨ (mục 11). Dành cho bệnh nhân tự dời trên web.
      // Đối với Lễ tân: Đã gỡ bỏ chặn để lễ tân có thể dời lịch tự do bất kể thời gian
      // const moc = cacMocCuaKhung(appointment.ngay_kham, appointment.gio_kham)
      // if (!moc || Date.now() >= moc.dongDatOnline.getTime()) {
      //   return res.status(409).json({
      //     success: false,
      //     message: 'Đã quá hạn xin dời (trước giờ khám 30 phút). Khách vẫn được khám nếu tới trong ca '
      //       + 'và KHÔNG mất tiền.',
      //   })
      // }
    }

    // ── Tìm slot đích ────────────────────────────────────────────────────────
    const ngayMoi = new Date(ngay_kham)
    if (Number.isNaN(ngayMoi.getTime())) {
      return res.status(400).json({ success: false, message: 'ngay_kham không hợp lệ' })
    }
    ngayMoi.setUTCHours(0, 0, 0, 0)

    const scheduleMoi = await LichLamViec.findOne({
      doctor_id: appointment.doctor_id,
      ngay: { $gte: ngayMoi, $lt: new Date(ngayMoi.getTime() + 86400000) },
      trang_thai_ngay: 'lam_viec',
      trang_thai_xac_nhan: { $ne: 'tu_choi' },
    }).lean()

    if (!scheduleMoi) {
      return res.status(400).json({ success: false, message: 'Bác sĩ không có lịch làm việc vào ngày này' })
    }

    // Lịch hẹn khác đã trỏ vào slot nào thì slot đó hết chỗ, dù `status` trong lịch có lệch.
    const slotDaCoLich = new Set(
      (await LichHen.find({
        schedule_id: scheduleMoi._id,
        status: { $ne: 'cancelled' },
        _id: { $ne: appointment._id },
      }).select('slot_id').lean())
        .filter((a) => a.slot_id).map((a) => String(a.slot_id)),
    )

    // Quét MỌI slot trùng giờ, không lấy slot đầu tiên: một khung có nhiều slot.
    const slotTrungGio = scheduleMoi.slots.filter((s) => s.gio_bat_dau === gio_kham)
    if (slotTrungGio.length === 0) {
      return res.status(400).json({ success: false, message: `Bác sĩ không có khung ${gio_kham} trong ngày này` })
    }
    if (slotTrungGio.some((s) => String(s._id) === String(appointment.slot_id))) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn ngày và giờ khác với lịch hẹn hiện tại' })
    }

    // Khách tự dời KHÔNG BAO GIỜ được lấn slot walk-in (mục 5, 15). Lỗi phòng khám thì mục 15
    // cho lấn nhưng có trần 1 slot/khung và phải ghi nhật ký — chưa hiện thực ở màn hình này,
    // nên tạm thời chặn cả hai chiều thay vì lấn không kiểm soát.
    const slotMoi = slotTrungGio.find(
      (s) => slotConTrong(s) && s.loai_slot !== 'walk_in' && !slotDaCoLich.has(String(s._id)),
    )
    if (!slotMoi) {
      const coWalkIn = slotTrungGio.some((s) => slotConTrong(s) && s.loai_slot === 'walk_in')
      return res.status(409).json({
        success: false,
        message: coWalkIn
          ? `Khung ${gio_kham} chỉ còn chỗ dành cho khách tới quầy, không dùng để dời lịch đặt trước.`
          : `Khung ${gio_kham} đã kín, vui lòng chọn khung khác.`,
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
      // Chỉ khoá slot cũ khi lỗi thuộc phòng khám. Khách yêu cầu dời -> trả pool (A1).
      khoaSlotCu: lyDoDoi !== 'khach_yeu_cau',
    })

    // `ly_do_doi_lich` là mô tả tự do cho lễ tân đọc lại; `ly_do_doi` là phân loại nghiệp vụ.
    appointment.ly_do_doi_lich = ly_do_doi_lich?.trim()
      || (laLoiPhongKham ? 'Phòng khám dời lịch' : 'Khách yêu cầu dời lịch')
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
        ? 'Đã dời lịch hẹn (lỗi phòng khám — không tính vào hạn mức của khách)'
        : `Đã dời lịch hẹn. Khách đã dùng ${appointment.so_lan_doi_khach_yeu_cau}/${TRAN_DOI_KHACH_YEU_CAU} lần dời.`,
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
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' })
    }

    const queueEntry = await getQueueEntryForAppointment(appointment._id)
    assertReceptionistAppointmentAction(
      appointment,
      queueEntry,
      RECEPTIONIST_APPOINTMENT_ACTIONS.LATE_RESCHEDULE,
    )

    const moc = cacMocCuaKhung(appointment.ngay_kham, appointment.gio_kham)
    if (!moc || now.getTime() < moc.T.getTime()) {
      return res.status(409).json({ success: false, message: 'Lịch hẹn chưa qua giờ khám, không thể ghi nhận khách đến muộn.' })
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
      message: `Đã xử lý khách đến muộn: chuyển từ ${gioCu} sang ${appointment.gio_kham}.`,
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
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' })
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
    appointment.ly_do_huy = ly_do_huy || 'Lễ tân hủy lịch'
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

    // Ghi ngoai transaction nghiep vu da commit - ghiNhatKyLeTan tu nuot loi, khong throw.
    await ghiNhatKyLeTan({
      hanhDong: 'LT_HUY_LICH',
      actorUserId: getActorUserId(req),
      actorRole: getActorRole(req),
      loaiDoiTuong: 'appointment',
      doiTuongId: appointment._id,
      duLieuCu: { status: oldStatus },
      duLieuMoi: { status: 'cancelled', ly_do: appointment.ly_do_huy ?? null },
    })

    res.status(200).json({
      success: true,
      message: 'Đã hủy lịch hẹn',
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
      return res.status(400).json({ success: false, message: 'Không có lịch hẹn nào được chọn' })
    }

    const appointments = await LichHen.find({ _id: { $in: ids }, status: { $in: ['pending', 'confirmed'] } }).populate('user_id', 'email')

    for (const appointment of appointments) {
      const oldStatus = appointment.status
      appointment.status = 'cancelled'
      appointment.ly_do_huy = reason || 'Hủy lịch hàng loạt'

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
      const tieuDe = 'Lịch hẹn của bạn đã bị hủy'
      const noiDung = `Phòng khám đã hủy lịch hẹn ngày ${appointment.ngay_kham.toLocaleDateString('vi-VN')} lúc ${appointment.gio_kham}. Lý do: ${appointment.ly_do_huy}`

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
    res.status(200).json({ success: true, message: `Đã hủy ${appointments.length} lịch hẹn` })
  } catch (error) {
    await session.abortTransaction()
    session.endSession()
    res.status(500).json({ success: false, message: error.message })
  }
}

// ─── GET /receptionist/booking/doctor-unavailable/preview ───────────────────
// Rào chắn #1 (mục 3.8 spec): xem trước ảnh hưởng, CHỈ ĐỌC, trước khi xác nhận báo nghỉ.
export const previewDoctorUnavailable = async (req, res) => {
  try {
    const { doctor_id: doctorId, tu_ngay: tuNgayInput, den_ngay: denNgayInput, gio_bat_dau: gioBatDau, gio_ket_thuc: gioKetThuc } = req.query
    if (!doctorId || !mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: 'doctor_id không hợp lệ' })
    }
    if (!tuNgayInput || !denNgayInput) {
      return res.status(400).json({ success: false, message: 'tu_ngay và den_ngay là bắt buộc' })
    }

    // I3 (2026-08-25): preview phải áp ĐÚNG validation của hành động thật (reportDoctorUnavailable)
    // — thiếu bước này, preview có thể báo "0 lịch ảnh hưởng" cho một khung giờ mà submit thật
    // sẽ 400, gây yên tâm giả; hoặc coi một gio_bat_dau-thiếu-gio_ket_thuc là nghỉ cả ngày trong
    // khi submit thật sẽ từ chối. Dùng lại nguyên `validHHMM` cục bộ, không viết lại logic.
    if (!validHHMM(gioBatDau) || !validHHMM(gioKetThuc) || ((gioBatDau || gioKetThuc) && (!gioBatDau || !gioKetThuc || gioKetThuc <= gioBatDau))) {
      return res.status(400).json({ success: false, message: 'Khung giờ nghỉ không hợp lệ' })
    }

    const doctor = await BacSi.findOne({
      _id: doctorId,
      trang_thai_duyet: 'approved',
      la_hien: true,
    })
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bác sĩ đang hoạt động' })
    }

    const tuNgay = startOfDayUtc(new Date(tuNgayInput))
    const denNgay = startOfDayUtc(new Date(denNgayInput))
    if (!tuNgay || !denNgay || denNgay < tuNgay) {
      return res.status(400).json({ success: false, message: 'Khoảng ngày không hợp lệ' })
    }

    const ketQua = await demAnhHuongCuaDonNghi({
      bacSiId: doctorId, tuNgay, denNgay, gioBatDau: gioBatDau || null, gioKetThuc: gioKetThuc || null,
    })
    return res.status(200).json({ success: true, message: 'OK', data: ketQua })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

export const reportDoctorUnavailable = async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const { doctor_id, date, tu_ngay, den_ngay, gio_bat_dau, gio_ket_thuc, reason, ghi_chu } = req.body
    const doctorId = doctor_id
    const startInput = tu_ngay || date
    const endInput = den_ngay || tu_ngay || date

    if (!doctorId || !startInput || !endInput) {
      await session.abortTransaction()
      session.endSession()
      return res.status(400).json({ success: false, message: 'doctor_id, ngày bắt đầu và ngày kết thúc là bắt buộc' })
    }
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      await session.abortTransaction()
      session.endSession()
      return res.status(400).json({ success: false, message: 'doctor_id không hợp lệ' })
    }
    if (!validHHMM(gio_bat_dau) || !validHHMM(gio_ket_thuc) || ((gio_bat_dau || gio_ket_thuc) && (!gio_bat_dau || !gio_ket_thuc || gio_ket_thuc <= gio_bat_dau))) {
      await session.abortTransaction()
      session.endSession()
      return res.status(400).json({ success: false, message: 'Khung giờ nghỉ không hợp lệ' })
    }

    const doctor = await BacSi.findOne({
      _id: doctorId,
      trang_thai_duyet: 'approved',
      la_hien: true,
    }).session(session)
    if (!doctor) {
      await session.abortTransaction()
      session.endSession()
      return res.status(404).json({ success: false, message: 'Không tìm thấy bác sĩ đang hoạt động' })
    }

    const tuNgay = startOfDayUtc(new Date(startInput))
    const denNgay = startOfDayUtc(new Date(endInput))
    if (!tuNgay || !denNgay || denNgay < tuNgay) {
      await session.abortTransaction()
      session.endSession()
      return res.status(400).json({ success: false, message: 'Khoảng ngày nghỉ không hợp lệ' })
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
        message: 'Bác sĩ đã có đơn nghỉ trong khoảng ngày này, vui lòng xử lý trên đơn hiện có',
        leave_id: overlappingLeave._id,
      })
    }

    // duyetDonNghi() yêu cầu leave.trang_thai === 'cho_duyet' làm tiền điều kiện — MỌI nhánh
    // tạo đơn ở đây đều khởi tạo 'cho_duyet', không được tạo sẵn 'da_duyet'.
    const leaveDoc = new NghiPhepBacSi({
      bac_si_id: doctorId,
      tu_ngay: tuNgay,
      den_ngay: denNgay,
      gio_bat_dau: gio_bat_dau || null,
      gio_ket_thuc: gio_ket_thuc || null,
      ly_do: reason || 'Bac si nghi dot xuat',
      trang_thai: 'cho_duyet',
      ghi_chu: ghi_chu || 'Le tan ghi nhan bac si nghi dot xuat',
      nguon_tao: 'le_tan_ghi_nhan',
      nguoi_tao_id: getActorUserId(req),
    })

    // Đ2 (2026-08-25): lễ tân chỉ được duyệt NGAY đơn NGẮN HẠN — cùng ranh giới thẩm quyền
    // với đường "bác sĩ tự gửi đơn" (approveLeave dùng laDonNganHanChoLeTan). Trước đợt này,
    // reportDoctorUnavailable tạo thẳng trang_thai:'da_duyet' không kiểm tra gì.
    if (!laDonNganHanChoLeTan(leaveDoc)) {
      await leaveDoc.save({ session })
      await session.commitTransaction()
      session.endSession()
      return res.status(200).json({
        success: true,
        message: 'Đã tạo đơn nghỉ. Khoảng nghỉ vượt quá 1 ngày nên cần Admin duyệt trước khi khoá lịch và báo khách.',
        data: {
          leave_id: leaveDoc._id,
          // C1 (2026-08-25): discriminator để FE phân biệt "đã xử lý xong" khỏi "mới tạo đơn,
          // còn chờ Admin" — trước đây FE coi mọi phản hồi 200 là đã xử lý xong, hiện nguyên
          // vẹn emerald success box + CTA "Sang trang điều phối" dẫn tới bảng trống.
          can_admin_duyet: true,
          so_lich_bi_anh_huong: 0,
          so_slot_da_khoa: 0,
          de_xuat_doi: [],
          can_dieu_phoi_tai_quay: [],
          so_luot_can_le_tan_lien_he: 0,
          so_lich_sinh_lai_phuong_an: 0,
        },
      })
    }

    await leaveDoc.save({ session })

    const { slotsLocked, affectedAppointments, canDieuPhoiTaiQuay, deXuat, deXuatSinhLai } = await duyetDonNghi({
      leave: leaveDoc,
      actorUserId: getActorUserId(req),
      actorRole: getActorRole(req),
      session,
    })

    await session.commitTransaction()
    session.endSession()

    const proposalSummaries = deXuat.map(summarizeSuddenLeaveProposal)
    const manualContactCount = proposalSummaries.filter((item) => item.can_lien_he_thu_cong).length
      + canDieuPhoiTaiQuay.filter((item) => item.ly_do_bo_qua !== 'benh_nhan_dang_trong_phong').length

    return res.status(200).json({
      success: true,
      message: `Đã ghi nhận bác sĩ nghỉ đột xuất. Tạo đề xuất cho ${deXuat.length}/${affectedAppointments.length} lịch bị ảnh hưởng.`,
      data: {
        leave_id: leaveDoc._id,
        can_admin_duyet: false,
        so_lich_bi_anh_huong: affectedAppointments.length,
        so_slot_da_khoa: slotsLocked,
        de_xuat_doi: proposalSummaries,
        can_dieu_phoi_tai_quay: canDieuPhoiTaiQuay,
        so_luot_can_le_tan_lien_he: manualContactCount,
        so_lich_sinh_lai_phuong_an: deXuatSinhLai.length,
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
  getOverloadAffectedAppointments,
  previewDoctorUnavailable,
  reportDoctorUnavailable,
  rescheduleAppointment,
  markLateArrival,
  cancelAppointment,
  getRescheduleHistory,
  bulkCancelAppointments
}
