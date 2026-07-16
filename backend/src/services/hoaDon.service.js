import HoaDon from '../models/HoaDon.js'
import ThanhToan from '../models/ThanhToan.js'
import LichHen from '../models/LichHen.js'

function resolveInvoiceStatus(totalDue, totalPaid) {
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

  // Đồng bộ trạng thái thanh toán sang Lịch Hẹn tương ứng
  if (hoaDon.appointment_id) {
    const appointmentPaymentStatus =
      trangThaiMoi === 'da_thanh_toan_du'
        ? 'paid'
        : trangThaiMoi === 'da_dat_coc'
        ? 'partial'
        : 'unpaid'

    const updateFields = { payment_status: appointmentPaymentStatus }

    if (trangThaiMoi === 'da_thanh_toan_du') {
      updateFields.thoi_diem_thanh_toan = new Date()

      // Chỉ tự động duyệt trạng thái khám nếu đang chờ xác nhận (pending)
      await LichHen.updateOne(
        { _id: hoaDon.appointment_id, status: 'pending' },
        { $set: { status: 'confirmed' } }
      )
    }

    await LichHen.updateOne(
      { _id: hoaDon.appointment_id },
      { $set: updateFields }
    )
  }

  return {
    hoaDonId: hoaDon._id,
    tongDaThu,
    tongCanThu,
    trang_thai_hoa_don: hoaDon.trang_thai_hoa_don,
  }
}

export default {
  tinhTrangThaiHoaDon,
}
