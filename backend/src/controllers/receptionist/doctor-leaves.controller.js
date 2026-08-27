import mongoose from 'mongoose'

import { NghiPhepBacSi } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'
import {
  duyetDonNghi,
  tuChoiDonNghi,
  findLeaveByIdWithDoctor,
  moTaKetQuaDuyet,
  laDonNganHanChoLeTan,
  demAnhHuongCuaDonNghi,
} from '../../services/doctorLeaveApproval.service.js'
import { huyBaoNghi, xemTruocKhoiPhuc, kiemTraDuocKhoiPhuc } from '../../services/doctorLeaveRestore.service.js'

// ============================================================
// Lễ tân duyệt đơn nghỉ NGẮN HẠN của bác sĩ — Routes: /api/receptionist/doctor-leaves
// Thiết kế: docs/superpowers/specs/2026-08-03-luong-bac-si-nghi-design.md muc 3.1
//
// Bác sĩ về sớm / xin nghỉ 1 ca không thể chờ Admin online mới xử lý được — nhưng nghỉ dài
// ngày ảnh hưởng MauLichLamViec + rang buoc phong/ca thi dung tham quyen Admin. Ranh gioi
// (laDonNganHanChoLeTan): bat dau cham nhat ngay mai, keo dai toi da 1 ngay.
//
// Dung CHUNG doctorLeaveApproval.service.js voi Admin — tranh 2 noi cai dat khac nhau cung
// mot hanh vi khoa slot + sinh de xuat (nguyen tac muc 7).
// ============================================================

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value)
}

function formatDoctorLeave(leave) {
  return {
    _id: leave._id,
    bac_si_id: leave.bac_si_id?._id ?? leave.bac_si_id ?? null,
    bac_si: leave.bac_si_id
      ? {
          _id: leave.bac_si_id._id ?? leave.bac_si_id,
          user_id: leave.bac_si_id.user_id?._id ?? leave.bac_si_id.user_id ?? null,
          ho_ten: leave.bac_si_id.user_id?.ho_ten ?? null,
          trang_thai: leave.bac_si_id.trang_thai ?? null,
        }
      : null,
    tu_ngay: leave.tu_ngay,
    den_ngay: leave.den_ngay,
    gio_bat_dau: leave.gio_bat_dau ?? null,
    gio_ket_thuc: leave.gio_ket_thuc ?? null,
    ly_do: leave.ly_do ?? null,
    trang_thai: leave.trang_thai,
    nguon_tao: leave.nguon_tao ?? null,
    nguoi_duyet_id: leave.nguoi_duyet_id ?? null,
    thoi_diem_duyet: leave.thoi_diem_duyet ?? null,
    ghi_chu: leave.ghi_chu ?? null,
    ngay_tao: leave.ngay_tao ?? null,
  }
}

function getActorUserId(req) {
  return req.user?._id ?? req.user?.id ?? null
}

