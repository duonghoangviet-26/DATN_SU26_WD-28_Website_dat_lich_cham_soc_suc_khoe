import mongoose from 'mongoose'
import { LichHen, NhatKyThaoTac } from '../models/index.js'

// ============================================================
// E-3 — Màn "Cần gọi thủ công". `NhatKyThaoTac` chỉ INSERT (immutable log), nên "đánh dấu
// đã gọi" KHÔNG được sửa bản ghi CUSTOMER_CONTACT_REQUIRED gốc — thay vào đó insert một bản
// ghi CUSTOMER_CONTACTED mới trỏ cùng doi_tuong_id. "Chưa gọi" = có CUSTOMER_CONTACT_REQUIRED
// mà CHƯA có CUSTOMER_CONTACTED nào mới hơn (phương án A, chốt trong kế hoạch task).
// ============================================================

const MAC_DINH_SO_NGAY = 7

/**
 * Ghép mỗi yêu cầu gọi với bản ghi "đã gọi" mới nhất phát sinh SAU nó (nếu có).
 * Tách riêng để test được mà không cần Mongo — logic ghép là phần dễ sai nhất.
 */
export function ganTrangThaiLienHe(requests, contacted) {
  const contactedByTarget = new Map()
  for (const record of contacted) {
    const key = String(record.doi_tuong_id)
    if (!contactedByTarget.has(key)) contactedByTarget.set(key, [])
    contactedByTarget.get(key).push(record)
  }

  return requests.map((request) => {
    const laterContacts = (contactedByTarget.get(String(request.doi_tuong_id)) ?? [])
      .filter((record) => new Date(record.ngay_tao).getTime() > new Date(request.ngay_tao).getTime())
      .sort((a, b) => new Date(a.ngay_tao).getTime() - new Date(b.ngay_tao).getTime())

    return {
      request,
      daGoi: laterContacts.length > 0,
      // Người gọi ĐẦU TIÊN sau yêu cầu — nếu hai lễ tân cùng gọi, người thứ hai vẫn được ghi
      // nhận (insert-only, không chặn), nhưng danh sách ưu tiên hiện người xử lý trước.
      contactedRecord: laterContacts[0] ?? null,
    }
  })
}

function serializeTask({ request, daGoi, contactedRecord }, appointmentById) {
  const appointment = appointmentById.get(String(request.doi_tuong_id)) ?? null
  const snapshot = request.du_lieu_moi?.appointment ?? {}
  return {
    audit_id: String(request._id),
    appointment_id: String(request.doi_tuong_id),
    trang_thai: daGoi ? 'da_goi' : 'chua_goi',
    ten_khach: appointment?.ten_khach ?? snapshot.ten_khach ?? null,
    so_dien_thoai: appointment?.so_dien_thoai_khach ?? snapshot.so_dien_thoai_khach ?? null,
    ma_lich_hen: appointment?.ma_lich_hen ?? snapshot.ma_lich_hen ?? null,
    gio_kham_cu: snapshot.gio_kham ?? null,
    gio_kham_moi: appointment?.gio_kham ?? null,
    bac_si: appointment?.doctor_id?.user_id?.ho_ten ?? null,
    tieu_de: request.du_lieu_moi?.title ?? null,
    noi_dung: request.du_lieu_moi?.content ?? null,
    ly_do_can_goi: request.ly_do ?? null,
    ngay_tao: request.ngay_tao,
    da_goi_luc: contactedRecord?.ngay_tao ?? null,
    da_goi_boi: contactedRecord?.nguoi_thuc_hien_id?.ho_ten ?? null,
    ghi_chu_cuoc_goi: contactedRecord?.ly_do ?? null,
  }
}

export async function layDanhSachCanGoi({ trangThai = null, tuNgay = null, denNgay = null } = {}) {
  const now = new Date()
  const tu = tuNgay ? new Date(tuNgay) : new Date(now.getTime() - MAC_DINH_SO_NGAY * 86400000)
  const den = denNgay ? new Date(denNgay) : now

  const requests = await NhatKyThaoTac.find({
    hanh_dong: 'CUSTOMER_CONTACT_REQUIRED',
    ngay_tao: { $gte: tu, $lte: den },
  }).sort({ ngay_tao: -1 }).lean()

  if (requests.length === 0) return []

  const targetIds = requests.map((request) => request.doi_tuong_id)
  const contacted = await NhatKyThaoTac.find({
    hanh_dong: 'CUSTOMER_CONTACTED',
    doi_tuong_id: { $in: targetIds },
  })
    .populate('nguoi_thuc_hien_id', 'ho_ten')
    .lean()

  const appointments = await LichHen.find({ _id: { $in: targetIds } })
    .select('ma_lich_hen ten_khach so_dien_thoai_khach gio_kham doctor_id')
    .populate({ path: 'doctor_id', select: 'user_id', populate: { path: 'user_id', select: 'ho_ten' } })
    .lean()
  const appointmentById = new Map(appointments.map((appointment) => [String(appointment._id), appointment]))

  const merged = ganTrangThaiLienHe(requests, contacted)
  const filtered = trangThai === 'da_goi' || trangThai === 'chua_goi'
    ? merged.filter((item) => (trangThai === 'da_goi' ? item.daGoi : !item.daGoi))
    : merged

  return filtered.map((item) => serializeTask(item, appointmentById))
}

export async function danhDauDaGoi({ auditId, actorUserId, ghiChu = null }) {
  if (!mongoose.Types.ObjectId.isValid(auditId)) {
    throw Object.assign(new Error('Mã việc cần gọi không hợp lệ'), { statusCode: 400 })
  }
  const request = await NhatKyThaoTac.findOne({ _id: auditId, hanh_dong: 'CUSTOMER_CONTACT_REQUIRED' }).lean()
  if (!request) throw Object.assign(new Error('Không tìm thấy việc cần gọi'), { statusCode: 404 })

  // KHÔNG kiểm tra "đã có ai đánh dấu chưa" rồi chặn — log chỉ insert, hai lễ tân cùng gọi
  // một khách thì được chấp nhận trùng, hiển thị đủ cả hai (đã ghi trong tài liệu thiết kế).
  const audit = await NhatKyThaoTac.create({
    nguoi_thuc_hien_id: actorUserId,
    vai_tro: 'receptionist',
    hanh_dong: 'CUSTOMER_CONTACTED',
    loai_doi_tuong: 'appointment',
    doi_tuong_id: request.doi_tuong_id,
    ly_do: ghiChu?.trim() || null,
  })

  return { id: String(audit._id) }
}
