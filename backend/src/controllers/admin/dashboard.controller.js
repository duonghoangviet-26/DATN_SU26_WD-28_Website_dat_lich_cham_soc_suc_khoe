import { getAdminDashboardSummary, getChiTietDoanhThu, getChiTietDoanhThuXuatHoaDon } from '../../services/admin/dashboard.service.js'
import { ok, fail } from '../../utils/response.js'

export async function getSummary(req, res) {
  try {
    const summary = await getAdminDashboardSummary()
    return ok(res, summary)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export async function getRevenueDetails(req, res) {
  try {
    const details = await getChiTietDoanhThu()
    return ok(res, details)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export async function getInvoicedDetails(req, res) {
  try {
    const details = await getChiTietDoanhThuXuatHoaDon()
    return ok(res, details)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export async function getDebtList(req, res) {
  try {
    const { getDanhSachCongNo } = await import('../../services/admin/dashboard.service.js')
    const list = await getDanhSachCongNo()
    return ok(res, list)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export async function remindDebt(req, res) {
  try {
    const { data } = req.body
    if (!data || !data.email) {
      return fail(res, 400, 'Không tìm thấy địa chỉ email của khách hàng')
    }

    const { sendDebtReminderEmail } = await import('../../services/mail.service.js')
    
    // Convert property names for template
    const templateData = {
      ten_khach_hang: data.ho_ten,
      so_hoa_don: data.so_hoa_don,
      thieu: data.no_hoa_don,
      chi_tiet_thu_phi: data.chi_tiet_thu_phi,
      ngay_tao: data.created_at
    }

    await sendDebtReminderEmail({ to: data.email, data: templateData })
    return ok(res, { message: 'Đã gửi email nhắc nợ thành công' })
  } catch (error) {
    return fail(res, 500, error.message || 'Lỗi khi gửi email nhắc nợ')
  }
}
