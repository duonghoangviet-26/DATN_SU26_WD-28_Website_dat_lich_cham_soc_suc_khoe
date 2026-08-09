import { layNhatKyCaTruc } from '../../services/receptionistActivityLog.service.js'
import { NHOM_HANH_DONG } from '../../services/receptionistAudit.service.js'
import { ok, fail } from '../../utils/response.js'

// GET /api/receptionist/activity-log?ngay=&nguoi_id=&nhom=
export async function list(req, res) {
  try {
    const rows = await layNhatKyCaTruc({
      ngay:    req.query.ngay ?? null,
      nguoiId: req.query.nguoi_id ?? null,
      nhom:    req.query.nhom ?? null,
    })
    return ok(res, { rows, nhom_kha_dung: Object.keys(NHOM_HANH_DONG) })
  } catch (err) {
    console.error('[activity-log] list:', err)
    return fail(res, 500, 'Không tải được nhật ký ca trực')
  }
}
