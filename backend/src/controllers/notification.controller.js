import { ok, created, fail } from '../utils/response.js'
import * as notificationService from '../services/notification.service.js'

export async function getNotifications(req, res) {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 10
    const result = await notificationService.getNotifications({
      page,
      limit,
      user_id: req.query.user_id || null,
    })

    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    })
  } catch (err) {
    if (err.message.includes('khong hop le')) {
      return fail(res, 400, err.message)
    }
    return fail(res, 500, err.message)
  }
}

export async function getReceivedNotifications(req, res) {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 10
    const result = await notificationService.getNotifications({
      page,
      limit,
      user_id: req.user.id,
    })

    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    })
  } catch (err) {
    if (err.message.includes('khong hop le')) {
      return fail(res, 400, err.message)
    }
    return fail(res, 500, err.message)
  }
}

export async function sendNotification(req, res) {
  try {
    const notification = await notificationService.createNotification(req.body)
    return created(res, notification, 'Tao thong bao thanh cong')
  } catch (err) {
    if (err.message.includes('Thieu truong') || err.message.includes('khong hop le') || err.message.includes('bat buoc')) {
      return fail(res, 400, err.message)
    }
    return fail(res, 500, err.message)
  }
}

export async function updateNotification(req, res) {
  try {
    const updatedNotif = await notificationService.updateNotification(req.params.id, req.body)
    return ok(res, updatedNotif, 'Cap nhat thong bao thanh cong')
  } catch (err) {
    if (err.message === 'Khong tim thay thong bao') return fail(res, 404, err.message)
    if (err.message.includes('khong hop le') || err.message.includes('bat buoc')) {
      return fail(res, 400, err.message)
    }
    return fail(res, 500, err.message)
  }
}

export async function deleteNotification(req, res) {
  try {
    await notificationService.deleteNotification(req.params.id)
    return ok(res, null, 'Xoa thong bao thanh cong')
  } catch (err) {
    if (err.message === 'Khong tim thay thong bao') return fail(res, 404, err.message)
    if (err.message.includes('khong hop le')) {
      return fail(res, 400, err.message)
    }
    return fail(res, 500, err.message)
  }
}

export async function markNotificationAsRead(req, res) {
  try {
    const updatedNotif = await notificationService.markNotificationAsRead(req.params.id)
    return ok(res, updatedNotif, 'Danh dau da doc thanh cong')
  } catch (err) {
    if (err.message === 'Khong tim thay thong bao') return fail(res, 404, err.message)
    if (err.message.includes('khong hop le')) {
      return fail(res, 400, err.message)
    }
    return fail(res, 500, err.message)
  }
}

export async function getNotificationLogs(req, res) {
  try {
    const logs = await notificationService.getNotificationLogs(req.params.id)
    return ok(res, logs, 'Lay lich su thanh cong')
  } catch (err) {
    if (err.message.includes('khong hop le')) return fail(res, 400, err.message)
    return fail(res, 500, err.message)
  }
}
