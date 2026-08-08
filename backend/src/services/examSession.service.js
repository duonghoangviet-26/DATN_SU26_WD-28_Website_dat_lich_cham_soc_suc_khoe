import mongoose from 'mongoose'
import { DichVu, DonThuoc, HangDoi, KetQuaKham, LichHen, SinhHieuKham } from '../models/index.js'
import { soSanhThuTuHangDoi } from '../models/HangDoi.js'
import {
  CAC_BUOC,
  buocKeTiep,
  duocPhepVaoBuoc,
  kiemTraBuocChanDoan,
  kiemTraBuocTiepNhan,
  tinhBMI,
} from './examStepRules.js'

// ============================================================
// WS-1 — Phiên khám 4 bước. NGUỒN GHI DUY NHẤT cho hồ sơ khám.
// ============================================================
// `appointments.controller.js` (createResult / createResultByQueue / updateResult) nay gọi
// vào đây thay vì tự ghi. Có hai đường ghi song song vào cùng `KetQuaKham` là cách chắc
// chắn nhất để hai luồng lệch nhau — đúng thứ rule mục 7 cấm.

function loi(statusCode, message) {
  return Object.assign(new Error(message), { statusCode, httpStatus: statusCode })
}

// ─── Helper dùng chung (chuyển từ appointments.controller.js) ────────────────
// PASTE NGUYÊN VĂN thân 3 hàm dưới đây từ appointments.controller.js, chỉ thêm `export`:

// Upsert sinh hiệu — gắn theo appointment_id (lượt online) hoặc hang_doi_id (lượt offline,
// không có LichHen). Bác sĩ tự đo/nhập ngay khi nhập kết quả khám.
export async function upsertVitals({ appointmentId, hangDoiId, memberId, doctorUserId, sinhHieu }) {
  if (!sinhHieu) return
  const { can_nang, chieu_cao, huyet_ap, nhiet_do, nhip_tim } = sinhHieu
  const filter = appointmentId ? { appointment_id: appointmentId } : { hang_doi_id: hangDoiId }
  const setFields = {
    member_id: memberId ?? null,
    can_nang,
    chieu_cao,
    huyet_ap,
    nhiet_do,
    nhip_tim,
    nguoi_do_id: doctorUserId,
    thoi_diem_do: new Date(),
  }
  if (appointmentId) setFields.appointment_id = appointmentId
  if (hangDoiId) setFields.hang_doi_id = hangDoiId
  await SinhHieuKham.findOneAndUpdate(filter, { $set: setFields }, { upsert: true })
}

export async function taoChiDinhDichVu(value, specialtyId, doctorId) {
  if (!Array.isArray(value)) {
    return { ok: false, status: 400, message: 'Danh sách dịch vụ phát sinh không hợp lệ' }
  }

  const requested = value.map((item) => ({
    service_id: item?.service_id,
    so_luong: Number(item?.so_luong ?? 1),
  }))
  if (requested.length > 20) return { ok: false, status: 400, message: 'Tối đa 20 dịch vụ phát sinh cho một ca khám' }
  if (requested.some((item) => !item.service_id || !mongoose.Types.ObjectId.isValid(item.service_id) || !Number.isInteger(item.so_luong) || item.so_luong < 1)) {
    return { ok: false, status: 400, message: 'Dịch vụ hoặc số lượng chỉ định không hợp lệ' }
  }

  const ids = requested.map((item) => String(item.service_id))
  if (new Set(ids).size !== ids.length) return { ok: false, status: 400, message: 'Không được chỉ định trùng cùng một dịch vụ' }

  const services = await DichVu.find({
    _id: { $in: ids },
    status: 'active',
    loai: 'related',
    $or: [{ specialty_id: specialtyId }, { specialty_id: null }],
  }).select('ten gia').lean()
  if (services.length !== requested.length) {
    return { ok: false, status: 400, message: 'Có dịch vụ không còn hoạt động hoặc không thuộc chuyên khoa của ca khám' }
  }

  const byId = new Map(services.map((service) => [String(service._id), service]))
  return {
    ok: true,
    lines: requested.map((item) => {
      const service = byId.get(String(item.service_id))
      return {
        service_id: service._id,
        ten: service.ten,
        so_luong: item.so_luong,
        don_gia: service.gia,
        thanh_tien: service.gia * item.so_luong,
        chi_dinh_boi_bac_si_id: doctorId,
      }
    }),
  }
}

export async function getOwnedOfflineQueue(queueId, docId) {
  if (!mongoose.Types.ObjectId.isValid(queueId)) {
    throw Object.assign(new Error('Ma luot kham khong hop le'), { httpStatus: 400 })
  }
  const entry = await HangDoi.findOne({ _id: queueId, doctor_id: docId, nguon: 'offline' }).lean()
  if (!entry) throw Object.assign(new Error('Khong tim thay luot kham offline'), { httpStatus: 404 })
  if (!['trong_phong', 'hoan_thanh', 'cho_dich_vu'].includes(entry.trang_thai)) {
    throw Object.assign(new Error('Chi nhap ket qua khi benh nhan dang kham hoac da ket thuc kham'), { httpStatus: 409 })
  }
  return entry
}
