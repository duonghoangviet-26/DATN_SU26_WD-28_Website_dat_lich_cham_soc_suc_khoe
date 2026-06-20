import { ChuyenKhoa } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'

export async function list(req, res) {
  try {
    const specialties = await ChuyenKhoa.find({ status: 'active' })
      .sort({ thu_tu: 1, ten: 1 })
      .select('_id ten')
      .lean()
    return ok(res, specialties.map(s => ({ id: s._id, ten: s.ten })))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
