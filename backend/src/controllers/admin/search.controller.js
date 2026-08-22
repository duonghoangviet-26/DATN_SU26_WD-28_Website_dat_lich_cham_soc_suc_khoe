import { NguoiDung, LichHen } from '../../models/index.js'

export const globalSearch = async (req, res, next) => {
  try {
    const query = (req.query.q || '').trim()
    if (!query) {
      return res.status(200).json([])
    }

    const searchRegex = new RegExp(query, 'i')

    // Search Users (Patients, Doctors, Staff)
    const users = await NguoiDung.find({
      $or: [
        { ho_ten: searchRegex },
        { so_dien_thoai: searchRegex },
        { email: searchRegex }
      ]
    }).select('ho_ten so_dien_thoai email vai_tro').limit(6)

    // Search Appointments by ma_lich_hen
    const appointments = await LichHen.find({
      ma_lich_hen: searchRegex
    }).populate('benh_nhan', 'ho_ten so_dien_thoai').limit(5)

    const results = []

    users.forEach(user => {
      let typeLabel = 'Người dùng'
      let link = '/admin/users'
      if (user.vai_tro === 'benh_nhan') {
        typeLabel = 'Bệnh nhân'
        link = `/admin/patients/${user._id}`
      } else if (user.vai_tro === 'bac_si') {
        typeLabel = 'Bác sĩ'
        link = `/admin/users`
      } else if (user.vai_tro === 'le_tan') {
        typeLabel = 'Lễ tân'
        link = `/admin/users`
      }

      results.push({
        _id: user._id,
        type: 'user',
        title: user.ho_ten || 'Không có tên',
        subtitle: user.so_dien_thoai || user.email || '',
        tag: typeLabel,
        link
      })
    })

    appointments.forEach(apt => {
      results.push({
        _id: apt._id,
        type: 'appointment',
        title: `Mã LH: ${apt.ma_lich_hen}`,
        subtitle: `BN: ${apt.benh_nhan?.ho_ten || 'N/A'} - ĐT: ${apt.benh_nhan?.so_dien_thoai || 'N/A'}`,
        tag: 'Lịch hẹn',
        link: `/admin/appointments`
      })
    })

    return res.status(200).json(results.slice(0, 10))
  } catch (error) {
    next(error)
  }
}
