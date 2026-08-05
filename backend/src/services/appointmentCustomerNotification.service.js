import { NhatKyThaoTac, ThongBao } from '../models/index.js'

function formatDate(value) {
  if (!value) return null
  return new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
}

function buildAppointmentChangeContent({ appointment, action, reason = null }) {
  const ngay = formatDate(appointment.ngay_kham)
  const gio = appointment.gio_kham ?? ''
  const ma = appointment.ma_lich_hen ? ` (${appointment.ma_lich_hen})` : ''

  if (action === 'cancel') {
    return {
      title: 'Lịch khám của bạn đã được hủy',
      content: `Lịch khám${ma} vào lúc ${gio} ngày ${ngay} đã được hủy.`
        + (reason ? ` Lý do: ${reason}.` : ''),
    }
  }

  if (action === 'reschedule') {
    return {
      title: 'Lịch khám của bạn đã được dời',
      content: `Lịch khám${ma} đã được dời sang lúc ${gio} ngày ${ngay}.`
        + (reason ? ` Lý do: ${reason}.` : ''),
    }
  }

  if (action === 'doctor_changed') {
    return {
      title: 'Lịch khám của bạn đã đổi bác sĩ',
      content: `Lịch khám${ma} vào lúc ${gio} ngày ${ngay} đã được cập nhật bác sĩ phụ trách.`
        + (reason ? ` Lý do: ${reason}.` : ''),
    }
  }

  return {
    title: 'Lịch khám của bạn đã được cập nhật',
    content: `Lịch khám${ma} vào lúc ${gio} ngày ${ngay} đã được cập nhật.`
      + (reason ? ` Lý do: ${reason}.` : ''),
  }
}

function customerContactSnapshot(appointment) {
  return {
    appointment_id: appointment._id,
    ma_lich_hen: appointment.ma_lich_hen ?? null,
    user_id: appointment.user_id ?? null,
    ten_khach: appointment.ten_khach ?? null,
    so_dien_thoai_khach: appointment.so_dien_thoai_khach ?? null,
    email_khach: appointment.email_khach ?? null,
    nguoi_dat_ho_ten: appointment.nguoi_dat_ho_ten ?? null,
    nguoi_dat_sdt: appointment.nguoi_dat_sdt ?? null,
    ngay_kham: appointment.ngay_kham,
    gio_kham: appointment.gio_kham ?? null,
    status: appointment.status,
  }
}

export async function notifyAppointmentCustomerChange({
  appointment,
  action,
  reason = null,
  actorUserId = null,
  actorRole = 'system',
  session = null,
}) {
  if (!appointment?._id) {
    throw new Error('Thieu lich hen khi tao thong bao khach hang')
  }

  const { title, content } = buildAppointmentChangeContent({ appointment, action, reason })
  const basePayload = {
    action,
    reason,
    appointment: customerContactSnapshot(appointment),
  }

  if (appointment.user_id) {
    const [notification] = await ThongBao.create([{
      user_id: appointment.user_id,
      tieu_de: title,
      noi_dung: content,
      loai: 'appointment',
      related_id: appointment._id,
      related_type: 'appointment',
      du_lieu_dinh_kem: {
        ...basePayload,
        delivery_status: 'in_app_created',
      },
      kenh_gui: 'in_app',
      da_gui: true,
      thoi_diem_gui: new Date(),
      ngay_gui_du_kien: new Date(),
    }], session ? { session } : {})

    return {
      mode: 'in_app',
      notification_id: notification._id,
      manual_contact_required: false,
    }
  }

  const [audit] = await NhatKyThaoTac.create([{
    nguoi_thuc_hien_id: actorUserId,
    vai_tro: actorRole,
    hanh_dong: 'CUSTOMER_CONTACT_REQUIRED',
    loai_doi_tuong: 'appointment',
    doi_tuong_id: appointment._id,
    ly_do: `Can lien he thu cong voi khach: ${title}`,
    du_lieu_cu: null,
    du_lieu_moi: {
      ...basePayload,
      title,
      content,
      delivery_status: 'manual_contact_required',
    },
  }], session ? { session } : {})

  return {
    mode: 'manual_contact_required',
    audit_id: audit._id,
    manual_contact_required: true,
  }
}

export default {
  notifyAppointmentCustomerChange,
}
