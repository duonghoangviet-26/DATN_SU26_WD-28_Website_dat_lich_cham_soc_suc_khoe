import { ok, fail } from '../utils/response.js'
import * as notificationService from '../services/notification.service.js'

export async function getNotifications(req, res) {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const result = await notificationService.getSystemNotifications(page, limit)
    
    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách thông báo hệ thống thành công',
      data: result.data,
      pagination: result.pagination
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

export async function sendNotification(req, res) {
  try {
    const { tieu_de, noi_dung, doi_tuong, admin_id } = req.body
    const newNotif = await notificationService.sendSystemNotification({
      tieu_de,
      noi_dung,
      doi_tuong,
      admin_id
    })
    
    return ok(res, newNotif, 'Gửi thông báo thành công', 201)
  } catch (err) {
    if (err.message.includes('không hợp lệ') || err.message.includes('Vui lòng cung cấp')) {
      return fail(res, 400, err.message)
    }
    return fail(res, 500, err.message)
  }
}

export async function updateNotification(req, res) {
  try {
    const { id } = req.params
    const { tieu_de, noi_dung } = req.body
    
    const updatedNotif = await notificationService.updateSystemNotification(id, {
      tieu_de,
      noi_dung
    })
    
    return ok(res, updatedNotif, 'Cập nhật thông báo thành công', 200)
  } catch (err) {
    if (err.message === 'Không tìm thấy thông báo') return fail(res, 404, err.message)
    if (err.message.includes('không hợp lệ') || err.message.includes('Vui lòng cung cấp')) {
      return fail(res, 400, err.message)
    }
    return fail(res, 500, err.message)
  }
}

export async function deleteNotification(req, res) {
  try {
    const { id } = req.params
    await notificationService.deleteSystemNotification(id)
    return ok(res, null, 'Xóa thông báo thành công', 200)
  } catch (err) {
    if (err.message === 'Không tìm thấy thông báo') return fail(res, 404, err.message)
    if (err.message.includes('không hợp lệ')) {
      return fail(res, 400, err.message)
    }
    return fail(res, 500, err.message)
  }
}
