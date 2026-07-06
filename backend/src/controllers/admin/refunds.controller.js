import mongoose from 'mongoose'

import { HoanTien, ThanhToan } from '../../models/index.js'
import { ok, created, fail } from '../../utils/response.js'

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value)
}

function formatRefund(refund) {
  return {
    _id: refund._id,
    payment_id: refund.payment_id?._id ?? refund.payment_id ?? null,
    appointment_id: refund.appointment_id,
    so_tien_hoan: refund.so_tien_hoan,
    so_tien_da_thu: refund.so_tien_da_thu,
    phi_huy: refund.phi_huy,
    chinh_sach_hoan: refund.chinh_sach_hoan,
    phan_tram_hoan: refund.phan_tram_hoan,
    ly_do: refund.ly_do,
    ly_do_hoan: refund.ly_do_hoan,
    status: refund.status,
    ly_do_tu_choi: refund.ly_do_tu_choi,
    nguoi_xu_ly_id: refund.nguoi_xu_ly_id ?? null,
    phuong_thuc_hoan: refund.phuong_thuc_hoan,
    ngay_yeu_cau: refund.ngay_yeu_cau,
    ngay_xu_ly: refund.ngay_xu_ly,
    thoi_diem_hoan_thanh: refund.thoi_diem_hoan_thanh,
  }
}

async function loadPaymentOrThrow(paymentId) {
  if (!isValidObjectId(paymentId)) {
    throw new Error('payment_id khong hop le')
  }

  const payment = await ThanhToan.findById(paymentId).lean()
  if (!payment) {
    throw new Error('Khong tim thay giao dich')
  }

  return payment
}

export async function list(req, res) {
  try {
    const { status, payment_id } = req.query
    const filter = {}

    if (status) filter.status = status

    if (payment_id) {
      if (!isValidObjectId(payment_id)) {
        return fail(res, 400, 'payment_id khong hop le')
      }
      filter.payment_id = payment_id
    }

    const refunds = await HoanTien.find(filter)
      .sort({ ngay_yeu_cau: -1, _id: -1 })
      .lean()

    return ok(res, refunds.map(formatRefund))
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export async function getById(req, res) {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) {
      return fail(res, 400, 'ID hoan tien khong hop le')
    }

    const refund = await HoanTien.findById(id).lean()
    if (!refund) {
      return fail(res, 404, 'Khong tim thay yeu cau hoan tien')
    }

    return ok(res, formatRefund(refund))
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export async function createRefund(req, res) {
  try {
    const {
      payment_id,
      appointment_id,
      so_tien_hoan,
      so_tien_da_thu,
      phi_huy = 0,
      chinh_sach_hoan = null,
      phan_tram_hoan = 100,
      ly_do = null,
      ly_do_hoan = null,
      nguoi_xu_ly_id,
      phuong_thuc_hoan = null,
    } = req.body

    if (!payment_id || !appointment_id || so_tien_hoan == null || !nguoi_xu_ly_id) {
      return fail(res, 400, 'Thieu truong bat buoc khi tao hoan tien')
    }

    if (!isValidObjectId(appointment_id)) {
      return fail(res, 400, 'appointment_id khong hop le')
    }

    if (!isValidObjectId(nguoi_xu_ly_id)) {
      return fail(res, 400, 'nguoi_xu_ly_id khong hop le')
    }

    const payment = await loadPaymentOrThrow(payment_id)
    const paidAmount = so_tien_da_thu ?? payment.so_tien ?? 0

    if (Number(so_tien_hoan) > Number(paidAmount)) {
      return fail(res, 400, 'So tien hoan khong duoc vuot qua so tien da thu')
    }

    const refund = await HoanTien.create({
      payment_id,
      appointment_id,
      so_tien_hoan,
      so_tien_da_thu: paidAmount,
      phi_huy,
      chinh_sach_hoan,
      phan_tram_hoan,
      ly_do,
      ly_do_hoan,
      nguoi_xu_ly_id,
      phuong_thuc_hoan,
      status: 'pending',
    })

    return created(res, formatRefund(refund.toObject()), 'Tao yeu cau hoan tien thanh cong')
  } catch (error) {
    return fail(res, 400, error.message)
  }
}

export async function approveRefund(req, res) {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) {
      return fail(res, 400, 'ID hoan tien khong hop le')
    }

    const refund = await HoanTien.findById(id)
    if (!refund) {
      return fail(res, 404, 'Khong tim thay yeu cau hoan tien')
    }

    if (refund.status === 'completed') {
      return fail(res, 409, 'Yeu cau hoan tien da duoc duyet')
    }

    refund.status = 'completed'
    refund.nguoi_xu_ly_id = req.body.nguoi_xu_ly_id && isValidObjectId(req.body.nguoi_xu_ly_id)
      ? req.body.nguoi_xu_ly_id
      : req.user.id
    refund.ngay_xu_ly = new Date()
    refund.thoi_diem_hoan_thanh = new Date()
    if (Object.prototype.hasOwnProperty.call(req.body, 'phuong_thuc_hoan')) {
      refund.phuong_thuc_hoan = req.body.phuong_thuc_hoan
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'ly_do_hoan')) {
      refund.ly_do_hoan = req.body.ly_do_hoan
    }

    await refund.save()

    return ok(res, formatRefund(refund.toObject()), 'Duyet hoan tien thanh cong')
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export async function rejectRefund(req, res) {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) {
      return fail(res, 400, 'ID hoan tien khong hop le')
    }

    const refund = await HoanTien.findById(id)
    if (!refund) {
      return fail(res, 404, 'Khong tim thay yeu cau hoan tien')
    }

    if (refund.status === 'completed') {
      return fail(res, 409, 'Khong the tu choi yeu cau da duoc duyet')
    }

    refund.status = 'rejected'
    refund.ly_do_tu_choi = req.body.ly_do_tu_choi || 'Admin tu choi hoan tien'
    refund.nguoi_xu_ly_id = req.body.nguoi_xu_ly_id && isValidObjectId(req.body.nguoi_xu_ly_id)
      ? req.body.nguoi_xu_ly_id
      : req.user.id
    refund.ngay_xu_ly = new Date()
    refund.thoi_diem_hoan_thanh = null

    await refund.save()

    return ok(res, formatRefund(refund.toObject()), 'Tu choi hoan tien thanh cong')
  } catch (error) {
    return fail(res, 500, error.message)
  }
}
