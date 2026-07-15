import mongoose from 'mongoose'

import { ThanhToan, LichHen, HoanTien, HoaDon } from '../../models/index.js'
import {
  finalizePendingPayment,
  withOptionalTransaction,
} from '../../services/bookingPaymentState.service.js'
import { tinhTrangThaiHoaDon } from '../../services/hoaDon.service.js'
import { ok, fail } from '../../utils/response.js'

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value)
}

async function validateInvoiceOrThrow(hoaDonId) {
  if (!isValidObjectId(hoaDonId)) {
    throw new Error('hoa_don_id khong hop le')
  }

  const invoice = await HoaDon.findById(hoaDonId).select('_id')
  if (!invoice) {
    throw new Error('Khong tim thay hoa don')
  }

  return invoice
}

function mapPaymentDetail(payment) {
  return {
    id: payment._id,
    hoa_don_id: payment.hoa_don_id?._id ?? payment.hoa_don_id ?? null,
    appointment_id: payment.appointment_id?._id ?? payment.appointment_id ?? null,
    ma_giao_dich: payment.ma_giao_dich,
    benh_nhan: payment.benh_nhan_id?.ho_ten,
    email: payment.benh_nhan_id?.email,
    so_dien_thoai: payment.benh_nhan_id?.so_dien_thoai,
    bac_si: payment.appointment_id?.doctor_id?.user_id?.ho_ten,
    so_tien: payment.so_tien,
    loai_thanh_toan: payment.loai_thanh_toan,
    phuong_thuc: payment.phuong_thuc,
    nguoi_thu_id: payment.nguoi_thu_id ?? null,
    thoi_diem_thanh_toan: payment.thoi_diem_thanh_toan,
    status: payment.status,
    ngay_thanh_toan: payment.ngay_thanh_toan,
    ngay_tao: payment.ngay_tao,
  }
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
    const filter = {}
    if (status) filter.status = status
    if (from || to) {
      filter.ngay_tao = {}
      if (from) filter.ngay_tao.$gte = new Date(from)
      if (to) filter.ngay_tao.$lte = new Date(to)
    }
    if (search) {
      filter.$or = [
        { ma_giao_dich: { $regex: search, $options: 'i' } },
      ]
    }

    const payments = await ThanhToan.find(filter)
      .populate('benh_nhan_id', 'ho_ten')
      .populate('hoa_don_id', 'so_hoa_don trang_thai_hoa_don')
      .populate({
        path: 'appointment_id',
        populate: { path: 'doctor_id', populate: { path: 'user_id', select: 'ho_ten' } },
      })
      .sort({ ngay_tao: -1 })
      .lean()

    const result = payments.map((p) => ({
      id: p._id,
      hoa_don_id: p.hoa_don_id?._id ?? p.hoa_don_id ?? null,
      so_hoa_don: p.hoa_don_id?.so_hoa_don ?? null,
      ma_giao_dich: p.ma_giao_dich,
      benh_nhan: p.benh_nhan_id?.ho_ten ?? 'Khong ro',
      bac_si: p.appointment_id?.doctor_id?.user_id?.ho_ten ?? 'Khong ro',
      so_tien: p.so_tien,
      loai_thanh_toan: p.loai_thanh_toan,
      phuong_thuc: p.phuong_thuc,
      status: p.status,
      thoi_diem_thanh_toan: p.thoi_diem_thanh_toan,
      ngay_tao: p.ngay_tao,
    }))
    return ok(res, result)
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

    await validateInvoiceOrThrow(hoa_don_id)

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
      .populate('hoa_don_id', 'so_hoa_don trang_thai_hoa_don')
      .populate({
        path: 'appointment_id',
        populate: { path: 'doctor_id', populate: { path: 'user_id', select: 'ho_ten' } },
      })
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

    return ok(res, {
      ...mapPaymentDetail(freshPayment.toObject()),
      hoa_don_trang_thai: invoiceState?.trang_thai_hoa_don ?? null,
    }, 'Cap nhat thanh toan thanh cong')
  } catch (err) {
    return fail(res, 400, err.message)
  }
}

// ─── PATCH /api/admin/payments/:id/refund ───────────────────────────────────
export async function refund(req, res) {
  try {
    const { ly_do } = req.body
    const payment = await ThanhToan.findById(req.params.id)
    if (!payment) return fail(res, 404, 'Khong tim thay giao dich')
    if (payment.status !== 'paid') {
      return fail(res, 409, 'Chi hoan tien giao dich da thanh toan')
    }

    payment.status = 'refunded'
    await payment.save()
    if (payment.hoa_don_id) {
      await tinhTrangThaiHoaDon(payment.hoa_don_id)
    }

    await syncAppointmentPaymentStatusFromPayment(payment, { trang_thai_hoa_don: 'chua_thanh_toan' })

    try {
      await HoanTien.create({
        payment_id: payment._id,
        appointment_id: payment.appointment_id,
        so_tien_hoan: payment.so_tien,
        so_tien_da_thu: payment.so_tien,
        phi_huy: 0,
        chinh_sach_hoan: 'Hoan tien thu cong boi admin',
        phan_tram_hoan: 100,
        ly_do: ly_do?.trim() || 'Admin hoan tien',
        ly_do_hoan: ly_do?.trim() || 'Admin hoan tien',
        nguoi_xu_ly_id: req.user.id,
        phuong_thuc_hoan: payment.phuong_thuc,
        ngay_xu_ly: new Date(),
        thoi_diem_hoan_thanh: new Date(),
        status: 'completed',
      })
    } catch (_) {
      // Khong chan luong chinh
    }

    return ok(res, { id: payment._id, status: payment.status }, 'Da hoan tien thanh cong')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
