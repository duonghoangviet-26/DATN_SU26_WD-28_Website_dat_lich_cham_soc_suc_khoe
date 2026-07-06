import mongoose from 'mongoose'

import ThongBao from '../models/ThongBao.js'

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value)
}

function formatNotification(notification) {
  return {
    _id: notification._id,
    user_id: notification.user_id?._id ?? notification.user_id ?? null,
    tieu_de: notification.tieu_de,
    noi_dung: notification.noi_dung,
    loai: notification.loai,
    related_id: notification.related_id ?? null,
    related_type: notification.related_type ?? null,
    da_doc: notification.da_doc ?? false,
    du_lieu_dinh_kem: notification.du_lieu_dinh_kem ?? null,
    kenh_gui: notification.kenh_gui ?? null,
    da_gui: notification.da_gui ?? false,
    thoi_diem_gui: notification.thoi_diem_gui ?? null,
    thoi_diem_doc: notification.thoi_diem_doc ?? null,
    ngay_gui_du_kien: notification.ngay_gui_du_kien ?? null,
    ngay_tao: notification.ngay_tao ?? null,
  }
}

export async function getNotifications({ page = 1, limit = 10, user_id = null }) {
  const pageNum = Math.max(1, Number(page) || 1)
  const limitNum = Math.max(1, Number(limit) || 10)
  const skip = (pageNum - 1) * limitNum

  const filter = {}
  if (user_id) {
    if (!isValidObjectId(user_id)) {
      throw new Error('user_id khong hop le')
    }
    filter.user_id = user_id
  }

  const [notifications, total] = await Promise.all([
    ThongBao.find(filter)
      .sort({ ngay_tao: -1, _id: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    ThongBao.countDocuments(filter),
  ])

  return {
    data: notifications.map(formatNotification),
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: total === 0 ? 1 : Math.ceil(total / limitNum),
    },
  }
}

export async function createNotification(payload) {
  const {
    user_id,
    tieu_de,
    noi_dung,
    loai,
    related_id = null,
    related_type = null,
    du_lieu_dinh_kem = null,
    kenh_gui = null,
    da_gui = false,
    thoi_diem_gui = null,
    thoi_diem_doc = null,
    ngay_gui_du_kien,
  } = payload

  if (!user_id || !tieu_de || !noi_dung || !loai || !ngay_gui_du_kien) {
    throw new Error('Thieu truong bat buoc khi tao thong bao')
  }

  if (!isValidObjectId(user_id)) {
    throw new Error('user_id khong hop le')
  }

  if (related_id && !isValidObjectId(related_id)) {
    throw new Error('related_id khong hop le')
  }

  const notification = await ThongBao.create({
    user_id,
    tieu_de,
    noi_dung,
    loai,
    related_id,
    related_type,
    du_lieu_dinh_kem,
    kenh_gui,
    da_gui,
    thoi_diem_gui: thoi_diem_gui ? new Date(thoi_diem_gui) : null,
    thoi_diem_doc: thoi_diem_doc ? new Date(thoi_diem_doc) : null,
    ngay_gui_du_kien: new Date(ngay_gui_du_kien),
  })

  return formatNotification(notification.toObject())
}

export async function updateNotification(id, payload) {
  if (!isValidObjectId(id)) {
    throw new Error('ID thong bao khong hop le')
  }

  const notification = await ThongBao.findById(id)
  if (!notification) {
    throw new Error('Khong tim thay thong bao')
  }

  const allowedFields = [
    'tieu_de',
    'noi_dung',
    'loai',
    'related_type',
    'du_lieu_dinh_kem',
    'kenh_gui',
    'da_gui',
    'thoi_diem_gui',
    'thoi_diem_doc',
    'ngay_gui_du_kien',
  ]

  for (const field of allowedFields) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) continue

    if (['thoi_diem_gui', 'thoi_diem_doc', 'ngay_gui_du_kien'].includes(field) && payload[field]) {
      notification[field] = new Date(payload[field])
    } else {
      notification[field] = payload[field]
    }
  }

  await notification.save()
  return formatNotification(notification.toObject())
}

export async function deleteNotification(id) {
  if (!isValidObjectId(id)) {
    throw new Error('ID thong bao khong hop le')
  }

  const notification = await ThongBao.findByIdAndDelete(id).lean()
  if (!notification) {
    throw new Error('Khong tim thay thong bao')
  }

  return true
}

export async function markNotificationAsRead(id) {
  if (!isValidObjectId(id)) {
    throw new Error('ID thong bao khong hop le')
  }

  const notification = await ThongBao.findById(id)
  if (!notification) {
    throw new Error('Khong tim thay thong bao')
  }

  notification.da_doc = true
  notification.thoi_diem_doc = notification.thoi_diem_doc || new Date()
  await notification.save()

  return formatNotification(notification.toObject())
}

export async function getNotificationLogs() {
  return []
}
