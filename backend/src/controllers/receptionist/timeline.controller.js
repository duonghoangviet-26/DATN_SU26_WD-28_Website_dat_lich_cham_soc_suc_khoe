import { fail, ok } from '../../utils/response.js'
import { layTimelineHoSo, layTimelineLichHen } from '../../services/receptionistTimeline.service.js'

export const getTimeline = async (req, res) => {
  try {
    const { loai, id } = req.query
    if (!id) return fail(res, 400, 'Thiếu id đối tượng cần xem lịch sử')

    if (loai === 'ho_so') {
      const result = await layTimelineHoSo(id)
      return ok(res, result)
    }
    if (loai === 'lich_hen') {
      const result = await layTimelineLichHen(id)
      return ok(res, result)
    }
    return fail(res, 400, 'Tham số loại phải là ho_so hoặc lich_hen')
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}
