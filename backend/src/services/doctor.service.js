import { BacSi, NguoiDung, LichHen, NhatKyThaoTac } from '../models/index.js'
import mongoose from 'mongoose'

// ============================================================
// DOCTOR SERVICE — Quản lý bác sĩ (Admin)
// ============================================================
// Tầng nghiệp vụ: toàn bộ logic nằm ở đây, controller chỉ gọi
// và trả về response.
// Quy tắc suspend: chỉ đổi trang_thai_duyet → 'suspended',
// KHÔNG đổi NguoiDung.role (giữ nguyên để bảo toàn dữ liệu).
// ============================================================

// ── Helper ghi audit log ─────────────────────────────────────
async function ghiLog({ adminId, hanhDong, doiTuongId, lyDo = null, duLieuCu = null, duLieuMoi = null }) {
  await NhatKyThaoTac.create({
    nguoi_thuc_hien_id: adminId,
    vai_tro: 'admin',
    hanh_dong: hanhDong,
    loai_doi_tuong: 'doctor',
    doi_tuong_id: doiTuongId,
    ly_do: lyDo,
    du_lieu_cu: duLieuCu,
    du_lieu_moi: duLieuMoi,
  })
}

// ── 1. Danh sách bác sĩ (có filter + phân trang) ─────────────
export async function getDoctorList({ trang_thai, chuyen_khoa, keyword, page = 1, limit = 10 } = {}) {
  const filter = {}

  // Lọc theo trạng thái duyệt
  if (trang_thai) {
    const validStatus = ['pending', 'approved', 'rejected', 'suspended']
    if (!validStatus.includes(trang_thai)) {
      throw new Error(`trang_thai không hợp lệ. Chấp nhận: ${validStatus.join(', ')}`)
    }
    filter.trang_thai_duyet = trang_thai
  }

  // Lọc theo chuyên khoa (ObjectId)
  if (chuyen_khoa) {
    if (!mongoose.Types.ObjectId.isValid(chuyen_khoa)) {
      throw new Error('chuyen_khoa không phải ObjectId hợp lệ')
    }
    filter.specialties = chuyen_khoa
  }

  // Tính offset phân trang
  const skip = (Number(page) - 1) * Number(limit)

  // Query BacSi, populate NguoiDung (thông tin cá nhân) và ChuyenKhoa (tên)
  let query = BacSi.find(filter)
    .populate({
      path: 'user_id',
      select: 'ho_ten email so_dien_thoai anh_dai_dien role status',
    })
    .populate({
      path: 'specialties',
      select: 'ten slug icon_url status',
    })
    .sort({ ngay_tao: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean()

  // Tìm theo tên / email (sau khi populate không filter được ở DB level —
  // với dự án nhỏ dùng JS filter sau populate là chấp nhận được)
  let docs = await query

  if (keyword) {
    const kw = keyword.trim().toLowerCase()
    docs = docs.filter((d) => {
      const u = d.user_id
      return (
        u?.ho_ten?.toLowerCase().includes(kw) ||
        u?.email?.toLowerCase().includes(kw)
      )
    })
  }

  const total = await BacSi.countDocuments(filter)

  return {
    doctors: docs,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  }
}

// ── 2. Chi tiết một bác sĩ ───────────────────────────────────
export async function getDoctorDetail(doctorId) {
  if (!mongoose.Types.ObjectId.isValid(doctorId)) {
    throw new Error('doctorId không hợp lệ')
  }

  const doctor = await BacSi.findById(doctorId)
    .populate({ path: 'user_id', select: 'ho_ten email so_dien_thoai anh_dai_dien role status ngay_tao' })
    .populate({ path: 'specialties', select: 'ten slug icon_url status' })
    .populate({ path: 'services', select: 'ten loai gia thoi_gian_phut status ma_dich_vu' })
    .lean()

  if (!doctor) throw new Error('Không tìm thấy bác sĩ')

  // Thống kê lịch hẹn
  const tongLichHen = await LichHen.countDocuments({ doctor_id: doctorId })
  const lichHenSapToi = await LichHen.countDocuments({
    doctor_id: doctorId,
    status: { $in: ['pending', 'confirmed'] },
    ngay_kham: { $gte: new Date() },
  })

  return {
    ...doctor,
    thong_ke: {
      tong_lich_hen: tongLichHen,
      lich_hen_sap_toi: lichHenSapToi,
    },
  }
}

// ── 3. Duyệt bác sĩ (pending → approved) ────────────────────
export async function approveDoctor(doctorId, adminId) {
  if (!mongoose.Types.ObjectId.isValid(doctorId)) throw new Error('doctorId không hợp lệ')

  const doctor = await BacSi.findById(doctorId)
  if (!doctor) throw new Error('Không tìm thấy bác sĩ')

  if (doctor.trang_thai_duyet === 'approved') {
    throw new Error('Bác sĩ đã được duyệt trước đó')
  }
  if (!['pending', 'rejected'].includes(doctor.trang_thai_duyet)) {
    throw new Error(`Không thể duyệt bác sĩ đang ở trạng thái: ${doctor.trang_thai_duyet}`)
  }

  const duLieuCu = { trang_thai_duyet: doctor.trang_thai_duyet }

  // Cập nhật BacSi
  doctor.trang_thai_duyet = 'approved'
  doctor.ly_do_tu_choi = null
  await doctor.save()

  // Cập nhật NguoiDung.role = 'doctor'
  await NguoiDung.findByIdAndUpdate(doctor.user_id, { role: 'doctor' })

  // Ghi audit log
  await ghiLog({
    adminId,
    hanhDong: 'APPROVE_DOCTOR',
    doiTuongId: doctorId,
    duLieuCu,
    duLieuMoi: { trang_thai_duyet: 'approved' },
  })

  return await getDoctorDetail(doctorId)
}

// ── 4. Từ chối bác sĩ (pending → rejected) ──────────────────
export async function rejectDoctor(doctorId, adminId, ly_do) {
  if (!mongoose.Types.ObjectId.isValid(doctorId)) throw new Error('doctorId không hợp lệ')
  if (!ly_do || !ly_do.trim()) throw new Error('Lý do từ chối là bắt buộc')

  const doctor = await BacSi.findById(doctorId)
  if (!doctor) throw new Error('Không tìm thấy bác sĩ')

  if (doctor.trang_thai_duyet !== 'pending') {
    throw new Error(`Chỉ có thể từ chối bác sĩ đang ở trạng thái pending. Hiện tại: ${doctor.trang_thai_duyet}`)
  }

  const MAX_SO_LAN_NOP = 5
  if (doctor.so_lan_nop >= MAX_SO_LAN_NOP) {
    throw new Error(`Bác sĩ đã nộp hồ sơ tối đa ${MAX_SO_LAN_NOP} lần, không thể từ chối để nộp lại`)
  }

  const duLieuCu = { trang_thai_duyet: doctor.trang_thai_duyet, ly_do_tu_choi: doctor.ly_do_tu_choi }

  doctor.trang_thai_duyet = 'rejected'
  doctor.ly_do_tu_choi = ly_do.trim()
  await doctor.save()

  await ghiLog({
    adminId,
    hanhDong: 'REJECT_DOCTOR',
    doiTuongId: doctorId,
    lyDo: ly_do.trim(),
    duLieuCu,
    duLieuMoi: { trang_thai_duyet: 'rejected', ly_do_tu_choi: ly_do.trim() },
  })

  return await getDoctorDetail(doctorId)
}

// ── 5. Đình chỉ bác sĩ (approved → suspended) ───────────────
// KHÔNG đổi NguoiDung.role — giữ nguyên 'doctor' (theo yêu cầu)
export async function suspendDoctor(doctorId, adminId, ly_do) {
  if (!mongoose.Types.ObjectId.isValid(doctorId)) throw new Error('doctorId không hợp lệ')
  if (!ly_do || !ly_do.trim()) throw new Error('Lý do đình chỉ là bắt buộc')

  const doctor = await BacSi.findById(doctorId)
  if (!doctor) throw new Error('Không tìm thấy bác sĩ')

  if (doctor.trang_thai_duyet !== 'approved') {
    throw new Error(`Chỉ có thể đình chỉ bác sĩ đang ở trạng thái approved. Hiện tại: ${doctor.trang_thai_duyet}`)
  }

  // Cảnh báo nếu có lịch hẹn sắp tới (nhưng vẫn cho phép đình chỉ)
  const lichHenSapToi = await LichHen.countDocuments({
    doctor_id: doctorId,
    status: { $in: ['pending', 'confirmed'] },
    ngay_kham: { $gte: new Date() },
  })

  const duLieuCu = { trang_thai_duyet: doctor.trang_thai_duyet }

  doctor.trang_thai_duyet = 'suspended'
  await doctor.save()

  await ghiLog({
    adminId,
    hanhDong: 'SUSPEND_DOCTOR',
    doiTuongId: doctorId,
    lyDo: ly_do.trim(),
    duLieuCu,
    duLieuMoi: { trang_thai_duyet: 'suspended' },
  })

  const result = await getDoctorDetail(doctorId)

  return {
    ...result,
    canh_bao: lichHenSapToi > 0
      ? `Bác sĩ còn ${lichHenSapToi} lịch hẹn sắp tới chưa xử lý`
      : null,
  }
}

// ── 6. Khôi phục bác sĩ (suspended → approved) ──────────────
export async function restoreDoctor(doctorId, adminId) {
  if (!mongoose.Types.ObjectId.isValid(doctorId)) throw new Error('doctorId không hợp lệ')

  const doctor = await BacSi.findById(doctorId)
  if (!doctor) throw new Error('Không tìm thấy bác sĩ')

  if (doctor.trang_thai_duyet !== 'suspended') {
    throw new Error(`Chỉ có thể khôi phục bác sĩ đang ở trạng thái suspended. Hiện tại: ${doctor.trang_thai_duyet}`)
  }

  const duLieuCu = { trang_thai_duyet: doctor.trang_thai_duyet }

  doctor.trang_thai_duyet = 'approved'
  await doctor.save()

  // Đảm bảo role vẫn là 'doctor'
  await NguoiDung.findByIdAndUpdate(doctor.user_id, { role: 'doctor' })

  await ghiLog({
    adminId,
    hanhDong: 'RESTORE_DOCTOR',
    doiTuongId: doctorId,
    duLieuCu,
    duLieuMoi: { trang_thai_duyet: 'approved' },
  })

  return await getDoctorDetail(doctorId)
}

// ── 7. Lịch sử thao tác của một bác sĩ ──────────────────────
export async function getDoctorAuditLogs(doctorId) {
  if (!mongoose.Types.ObjectId.isValid(doctorId)) throw new Error('doctorId không hợp lệ')

  const logs = await NhatKyThaoTac.find({
    loai_doi_tuong: 'doctor',
    doi_tuong_id: doctorId,
  })
    .populate({ path: 'nguoi_thuc_hien_id', select: 'ho_ten email anh_dai_dien' })
    .sort({ ngay_tao: -1 })
    .limit(50)
    .lean()

  return logs
}

// ── 8. Cập nhật thông tin bác sĩ ────────────────────────────
export async function updateDoctorInfo(doctorId, updateData, adminId) {
  if (!mongoose.Types.ObjectId.isValid(doctorId)) throw new Error('doctorId không hợp lệ')

  const doctor = await BacSi.findById(doctorId)
  if (!doctor) throw new Error('Không tìm thấy bác sĩ')

  const allowedFields = ['tieu_su', 'bang_cap', 'kinh_nghiem', 'so_nam_kinh_nghiem', 'phi_tu_van', 'la_hien']
  const duLieuCu = {}
  const duLieuMoi = {}
  let hasChanges = false

  for (const field of allowedFields) {
    if (updateData[field] !== undefined && updateData[field] !== doctor[field]) {
      duLieuCu[field] = doctor[field]
      duLieuMoi[field] = updateData[field]
      doctor[field] = updateData[field]
      hasChanges = true
    }
  }

  if (hasChanges) {
    await doctor.save()

    await ghiLog({
      adminId,
      hanhDong: 'UPDATE_INFO',
      doiTuongId: doctorId,
      duLieuCu,
      duLieuMoi,
    })
  }

  return await getDoctorDetail(doctorId)
}
