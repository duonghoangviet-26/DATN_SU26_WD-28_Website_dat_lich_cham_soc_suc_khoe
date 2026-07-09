import mongoose from 'mongoose'
import LichHen from '../../models/LichHen.js'
import LichLamViec from '../../models/LichLamViec.js'
import LichSuLichHen from '../../models/LichSuLichHen.js'
import BacSi from '../../models/BacSi.js'
import DichVu from '../../models/DichVu.js'
import HoaDon from '../../models/HoaDon.js'
import ThanhToan from '../../models/ThanhToan.js'
import HoanTien from '../../models/HoanTien.js'
import CaiDatThanhToan from '../../models/CaiDatThanhToan.js'
import { ok, fail } from '../../utils/response.js'

const ADMIN_REFUND_SETTING_KEYS = ['hoan_tien_admin_huy', 'hoan_tien_admin_huy_khan_cap']
const APPOINTMENT_LIST_LIMIT_MAX = 100

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value)
}

function toDateOnly(value) {
  const date = new Date(value)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

function endOfDateOnly(value) {
  const date = toDateOnly(value)
  date.setUTCHours(23, 59, 59, 999)
  return date
}

function formatDateOnly(value) {
  return new Date(value).toISOString().slice(0, 10)
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function clampPositiveInt(value, fallback, max) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return Math.min(parsed, max)
}

function getQuickFilterConditions(quickFilter) {
  const today = toDateOnly(new Date())

  switch (quickFilter) {
    case 'today':
      return { ngay_kham: { $gte: today, $lte: endOfDateOnly(today) } }
    case 'upcoming':
      return {
        ngay_kham: { $gte: today },
        status: { $in: ['pending', 'confirmed', 'checked_in', 'in_progress'] },
      }
    case 'unpaid':
      return {
        payment_status: { $in: ['unpaid', 'partial'] },
        status: { $ne: 'cancelled' },
      }
    case 'cancelled':
      return { status: 'cancelled' }
    case 'need_attention':
      return {
        $or: [
          { status: 'pending' },
          { payment_status: { $in: ['unpaid', 'partial'] } },
          { so_lan_thay_doi: { $gte: 2 } },
        ],
      }
    case 'proxy_booking':
      return { dat_ho: true }
    default:
      return null
  }
}

async function buildKeywordFilter(keyword) {
  const normalizedKeyword = keyword?.trim()
  if (!normalizedKeyword) {
    return null
  }

  const safeKeyword = escapeRegex(normalizedKeyword)
  const keywordRegex = new RegExp(safeKeyword, 'i')

  const [matchedUsers, matchedDoctorUsers] = await Promise.all([
    mongoose.connection.collection('nguoi_dung')
      .find(
        {
          $or: [
            { ho_ten: keywordRegex },
            { so_dien_thoai: keywordRegex },
            { email: keywordRegex },
          ],
        },
        { projection: { _id: 1 } }
      )
      .toArray(),
    mongoose.connection.collection('nguoi_dung')
      .find({ ho_ten: keywordRegex, role: 'doctor' }, { projection: { _id: 1 } })
      .toArray(),
  ])

  const matchedDoctorUserIds = matchedDoctorUsers.map((item) => item._id)
  const matchedDoctors = matchedDoctorUserIds.length > 0
    ? await BacSi.find({ user_id: { $in: matchedDoctorUserIds } }).select('_id').lean()
    : []

  const userIds = matchedUsers.map((item) => item._id)
  const doctorIds = matchedDoctors.map((item) => item._id)

  return {
    $or: [
      { ma_lich_hen: keywordRegex },
      { ten_khach: keywordRegex },
      { so_dien_thoai_khach: keywordRegex },
      { nguoi_dat_ho_ten: keywordRegex },
      { nguoi_dat_sdt: keywordRegex },
      ...(userIds.length > 0 ? [{ user_id: { $in: userIds } }] : []),
      ...(doctorIds.length > 0 ? [{ doctor_id: { $in: doctorIds } }] : []),
    ],
  }
}

async function buildAppointmentQuery({
  keyword,
  status,
  payment_status,
  loai_kham,
  startDate,
  endDate,
  doctor_id,
  chi_nhanh_id,
  specialty_id,
  ma_lich_hen,
  quick_filter,
  booking_scope,
}) {
  const query = {}

  if (loai_kham) query.loai_kham = loai_kham
  if (status) query.status = status
  if (payment_status) query.payment_status = payment_status

  if (doctor_id) {
    if (!isValidObjectId(doctor_id)) {
      throw new Error('doctor_id khong hop le')
    }
    query.doctor_id = doctor_id
  }

  if (chi_nhanh_id) {
    if (!isValidObjectId(chi_nhanh_id)) {
      throw new Error('chi_nhanh_id khong hop le')
    }
    query.chi_nhanh_id = chi_nhanh_id
  }

  if (specialty_id) {
    if (!isValidObjectId(specialty_id)) {
      throw new Error('specialty_id khong hop le')
    }
    query.specialty_id = specialty_id
  }

  if (ma_lich_hen?.trim()) {
    query.ma_lich_hen = ma_lich_hen.trim()
  }

  if (booking_scope === 'proxy') {
    query.dat_ho = true
  } else if (booking_scope === 'self') {
    query.dat_ho = { $ne: true }
  }

  if (startDate || endDate) {
    query.ngay_kham = {}
    if (startDate) query.ngay_kham.$gte = toDateOnly(startDate)
    if (endDate) query.ngay_kham.$lte = endOfDateOnly(endDate)
  }

  const andConditions = []
  const quickFilterConditions = getQuickFilterConditions(quick_filter)
  if (quickFilterConditions) {
    andConditions.push(quickFilterConditions)
  }

  const keywordFilter = await buildKeywordFilter(keyword)
  if (keywordFilter) {
    andConditions.push(keywordFilter)
  }

  if (andConditions.length > 0) {
    query.$and = andConditions
  }

  return query
}

function getSummaryBaseQuery(query) {
  const summaryQuery = { ...query }
  delete summaryQuery.status
  delete summaryQuery.payment_status
  delete summaryQuery.$and

  const retainedAndConditions = (query.$and ?? []).filter((condition) => {
    if (condition.$or) {
      return true
    }

    return condition.ngay_kham == null
  })

  if (retainedAndConditions.length > 0) {
    summaryQuery.$and = retainedAndConditions
  }

  return summaryQuery
}

function formatAppointmentItem(appointment) {
  const patientName =
    appointment.member_id?.ho_ten ||
    appointment.ten_khach ||
    appointment.user_id?.ho_ten ||
    'Khach vang lai'
  const patientPhone =
    appointment.so_dien_thoai_khach ||
    appointment.member_id?.tai_khoan_id?.so_dien_thoai ||
    appointment.user_id?.so_dien_thoai ||
    null
  const bookerName =
    appointment.nguoi_dat_ho_ten ||
    appointment.nguoi_dat_ho_id?.ho_ten ||
    null
  const bookerPhone =
    appointment.nguoi_dat_sdt ||
    appointment.nguoi_dat_ho_id?.so_dien_thoai ||
    null

  return {
    _id: appointment._id,
    ma_lich_hen: appointment.ma_lich_hen ?? null,
    user_id: appointment.user_id?._id ?? appointment.user_id ?? null,
    member_id: appointment.member_id?._id ?? appointment.member_id ?? null,
    user_email: appointment.user_id?.email ?? appointment.email_khach ?? null,
    service_id: appointment.service_id?._id ?? appointment.service_id ?? null,
    chi_nhanh_id: appointment.chi_nhanh_id ?? null,
    specialty_id: appointment.specialty_id?._id ?? appointment.specialty_id ?? null,
    loai_benh_nhan: appointment.loai_benh_nhan ?? null,
    khach_vang_lai_id: appointment.khach_vang_lai_id ?? null,
    dat_ho: appointment.dat_ho ?? false,
    nguoi_dat_ho_id: appointment.nguoi_dat_ho_id?._id ?? appointment.nguoi_dat_ho_id ?? null,
    nguoi_dat_ho_ten: bookerName,
    nguoi_dat_sdt: bookerPhone,
    hinh_thuc_dat_lich: appointment.hinh_thuc_dat_lich ?? null,
    loai_dat_lich: appointment.dat_ho ? 'proxy' : 'self',
    benh_nhan: patientName,
    sdt_benh_nhan: patientPhone,
    doctor_id: appointment.doctor_id?._id ?? appointment.doctor_id ?? null,
    bac_si: appointment.doctor_id?.user_id?.ho_ten || 'Khong ro',
    chuyen_khoa:
      appointment.service_id?.ten ||
      appointment.specialty_id?.ten ||
      appointment.doctor_id?.specialties?.[0]?.ten ||
      'Kham tong quat',
    ngay_kham: formatDateOnly(appointment.ngay_kham),
    gio_kham: appointment.gio_kham,
    loai_kham: appointment.loai_kham,
    status: appointment.status,
    payment_status: appointment.payment_status,
    trang_thai_den: appointment.trang_thai_den ?? null,
    so_lan_thay_doi: appointment.so_lan_thay_doi ?? 0,
    gia_kham: appointment.gia_kham,
    dia_chi_kham: appointment.dia_chi_kham,
    ly_do_kham: appointment.ly_do_kham ?? null,
    ly_do_huy: appointment.ly_do_huy ?? null,
    huy_boi: appointment.huy_boi ?? null,
    thoi_diem_huy: appointment.thoi_diem_huy ?? null,
    ghi_chu_le_tan: appointment.ghi_chu_le_tan ?? null,
    ghi_chu_tiep_nhan: appointment.ghi_chu_tiep_nhan ?? null,
    canh_bao: {
      unpaid:
        appointment.status !== 'cancelled' &&
        ['unpaid', 'partial'].includes(appointment.payment_status),
      rescheduled_multiple_times: (appointment.so_lan_thay_doi ?? 0) >= 2,
      missing_linkage: !appointment.doctor_id || !appointment.specialty_id,
      cancelled: appointment.status === 'cancelled',
    },
    invoice: appointment.invoice
      ? {
          _id: appointment.invoice._id,
          so_hoa_don: appointment.invoice.so_hoa_don ?? null,
          trang_thai_hoa_don: appointment.invoice.trang_thai_hoa_don ?? null,
          tong_thanh_toan: appointment.invoice.tong_thanh_toan ?? null,
        }
      : null,
    ngay_cap_nhat: appointment.ngay_cap_nhat,
  }
}

async function getScheduleAndSlot(scheduleId, slotId, session) {
  const schedule = await LichLamViec.findOne({
    _id: scheduleId,
    'slots._id': slotId,
  }).session(session)

  if (!schedule) {
    throw new Error('Khong tim thay lich lam viec hoac khung gio nay')
  }

  const slot = schedule.slots.id(slotId)
  if (!slot) {
    throw new Error('Khong tim thay khung gio da chon')
  }

  return { schedule, slot }
}

async function getDoctorOrThrow(doctorId, session) {
  const doctor = await BacSi.findById(doctorId).session(session)
  if (!doctor) {
    throw new Error('Khong tim thay bac si')
  }
  if (doctor.trang_thai_duyet !== 'approved' || !doctor.la_hien) {
    throw new Error('Bac si nay hien khong nhan lich')
  }
  return doctor
}

async function getServiceOrThrow(serviceId, loaiKham, session) {
  const service = await DichVu.findById(serviceId).session(session)
  if (!service) {
    throw new Error('Khong tim thay dich vu')
  }
  if (service.status !== 'active') {
    throw new Error('Dich vu nay hien khong hoat dong')
  }
  if (service.loai !== loaiKham) {
    throw new Error('Loai kham khong khop voi dich vu da chon')
  }
  return service
}

function doctorSupportsService(doctor, serviceId) {
  return doctor.services.some((item) => String(item) === String(serviceId))
}

function formatDatePart(date) {
  const year = String(date.getUTCFullYear()).slice(-2)
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

async function nextCounterCode(session, keyPrefix, codePrefix, date) {
  const datePart = formatDatePart(date)
  const counter = await mongoose.connection.collection('counters').findOneAndUpdate(
    { key: `${keyPrefix}_${datePart}` },
    {
      $inc: { seq: 1 },
      $setOnInsert: { key: `${keyPrefix}_${datePart}` },
    },
    {
      upsert: true,
      returnDocument: 'after',
      session,
    }
  )

  const counterDocument = counter?.value ?? counter
  const sequence = String(counterDocument.seq).padStart(4, '0')
  return `${codePrefix}-${datePart}-${sequence}`
}

async function getAdminRefundPercent() {
  const setting = await CaiDatThanhToan.findOne({
    ten_cai_dat: { $in: ADMIN_REFUND_SETTING_KEYS },
  }).lean()

  if (!setting) {
    return 100
  }

  const percent = Number(setting.gia_tri)
  if (![0, 50, 80, 100].includes(percent)) {
    throw new Error('Cau hinh hoan tien cua Admin khong hop le')
  }

  return percent
}

async function findInvoiceAndPaymentsForAppointment(appointmentId, session) {
  const invoice = await HoaDon.findOne({ appointment_id: appointmentId }).session(session)

  if (!invoice) {
    return { invoice: null, payments: [] }
  }

  const payments = await ThanhToan.find({
    $or: [{ hoa_don_id: invoice._id }, { appointment_id: appointmentId }],
  }).session(session)

  return { invoice, payments }
}

async function syncRefundForCancelledAppointment({ appointment, lyDoHuy, adminUserId, session }) {
  const { invoice, payments } = await findInvoiceAndPaymentsForAppointment(appointment._id, session)

  if (appointment.payment_status !== 'paid') {
    for (const payment of payments) {
      if (payment.status === 'pending') {
        payment.status = 'failed'
        await payment.save({ session })
      }
    }

    return {
      oldPaymentStatus: appointment.payment_status,
      newPaymentStatus: appointment.payment_status,
    }
  }

  const paidPayments = payments.filter((payment) => payment.status === 'paid')
  if (paidPayments.length === 0) {
    throw new Error('Khong tim thay ban ghi thanh toan da thu cua lich hen')
  }

  const refundPercent = await getAdminRefundPercent()
  const totalPaid = paidPayments.reduce((sum, payment) => sum + Number(payment.so_tien || 0), 0)
  const refundAmount = Math.round((totalPaid * refundPercent) / 100)

  for (const payment of paidPayments) {
    payment.status = 'refunded'
    payment.ngay_hoan_tien = new Date()
    await payment.save({ session })
  }

  const existingRefund = await HoanTien.findOne({ appointment_id: appointment._id }).session(session)
  if (existingRefund) {
    existingRefund.payment_id = paidPayments[0]._id
    existingRefund.so_tien_hoan = refundAmount
    existingRefund.so_tien_da_thu = totalPaid
    existingRefund.phi_huy = 0
    existingRefund.chinh_sach_hoan = 'Hoan tien thu cong boi admin'
    existingRefund.phan_tram_hoan = refundPercent
    existingRefund.ly_do = lyDoHuy
    existingRefund.ly_do_hoan = lyDoHuy
    existingRefund.status = 'completed'
    existingRefund.xu_ly_boi = adminUserId
    existingRefund.nguoi_xu_ly_id = adminUserId
    existingRefund.ngay_xu_ly = new Date()
    existingRefund.thoi_diem_hoan_thanh = new Date()
    await existingRefund.save({ session })
  } else {
    await HoanTien.create([{
      payment_id: paidPayments[0]._id,
      appointment_id: appointment._id,
      so_tien_hoan: refundAmount,
      so_tien_da_thu: totalPaid,
      phi_huy: 0,
      chinh_sach_hoan: 'Hoan tien thu cong boi admin',
      phan_tram_hoan: refundPercent,
      ly_do: lyDoHuy,
      ly_do_hoan: lyDoHuy,
      status: 'completed',
      xu_ly_boi: adminUserId,
      nguoi_xu_ly_id: adminUserId,
      ngay_xu_ly: new Date(),
      thoi_diem_hoan_thanh: new Date(),
    }], { session })
  }

  if (invoice) {
    invoice.trang_thai_hoa_don = 'chua_thanh_toan'
    await invoice.save({ session })
  }

  const oldPaymentStatus = appointment.payment_status
  appointment.payment_status = 'refunded'

  return {
    oldPaymentStatus,
    newPaymentStatus: appointment.payment_status,
  }
}

async function loadAppointmentForResponse(id) {
  const appointment = await LichHen.findById(id)
    .populate({ path: 'user_id', select: 'ho_ten email so_dien_thoai' })
    .populate({
      path: 'member_id',
      select: 'ho_ten tai_khoan_id',
      populate: { path: 'tai_khoan_id', select: 'so_dien_thoai' },
    })
    .populate({
      path: 'doctor_id',
      populate: [
        { path: 'user_id', select: 'ho_ten' },
        { path: 'specialties', select: 'ten' },
      ],
    })
    .populate('service_id', 'ten')
    .populate('specialty_id', 'ten')
    .lean()

  if (!appointment) {
    return null
  }

  const invoice = await HoaDon.findOne({ appointment_id: appointment._id })
    .select('so_hoa_don trang_thai_hoa_don tong_thanh_toan')
    .lean()

  return {
    ...appointment,
    invoice,
  }
}

// GET /api/admin/appointments
// Lay danh sach lich hen voi filter
export async function getAllAppointments(req, res) {
  try {
    const pageNum = clampPositiveInt(req.query.page, 1, Number.MAX_SAFE_INTEGER)
    const limitNum = clampPositiveInt(req.query.limit, 20, APPOINTMENT_LIST_LIMIT_MAX)
    const skip = (pageNum - 1) * limitNum
    const query = await buildAppointmentQuery(req.query)
    const summaryBaseQuery = getSummaryBaseQuery(query)

    const [
      total,
      appointments,
      todayCount,
      pendingCount,
      confirmedCount,
      inProgressCount,
      completedCount,
      cancelledCount,
      unpaidCount,
      abnormalCount,
      proxyBookingCount,
    ] = await Promise.all([
      LichHen.countDocuments(query),
      LichHen.find(query)
        .populate({ path: 'user_id', select: 'ho_ten email so_dien_thoai' })
        .populate({
          path: 'member_id',
          select: 'ho_ten tai_khoan_id',
          populate: { path: 'tai_khoan_id', select: 'so_dien_thoai' },
        })
        .populate({
          path: 'doctor_id',
          populate: [
            { path: 'user_id', select: 'ho_ten' },
            { path: 'specialties', select: 'ten' },
          ],
        })
        .populate('service_id', 'ten')
        .populate('specialty_id', 'ten')
        .sort({ ngay_kham: 1, gio_kham: 1, ngay_tao: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      LichHen.countDocuments({
        ...summaryBaseQuery,
        ngay_kham: { $gte: toDateOnly(new Date()), $lte: endOfDateOnly(new Date()) },
      }),
      LichHen.countDocuments({ ...summaryBaseQuery, status: 'pending' }),
      LichHen.countDocuments({ ...summaryBaseQuery, status: 'confirmed' }),
      LichHen.countDocuments({ ...summaryBaseQuery, status: 'in_progress' }),
      LichHen.countDocuments({ ...summaryBaseQuery, status: 'completed' }),
      LichHen.countDocuments({ ...summaryBaseQuery, status: 'cancelled' }),
      LichHen.countDocuments({
        ...summaryBaseQuery,
        payment_status: { $in: ['unpaid', 'partial'] },
        status: { $ne: 'cancelled' },
      }),
      LichHen.countDocuments({
        ...summaryBaseQuery,
        $or: [
          { status: 'pending' },
          { payment_status: { $in: ['unpaid', 'partial'] }, status: { $ne: 'cancelled' } },
          { so_lan_thay_doi: { $gte: 2 } },
        ],
      }),
      LichHen.countDocuments({
        ...summaryBaseQuery,
        dat_ho: true,
      }),
    ])

    const totalPages = total === 0 ? 1 : Math.ceil(total / limitNum)

    return res.status(200).json({
      success: true,
      data: appointments.map(formatAppointmentItem),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
      summary: {
        today: todayCount,
        pending: pendingCount,
        confirmed: confirmedCount,
        in_progress: inProgressCount,
        completed: completedCount,
        cancelled: cancelledCount,
        unpaid: unpaidCount,
        need_attention: abnormalCount,
        proxy_booking: proxyBookingCount,
      },
    })
  } catch (err) {
    return fail(res, 400, err.message)
  }
}

// GET /api/admin/appointments/:id
export async function getAppointmentById(req, res) {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) {
      return fail(res, 400, 'ID lich hen khong hop le')
    }
    const appointment = await loadAppointmentForResponse(id)

    if (!appointment) return fail(res, 404, 'Khong tim thay lich hen')

    return ok(res, formatAppointmentItem(appointment))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// PATCH /api/admin/appointments/:id/cancel
export async function cancelAppointment(req, res) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) {
      await session.abortTransaction()
      session.endSession()
      return fail(res, 400, 'ID lich hen khong hop le')
    }

    const cancelReason = req.body.ly_do_huy?.trim()
    if (!cancelReason) {
      await session.abortTransaction()
      session.endSession()
      return fail(res, 400, 'Ly do huy la bat buoc')
    }

    const appointment = await LichHen.findById(id).session(session)

    if (!appointment) {
      await session.abortTransaction()
      session.endSession()
      return fail(res, 404, 'Khong tim thay lich hen')
    }

    if (appointment.status === 'cancelled' || appointment.status === 'completed') {
      await session.abortTransaction()
      session.endSession()
      return fail(res, 400, 'Khong the huy lich hen da hoan thanh hoac da huy')
    }

    if (req.body.updatedAt && new Date(req.body.updatedAt).getTime() !== new Date(appointment.ngay_cap_nhat).getTime()) {
      await session.abortTransaction()
      session.endSession()
      return fail(res, 409, 'Lịch hẹn đã bị thay đổi bởi người khác (Concurrency Conflict). Vui lòng tải lại trang.')
    }

    const oldStatus = appointment.status
    appointment.status = 'cancelled'
    appointment.ly_do_huy = cancelReason
    appointment.huy_boi = 'admin'
    appointment.nguoi_huy_id = req.user.id
    appointment.thoi_diem_huy = new Date()

    const { oldPaymentStatus, newPaymentStatus } = await syncRefundForCancelledAppointment({
      appointment,
      lyDoHuy: appointment.ly_do_huy,
      adminUserId: req.user.id,
      session,
    })

    await appointment.save({ session })

    await LichSuLichHen.create([{
      appointment_id: appointment._id,
      tu_trang_thai: oldStatus,
      den_trang_thai: 'cancelled',
      tu_payment_status: oldPaymentStatus,
      den_payment_status: newPaymentStatus,
      nguoi_thay_doi_id: req.user.id,
      kenh_thay_doi: 'admin',
      nguoi_thuc_hien_id: req.user.id,
      vai_tro: 'admin',
      ly_do: appointment.ly_do_huy,
    }], { session })

    if (appointment.schedule_id && appointment.slot_id) {
      const schedule = await LichLamViec.findById(appointment.schedule_id).session(session)
      const slot = schedule?.slots.id(appointment.slot_id)
      if (slot) {
        slot.status = 'active'
        slot.benh_nhan_id = null
        slot.benh_nhan_tam_giu_id = null
        await schedule.save({ session })
      }
    }

    await session.commitTransaction()
    session.endSession()

    const updated = await loadAppointmentForResponse(id)
    return ok(res, formatAppointmentItem(updated), 'Đã hủy lịch hẹn thành công')
  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    return fail(res, 500, err.message)
  }
}

// PATCH /api/admin/appointments/:id/restore
export async function restoreAppointment(req, res) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) {
      await session.abortTransaction()
      session.endSession()
      return fail(res, 400, 'ID lich hen khong hop le')
    }

    const appointment = await LichHen.findById(id).session(session)

    if (!appointment) {
      await session.abortTransaction()
      session.endSession()
      return fail(res, 404, 'Khong tim thay lich hen')
    }

    if (appointment.status !== 'cancelled') {
      await session.abortTransaction()
      session.endSession()
      return fail(res, 400, 'Chi co the khoi phuc lich hen da huy')
    }

    const schedule = appointment.schedule_id
      ? await LichLamViec.findById(appointment.schedule_id).session(session)
      : null
    const slot = schedule?.slots.id(appointment.slot_id)
    if (!schedule || !slot || slot.status !== 'active') {
      await session.abortTransaction()
      session.endSession()
      return fail(res, 409, 'Khong the khoi phuc vi slot cu khong con trong')
    }

    slot.status = 'booked'
    slot.benh_nhan_id = appointment.user_id ?? null
    slot.benh_nhan_tam_giu_id = null
    await schedule.save({ session })

    appointment.status = 'pending'
    appointment.ly_do_huy = null
    appointment.huy_boi = null
    appointment.nguoi_huy_id = null
    appointment.thoi_diem_huy = null
    await appointment.save({ session })

    await LichSuLichHen.create([{
      appointment_id: appointment._id,
      tu_trang_thai: 'cancelled',
      den_trang_thai: 'pending',
      tu_payment_status: appointment.payment_status,
      den_payment_status: appointment.payment_status,
      nguoi_thay_doi_id: req.user.id,
      kenh_thay_doi: 'admin',
      nguoi_thuc_hien_id: req.user.id,
      vai_tro: 'admin',
      ly_do: 'Admin khoi phuc lich hen da huy',
    }], { session })

    await session.commitTransaction()
    session.endSession()

    return ok(res, null, 'Khoi phuc lich hen thanh cong')
  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    return fail(res, 500, err.message)
  }
}

