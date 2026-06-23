import mongoose from 'mongoose'
import LichHen from '../models/LichHen.js'
import LichLamViec from '../models/LichLamViec.js'
import LichSuLichHen from '../models/LichSuLichHen.js'
import NguoiDung from '../models/NguoiDung.js'
import BacSi from '../models/BacSi.js'
import { ok, created, fail } from '../utils/response.js'

// GET /api/admin/appointments
// Lấy danh sách lịch hẹn với filter
export async function getAllAppointments(req, res) {
  try {
    const { keyword, status, loai_kham, startDate, endDate, page = 1, limit = 20 } = req.query

    // Xây dựng query
    const query = {}
    if (status) query.status = status
    if (loai_kham) query.loai_kham = loai_kham
    
    // Lọc theo ngày
    if (startDate || endDate) {
      query.ngay_kham = {}
      if (startDate) query.ngay_kham.$gte = new Date(startDate)
      if (endDate) query.ngay_kham.$lte = new Date(endDate)
    }

    // Fetch dữ liệu kèm populate
    let appointments = await LichHen.find(query)
      .populate({ path: 'user_id', select: 'ho_ten email so_dien_thoai' })
      .populate({
        path: 'doctor_id',
        populate: { path: 'user_id', select: 'ho_ten' }
      })
      .populate('service_id', 'ten')
      .sort({ ngay_kham: -1, gio_kham: -1 })
      .lean()

    // Filter theo keyword ở JS (do tìm kiếm chuỗi qua các bảng ref khá phức tạp trong mongo)
    if (keyword) {
      const kw = keyword.toLowerCase().trim()
      appointments = appointments.filter(a => {
        const tenBenhNhan = a.ten_khach || a.user_id?.ho_ten || ''
        const tenBacSi = a.doctor_id?.user_id?.ho_ten || ''
        const sdt = a.so_dien_thoai_khach || a.user_id?.so_dien_thoai || ''
        return tenBenhNhan.toLowerCase().includes(kw) || 
               tenBacSi.toLowerCase().includes(kw) ||
               sdt.includes(kw)
      })
    }

    // Phân trang bằng JS (sau khi đã lọc)
    const total = appointments.length
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const totalPages = Math.ceil(total / limitNum)
    const startIndex = (pageNum - 1) * limitNum
    const endIndex = startIndex + limitNum
    
    const paginatedAppointments = appointments.slice(startIndex, endIndex)

    // Map lại data trả về cho frontend giống AppointmentItem
    const formattedData = paginatedAppointments.map(a => ({
      _id: a._id,
      benh_nhan: a.ten_khach || a.user_id?.ho_ten || 'Khách vãng lai',
      sdt_benh_nhan: a.so_dien_thoai_khach || a.user_id?.so_dien_thoai,
      bac_si: a.doctor_id?.user_id?.ho_ten || 'Không rõ',
      chuyen_khoa: a.service_id?.ten || 'Khám tổng quát', // Tạm dùng service name làm chuyên khoa
      ngay_kham: new Date(a.ngay_kham).toISOString().slice(0, 10),
      gio_kham: a.gio_kham,
      loai_kham: a.loai_kham,
      status: a.status,
      payment_status: a.payment_status,
      gia_kham: a.gia_kham,
      ly_do_kham: a.ly_do_kham,
      dia_chi_kham: a.dia_chi_kham,
    }))

    return res.status(200).json({
      success: true,
      data: formattedData,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages
      }
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// GET /api/admin/appointments/:id
export async function getAppointmentById(req, res) {
  try {
    const { id } = req.params
    const a = await LichHen.findById(id)
      .populate({ path: 'user_id', select: 'ho_ten email so_dien_thoai' })
      .populate({
        path: 'doctor_id',
        populate: { path: 'user_id', select: 'ho_ten' }
      })
      .populate('service_id', 'ten')
      .lean()

    if (!a) return fail(res, 404, 'Không tìm thấy lịch hẹn')

    const formattedData = {
      _id: a._id,
      benh_nhan: a.ten_khach || a.user_id?.ho_ten || 'Khách vãng lai',
      sdt_benh_nhan: a.so_dien_thoai_khach || a.user_id?.so_dien_thoai,
      bac_si: a.doctor_id?.user_id?.ho_ten || 'Không rõ',
      chuyen_khoa: a.service_id?.ten || 'Khám tổng quát',
      ngay_kham: new Date(a.ngay_kham).toISOString().slice(0, 10),
      gio_kham: a.gio_kham,
      loai_kham: a.loai_kham,
      status: a.status,
      payment_status: a.payment_status,
      gia_kham: a.gia_kham,
      ly_do_kham: a.ly_do_kham,
      dia_chi_kham: a.dia_chi_kham,
    }

    return ok(res, formattedData)
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
    const appointment = await LichHen.findById(id).session(session)

    if (!appointment) {
      await session.abortTransaction()
      session.endSession()
      return fail(res, 404, 'Không tìm thấy lịch hẹn')
    }

    if (appointment.status === 'cancelled' || appointment.status === 'completed') {
      await session.abortTransaction()
      session.endSession()
      return fail(res, 400, 'Không thể hủy lịch hẹn đã hoàn thành hoặc đã hủy')
    }

    const oldStatus = appointment.status
    appointment.status = 'cancelled'
    appointment.ly_do_huy = req.body.ly_do_huy || 'Hủy bởi Admin'
    
    // Nếu có hoàn tiền
    let oldPaymentStatus = appointment.payment_status
    if (appointment.payment_status === 'paid') {
      appointment.payment_status = 'refunded'
    }

    await appointment.save({ session })

    // Lưu lịch sử
    await LichSuLichHen.create([{
      appointment_id: appointment._id,
      tu_trang_thai: oldStatus,
      den_trang_thai: 'cancelled',
      tu_payment_status: oldPaymentStatus,
      den_payment_status: appointment.payment_status,
      vai_tro_nguoi_thuc_hien: 'admin',
      ly_do: appointment.ly_do_huy
    }], { session })

    // Trả lại slot (giảm so_benh_nhan_hien_tai)
    await LichLamViec.findOneAndUpdate(
      { _id: appointment.schedule_id, 'slots._id': appointment.slot_id },
      { $inc: { 'slots.$.so_benh_nhan_hien_tai': -1 } },
      { session }
    )

    await session.commitTransaction()
    session.endSession()

    // Lấy lại thông tin format gửi về client
    const updated = await LichHen.findById(id)
      .populate({ path: 'user_id', select: 'ho_ten email so_dien_thoai' })
      .populate({
        path: 'doctor_id',
        populate: { path: 'user_id', select: 'ho_ten' }
      })
      .populate('service_id', 'ten')
      .lean()

    const formattedData = {
      _id: updated._id,
      benh_nhan: updated.ten_khach || updated.user_id?.ho_ten || 'Khách vãng lai',
      sdt_benh_nhan: updated.so_dien_thoai_khach || updated.user_id?.so_dien_thoai,
      bac_si: updated.doctor_id?.user_id?.ho_ten || 'Không rõ',
      chuyen_khoa: updated.service_id?.ten || 'Khám tổng quát',
      ngay_kham: new Date(updated.ngay_kham).toISOString().slice(0, 10),
      gio_kham: updated.gio_kham,
      loai_kham: updated.loai_kham,
      status: updated.status,
      payment_status: updated.payment_status,
      gia_kham: updated.gia_kham,
      ly_do_kham: updated.ly_do_kham,
      dia_chi_kham: updated.dia_chi_kham,
    }

    return ok(res, formattedData, 'Đã hủy lịch hẹn thành công')
  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    return fail(res, 500, err.message)
  }
}

// POST /api/admin/appointments
// Admin tạo lịch khám thay khách hàng
export async function createAppointment(req, res) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const { 
      user_id, doctor_id, schedule_id, slot_id, service_id,
      loai_kham, ngay_kham, gio_kham, gia_kham, dia_chi_kham,
      ten_khach, so_dien_thoai_khach
    } = req.body

    // 1. Kiểm tra Slot có hợp lệ và còn chỗ không
    const schedule = await LichLamViec.findOne(
      { _id: schedule_id, 'slots._id': slot_id }
    ).session(session)

    if (!schedule) {
      throw new Error('Không tìm thấy lịch làm việc hoặc khung giờ này')
    }

    const slot = schedule.slots.id(slot_id)
    if (slot.status !== 'active') {
      throw new Error('Khung giờ này đã bị khóa hoặc hủy')
    }
    if (slot.so_benh_nhan_hien_tai >= slot.so_benh_nhan_toi_da) {
      throw new Error('Khung giờ này đã kín chỗ')
    }

    // Tăng số lượng bệnh nhân
    slot.so_benh_nhan_hien_tai += 1
    await schedule.save({ session })

    // 2. Tạo Lịch hẹn
    const newAppointment = new LichHen({
      user_id, 
      doctor_id, 
      schedule_id, 
      slot_id, 
      service_id,
      loai_kham, 
      ngay_kham: new Date(ngay_kham), 
      gio_kham, 
      gia_kham, 
      dia_chi_kham,
      ten_khach, 
      so_dien_thoai_khach,
      status: 'confirmed', // Admin tạo mặc định xác nhận luôn
      payment_status: 'unpaid'
    })

    await newAppointment.save({ session })

    // 3. Ghi log lịch sử
    await LichSuLichHen.create([{
      appointment_id: newAppointment._id,
      tu_trang_thai: null,
      den_trang_thai: 'confirmed',
      tu_payment_status: null,
      den_payment_status: 'unpaid',
      vai_tro_nguoi_thuc_hien: 'admin',
      ly_do: 'Admin đặt lịch thay khách'
    }], { session })

    await session.commitTransaction()
    session.endSession()

    return created(res, newAppointment, 'Đã tạo lịch hẹn thành công')
  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    return fail(res, 400, err.message)
  }
}

// PATCH /api/admin/appointments/:id/reschedule
export async function rescheduleAppointment(req, res) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const { id } = req.params
    const { doctor_id, schedule_id, slot_id, ngay_kham, gio_kham } = req.body

    const appointment = await LichHen.findById(id).session(session)
    if (!appointment) {
      throw new Error('Không tìm thấy lịch hẹn')
    }

    if (appointment.status === 'cancelled' || appointment.status === 'completed') {
      throw new Error('Không thể dời lịch hẹn đã hoàn thành hoặc đã hủy')
    }

    // 1. Kiểm tra Slot mới có hợp lệ không
    const newSchedule = await LichLamViec.findOne(
      { _id: schedule_id, 'slots._id': slot_id }
    ).session(session)

    if (!newSchedule) throw new Error('Không tìm thấy lịch làm việc mới')
    
    const newSlot = newSchedule.slots.id(slot_id)
    if (newSlot.status !== 'active') throw new Error('Khung giờ mới đã bị khóa')
    if (newSlot.so_benh_nhan_hien_tai >= newSlot.so_benh_nhan_toi_da) throw new Error('Khung giờ mới đã kín chỗ')

    // 2. Trả lại slot cũ
    await LichLamViec.findOneAndUpdate(
      { _id: appointment.schedule_id, 'slots._id': appointment.slot_id },
      { $inc: { 'slots.$.so_benh_nhan_hien_tai': -1 } },
      { session }
    )

    // 3. Tăng slot mới
    newSlot.so_benh_nhan_hien_tai += 1
    await newSchedule.save({ session })

    // 4. Cập nhật Lịch hẹn
    appointment.doctor_id = doctor_id
    appointment.schedule_id = schedule_id
    appointment.slot_id = slot_id
    appointment.ngay_kham = new Date(ngay_kham)
    appointment.gio_kham = gio_kham
    await appointment.save({ session })

    // 5. Ghi log lịch sử
    await LichSuLichHen.create([{
      appointment_id: appointment._id,
      tu_trang_thai: appointment.status,
      den_trang_thai: appointment.status,
      tu_payment_status: appointment.payment_status,
      den_payment_status: appointment.payment_status,
      vai_tro_nguoi_thuc_hien: 'admin',
      ly_do: `Admin dời lịch sang ${gio_kham} ngày ${ngay_kham}`
    }], { session })

    await session.commitTransaction()
    session.endSession()

    return ok(res, appointment, 'Đã dời lịch thành công')
  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    return fail(res, 400, err.message)
  }
}

