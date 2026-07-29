import { NguoiDung, ThongBao, ThongBaoHeThong } from '../models/index.js'

const REMINDER_TYPE = 'news_article_reminder'
const REMINDER_URL = '/receptionist/news/create'
const CLINIC_TIMEZONE = 'Asia/Ho_Chi_Minh'

function getClinicDateTimeParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

function buildReminderKey(date = new Date()) {
  const parts = getClinicDateTimeParts(date)
  return `${parts.year}-${parts.month}-${parts.day}-${parts.hour}${parts.minute}`
}

export async function sendWeeklyNewsArticleReminder({ scheduledAt = new Date() } = {}) {
  const reminderKey = buildReminderKey(scheduledAt)

  const existingCount = await ThongBao.countDocuments({
    'du_lieu_dinh_kem.reminder_type': REMINDER_TYPE,
    'du_lieu_dinh_kem.reminder_key': reminderKey,
  })

  if (existingCount > 0) {
    return {
      reminderKey,
      recipientCount: 0,
      insertedCount: 0,
      skipped: true,
      reason: 'duplicate_reminder_key',
    }
  }

  const receptionists = await NguoiDung.find({
    role: 'receptionist',
    status: 'active',
    ngay_xoa: null,
  })
    .select('_id')
    .lean()

  if (receptionists.length === 0) {
    return {
      reminderKey,
      recipientCount: 0,
      insertedCount: 0,
      skipped: true,
      reason: 'no_active_receptionists',
    }
  }

  const sentAt = new Date()
  const title = 'Nhắc thêm bài viết tin tức mới'
  const content = 'Đã đến lịch cập nhật tin tức/cẩm nang sức khỏe. Vui lòng thêm bài viết mới trong mục Tin tức của cổng lễ tân.'
  const systemNotification = await ThongBaoHeThong.create({
    tieu_de: title,
    noi_dung: content,
    url: REMINDER_URL,
    doi_tuong: 'le_tan',
    tao_boi: null,
    ngay_gui: sentAt,
    so_nguoi_nhan: receptionists.length,
  })

  const result = await ThongBao.insertMany(
    receptionists.map((receptionist) => ({
      user_id: receptionist._id,
      tieu_de: title,
      noi_dung: content,
      loai: 'reminder',
      related_id: systemNotification._id,
      related_type: 'system_notification',
      du_lieu_dinh_kem: {
        system_notification_id: systemNotification._id,
        reminder_type: REMINDER_TYPE,
        reminder_key: reminderKey,
        url: REMINDER_URL,
        lich_nhac: 'Thứ 4 hằng tuần lúc 08:00 và 20:00',
      },
      kenh_gui: 'in_app',
      da_gui: true,
      thoi_diem_gui: sentAt,
      ngay_gui_du_kien: sentAt,
    })),
    { ordered: false }
  )

  return {
    reminderKey,
    recipientCount: receptionists.length,
    insertedCount: result.length,
    skipped: false,
    reason: null,
  }
}
