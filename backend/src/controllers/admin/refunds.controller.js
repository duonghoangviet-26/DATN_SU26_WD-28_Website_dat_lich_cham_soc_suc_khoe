import mongoose from 'mongoose'

import { HoanTien, ThanhToan } from '../../models/index.js'
import { ok, created, fail } from '../../utils/response.js'

function isValidObjectId(value) {
  return value && mongoose.Types.ObjectId.isValid(value)
}

function getAdminId(req) {
  return req.user?.id || req.user?._id || req.user?.sub
}

function toPlain(refund) {
  return typeof refund?.toObject === 'function' ? refund.toObject() : refund
}

function formatRefund(refund, { hideNguoiDuyet = false } = {}) {
  const data = toPlain(refund)
  if (!data) return null

  const formatted = {
    ...data,
    _id: data._id,
    payment_id: data.payment_id?._id ?? data.payment_id,
    appointment_id: data.appointment_id?._id ?? data.appointment_id,
    nguoi_xu_ly_id: data.nguoi_xu_ly_id ?? data.xu_ly_boi ?? null,
    phuong_thuc_hoan: data.phuong_thuc_hoan ?? null,
  }

  if (hideNguoiDuyet) {
    delete formatted.nguoi_duyet_id
  }

  return formatted
}

async function findPaymentOrFail(paymentId) {
  if (!isValidObjectId(paymentId)) {
    throw new Error('payment_id khong hop le')
  }

  const payment = await ThanhToan.findById(paymentId).lean()
  if (!payment) {
    throw new Error('Khong tim thay thanh toan')
  }

  return payment
}

export async function listRefunds(req, res) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20))
    const filter = {}

    if (req.query.status) {
      if (!['pending', 'completed', 'rejected'].includes(req.query.status)) {
        return fail(res, 400, 'status khong hop le')
      }
      filter.status = req.query.status
    }

    const [items, total] = await Promise.all([
      HoanTien.find(filter)
        .sort({ ngay_yeu_cau: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      HoanTien.countDocuments(filter),
    ])

    return ok(res, {
      items: items.map((item) => formatRefund(item, { hideNguoiDuyet: true })),
      total,
      page,
      limit,
      totalPages: total === 0 ? 1 : Math.ceil(total / limit),
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

export async function getRefundById(req, res) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return fail(res, 400, 'refund_id khong hop le')
    }

    const refund = await HoanTien.findById(req.params.id).lean()
    if (!refund) return fail(res, 404, 'Khong tim thay yeu cau hoan tien')

    return ok(res, formatRefund(refund, { hideNguoiDuyet: true }))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

export async function createRefund(req, res) {
  try {
    const adminId = getAdminId(req)
    if (!adminId) return fail(res, 401, 'Khong xac dinh duoc tai khoan Admin')

    const {
      payment_id,
      appointment_id,
      so_tien_hoan,
      so_tien_da_thu,
      phi_huy,
      chinh_sach_hoan,
      phan_tram_hoan,
      ly_do,
      ly_do_hoan,
      phuong_thuc_hoan,
    } = req.body

    if (!isValidObjectId(appointment_id)) {
      return fail(res, 400, 'appointment_id khong hop le')
    }

    const payment = await findPaymentOrFail(payment_id)
    const paidAmount = so_tien_da_thu == null || so_tien_da_thu === ''
      ? Number(payment.so_tien ?? 0)
      : Number(so_tien_da_thu)
    const refundAmount = Number(so_tien_hoan)

    if (!Number.isFinite(paidAmount) || paidAmount < 0) {
      return fail(res, 400, 'so_tien_da_thu khong hop le')
    }
    if (!Number.isFinite(refundAmount) || refundAmount < 0) {
      return fail(res, 400, 'so_tien_hoan khong hop le')
    }
    if (refundAmount > paidAmount) {
      return fail(res, 400, 'So tien hoan khong duoc lon hon so tien da thu')
    }

    const refund = await HoanTien.create({
      payment_id,
      appointment_id,
      so_tien_hoan: refundAmount,
      so_tien_da_thu: paidAmount,
      phi_huy: phi_huy == null || phi_huy === '' ? 0 : Number(phi_huy),
      chinh_sach_hoan: chinh_sach_hoan?.trim() || null,
      phan_tram_hoan,
      ly_do: ly_do?.trim() || null,
      ly_do_hoan: ly_do_hoan?.trim() || null,
      xu_ly_boi: adminId,
      nguoi_xu_ly_id: adminId,
      phuong_thuc_hoan: phuong_thuc_hoan?.trim() || null,
    })

    return created(res, formatRefund(refund), 'Tao yeu cau hoan tien thanh cong')
  } catch (err) {
    if (err.code === 11000) return fail(res, 409, 'Lich hen da co yeu cau hoan tien')
    if (err.name === 'ValidationError' || err.message.includes('khong hop le') || err.message.includes('Khong tim thay')) {
      return fail(res, 400, err.message)
    }
    return fail(res, 500, err.message)
  }
}

export async function approveRefund(req, res) {
  try {
    const adminId = getAdminId(req)
    if (!adminId) return fail(res, 401, 'Khong xac dinh duoc tai khoan Admin')
    if (!isValidObjectId(req.params.id)) return fail(res, 400, 'refund_id khong hop le')

    const refund = await HoanTien.findById(req.params.id)
    if (!refund) return fail(res, 404, 'Khong tim thay yeu cau hoan tien')
    if (refund.status !== 'pending') return fail(res, 400, 'Chi duoc duyet yeu cau dang cho xu ly')

    refund.status = 'completed'
    refund.nguoi_duyet_id = adminId
    refund.nguoi_xu_ly_id = refund.nguoi_xu_ly_id ?? adminId
    refund.xu_ly_boi = refund.xu_ly_boi ?? adminId
    refund.phuong_thuc_hoan = req.body.phuong_thuc_hoan?.trim() || refund.phuong_thuc_hoan
    refund.ngay_xu_ly = new Date()
    refund.thoi_diem_hoan_thanh = new Date()
    await refund.save()

    await ThanhToan.findByIdAndUpdate(refund.payment_id, {
      status: 'refunded',
      ngay_hoan_tien: refund.thoi_diem_hoan_thanh,
    })

    return ok(res, formatRefund(refund), 'Duyet hoan tien thanh cong')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

export async function rejectRefund(req, res) {
  try {
    const adminId = getAdminId(req)
    if (!adminId) return fail(res, 401, 'Khong xac dinh duoc tai khoan Admin')
    if (!isValidObjectId(req.params.id)) return fail(res, 400, 'refund_id khong hop le')

    const refund = await HoanTien.findById(req.params.id)
    if (!refund) return fail(res, 404, 'Khong tim thay yeu cau hoan tien')
    if (refund.status !== 'pending') return fail(res, 400, 'Chi duoc tu choi yeu cau dang cho xu ly')

    refund.status = 'rejected'
    refund.nguoi_duyet_id = adminId
    refund.nguoi_xu_ly_id = refund.nguoi_xu_ly_id ?? adminId
    refund.xu_ly_boi = refund.xu_ly_boi ?? adminId
    refund.ly_do_tu_choi = req.body.ly_do_tu_choi?.trim() || req.body.ly_do?.trim() || null
    refund.ngay_xu_ly = new Date()
    await refund.save()

    return ok(res, formatRefund(refund), 'Tu choi hoan tien thanh cong')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
