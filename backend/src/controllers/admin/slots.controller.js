import { generateRollingWindowForAllDoctors } from '../../services/scheduleGenerator.service.js'
import { ok, fail } from '../../utils/response.js'

// ============================================================
// B2 — Sinh lịch làm việc thủ công (Admin)
// Routes: /api/admin/slots
// ============================================================
// Fallback khi cron 23:55 lỗi — xem docs/Bác sĩ/B2 - Lịch làm việc.md mục 2.3.

// ─── POST /api/admin/slots/generate ─────────────────────────────────────────
export async function generate(req, res) {
  try {
    const result = await generateRollingWindowForAllDoctors()
    return ok(res, result, result.skipped
      ? result.reason
      : `Đã sinh lịch ngày ${result.date.toISOString().slice(0, 10)} cho ${result.generated}/${result.total} bác sĩ`)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