// DELETE /api/admin/appointments/:id
export async function deleteAppointment(req, res) {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) {
      return fail(res, 400, 'ID lich hen khong hop le')
    }

    const appointment = await LichHen.findById(id)

    if (!appointment) return fail(res, 404, 'Khong tim thay lich hen')
    if (appointment.status !== 'cancelled') {
      return fail(res, 400, 'Chi duoc xoa cung lich hen da huy')
    }

    await LichHen.findByIdAndDelete(id)

    return ok(res, null, 'Xoa cung lich hen thanh cong')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// POST /api/admin/appointments
// Admin khong duoc tao lich hen moi do nghiep vu thanh toan thuoc user/le tan
export async function createAppointment(req, res) {
  return fail(
    res,
    403,
    'Admin khong duoc tao lich hen moi. Chi nguoi dung hoac le tan duoc dat lich do lien quan den thanh toan.'
  )
}

// PATCH /api/admin/appointments/:id/reschedule
export async function rescheduleAppointment(req, res) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const { id } = req.params
    const { doctor_id, schedule_id, slot_id, ly_do } = req.body
    const reason = ly_do?.trim()

    if (!isValidObjectId(id)) {
      throw new Error('ID lich hen khong hop le')
    }
    if (!doctor_id || !schedule_id || !slot_id) {
      throw new Error('Bac si, lich lam viec va khung gio moi la bat buoc')
    }
    if (!isValidObjectId(doctor_id) || !isValidObjectId(schedule_id) || !isValidObjectId(slot_id)) {
      throw new Error('Du lieu doi lich khong hop le')
    }
    if (!reason) {
      throw new Error('Ly do doi lich la bat buoc')
    }

    const appointment = await LichHen.findById(id).session(session)
    if (!appointment) {
      throw new Error('Khong tim thay lich hen')
    }

    if (appointment.status === 'cancelled' || appointment.status === 'completed') {
      throw new Error('Khong the doi lich hen da hoan thanh hoac da huy')
    }

    if (req.body.updatedAt && new Date(req.body.updatedAt).getTime() !== new Date(appointment.ngay_cap_nhat).getTime()) {
      throw new Error('Lich hen da bi thay doi boi nguoi khac (Concurrency Conflict). Vui long tai lai trang.')
    }

    if (
      String(appointment.doctor_id) === String(doctor_id) &&
      String(appointment.schedule_id) === String(schedule_id) &&
      String(appointment.slot_id) === String(slot_id)
    ) {
      throw new Error('Khung gio moi dang trung voi lich hien tai')
    }

    const doctor = await getDoctorOrThrow(doctor_id, session)
    if (appointment.service_id && !doctorSupportsService(doctor, appointment.service_id)) {
      throw new Error('Bac si moi khong ho tro dich vu cua lich hen nay')
    }

    const { schedule: newSchedule, slot: newSlot } = await getScheduleAndSlot(schedule_id, slot_id, session)
    if (String(newSchedule.doctor_id) !== String(doctor._id)) {
      throw new Error('Lich lam viec moi khong thuoc bac si da chon')
    }
    if (newSlot.status !== 'active') {
      throw new Error('Khung gio moi da bi khoa')
    }

    const nextDateTime = new Date(formatDateOnly(newSchedule.ngay) + 'T' + newSlot.gio_bat_dau + ':00')
    if (nextDateTime.getTime() <= Date.now()) {
      throw new Error('Khong the doi lich vao thoi diem trong qua khu')
    }

    const oldDoctorId = appointment.doctor_id
    const oldScheduleId = appointment.schedule_id
    const oldSlotId = appointment.slot_id
    const oldSpecialtyId = appointment.specialty_id
    const oldNgayKham = appointment.ngay_kham
    const oldGioKham = appointment.gio_kham

    const oldSchedule = await LichLamViec.findById(appointment.schedule_id).session(session)
    const oldSlot = oldSchedule?.slots.id(appointment.slot_id)
    if (oldSlot) {
      oldSlot.status = 'active'
      oldSlot.benh_nhan_id = null
      oldSlot.benh_nhan_tam_giu_id = null
      await oldSchedule.save({ session })
    }

    newSlot.status = 'booked'
    newSlot.benh_nhan_id = appointment.user_id ?? null
    newSlot.benh_nhan_tam_giu_id = null
    await newSchedule.save({ session })

    appointment.doctor_id = doctor._id
    appointment.schedule_id = newSchedule._id
    appointment.slot_id = newSlot._id
    appointment.chi_nhanh_id = newSchedule.chi_nhanh_id ?? doctor.chi_nhanh_id ?? appointment.chi_nhanh_id
    appointment.specialty_id = newSlot.specialty_id ?? doctor.specialties?.[0] ?? appointment.specialty_id
    appointment.ngay_kham = toDateOnly(newSchedule.ngay)
    appointment.gio_kham = newSlot.gio_bat_dau
    appointment.so_lan_thay_doi = (appointment.so_lan_thay_doi ?? 0) + 1
    await appointment.save({ session })

    await LichSuLichHen.create([{
      appointment_id: appointment._id,
      tu_trang_thai: appointment.status,
      den_trang_thai: appointment.status,
      tu_payment_status: appointment.payment_status,
      den_payment_status: appointment.payment_status,
      bac_si_cu_id: oldDoctorId,
      bac_si_moi_id: doctor._id,
      specialty_cu_id: oldSpecialtyId,
      specialty_moi_id: appointment.specialty_id,
      schedule_cu_id: oldScheduleId,
      schedule_moi_id: newSchedule._id,
      slot_cu_id: oldSlotId,
      slot_moi_id: newSlot._id,
      ngay_kham_cu: oldNgayKham,
      ngay_kham_moi: appointment.ngay_kham,
      gio_kham_cu: oldGioKham,
      gio_kham_moi: appointment.gio_kham,
      nguoi_thay_doi_id: req.user.id,
      kenh_thay_doi: 'admin',
      nguoi_thuc_hien_id: req.user.id,
      vai_tro: 'admin',
      ly_do: reason,
      ly_do_thay_doi: reason,
      loai_thay_doi: 'reschedule',
    }], { session })

    await session.commitTransaction()
    session.endSession()

    const updatedAppointmentPayload = await loadAppointmentForResponse(appointment._id)
    return ok(res, formatAppointmentItem(updatedAppointmentPayload), 'Da doi lich thanh cong')
  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    return fail(res, 400, err.message)
  }
}

