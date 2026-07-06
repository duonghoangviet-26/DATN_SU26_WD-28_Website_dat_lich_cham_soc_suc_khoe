import HoaDon from '../models/HoaDon.js'
import ThanhToan from '../models/ThanhToan.js'

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
