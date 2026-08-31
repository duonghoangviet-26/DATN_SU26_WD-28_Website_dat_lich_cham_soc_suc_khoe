import mongoose from 'mongoose'
import { LichHen, KetQuaKham, LichLamViec, BacSi, NghiPhepBacSi } from '../models/index.js'

export class FollowUpError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.statusCode = statusCode
  }
}

function parseDateOnly(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setUTCHours(0, 0, 0, 0)
  return date
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000)
}

/**
 * Xác thực luồng tái khám
 * 
 * @param {Object} params
 * @param {string} params.lich_hen_goc_id - ID LichHen gốc
 * @param {string} params.userId - req.user.id (null nếu là lễ tân đặt hộ)
 * @param {Date} params.ngay_kham - Ngày muốn đặt tái khám
 * @param {string} params.specialty_id - Chuyên khoa sẽ đặt
 * @param {Object} params.session - Mongoose session
 * @param {boolean} params.isReceptionist - true = lễ tân, bỏ qua ownership check
 * 
 * @returns {Promise<{ketQuaKham: Object, lichHenGoc: Object, doctor_id_uu_tien: string}>}
 */
export async function validateFollowUpBooking({
  lich_hen_goc_id,
  userId,
  ngay_kham,
  specialty_id,
  session,
  isReceptionist = false
}) {
  // a) Kiểm tra lich_hen_goc_id hợp lệ ObjectId
  if (!lich_hen_goc_id || !mongoose.Types.ObjectId.isValid(lich_hen_goc_id)) {
    throw new FollowUpError(400, 'ID lịch hẹn gốc không hợp lệ')
  }

  // b) Tìm LichHen gốc, kiểm tra status = 'completed'
  const lichHenGoc = await LichHen.findById(lich_hen_goc_id).session(session).lean()
  if (!lichHenGoc) {
    throw new FollowUpError(404, 'Không tìm thấy lịch hẹn gốc')
  }
  if (lichHenGoc.status !== 'completed') {
    throw new FollowUpError(400, 'Lịch hẹn gốc chưa hoàn thành')
  }

  // c) Nếu isReceptionist = false: kiểm tra ownership
  if (!isReceptionist) {
    if (lichHenGoc.user_id?.toString() !== userId && lichHenGoc.nguoi_dat_ho_id?.toString() !== userId) {
      // Cho phép nếu userId là chủ tài khoản đặt hộ hoặc chính là user_id của bệnh nhân
      // Check kỹ hơn:
      const owns = lichHenGoc.user_id?.toString() === userId || lichHenGoc.nguoi_dat_ho_id?.toString() === userId
      if (!owns) {
        throw new FollowUpError(403, 'Bạn không có quyền thao tác trên lịch hẹn này')
      }
    }
  }

  // d) Tìm KetQuaKham theo appointment_id = lich_hen_goc_id
  const ketQuaKham = await KetQuaKham.findOne({ appointment_id: lich_hen_goc_id }).session(session).lean()
  if (!ketQuaKham) {
    throw new FollowUpError(400, 'Chưa có kết quả khám cho lịch hẹn này')
  }

  // e) Kiểm tra chi_dinh_tai_kham = true
  if (!ketQuaKham.chi_dinh_tai_kham) {
    throw new FollowUpError(400, 'Ca khám này không có chỉ định tái khám')
  }

  // f) Kiểm tra da_dat_lich_tai_kham = false
  if (ketQuaKham.da_dat_lich_tai_kham) {
    throw new FollowUpError(409, 'Đã đặt lịch tái khám cho ca này rồi')
  }

  // g) Kiểm tra ngay_tai_kham (nếu có)
  const ngayDat = parseDateOnly(ngay_kham)
  if (!ngayDat) {
    throw new FollowUpError(400, 'Ngày khám không hợp lệ')
  }
  
  if (ketQuaKham.ngay_tai_kham) {
    const ngayTaiKham = parseDateOnly(ketQuaKham.ngay_tai_kham)
    if (ngayTaiKham) {
      const hanCuoi = addDays(ngayTaiKham, 14) // Cho phép trễ 14 ngày (2 tuần)
      if (ngayDat.getTime() > hanCuoi.getTime()) {
        throw new FollowUpError(400, 'Đã quá hạn tái khám miễn phí')
      }
    }
  }

  // h) Kiểm tra trùng chuyên khoa cùng ngày (quy tắc R4)
  // Lịch tái khám được phép cùng ngày với lịch thường nhưng khác chuyên khoa
  // Tìm lịch hẹn trong cùng ngày của bệnh nhân này
  const identityFilters = []
  if (lichHenGoc.member_id) {
    identityFilters.push({ member_id: lichHenGoc.member_id })
  } else if (lichHenGoc.user_id) {
    identityFilters.push({ user_id: lichHenGoc.user_id, member_id: null })
  } else {
     // fallback phone/name
     identityFilters.push({ 
       ten_khach: lichHenGoc.ten_khach, 
       so_dien_thoai_khach: lichHenGoc.so_dien_thoai_khach, 
       member_id: null 
     })
  }

  const dangHoatDong = ['pending', 'confirmed', 'checked_in', 'in_progress', 'waiting_record', 'waiting_doctor_confirm']
  const luotTrung = await LichHen.findOne({
    $or: identityFilters,
    ngay_kham: { $gte: ngayDat, $lt: addDays(ngayDat, 1) },
    status: { $in: dangHoatDong }
  }).select('specialty_id loai_lich_hen').session(session).lean()

  if (luotTrung) {
    if (luotTrung.specialty_id?.toString() === String(specialty_id)) {
      throw new FollowUpError(409, 'Bạn đã có lịch khám chuyên khoa này trong ngày')
    }
    // Nếu khác chuyên khoa thì cho phép đi tiếp
  }

  // i) Kiểm tra bác sĩ (quy tắc R3)
  const doctor_id_cu = lichHenGoc.doctor_id?.toString()
  let doctor_id_uu_tien = null

  if (doctor_id_cu) {
    // Kiem tra bac si cu co lich lam viec khong
    const scheduleCu = await LichLamViec.findOne({
      doctor_id: doctor_id_cu,
      ngay: { $gte: ngayDat, $lt: addDays(ngayDat, 1) },
      trang_thai_ngay: 'lam_viec',
      trang_thai_xac_nhan: { $ne: 'tu_choi' }
    }).session(session).lean()

    // Kiem tra xem bac si cu co dang nghi phep ca ngay khong
    const nghiPhepCu = await NghiPhepBacSi.findOne({
      bac_si_id: doctor_id_cu,
      trang_thai: 'da_duyet',
      tu_ngay: { $lte: ngayDat },
      den_ngay: { $gte: ngayDat },
      gio_bat_dau: null // Nghi ca ngay
    }).session(session).lean()

    if (scheduleCu && !nghiPhepCu) {
      doctor_id_uu_tien = doctor_id_cu
    }
  }

  // Neu bac si cu khong co lich hoac dang nghi
  if (!doctor_id_uu_tien) {
    // Tim bac si khac cung chuyen khoa co lich lam viec
    const bacSiCungChuyenKhoa = await BacSi.find({
      'specialties._id': specialty_id,
      trang_thai_duyet: 'approved',
      la_hien: true
    }).select('_id').session(session).lean()

    const bsIds = bacSiCungChuyenKhoa.map(d => d._id.toString())
    if (bsIds.length === 0) {
      throw new FollowUpError(404, 'Không có bác sĩ nào thuộc chuyên khoa này')
    }

    const availableSchedules = await LichLamViec.find({
      doctor_id: { $in: bsIds },
      ngay: { $gte: ngayDat, $lt: addDays(ngayDat, 1) },
      trang_thai_ngay: 'lam_viec',
      trang_thai_xac_nhan: { $ne: 'tu_choi' }
    }).session(session).lean()

    const availableBsIds = availableSchedules.map(s => s.doctor_id.toString())
    
    // Loai bo nhung bac si dang nghi phep ca ngay
    const nghiPheps = await NghiPhepBacSi.find({
      bac_si_id: { $in: availableBsIds },
      trang_thai: 'da_duyet',
      tu_ngay: { $lte: ngayDat },
      den_ngay: { $gte: ngayDat },
      gio_bat_dau: null
    }).session(session).lean()
    
    const nghiPhepBsIds = new Set(nghiPheps.map(n => n.bac_si_id.toString()))
    
    const finalAvailableBsIds = availableBsIds.filter(id => !nghiPhepBsIds.has(id))

    if (finalAvailableBsIds.length === 0) {
      throw new FollowUpError(404, 'Không có bác sĩ chuyên khoa này có lịch làm việc vào ngày đã chọn')
    }
    
    // Chon bac si dau tien (hoac co the chon ngau nhien)
    doctor_id_uu_tien = finalAvailableBsIds[0]
  }

  return { ketQuaKham, lichHenGoc, doctor_id_uu_tien }
}
