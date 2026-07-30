import HoaDon from '../models/HoaDon.js'
import ThanhToan from '../models/ThanhToan.js'
import LichHen from '../models/LichHen.js'

function resolveInvoiceStatus(totalDue, totalPaid) {
  if (totalDue <= 0) {
    return 'da_thanh_toan_du'
  }
  if (totalPaid <= 0) {
    return 'chua_thanh_toan'
  }

  if (totalPaid < totalDue) {
    return 'da_dat_coc'
  }

  return 'da_thanh_toan_du'
}

export async function tinhTrangThaiHoaDon(hoaDonId) {
  const hoaDon = await HoaDon.findById(hoaDonId)

  if (!hoaDon) {
    throw new Error(`HoaDon not found: ${hoaDonId}`)
  }

  const paidPayments = await ThanhToan.find({
    hoa_don_id: hoaDon._id,
    status: 'paid',
  })
    .select('so_tien')
    .lean()

  const tongDaThu = paidPayments.reduce((sum, payment) => sum + (payment.so_tien || 0), 0)
  const tongCanThu = hoaDon.tong_thanh_toan || 0
  const trangThaiMoi = resolveInvoiceStatus(tongCanThu, tongDaThu)

  if (hoaDon.trang_thai_hoa_don !== trangThaiMoi) {
    hoaDon.trang_thai_hoa_don = trangThaiMoi
    await hoaDon.save()
  }

  // `LichHen.payment_status` chỉ phản ánh khoản thu để giữ lịch/phí khám ban đầu.
  // Hóa đơn cuối buổi có thể phát sinh thêm dịch vụ, vì vậy không được dùng trạng
  // thái hóa đơn cuối buổi để ghi đè trạng thái phí đặt lịch của lịch hẹn.
  let appointmentStatusChange = null
  if (hoaDon.appointment_id) {
    if (trangThaiMoi === 'da_thanh_toan_du') {
      // Chỉ tự động duyệt trạng thái khám nếu đang chờ xác nhận (pending)
      const statusUpdate = await LichHen.updateOne(
        { _id: hoaDon.appointment_id, status: 'pending' },
        { $set: { status: 'confirmed' } }
      )
      if (statusUpdate.modifiedCount > 0) {
        appointmentStatusChange = { trang_thai_cu: 'pending', trang_thai_moi: 'confirmed' }
      }
    }

  }

  return {
    hoaDonId: hoaDon._id,
    tongDaThu,
    tongCanThu,
    trang_thai_hoa_don: hoaDon.trang_thai_hoa_don,
    appointment_status_change: appointmentStatusChange,
  }
}

export default {
  tinhTrangThaiHoaDon,
}
