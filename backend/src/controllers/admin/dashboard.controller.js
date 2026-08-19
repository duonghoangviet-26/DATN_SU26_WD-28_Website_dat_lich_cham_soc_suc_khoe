import { getAdminDashboardSummary, getChiTietDoanhThu } from '../../services/admin/dashboard.service.js'
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
