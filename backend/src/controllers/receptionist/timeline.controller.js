import { fail, ok } from '../../utils/response.js'
import { layTimelineHoSo, layTimelineLichHen } from '../../services/receptionistTimeline.service.js'

export const getTimeline = async (req, res) => {
  try {
    const { loai, id } = req.query
    if (!id) return fail(res, 400, 'Thieu id doi tuong can xem lich su')

    if (loai === 'ho_so') {
      const result = await layTimelineHoSo(id)
      return ok(res, result)
    }
    if (loai === 'lich_hen') {
      const result = await layTimelineLichHen(id)
      return ok(res, result)
    }
    return fail(res, 400, 'Tham so loai phai la ho_so hoac lich_hen')
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}