// Chỉ đơn CHỜ DUYỆT và thuộc thẩm quyền lễ tân — đơn kỳ dài không hiện ở đây, tránh lễ tân
// tưởng nhầm mình duyệt được rồi bấm phải 403.
export async function listPendingLeaves(req, res) {
  try {
    const leaves = await NghiPhepBacSi.find({ trang_thai: 'cho_duyet' })
      .populate({
        path: 'bac_si_id',
        select: 'user_id trang_thai',
        populate: { path: 'user_id', select: 'ho_ten' },
      })
      .sort({ ngay_tao: -1, _id: -1 })
      .lean()

    const thuocThamQuyen = leaves.filter((leave) => laDonNganHanChoLeTan(leave))

    // B1: mỗi đơn chờ duyệt hiện kèm số lịch sẽ bị ảnh hưởng nếu duyệt — thẻ bác sĩ trạng
    // thái (b) hiển thị con số này thay vì chỉ tên bác sĩ (Task 11).
    const ketQua = await Promise.all(thuocThamQuyen.map(async (leave) => {
      const anhHuong = await demAnhHuongCuaDonNghi({
        bacSiId: leave.bac_si_id?._id ?? leave.bac_si_id,
        tuNgay: leave.tu_ngay,
        denNgay: leave.den_ngay,
        gioBatDau: leave.gio_bat_dau,
        gioKetThuc: leave.gio_ket_thuc,
      })
      return { ...formatDoctorLeave(leave), so_lich_se_anh_huong: anhHuong.so_lich_anh_huong }
    }))

    return ok(res, ketQua)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export async function approveLeave(req, res) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) {
      await session.abortTransaction()
      session.endSession()
      return fail(res, 400, 'ID nghỉ phép không hợp lệ')
    }

    const leave = await NghiPhepBacSi.findById(id).session(session)
    if (!leave) {
      await session.abortTransaction()
      session.endSession()
      return fail(res, 404, 'Không tìm thấy đơn nghỉ phép')
    }

    if (!laDonNganHanChoLeTan(leave)) {
      await session.abortTransaction()
      session.endSession()
      return fail(res, 403, 'Đơn nghỉ kéo dài hoặc bắt đầu xa hơn ngày mai — cần Admin duyệt')
    }

    const { slotsLocked, affectedAppointments, canDieuPhoiTaiQuay, deXuat } = await duyetDonNghi({
      leave,
      actorUserId: getActorUserId(req),
      actorRole: req.user?.role === 'admin' ? 'admin' : 'receptionist',
      ghiChu: req.body?.ghi_chu,
      session,
    })

    await session.commitTransaction()
    session.endSession()

    const populatedLeave = await findLeaveByIdWithDoctor(id).lean()
    return ok(
      res,
      {
        ...formatDoctorLeave(populatedLeave),
        so_slot_da_khoa: slotsLocked,
        lich_hen_can_xu_ly: affectedAppointments.map((a) => ({
          id: a._id,
          ma_lich_hen: a.ma_lich_hen ?? null,
          ngay_kham: a.ngay_kham,
          gio_kham: a.gio_kham,
          status: a.status,
          ten_khach: a.ten_khach ?? null,
        })),
        can_dieu_phoi_tai_quay: canDieuPhoiTaiQuay,
        de_xuat_doi: deXuat,
        so_lich_cho_admin_duyet: deXuat.filter((d) => d.cho_admin_duyet).length,
        so_lich_khong_co_phuong_an: deXuat.filter((d) => d.so_phuong_an === 0).length,
      },
      moTaKetQuaDuyet(affectedAppointments.length, deXuat),
    )
  } catch (error) {
    await session.abortTransaction().catch(() => {})
    session.endSession()
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

export async function rejectLeave(req, res) {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) {
      return fail(res, 400, 'ID nghỉ phép không hợp lệ')
    }

    const leave = await NghiPhepBacSi.findById(id)
    if (!leave) {
      return fail(res, 404, 'Không tìm thấy đơn nghỉ phép')
    }
    if (!laDonNganHanChoLeTan(leave)) {
      return fail(res, 403, 'Đơn nghỉ kéo dài hoặc bắt đầu xa hơn ngày mai — cần Admin duyệt')
    }

    await tuChoiDonNghi({ leave, actorUserId: getActorUserId(req), ghiChu: req.body?.ghi_chu })

    const populatedLeave = await findLeaveByIdWithDoctor(id).lean()
    return ok(res, formatDoctorLeave(populatedLeave), 'Từ chối đơn nghỉ phép thành công')
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

// ─── GET /api/receptionist/doctor-leaves/:id/huy-bao-nghi/preview ───────────
// Xem trước hậu quả khôi phục — modal xác nhận cần hiện ĐÚNG con số trước khi lễ tân bấm,
// không phải câu chung chung "bạn có chắc không".
export async function previewHuyBaoNghi(req, res) {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) return fail(res, 400, 'ID nghỉ phép không hợp lệ')

    const leave = await NghiPhepBacSi.findById(id)
    if (!leave) return fail(res, 404, 'Không tìm thấy đơn nghỉ phép')

    const kiemTra = kiemTraDuocKhoiPhuc(leave)
    if (!kiemTra.hopLe) return fail(res, 409, kiemTra.message)

    return ok(res, await xemTruocKhoiPhuc(leave))
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

// ─── PATCH /api/receptionist/doctor-leaves/:id/huy-bao-nghi ─────────────────
// Bác sĩ đổi ý hoặc lễ tân bấm nhầm nút "Báo nghỉ đột xuất" (A2, B1).
export async function huyBaoNghiHandler(req, res) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) {
      await session.abortTransaction()
      session.endSession()
      return fail(res, 400, 'ID nghỉ phép không hợp lệ')
    }

    const leave = await NghiPhepBacSi.findById(id).session(session)
    if (!leave) {
      await session.abortTransaction()
      session.endSession()
      return fail(res, 404, 'Không tìm thấy đơn nghỉ phép')
    }

    const ketQua = await huyBaoNghi({
      leave,
      actorUserId: getActorUserId(req),
      actorRole: req.user?.role === 'admin' ? 'admin' : 'receptionist',
      session,
    })

    await session.commitTransaction()
    session.endSession()

    return ok(
      res,
      ketQua,
      `Đã khôi phục lịch làm việc. Mở lại ${ketQua.so_slot_mo_lai} slot, huỷ `
        + `${ketQua.so_de_xuat_huy} đề xuất dời và đã báo đính chính cho khách. `
        + `${ketQua.so_lich_da_doi_giu_nguyen} lịch đã dời xong giữ nguyên ở chỗ mới.`,
    )
  } catch (error) {
    await session.abortTransaction().catch(() => {})
    session.endSession()
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

export default {
  listPendingLeaves,
  approveLeave,
  rejectLeave,
  previewHuyBaoNghi,
  huyBaoNghiHandler,
}