// GET /api/admin/doctors/active
// Lấy danh sách bác sĩ (dùng cho Dropdown)
export async function getActiveDoctors(req, res) {
  try {
    const doctors = await BacSi.find({ la_hien: true, trang_thai_duyet: 'approved' })
      .populate('user_id', 'ho_ten email so_dien_thoai')
      .populate('specialties', 'ten')
      .lean()

    const formatted = doctors.map(d => ({
      _id: d._id,
      ten: d.user_id?.ho_ten,
      chuyen_khoa: d.specialties?.map(s => s.ten).join(', ') || 'Chưa rõ',
      gia_kham: d.phi_tu_van || 0
    }))
    return ok(res, formatted)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// GET /api/admin/doctors/:id/schedules
// Lấy lịch làm việc của bác sĩ (từ hôm nay trở đi)
export async function getDoctorSchedules(req, res) {
  try {
    const { id } = req.params
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const schedules = await LichLamViec.find({
      doctor_id: id,
      ngay: { $gte: today }
    }).sort({ ngay: 1 }).lean()

    // Map lại chỉ lấy các slot active và còn chỗ
    const formatted = schedules.map(s => {
      return {
        _id: s._id,
        ngay: new Date(s.ngay).toISOString().slice(0, 10),
        slots: s.slots.filter(sl => sl.status === 'active' && sl.so_benh_nhan_hien_tai < sl.so_benh_nhan_toi_da)
      }
    }).filter(s => s.slots.length > 0) // Chỉ trả về ngày có slot trống

    return ok(res, formatted)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
