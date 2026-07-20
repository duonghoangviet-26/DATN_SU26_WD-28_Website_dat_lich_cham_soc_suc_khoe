import mongoose from 'mongoose'

import ThongBao from '../models/ThongBao.js'
import ThongBaoHeThong from '../models/ThongBaoHeThong.js'
import NguoiDung from '../models/NguoiDung.js'
import NhatKyThaoTac from '../models/NhatKyThaoTac.js'
import { isMailConfigured, sendNotificationEmail } from './mail.service.js'

const TARGET_ROLES = {
  tat_ca: ['user', 'patient', 'doctor', 'receptionist', 'nurse'],
  benh_nhan: ['user', 'patient'],
  bac_si: ['doctor'],
  le_tan: ['receptionist'],
  y_ta: ['nurse'],
}

const TARGETS = Object.keys(TARGET_ROLES)

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value)
}

function formatUserNotification(notification) {
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

function formatSystemNotification(notification) {
  return {
    _id: notification._id,
    tieu_de: notification.tieu_de,
    noi_dung: notification.noi_dung,
    url: notification.url ?? null,
    doi_tuong: notification.doi_tuong,
    tao_boi: notification.tao_boi
      ? {
          _id: notification.tao_boi._id ?? notification.tao_boi,
          ho_ten: notification.tao_boi.ho_ten,
          email: notification.tao_boi.email,
        }
      : null,
    ngay_gui: notification.ngay_gui ?? notification.ngay_tao ?? null,
    so_nguoi_nhan: Number(notification.so_nguoi_nhan) || 0,
    status: notification.status ?? 'da_gui',
    ngay_tao: notification.ngay_tao ?? null,
  }
}

function pickSystemSnapshot(notification) {
  return {
    tieu_de: notification.tieu_de,
    noi_dung: notification.noi_dung,
    doi_tuong: notification.doi_tuong,
    so_nguoi_nhan: Number(notification.so_nguoi_nhan) || 0,
    ngay_gui: notification.ngay_gui ?? null,
  }
}

async function writeNotificationAudit(actorId, action, targetId, oldData, newData) {
  if (!isValidObjectId(actorId) || !isValidObjectId(targetId)) return

  await NhatKyThaoTac.create({
    nguoi_thuc_hien_id: actorId,
    vai_tro: 'admin',
    hanh_dong: action,
    loai_doi_tuong: 'system_notification',
    doi_tuong_id: targetId,
    du_lieu_cu: oldData,
    du_lieu_moi: newData,
  })
}

async function sendNotificationEmailsInBackground(recipients, notification, url) {
  if (!isMailConfigured()) {
    console.warn('[notification-email] EMAIL_USER/EMAIL_PASS chua duoc cau hinh, bo qua gui email')
    return
  }

  const emailRecipients = recipients.filter((recipient) => recipient.email)
  if (emailRecipients.length === 0) return

  const results = await Promise.allSettled(
    emailRecipients.map((recipient) =>
      sendNotificationEmail({
        to: recipient.email,
        title: notification.tieu_de,
        content: notification.noi_dung,
        url,
      }),
    ),
  )

  const failed = results
    .map((result, index) => ({ result, recipient: emailRecipients[index] }))
    .filter(({ result }) => result.status === 'rejected')

  if (failed.length > 0) {
    console.error('[notification-email] Gui email thong bao that bai', {
      notification_id: notification._id?.toString?.() ?? notification._id,
      failed: failed.map(({ result, recipient }) => ({
        email: recipient.email,
        reason: result.reason?.message ?? String(result.reason),
      })),
    })
  }

  const sentCount = results.length - failed.length
  if (sentCount > 0) {
    console.info('[notification-email] Da gui email thong bao', {
      notification_id: notification._id?.toString?.() ?? notification._id,
      sent: sentCount,
      failed: failed.length,
    })
  }
}

export async function getNotifications({ page = 1, limit = 10, user_id = null }) {
  const pageNum = Math.max(1, Number(page) || 1)
  const limitNum = Math.max(1, Number(limit) || 10)
  const skip = (pageNum - 1) * limitNum

  if (user_id) {
    if (!isValidObjectId(user_id)) {
      throw new Error('user_id khong hop le')
    }

    const filter = { user_id }
    const [notifications, total] = await Promise.all([
      ThongBao.find(filter)
        .sort({ ngay_tao: -1, _id: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ThongBao.countDocuments(filter),
    ])

    return {
      data: notifications.map(formatUserNotification),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: total === 0 ? 1 : Math.ceil(total / limitNum),
      },
    }
  }

  const [notifications, total] = await Promise.all([
    ThongBaoHeThong.find({})
      .populate('tao_boi', 'ho_ten email')
      .sort({ ngay_gui: -1, ngay_tao: -1, _id: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    ThongBaoHeThong.countDocuments({}),
  ])

  return {
    data: notifications.map(formatSystemNotification),
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: total === 0 ? 1 : Math.ceil(total / limitNum),
    },
  }
}

export async function createNotification(payload, actorId) {
  const {
    tieu_de,
    noi_dung,
    doi_tuong,
    url = null,
    kenh_gui = 'in_app',
    recipient_ids = [],
  } = payload

  if (!tieu_de || !noi_dung || !doi_tuong) {
    throw new Error('Thieu truong bat buoc khi tao thong bao')
  }

  if (!TARGETS.includes(doi_tuong)) {
    throw new Error('doi_tuong khong hop le')
  }

  if (!['in_app', 'email'].includes(kenh_gui)) {
    throw new Error('kenh_gui khong hop le')
  }

  if (!isValidObjectId(actorId)) {
    throw new Error('admin_id khong hop le')
  }

  if (!Array.isArray(recipient_ids)) {
    throw new Error('recipient_ids khong hop le')
  }

  const invalidRecipientIds = recipient_ids.filter((id) => !isValidObjectId(id))
  if (invalidRecipientIds.length > 0) {
    throw new Error('recipient_ids khong hop le')
  }

  const sentAt = new Date()
  const recipientFilter = {
    role: { $in: TARGET_ROLES[doi_tuong] },
    status: 'active',
    ngay_xoa: null,
  }

  if (recipient_ids.length > 0) {
    recipientFilter._id = { $in: recipient_ids }
  }

  const recipients = await NguoiDung.find(recipientFilter).select('_id email').lean()

  if (recipient_ids.length > 0 && recipients.length !== recipient_ids.length) {
    throw new Error('Mot so nguoi nhan khong hop le hoac khong thuoc doi tuong da chon')
  }

  const systemNotification = await ThongBaoHeThong.create({
    tieu_de: tieu_de.trim(),
    noi_dung: noi_dung.trim(),
    url,
    doi_tuong,
    tao_boi: actorId,
    ngay_gui: sentAt,
    so_nguoi_nhan: recipients.length,
  })

  if (recipients.length > 0) {
    await ThongBao.insertMany(
      recipients.map((recipient) => ({
        user_id: recipient._id,
        tieu_de: systemNotification.tieu_de,
        noi_dung: systemNotification.noi_dung,
        loai: 'system',
        related_id: systemNotification._id,
        related_type: 'system_notification',
        du_lieu_dinh_kem: { system_notification_id: systemNotification._id, url, kenh_gui },
        kenh_gui,
        da_gui: true,
        thoi_diem_gui: sentAt,
        ngay_gui_du_kien: sentAt,
      })),
      { ordered: false },
    )
  }

  await writeNotificationAudit(
    actorId,
    'CREATE_SYSTEM_NOTIFICATION',
    systemNotification._id,
    null,
    pickSystemSnapshot(systemNotification),
  )

  if (kenh_gui === 'email') {
    void sendNotificationEmailsInBackground(recipients, systemNotification, url).catch((error) => {
      console.error('[notification-email] Loi khong mong doi khi gui email thong bao', {
        notification_id: systemNotification._id?.toString?.() ?? systemNotification._id,
        message: error.message,
      })
    })
  }

  const populated = await ThongBaoHeThong.findById(systemNotification._id)
    .populate('tao_boi', 'ho_ten email')
    .lean()
  return formatSystemNotification(populated ?? systemNotification.toObject())
}

export async function updateNotification(id, payload, actorId = null) {
  if (!isValidObjectId(id)) {
    throw new Error('ID thong bao khong hop le')
  }

  const notification = await ThongBaoHeThong.findById(id)
  if (!notification) {
    throw new Error('Khong tim thay thong bao')
  }

  const oldData = pickSystemSnapshot(notification)

  if (Object.prototype.hasOwnProperty.call(payload, 'tieu_de')) {
    if (!payload.tieu_de?.trim()) throw new Error('tieu_de bat buoc')
    notification.tieu_de = payload.tieu_de.trim()
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'noi_dung')) {
    if (!payload.noi_dung?.trim()) throw new Error('noi_dung bat buoc')
    notification.noi_dung = payload.noi_dung.trim()
  }

  await notification.save()
  const newData = pickSystemSnapshot(notification)

  await writeNotificationAudit(actorId, 'UPDATE_SYSTEM_NOTIFICATION', notification._id, oldData, newData)

  const populated = await ThongBaoHeThong.findById(notification._id)
    .populate('tao_boi', 'ho_ten email')
    .lean()
  return formatSystemNotification(populated ?? notification.toObject())
}

export async function deleteNotification(id, actorId = null) {
  if (!isValidObjectId(id)) {
    throw new Error('ID thong bao khong hop le')
  }

  const notification = await ThongBaoHeThong.findByIdAndDelete(id).lean()
  if (!notification) {
    throw new Error('Khong tim thay thong bao')
  }

  await writeNotificationAudit(actorId, 'DELETE_SYSTEM_NOTIFICATION', id, pickSystemSnapshot(notification), null)

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

  return formatUserNotification(notification.toObject())
}

export async function getNotificationLogs(id) {
  if (!isValidObjectId(id)) {
    throw new Error('ID thong bao khong hop le')
  }

  return NhatKyThaoTac.find({
    loai_doi_tuong: 'system_notification',
    doi_tuong_id: id,
  })
    .populate('nguoi_thuc_hien_id', 'ho_ten email')
    .sort({ ngay_tao: -1, _id: -1 })
    .lean()
}
