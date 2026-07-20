import mongoose from 'mongoose'
import LichHen from '../../models/LichHen.js'
import NguoiDung from '../../models/NguoiDung.js'
import LichLamViec from '../../models/LichLamViec.js'
import { emitDashboardAppointmentChanged } from '../../realtime/socket.js'

export const getAppointments = async (req, res) => {
  try {
    const { date, status, timeframe, search } = req.query
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
      const startDate = new Date(date)
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(date)
      endDate.setHours(23, 59, 59, 999)
      query.ngay_kham = { $gte: startDate, $lte: endDate }
    } else {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      
      const todayEnd = new Date()
      todayEnd.setHours(23, 59, 59, 999)

      const tomorrowStart = new Date()
      tomorrowStart.setDate(tomorrowStart.getDate() + 1)
      tomorrowStart.setHours(0, 0, 0, 0)

      const tomorrowEnd = new Date()
      tomorrowEnd.setDate(tomorrowEnd.getDate() + 1)
      tomorrowEnd.setHours(23, 59, 59, 999)

      if (timeframe === 'today') {
        query.ngay_kham = { $gte: todayStart, $lte: todayEnd }
      } else if (timeframe === 'tomorrow') {
        query.ngay_kham = { $gte: tomorrowStart, $lte: tomorrowEnd }
      } else if (timeframe === 'upcoming') {
        query.ngay_kham = { $gt: todayEnd }
      } else if (timeframe === 'past') {
        query.ngay_kham = { $lt: todayStart }
      }
    }
    
    if (status) query.status = status

    let sortOption = { ngay_kham: 1, gio_kham: 1 }
    if (timeframe === 'past') {
      sortOption = { ngay_kham: -1, gio_kham: -1 }
    }

    const appointments = await LichHen.find(query)
      .populate('user_id', 'ho_ten so_dien_thoai email anh_dai_dien')
      .populate({
        path: 'doctor_id',
        populate: { path: 'user_id', select: 'ho_ten' }
      })
      .sort(sortOption)
      
    res.status(200).json({ success: true, data: appointments })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const markAsArrived = async (req, res) => {
  try {
    const { id } = req.params
    const appointment = await LichHen.findById(id)
    
    if (!appointment) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' })
    if (appointment.loai_kham !== 'clinic') return res.status(400).json({ success: false, message: 'Chỉ áp dụng cho lịch khám tại phòng khám' })
    
    const oldStatus = appointment.status
    appointment.status = 'checked_in'
    appointment.gio_den_thuc_te = new Date()
    await appointment.save()
    emitDashboardAppointmentChanged(oldStatus, appointment.status)
    
    res.status(200).json({ success: true, message: 'Đã check-in bệnh nhân thành công', data: appointment })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const rescheduleAppointment = async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const { id } = req.params
    const { ngay_kham, gio_kham, ly_do_doi_lich } = req.body
    
    if (!ngay_kham || !gio_kham) {
      await session.abortTransaction()
      session.endSession()
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ngày và giờ khám mới' })
    }

    // 1. Lấy lịch hẹn cũ
    const appointment = await LichHen.findById(id).session(session)
    if (!appointment) {
      await session.abortTransaction()
      session.endSession()
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' })
    }

    const { doctor_id, schedule_id: old_schedule_id, slot_id: old_slot_id } = appointment

    // 2. Tra cứu slot mới trong LichLamViec
    // Parse ngay_kham (new) to UTC midnight Date
    const parsedDate = new Date(ngay_kham)
    parsedDate.setUTCHours(0, 0, 0, 0)

    const newSchedule = await LichLamViec.findOne({
      doctor_id,
      ngay: { $gte: parsedDate, $lt: new Date(parsedDate.getTime() + 86400000) },
      trang_thai_ngay: 'lam_viec',
      trang_thai_xac_nhan: { $ne: 'tu_choi' },
      'slots.gio_bat_dau': gio_kham
    }).session(session)

    if (!newSchedule) {
      await session.abortTransaction()
      session.endSession()
      return res.status(400).json({ success: false, message: 'Lịch làm việc của Bác sĩ vào ngày giờ này không tồn tại' })
    }

    const newSlot = newSchedule.slots.find(s => s.gio_bat_dau === gio_kham)
    
    // Kiểm tra nếu Lễ tân chọn lại đúng slot của chính lịch hẹn này
    if (old_schedule_id && old_slot_id && 
        newSchedule._id.toString() === old_schedule_id.toString() && 
        newSlot && newSlot._id.toString() === old_slot_id.toString()) {
      await session.abortTransaction()
      session.endSession()
      return res.status(400).json({ success: false, message: 'Vui lòng chọn ngày và giờ khác với lịch hẹn hiện tại' })
    }

    if (!newSlot || newSlot.status === 'booked') {
      await session.abortTransaction()
      session.endSession()
      return res.status(400).json({ success: false, message: 'Khung giờ này của bác sĩ đã kín' })
    }

    if (newSlot.status !== 'active') {
      await session.abortTransaction()
      session.endSession()
      return res.status(400).json({ success: false, message: 'Khung giờ này không khả dụng' })
    }

    // 3. Đánh dấu slot MỚI thành booked
    newSlot.status = 'booked'
    await newSchedule.save({ session })

    // 4. Giải phóng slot CŨ thành active
    if (old_schedule_id && old_slot_id) {
      const oldSchedule = await LichLamViec.findById(old_schedule_id).session(session)
      if (oldSchedule) {
        const oldSlotToFree = oldSchedule.slots.id(old_slot_id)
        if (oldSlotToFree) {
          oldSlotToFree.status = 'active'
          await oldSchedule.save({ session })
        }
      }
    }

    // 5. Cập nhật LichHen với dữ liệu mới
    appointment.ngay_kham = parsedDate
    appointment.gio_kham = gio_kham
    appointment.schedule_id = newSchedule._id
    appointment.slot_id = newSlot._id
    appointment.ly_do_doi_lich = ly_do_doi_lich || 'Lễ tân dời lịch'
    appointment.so_lan_thay_doi = (appointment.so_lan_thay_doi || 0) + 1

    await appointment.save({ session })
    await session.commitTransaction()
    session.endSession()

    res.status(200).json({ success: true, message: 'Đã dời lịch hẹn thành công', data: appointment })
  } catch (error) {
    await session.abortTransaction()
    session.endSession()
    res.status(500).json({ success: false, message: error.message })
  }
}

export const cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params
    const { ly_do_huy } = req.body
    
    const appointment = await LichHen.findById(id)
    if (!appointment) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' })
    
    const oldStatus = appointment.status
    appointment.status = 'cancelled'
    appointment.ly_do_huy = ly_do_huy || 'Lễ tân hủy lịch'
    appointment.huy_boi = 'admin'
    if (req.user && req.user._id) {
      appointment.nguoi_huy_id = req.user._id
    }
    
    await appointment.save()
    emitDashboardAppointmentChanged(oldStatus, appointment.status)
    
    res.status(200).json({ success: true, message: 'Đã hủy lịch hẹn', data: appointment })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export default {
  getAppointments,
  markAsArrived,
  rescheduleAppointment,
  cancelAppointment
}
