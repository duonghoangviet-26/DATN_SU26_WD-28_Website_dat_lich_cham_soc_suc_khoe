import LichHen from '../../models/LichHen.js'
import ThongBao from '../../models/ThongBao.js'
import { ok, fail } from '../../utils/response.js'

export async function getRecentNotifications(req, res) {
  try {
    const [savedNotifications, recentBookings] = await Promise.all([
      ThongBao.find({ user_id: req.user.id })
        .sort({ ngay_tao: -1, _id: -1 })
        .limit(20)
        .lean(),
      // Chỉ lấy 20 lịch hẹn mới nhất để làm thông báo ảo
      LichHen.find()
        .populate('user_id', 'ho_ten')
        .populate('doctor_id', 'user_id') // Nếu muốn lấy tên bác sĩ thì cần populate sâu hơn tùy model
        .sort({ ngay_tao: -1 })
        .limit(20)
        .lean(),
    ])

    const databaseNotifications = savedNotifications.map((notification) => ({
      id: notification._id,
      tieu_de: notification.tieu_de,
      noi_dung: notification.noi_dung,
      ngay_tao: notification.ngay_tao,
      da_doc: notification.da_doc,
      loai: notification.loai,
      related_id: notification.related_id,
      related_type: notification.related_type,
      du_lieu_dinh_kem: notification.du_lieu_dinh_kem ?? null,
    }))

    // Format lại dữ liệu cho giống cấu trúc Thông báo
    // `url` phải trỏ đúng lịch hẹn vừa đặt (qua appointment_id), VÀ đúng trang đang dùng trong
    // sidebar — "Tiếp nhận & lịch hẹn" (/receptionist/patient-intake, tab "appointments").
    // Trước đây `url` để null nên frontend rơi về '/receptionist/appointments' — trang lịch hẹn
    // CŨ đã bỏ khỏi menu — hiển thị lịch hẹn đầu danh sách theo bộ lọc mặc định thay vì đúng
    // lịch hẹn vừa được thông báo.
    const bookingNotifications = recentBookings.map((booking) => {
      const tenKhach = booking.ten_khach || booking.user_id?.ho_ten || 'Khách hàng ẩn danh'
      return {
        id: booking._id,
        tieu_de: 'Có lịch khám mới!',
        noi_dung: `${tenKhach} vừa đặt một lịch hẹn vào lúc ${booking.gio_kham} ngày ${new Date(booking.ngay_kham).toLocaleDateString('vi-VN')}.`,
        ngay_tao: booking.ngay_tao,
        da_doc: false, // Cái này frontend sẽ tự quản lý bằng localStorage
        loai: 'appointment',
        related_id: booking._id,
        related_type: 'appointment',
        du_lieu_dinh_kem: { url: `/receptionist/patient-intake?tab=appointments&appointment_id=${booking._id}` },
      }
    })

    const notifications = [...databaseNotifications, ...bookingNotifications]
      .sort((a, b) => new Date(b.ngay_tao).getTime() - new Date(a.ngay_tao).getTime())
      .slice(0, 30)

    return ok(res, notifications)
  } catch (error) {
    console.error('Lỗi getRecentNotifications:', error)
    return fail(res, 500, 'Không thể lấy thông báo lễ tân.')
  }
}