// GET /api/admin/doctors/active
// Lay danh sach bac si (dung cho Dropdown)
export async function getActiveDoctors(req, res) {
  try {
    const doctors = await BacSi.find({ la_hien: true, trang_thai_duyet: 'approved' })
      .populate('user_id', 'ho_ten email so_dien_thoai')
      .populate('specialties', 'ten')
      .lean()

    const formatted = doctors.map((doctor) => ({
      _id: doctor._id,
      ten: doctor.user_id?.ho_ten,
      chuyen_khoa: doctor.specialties?.map((specialty) => specialty.ten).join(', ') || 'Chua ro',
      service_ids: doctor.services?.map((serviceId) => String(serviceId)) || [],
      phi_kham: doctor.phi_kham ?? doctor.gia_kham ?? 0,
    }))

    return ok(res, formatted)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// GET /api/admin/appointments/services/active?loai=clinic|home
export async function getActiveServices(req, res) {
  try {
    const { loai } = req.query
    const filter = { status: 'active' }
    if (loai) filter.loai = loai

    const services = await DichVu.find(filter)
      .sort({ ten: 1 })
      .lean()

    const formatted = services.map((service) => ({
      _id: service._id,
      ten: service.ten,
      loai: service.loai,
      gia: service.gia,
    }))

    return ok(res, formatted)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// GET /api/admin/doctors/:id/schedules
// Lay lich lam viec cua bac si (tu hom nay tro di, slot chua qua gio)
export async function getDoctorSchedules(req, res) {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) {
      return fail(res, 400, 'ID bac si khong hop le')
    }

    const now = new Date()
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)

    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const currentTimeStr = hh + ':' + mm
    const todayStr = formatDateOnly(today)

    const schedules = await LichLamViec.find({
      doctor_id: id,
      ngay: { $gte: today },
    }).sort({ ngay: 1 }).lean()

    const formatted = schedules
      .map((schedule) => {
        const scheduleDate = formatDateOnly(schedule.ngay)
        const isToday = scheduleDate === todayStr

        return {
          _id: schedule._id,
          ngay: scheduleDate,
          slots: schedule.slots.filter((slot) => {
            if (slot.status !== 'active') return false
            if (isToday && slot.gio_bat_dau <= currentTimeStr) return false
            return true
          }),
        }
      })
      .filter((schedule) => schedule.slots.length > 0)

    return ok(res, formatted)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// GET /api/admin/appointments/:id/history
// Xem lich su thay doi cua 1 lich hen
export async function getAppointmentHistory(req, res) {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) {
      return fail(res, 400, 'ID lich hen khong hop le')
    }

    const history = await LichSuLichHen.find({ appointment_id: id })
      .populate('nguoi_thuc_hien_id', 'ho_ten email')
      .sort({ thoi_diem: -1, thoi_diem_thay_doi: -1 })
      .lean()

    const formatted = history.map((item) => ({
      _id: item._id,
      tu_trang_thai: item.tu_trang_thai,
      den_trang_thai: item.den_trang_thai,
      tu_payment_status: item.tu_payment_status,
      den_payment_status: item.den_payment_status,
      vai_tro: item.vai_tro,
      loai_thay_doi: item.loai_thay_doi ?? null,
      ly_do_thay_doi: item.ly_do_thay_doi ?? null,
      nguoi_thuc_hien: item.nguoi_thuc_hien_id ? item.nguoi_thuc_hien_id.ho_ten : (item.vai_tro === 'system' ? 'He thong' : 'Khach'),
      nguoi_thuc_hien_email: item.nguoi_thuc_hien_id ? item.nguoi_thuc_hien_id.email : '',
      ly_do: item.ly_do,
      thoi_diem: item.thoi_diem,
      ngay_kham_cu: item.ngay_kham_cu ? formatDateOnly(item.ngay_kham_cu) : null,
      ngay_kham_moi: item.ngay_kham_moi ? formatDateOnly(item.ngay_kham_moi) : null,
      gio_kham_cu: item.gio_kham_cu ?? null,
      gio_kham_moi: item.gio_kham_moi ?? null,
    }))

    return ok(res, formatted)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
