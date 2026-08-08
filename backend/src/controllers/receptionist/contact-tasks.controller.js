import { fail, ok } from '../../utils/response.js'
import { danhDauDaGoi, layDanhSachCanGoi } from '../../services/contactTasks.service.js'

export const getContactTasks = async (req, res) => {
  try {
    const tasks = await layDanhSachCanGoi({
      trangThai: req.query.trang_thai ?? null,
      tuNgay: req.query.tu_ngay ?? null,
      denNgay: req.query.den_ngay ?? null,
    })
    return ok(res, tasks)
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

export const markContactTaskDone = async (req, res) => {
  try {
    const result = await danhDauDaGoi({
      auditId: req.params.auditId,
      actorUserId: req.user?._id ?? req.user?.id ?? null,
      ghiChu: req.body?.ghi_chu,
    })
    return ok(res, result, 'Đã ghi nhận cuộc gọi')
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

export default { getContactTasks, markContactTaskDone }
