import LichHen from '../../models/LichHen.js'
import { ok, fail } from '../../utils/response.js'

export async function getRecentNotifications(req, res) {
  try {
    // Chỉ lấy 20 lịch hẹn mới nhất để làm thông báo ảo
    const recentBookings = await LichHen.find()
      .populate('user_id', 'ho_ten')
      .populate('doctor_id', 'user_id') // Nếu muốn lấy tên bác sĩ thì cần populate sâu hơn tùy model
      .sort({ ngay_tao: -1 })
      .limit(20)
      .lean()

    // Format lại dữ liệu cho giống cấu trúc Thông báo
    const notifications = recentBookings.map((booking) => {
      const tenKhach = booking.ten_khach || booking.user_id?.ho_ten || 'Khách hàng ẩn danh'
      return {
        id: booking._id,
        tieu_de: 'Có lịch khám mới!',
        noi_dung: `${tenKhach} vừa đặt một lịch hẹn vào lúc ${booking.gio_kham} ngày ${new Date(booking.ngay_kham).toLocaleDateString('vi-VN')}.`,
        ngay_tao: booking.ngay_tao,
        da_doc: false, // Cái này frontend sẽ tự quản lý bằng localStorage
        loai: 'appointment',
        related_id: booking._id,
      }
    })

    return ok(res, notifications)
  } catch (error) {
    console.error('Lỗi getRecentNotifications:', error)
    return fail(res, 500, 'Không thể lấy thông báo ảo.')
  }
}
