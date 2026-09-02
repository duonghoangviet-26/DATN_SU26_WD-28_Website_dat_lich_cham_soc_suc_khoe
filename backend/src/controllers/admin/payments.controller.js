import mongoose from 'mongoose'

import { ThanhToan, LichHen, HoaDon } from '../../models/index.js'
import {
  finalizePendingPayment,
  withOptionalTransaction,
} from '../../services/bookingPaymentState.service.js'
import { tinhTrangThaiHoaDon } from '../../services/hoaDon.service.js'
import { ok, fail } from '../../utils/response.js'
import {
  emitAdminRealtime,
  emitDashboardAppointmentChanged,
  emitDashboardRevenueChanged,
} from '../../realtime/socket.js'

const PAYMENT_LIST_LIMIT_MAX = 100
const CLINIC_TIME_OFFSET_MS = 7 * 60 * 60 * 1000
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded']
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value)
}

function clampPositiveInt(value, fallback, max) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return Math.min(parsed, max)
}

function parseClinicDateOnly(value) {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const normalized = new Date(Date.UTC(year, month - 1, day))
  if (
    normalized.getUTCFullYear() !== year
    || normalized.getUTCMonth() !== month - 1
    || normalized.getUTCDate() !== day
  ) {
    return null
  }
  return new Date(normalized.getTime() - CLINIC_TIME_OFFSET_MS)
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getPopulatedObject(value) {
  return value && typeof value === 'object' && !mongoose.Types.ObjectId.isValid(value)
    ? value
    : null
}

function resolvePaymentPayerAndPatient(payment) {
  const directPatient = getPopulatedObject(payment.benh_nhan_id)
  const invoice = getPopulatedObject(payment.hoa_don_id)
  const appointment = getPopulatedObject(payment.appointment_id) ?? getPopulatedObject(invoice?.appointment_id)
  const appointmentUser = getPopulatedObject(appointment?.user_id)
  const queue = getPopulatedObject(invoice?.hang_doi_id)
  const profile =
    getPopulatedObject(payment.ho_so_benh_nhan_id)
    ?? getPopulatedObject(invoice?.ho_so_benh_nhan_id)
    ?? getPopulatedObject(appointment?.ho_so_benh_nhan_id)
    ?? getPopulatedObject(queue?.ho_so_benh_nhan_id)

  const patientName = profile?.ho_ten ?? queue?.ten_benh_nhan ?? appointment?.ten_khach ?? appointmentUser?.ho_ten ?? directPatient?.ho_ten ?? null
  const patientPhone = profile?.so_dien_thoai ?? queue?.so_dien_thoai ?? appointment?.so_dien_thoai_khach ?? appointmentUser?.so_dien_thoai ?? directPatient?.so_dien_thoai ?? null

  const payerName = appointmentUser?.ho_ten ?? directPatient?.ho_ten ?? patientName
  const payerPhone = appointmentUser?.so_dien_thoai ?? appointment?.nguoi_dat_sdt ?? directPatient?.so_dien_thoai ?? patientPhone
  const payerEmail = appointmentUser?.email ?? appointment?.email_khach ?? directPatient?.email ?? null

  return {
    patient: {
      ho_ten: patientName,
      so_dien_thoai: patientPhone,
    },
    payer: {
      ho_ten: payerName,
      so_dien_thoai: payerPhone,
      email: payerEmail,
    }
  }
}

function resolvePaymentDoctor(payment) {
  const invoice = getPopulatedObject(payment.hoa_don_id)
  const appointment = getPopulatedObject(payment.appointment_id) ?? getPopulatedObject(invoice?.appointment_id)
  const queue = getPopulatedObject(invoice?.hang_doi_id)

  return appointment?.doctor_id?.user_id?.ho_ten
    ?? queue?.doctor_id?.user_id?.ho_ten
    ?? null
}

function resolvePaymentAppointmentId(payment) {
  const invoice = getPopulatedObject(payment.hoa_don_id)
  const invoiceAppointment = getPopulatedObject(invoice?.appointment_id)
  const queue = getPopulatedObject(payment.hang_doi_id) ?? getPopulatedObject(invoice?.hang_doi_id)

  return payment.appointment_id?._id
    ?? payment.appointment_id
    ?? invoiceAppointment?._id
    ?? invoice?.appointment_id
    ?? queue?.appointment_id
    ?? null
}

async function validateInvoiceOrThrow(hoaDonId) {
  if (!isValidObjectId(hoaDonId)) {
    throw new Error('hoa_don_id khong hop le')
  }

  const invoice = await HoaDon.findById(hoaDonId).select('_id appointment_id')
  if (!invoice) {
    throw new Error('Khong tim thay hoa don')
  }

  return invoice
}

function mapPaymentDetail(payment) {
  const resolved = resolvePaymentPayerAndPatient(payment)
  const invoice = getPopulatedObject(payment.hoa_don_id)
  const appointment = getPopulatedObject(payment.appointment_id) ?? getPopulatedObject(invoice?.appointment_id)
  const queue = getPopulatedObject(invoice?.hang_doi_id)
  const isTaiKham = appointment?.loai_lich_hen === 'tai_kham' ||
    !!appointment?.lich_hen_goc_id ||
    queue?.loai_lich_hen === 'tai_kham' ||
    !!queue?.lich_hen_goc_id

  return {
    id: payment._id,
    hoa_don_id: payment.hoa_don_id?._id ?? payment.hoa_don_id ?? null,
    appointment_id: resolvePaymentAppointmentId(payment),
    loai_lich_hen: appointment?.loai_lich_hen ?? queue?.loai_lich_hen ?? (isTaiKham ? 'tai_kham' : 'kham_moi'),
    is_tai_kham: isTaiKham,
    ma_giao_dich: payment.ma_giao_dich,
    benh_nhan: resolved.patient.ho_ten,
    so_dien_thoai_benh_nhan: resolved.patient.so_dien_thoai,
    nguoi_thanh_toan: resolved.payer.ho_ten,
    email: resolved.payer.email,
    so_dien_thoai: resolved.payer.so_dien_thoai,
    bac_si: resolvePaymentDoctor(payment),
    so_tien: payment.so_tien,
    loai_thanh_toan: payment.loai_thanh_toan,
    phuong_thuc: payment.phuong_thuc,
    nguoi_thu_id: payment.nguoi_thu_id ?? null,
    thoi_diem_thanh_toan: payment.thoi_diem_thanh_toan,
    status: payment.status,
    ngay_thanh_toan: payment.ngay_thanh_toan,
    ngay_tao: payment.ngay_tao,
    trang_thai_hoa_don: payment.hoa_don_id?.trang_thai_hoa_don ?? null,
    chi_tiet_thu_phi: payment.hoa_don_id?.chi_tiet_thu_phi ?? [],
  }
}

const appointmentPopulate = {
  path: 'appointment_id',
  select: 'doctor_id user_id ten_khach so_dien_thoai_khach email_khach nguoi_dat_sdt ho_so_benh_nhan_id loai_lich_hen lich_hen_goc_id ly_do_kham',
  populate: [
    { path: 'doctor_id', populate: { path: 'user_id', select: 'ho_ten' } },
    { path: 'user_id', select: 'ho_ten email so_dien_thoai' },
    { path: 'ho_so_benh_nhan_id', select: 'ho_ten so_dien_thoai' },
  ],
}

const invoicePopulate = {
  path: 'hoa_don_id',
  select: 'so_hoa_don trang_thai_hoa_don appointment_id hang_doi_id ho_so_benh_nhan_id chi_tiet_thu_phi',
  populate: [
    {
      path: 'appointment_id',
      select: 'doctor_id user_id ten_khach so_dien_thoai_khach email_khach nguoi_dat_sdt ho_so_benh_nhan_id loai_lich_hen lich_hen_goc_id ly_do_kham',
      populate: [
        { path: 'doctor_id', populate: { path: 'user_id', select: 'ho_ten' } },
        { path: 'user_id', select: 'ho_ten email so_dien_thoai' },
        { path: 'ho_so_benh_nhan_id', select: 'ho_ten so_dien_thoai' },
      ],
    },
    {
      path: 'hang_doi_id',
      select: 'ten_benh_nhan so_dien_thoai doctor_id ho_so_benh_nhan_id loai_lich_hen lich_hen_goc_id',
      populate: [
        { path: 'doctor_id', populate: { path: 'user_id', select: 'ho_ten' } },
        { path: 'ho_so_benh_nhan_id', select: 'ho_ten so_dien_thoai' },
      ],
    },
    { path: 'ho_so_benh_nhan_id', select: 'ho_ten so_dien_thoai' },
  ],
}

async function syncAppointmentPaymentStatusFromPayment(payment, invoiceState = null) {
  let appointmentId = payment.appointment_id ?? null

  if (!appointmentId && payment.hoa_don_id) {
    const invoice = await HoaDon.findById(payment.hoa_don_id).select('appointment_id').lean()
    appointmentId = invoice?.appointment_id ?? null
  }

  if (!appointmentId) {
    return
  }

  // Cho phép tất cả các loại thanh toán (bao gồm cả hóa đơn sau khám)
  // cập nhật trạng thái thanh toán của lịch hẹn để đồng bộ.

  let nextPaymentStatus = 'unpaid'
  if (payment.status === 'refunded') {
    nextPaymentStatus = 'refunded'
  } else if (invoiceState?.trang_thai_hoa_don === 'da_thanh_toan_du' || payment.status === 'paid') {
    nextPaymentStatus = 'paid'
  } else if (invoiceState?.trang_thai_hoa_don === 'da_dat_coc') {
    nextPaymentStatus = 'partial'
  }

  const update = { payment_status: nextPaymentStatus }
  if (nextPaymentStatus === 'paid') {
    update.thoi_diem_thanh_toan = payment.ngay_thanh_toan || payment.thoi_diem_thanh_toan || new Date()
  }

  await LichHen.findByIdAndUpdate(appointmentId, update)
}

// ============================================================
// C8 — Quản lý thanh toán (Admin)
// Routes: /api/admin/payments
// ============================================================

// ─── GET /api/admin/payments?status=&search=&from=&to= ──────────────────────
export async function list(req, res) {
  try {
    const { status, search, from, to } = req.query
    const pageNum = clampPositiveInt(req.query.page, 1, Number.MAX_SAFE_INTEGER)
    const limitNum = clampPositiveInt(req.query.limit, 20, PAYMENT_LIST_LIMIT_MAX)
    const skip = (pageNum - 1) * limitNum
    const filter = {}
    if (status && !PAYMENT_STATUSES.includes(status)) {
      return fail(res, 400, 'status khong hop le')
    }
    if (status) filter.status = status
    if (from || to) {
      const fromDate = from ? parseClinicDateOnly(from) : null
      const toDate = to ? parseClinicDateOnly(to) : null
      if ((from && !fromDate) || (to && !toDate)) {
        return fail(res, 400, 'from va to phai co dinh dang YYYY-MM-DD hop le')
      }
      if (fromDate && toDate && fromDate > toDate) {
        return fail(res, 400, 'Khoang ngay khong hop le')
      }
      filter.ngay_tao = {}
      if (fromDate) filter.ngay_tao.$gte = fromDate
      if (toDate) filter.ngay_tao.$lt = new Date(toDate.getTime() + 24 * 60 * 60 * 1000)
    }
    if (search?.trim()) {
      filter.$or = [
        { ma_giao_dich: { $regex: escapeRegex(search.trim()), $options: 'i' } },
      ]
    }

    const [total, payments, summaryRows] = await Promise.all([
      ThanhToan.countDocuments(filter),
      ThanhToan.find(filter)
        .populate('benh_nhan_id', 'ho_ten email so_dien_thoai')
        .populate('ho_so_benh_nhan_id', 'ho_ten so_dien_thoai')
        .populate(invoicePopulate)
        .populate(appointmentPopulate)
        .sort({ ngay_tao: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ThanhToan.aggregate([
        {
          $match: (() => {
            const summaryFilter = { ...filter }
            delete summaryFilter.status
            return summaryFilter
          })(),
        },
        {
          $group: {
            _id: null,
            paidAmount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$so_tien', 0] } },
            pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          },
        },
      ]),
    ])

    const result = payments.map((p) => {
      const resolved = resolvePaymentPayerAndPatient(p)

      return {
        id: p._id,
        hoa_don_id: p.hoa_don_id?._id ?? p.hoa_don_id ?? null,
        so_hoa_don: p.hoa_don_id?.so_hoa_don ?? null,
        ma_giao_dich: p.ma_giao_dich,
        benh_nhan: resolved.patient.ho_ten ?? 'Không rõ',
        so_dien_thoai_benh_nhan: resolved.patient.so_dien_thoai,
        nguoi_thanh_toan: resolved.payer.ho_ten ?? 'Không rõ',
        email: resolved.payer.email,
        so_dien_thoai: resolved.payer.so_dien_thoai,
        so_tien: p.so_tien,
        loai_thanh_toan: p.loai_thanh_toan,
        phuong_thuc: p.phuong_thuc,
        status: p.status,
        thoi_diem_thanh_toan: p.thoi_diem_thanh_toan,
        ngay_tao: p.ngay_tao,
        bac_si: resolvePaymentDoctor(p) ?? 'Không rõ',
        appointment_id: resolvePaymentAppointmentId(p),
        trang_thai_hoa_don: p.hoa_don_id?.trang_thai_hoa_don ?? null,
        chi_tiet_thu_phi: p.hoa_don_id?.chi_tiet_thu_phi ?? [],
      }
    })
    return res.status(200).json({
      success: true,
      message: 'Thành công',
      data: result,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: total === 0 ? 1 : Math.ceil(total / limitNum),
      },
      summary: {
        paidAmount: Number(summaryRows[0]?.paidAmount ?? 0),
        pendingCount: Number(summaryRows[0]?.pendingCount ?? 0),
      },
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── POST /api/admin/payments ────────────────────────────────────────────────
export async function create(req, res) {
  try {
    if (Object.prototype.hasOwnProperty.call(req.body, 'appointment_id')) {
      return fail(res, 400, 'Khong duoc tao thanh toan moi bang appointment_id')
    }

    const {
      hoa_don_id,
      loai_thanh_toan,
      phuong_thuc,
      so_tien,
      nguoi_thu_id,
      thoi_diem_thanh_toan,
      status,
      benh_nhan_id,
    } = req.body

    if (!hoa_don_id || !loai_thanh_toan || !phuong_thuc || so_tien == null || !nguoi_thu_id || !thoi_diem_thanh_toan || !status) {
      return fail(res, 400, 'Thieu truong bat buoc khi tao thanh toan')
    }

    const invoice = await validateInvoiceOrThrow(hoa_don_id)
    const previousAppointmentStatus = invoice.appointment_id
      ? (await LichHen.findById(invoice.appointment_id).select('status').lean())?.status ?? null
      : null

    if (!isValidObjectId(nguoi_thu_id)) {
      return fail(res, 400, 'nguoi_thu_id khong hop le')
    }

    if (benh_nhan_id && !isValidObjectId(benh_nhan_id)) {
      return fail(res, 400, 'benh_nhan_id khong hop le')
    }

    const payment = await ThanhToan.create({
      hoa_don_id,
      benh_nhan_id: benh_nhan_id || null,
      so_tien,
      loai_thanh_toan,
      phuong_thuc,
      nguoi_thu_id,
      thoi_diem_thanh_toan: new Date(thoi_diem_thanh_toan),
      status,
      ngay_thanh_toan: status === 'paid' ? new Date(thoi_diem_thanh_toan) : null,
    })

    const invoiceState = await tinhTrangThaiHoaDon(hoa_don_id)
    await syncAppointmentPaymentStatusFromPayment(payment, invoiceState)
    if (payment.status === 'paid') {
      emitDashboardRevenueChanged({
        ngay: payment.ngay_thanh_toan ?? payment.thoi_diem_thanh_toan,
        so_tien: payment.so_tien,
        loai: 'thanh_toan',
      })
    }
    if (invoice.appointment_id && previousAppointmentStatus) {
      const nextAppointmentStatus = (await LichHen.findById(invoice.appointment_id).select('status').lean())?.status ?? null
      emitDashboardAppointmentChanged(previousAppointmentStatus, nextAppointmentStatus)
    }

    return res.status(201).json({
      success: true,
      data: {
        ...mapPaymentDetail(payment.toObject()),
        hoa_don_trang_thai: invoiceState.trang_thai_hoa_don,
      },
    })
  } catch (err) {
    return fail(res, 400, err.message)
  }
}

// ─── GET /api/admin/payments/:id ────────────────────────────────────────────
export async function getById(req, res) {
  try {
    const p = await ThanhToan.findById(req.params.id)
      .populate('benh_nhan_id', 'ho_ten email so_dien_thoai')
      .populate('ho_so_benh_nhan_id', 'ho_ten so_dien_thoai')
      .populate(invoicePopulate)
      .populate(appointmentPopulate)
      .lean()
    if (!p) return fail(res, 404, 'Khong tim thay giao dich')

    return ok(res, {
      ...mapPaymentDetail(p),
      so_hoa_don: p.hoa_don_id?.so_hoa_don ?? null,
      trang_thai_hoa_don: p.hoa_don_id?.trang_thai_hoa_don ?? null,
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/admin/payments/:id ──────────────────────────────────────────
export async function update(req, res) {
  try {
    if (Object.prototype.hasOwnProperty.call(req.body, 'appointment_id')) {
      return fail(res, 400, 'Khong duoc cap nhat appointment_id cho thanh toan moi')
    }

    const payment = await ThanhToan.findById(req.params.id)
    if (!payment) return fail(res, 404, 'Khong tim thay giao dich')
    const previousHoaDonId = payment.hoa_don_id ? payment.hoa_don_id.toString() : null
    const previousStatus = payment.status
    let relatedAppointmentId = payment.appointment_id ?? null
    if (!relatedAppointmentId && payment.hoa_don_id) {
      relatedAppointmentId = (await HoaDon.findById(payment.hoa_don_id).select('appointment_id').lean())?.appointment_id ?? null
    }
    const previousAppointmentStatus = relatedAppointmentId
      ? (await LichHen.findById(relatedAppointmentId).select('status').lean())?.status ?? null
      : null
    let shouldFinalizePayment = false

    const allowedFields = [
      'hoa_don_id',
      'loai_thanh_toan',
      'phuong_thuc',
      'so_tien',
      'nguoi_thu_id',
      'thoi_diem_thanh_toan',
      'status',
      'benh_nhan_id',
    ]

    for (const field of allowedFields) {
      if (!Object.prototype.hasOwnProperty.call(req.body, field)) continue

      const value = req.body[field]
      if (field === 'hoa_don_id') {
        await validateInvoiceOrThrow(value)
        payment.hoa_don_id = value
        continue
      }

      if (['nguoi_thu_id', 'benh_nhan_id'].includes(field) && value && !isValidObjectId(value)) {
        return fail(res, 400, `${field} khong hop le`)
      }

      if (field === 'thoi_diem_thanh_toan') {
        payment.thoi_diem_thanh_toan = new Date(value)
        continue
      }

      if (field === 'status' && value === 'paid' && previousStatus === 'pending') {
        shouldFinalizePayment = true
        continue
      }

      payment[field] = value
    }

    let invoiceState = null

    if (shouldFinalizePayment) {
      if (!payment.thoi_diem_thanh_toan) {
        payment.thoi_diem_thanh_toan = new Date()
      }
      await payment.save()

      const appointmentId = payment.appointment_id
        ?? (payment.hoa_don_id
          ? (await HoaDon.findById(payment.hoa_don_id).select('appointment_id').lean())?.appointment_id
          : null)

      if (!appointmentId) {
        payment.status = 'paid'
        payment.ngay_thanh_toan = payment.thoi_diem_thanh_toan
        await payment.save()
      } else {
        const result = await withOptionalTransaction((session) =>
          finalizePendingPayment({
            paymentId: payment._id,
            appointment: appointmentId,
            actorUserId: req.user.id,
            actorRole: 'admin',
            channel: 'admin_payment_update',
            reason: 'Admin xac nhan thanh toan',
            providerData: {
              provider: 'admin',
              mode: 'manual',
              confirmed_by: 'admin',
            },
            session,
          })
        )
        invoiceState = result.invoiceState
      }
    } else {
      payment.ngay_thanh_toan = payment.status === 'paid' ? payment.thoi_diem_thanh_toan : null
      await payment.save()
    }

    if (previousHoaDonId && previousHoaDonId !== payment.hoa_don_id?.toString()) {
      await tinhTrangThaiHoaDon(previousHoaDonId)
    }

    if (!invoiceState) {
      invoiceState = payment.hoa_don_id
        ? await tinhTrangThaiHoaDon(payment.hoa_don_id)
        : null
    }
    if (!shouldFinalizePayment || !payment.appointment_id) {
      await syncAppointmentPaymentStatusFromPayment(payment, invoiceState)
    }

    const freshPayment = await ThanhToan.findById(payment._id)
    emitAdminRealtime('admin:payment_updated', {
      payment_id: payment._id,
      appointment_id: payment.appointment_id ?? null,
      status: freshPayment?.status ?? payment.status,
      source: 'admin_payment_update',
    })
    if (payment.appointment_id) {
      emitAdminRealtime('admin:appointment_updated', {
        appointment_id: payment.appointment_id,
        source: 'admin_payment_update',
      })
    }
    if (previousStatus !== 'paid' && freshPayment?.status === 'paid') {
      emitDashboardRevenueChanged({
        ngay: freshPayment.ngay_thanh_toan ?? freshPayment.thoi_diem_thanh_toan,
        so_tien: freshPayment.so_tien,
        loai: 'thanh_toan',
      })
    }
    if (relatedAppointmentId && previousAppointmentStatus) {
      const nextAppointmentStatus = (await LichHen.findById(relatedAppointmentId).select('status').lean())?.status ?? null
      emitDashboardAppointmentChanged(previousAppointmentStatus, nextAppointmentStatus)
    }

    return ok(res, {
      ...mapPaymentDetail(freshPayment.toObject()),
      hoa_don_trang_thai: invoiceState?.trang_thai_hoa_don ?? null,
    }, 'Cap nhat thanh toan thanh cong')
  } catch (err) {
    return fail(res, 400, err.message)
  }
}

