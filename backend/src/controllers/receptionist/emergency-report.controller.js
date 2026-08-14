import { layBaoCaoCaKhan } from '../../services/emergencyReport.service.js'
import { ok, fail } from '../../utils/response.js'

// GET /api/receptionist/emergency-report?ngay=
export async function list(req, res) {
  try {
    const rows = await layBaoCaoCaKhan({ ngay: req.query.ngay ?? null })
    return ok(res, rows)
  } catch (err) {
    console.error('[emergency-report] list:', err)
    return fail(res, 500, 'Không tải được biên bản ca khẩn')
  }
}
