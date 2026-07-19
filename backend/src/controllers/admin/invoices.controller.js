import mongoose from 'mongoose'

import HoaDon from '../../models/HoaDon.js'
import { tinhTrangThaiHoaDon } from '../../services/hoaDon.service.js'
import { emitDashboardAppointmentChanged } from '../../realtime/socket.js'
import { ok, fail } from '../../utils/response.js'

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value)
}

function buildDateRange(from, to) {
  if (!from && !to) {
    return null
  }

  const range = {}

  if (from) {
    const start = new Date(from)
    if (Number.isNaN(start.getTime())) {
      throw new Error('Ngay bat dau khong hop le')
    }
    range.$gte = start
  }

  if (to) {
    const end = new Date(to)
    if (Number.isNaN(end.getTime())) {
      throw new Error('Ngay ket thuc khong hop le')
    }
    range.$lte = end
  }

  return range
}

function formatInvoice(invoice) {
  return {
    _id: invoice._id,
    appointment_id: invoice.appointment_id,
    so_hoa_don: invoice.so_hoa_don,
    chi_nhanh_id: invoice.chi_nhanh_id,
    specialty_id: invoice.specialty_id,
    tong_tien_kham: invoice.tong_tien_kham,
    chi_tiet_thu_phi: invoice.chi_tiet_thu_phi ?? [],
    tong_tien_phat_sinh: invoice.tong_tien_phat_sinh,
    tong_thanh_toan: invoice.tong_thanh_toan,
    trang_thai_hoa_don: invoice.trang_thai_hoa_don,
    ghi_chu_ke_toan: invoice.ghi_chu_ke_toan,
    created_at: invoice.created_at,
    updated_at: invoice.updated_at,
  }
}

export async function listInvoices(req, res) {
  try {
    const {
      so_hoa_don,
      appointment_id,
      trang_thai_hoa_don,
      chi_nhanh_id,
      created_from,
      created_to,
      page = 1,
      limit = 20,
    } = req.query

    const query = {}

    if (so_hoa_don) {
      query.so_hoa_don = { $regex: so_hoa_don.trim(), $options: 'i' }
    }

    if (appointment_id) {
      if (!isValidObjectId(appointment_id)) {
        return fail(res, 400, 'appointment_id khong hop le')
      }
      query.appointment_id = appointment_id
    }

    if (trang_thai_hoa_don) {
      query.trang_thai_hoa_don = trang_thai_hoa_don
    }

    if (chi_nhanh_id) {
      if (!isValidObjectId(chi_nhanh_id)) {
        return fail(res, 400, 'chi_nhanh_id khong hop le')
      }
      query.chi_nhanh_id = chi_nhanh_id
    }

    const createdAtRange = buildDateRange(created_from, created_to)
    if (createdAtRange) {
      query.created_at = createdAtRange
    }

    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1)
    const limitNum = Math.max(1, Number.parseInt(limit, 10) || 20)
    const skip = (pageNum - 1) * limitNum

    const [total, invoices] = await Promise.all([
      HoaDon.countDocuments(query),
      HoaDon.find(query)
        .sort({ created_at: -1, _id: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ])

    return res.status(200).json({
      success: true,
      data: invoices.map(formatInvoice),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: total === 0 ? 1 : Math.ceil(total / limitNum),
      },
    })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export async function getInvoiceById(req, res) {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) {
      return fail(res, 400, 'ID hoa don khong hop le')
    }

    const invoice = await HoaDon.findById(id).lean()
    if (!invoice) {
      return fail(res, 404, 'Khong tim thay hoa don')
    }

    return ok(res, formatInvoice(invoice))
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export async function recalculateInvoiceStatus(req, res) {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) {
      return fail(res, 400, 'ID hoa don khong hop le')
    }

    const result = await tinhTrangThaiHoaDon(id)
    const invoice = await HoaDon.findById(id).lean()
    if (result.appointment_status_change) {
      emitDashboardAppointmentChanged(
        result.appointment_status_change.trang_thai_cu,
        result.appointment_status_change.trang_thai_moi,
      )
    }

    return ok(res, {
      ...formatInvoice(invoice),
      tong_da_thu: result.tongDaThu,
    })
  } catch (error) {
    if (error.message.startsWith('HoaDon not found')) {
      return fail(res, 404, 'Khong tim thay hoa don')
    }
    return fail(res, 500, error.message)
  }
}

export async function updateInvoice(req, res) {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) {
      return fail(res, 400, 'ID hoa don khong hop le')
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'trang_thai_hoa_don')) {
      return fail(res, 400, 'Khong duoc cap nhat truc tiep trang_thai_hoa_don')
    }

    const allowedUpdates = {}
    if (Object.prototype.hasOwnProperty.call(req.body, 'ghi_chu_ke_toan')) {
      allowedUpdates.ghi_chu_ke_toan = req.body.ghi_chu_ke_toan
    }

    const invoice = await HoaDon.findByIdAndUpdate(id, allowedUpdates, {
      new: true,
      runValidators: true,
    }).lean()

    if (!invoice) {
      return fail(res, 404, 'Khong tim thay hoa don')
    }

    return ok(res, formatInvoice(invoice), 'Cap nhat hoa don thanh cong')
  } catch (error) {
    return fail(res, 500, error.message)
  }
}
