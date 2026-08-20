import { layNhatKyCaTruc } from '../../services/receptionistActivityLog.service.js'
import { NHOM_HANH_DONG } from '../../services/receptionistAudit.service.js'
import { ok, fail } from '../../utils/response.js'

// GET /api/receptionist/activity-log?ngay=&tu_ngay=&den_ngay=&tu_khoa=&nguoi_id=&nhom=&page=&limit=
export async function list(req, res) {
  try {
    const result = await layNhatKyCaTruc({
      ngay:     req.query.ngay ?? null,
      tu_ngay:  req.query.tu_ngay ?? null,
      den_ngay: req.query.den_ngay ?? null,
      tu_khoa:  req.query.tu_khoa ?? null,
      nguoiId:  req.query.nguoi_id ?? null,
      nhom:     req.query.nhom ?? null,
      page:     req.query.page,
      limit:    req.query.limit,
    })
    return ok(res, { ...result, nhom_kha_dung: Object.keys(NHOM_HANH_DONG) })
  } catch (err) {
    console.error('[activity-log] list:', err)
    return fail(res, 500, err.message || 'Không tải được nhật ký ca trực')
  }
}
