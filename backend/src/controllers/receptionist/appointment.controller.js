import LichHen from '../../models/LichHen.js'
import NguoiDung from '../../models/NguoiDung.js'

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
    
    appointment.status = 'checked_in'
    appointment.gio_den_thuc_te = new Date()
    await appointment.save()
    
    res.status(200).json({ success: true, message: 'Đã check-in bệnh nhân thành công', data: appointment })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const rescheduleAppointment = async (req, res) => {
  try {
    const { id } = req.params
    const { ngay_kham, gio_kham, ly_do_doi_lich } = req.body
    
    if (!ngay_kham || !gio_kham) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ngày và giờ khám mới' })
    }

    const appointment = await LichHen.findByIdAndUpdate(
      id,
      { ngay_kham, gio_kham, ly_do_doi_lich, $inc: { so_lan_thay_doi: 1 } },
      { new: true }
    )
    
    if (!appointment) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' })
    
    res.status(200).json({ success: true, message: 'Đã dời lịch hẹn', data: appointment })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params
    const { ly_do_huy } = req.body
    
    const appointment = await LichHen.findById(id)
    if (!appointment) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' })
    
    appointment.status = 'cancelled'
    appointment.ly_do_huy = ly_do_huy || 'Lễ tân hủy lịch'
    appointment.huy_boi = 'admin'
    if (req.user && req.user._id) {
      appointment.nguoi_huy_id = req.user._id
    }
    
    await appointment.save()
    
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
