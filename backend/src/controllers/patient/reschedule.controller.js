import mongoose from 'mongoose'

import { LichHen } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'
import {
  apDungPhuongAn,
  nhaChoDaGiu,
  sinhPhuongAnDoi,
} from '../../services/appointmentReschedule.service.js'
import { cacMocCuaKhung } from '../../utils/clinicTime.js'

// ============================================================
// DỜI LỊCH — phía bệnh nhân
// Routes: /api/patient/appointments/:id/reschedule*
// ============================================================
// ⛔ KHÔNG HOÀN TIỀN trong mọi trường hợp (rule mục 5). Tiền chỉ được bảo toàn dưới dạng
// QUYỀN DỜI LỊCH, và quyền đó có hạn mức:
//   - Khách tự xin dời : ĐÚNG 1 LẦN, và phải trước `T-30'` của khung cũ
//   - Lỗi phòng khám   : dời tuỳ tình huống, KHÔNG tính vào hạn mức của khách

/** Trần số lần khách tự xin dời (rule mục 5). */
const TRAN_DOI_KHACH_YEU_CAU = 1

async function timLichCuaMinh(appointmentId, userId) {
  if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
    return { loi: [400, 'ID lịch hẹn không hợp lệ'] }
  }
  const appointment = await LichHen.findOne({ _id: appointmentId, user_id: userId })
  if (!appointment) return { loi: [404, 'Không tìm thấy lịch hẹn'] }
  if (['completed', 'cancelled', 'no_show'].includes(appointment.status)) {
    return { loi: [409, 'Lịch hẹn đã kết thúc, không dời được'] }
  }
  return { appointment }
}

function fmtPhuongAn(pa, index) {
  return {
    index,
    loai: pa.loai,
    mo_ta: pa.mo_ta,
    ngay: pa.ngay,
    gio_bat_dau: pa.gio_bat_dau,
    bac_si_ten: pa.bac_si_ten ?? null,
    da_giu_cho: Boolean(pa.da_giu_cho),
  }
}

// ─── GET /api/patient/appointments/:id/reschedule ───────────────────────────
// Xem đề xuất do PHÒNG KHÁM gửi (bác sĩ nghỉ/bận), hoặc các lựa chọn khi khách TỰ xin dời.
export async function getRescheduleOptions(req, res) {
  try {
    const { appointment, loi } = await timLichCuaMinh(req.params.id, req.user.id)
    if (loi) return fail(res, ...loi)

    // Có đề xuất từ phòng khám -> trả đúng đề xuất đó, khách không phải tự tìm.
    const dx = appointment.de_xuat_doi
    if (dx && ['cho_khach_chon', 'cho_admin_duyet'].includes(dx.trang_thai)) {
      return ok(res, {
        loai: 'phong_kham_de_xuat',
        trang_thai: dx.trang_thai,
        han_phan_hoi: dx.han_phan_hoi,
        khong_mat_tien: true,
        thong_diep: dx.trang_thai === 'cho_admin_duyet'
          ? 'Lịch của bạn đã thanh toán nên phương án đổi cần phòng khám duyệt trước. Bạn không mất tiền.'
          : 'Bác sĩ bận đột xuất. Bạn không mất tiền — vui lòng chọn một phương án bên dưới. '
            + 'Nếu không phản hồi kịp, chúng tôi đã giữ sẵn phương án 1 cho bạn.',
        phuong_an: dx.phuong_an.map(fmtPhuongAn),
      })
    }

    // Khách TỰ xin dời: kiểm hạn mức + mốc `T-30'` trước khi mất công tìm phương án.
    const daDung = appointment.so_lan_doi_khach_yeu_cau ?? 0
    if (daDung >= TRAN_DOI_KHACH_YEU_CAU) {
      return fail(res, 409, `Bạn đã dùng hết ${TRAN_DOI_KHACH_YEU_CAU} lần dời lịch. Không thể dời thêm.`)
    }

    const moc = cacMocCuaKhung(appointment.ngay_kham, appointment.gio_kham)
    if (!moc || Date.now() >= moc.dongDatOnline.getTime()) {
      return fail(
        res,
        409,
        'Đã quá hạn xin dời (trước giờ khám 30 phút). Bạn vẫn được khám nếu tới trong ca, không mất tiền.',
      )
    }

    // Khách tự dời thì KHÔNG BAO GIỜ được lấn slot walk-in (rule mục 15).
    const phuongAn = await sinhPhuongAnDoi({ appointment, duocLanWalkIn: false })
    return ok(res, {
      loai: 'khach_tu_doi',
      con_lai: TRAN_DOI_KHACH_YEU_CAU - daDung,
      han_chot: moc.dongDatOnline,
      khong_mat_tien: true,
      thong_diep: `Bạn còn ${TRAN_DOI_KHACH_YEU_CAU - daDung} lần dời lịch. Dời xong sẽ không đổi được nữa.`,
      phuong_an: phuongAn.map(fmtPhuongAn),
    })
  } catch (err) {
    return fail(res, err.statusCode ?? 500, err.message)
  }
}

// ─── POST /api/patient/appointments/:id/reschedule ──────────────────────────
// Body: { phuong_an_index }
export async function chooseReschedule(req, res) {
  try {
    const { appointment, loi } = await timLichCuaMinh(req.params.id, req.user.id)
    if (loi) return fail(res, ...loi)

    const index = Number(req.body.phuong_an_index)
    if (!Number.isInteger(index) || index < 0) {
      return fail(res, 400, 'phuong_an_index không hợp lệ')
    }

    const dx = appointment.de_xuat_doi

    // ── Nhánh 1: đề xuất do phòng khám gửi ────────────────────────────────
    if (dx && dx.trang_thai === 'cho_khach_chon') {
      const phuongAn = dx.phuong_an?.[index]
      if (!phuongAn) return fail(res, 400, 'Phương án không tồn tại')

      // Nhả chỗ đã giữ sẵn ở phương án 1 nếu khách chọn phương án khác — không giữ hai chỗ.
      for (const [i, pa] of dx.phuong_an.entries()) {
        if (i !== index) await nhaChoDaGiu(pa)
      }

      await apDungPhuongAn({
        appointment,
        phuongAn,
        lyDoDoi: 'phong_kham', // lỗi phòng khám -> KHÔNG tính vào hạn mức của khách
        actorUserId: req.user.id,
      })
      return ok(res, ketQua(appointment), 'Đã đổi lịch theo phương án bạn chọn. Bạn không mất khoản nào.')
    }

    if (dx && dx.trang_thai === 'cho_admin_duyet') {
      return fail(res, 409, 'Phương án đang chờ phòng khám duyệt. Chúng tôi sẽ báo bạn ngay khi xong.')
    }

    // ── Nhánh 2: khách tự xin dời ─────────────────────────────────────────
    const daDung = appointment.so_lan_doi_khach_yeu_cau ?? 0
    if (daDung >= TRAN_DOI_KHACH_YEU_CAU) {
      return fail(res, 409, `Bạn đã dùng hết ${TRAN_DOI_KHACH_YEU_CAU} lần dời lịch.`)
    }

    // Kiểm LẠI mốc `T-30'` ngay lúc ghi: khách có thể mở trang từ trước rồi mới bấm.
    // Chặn chiêu né mất tiền — thấy sắp trễ thì bấm dời lúc `T-5'`, slot không kịp bán
    // cho ai, phòng khám mất trắng chỗ (rule mục 11).
    const moc = cacMocCuaKhung(appointment.ngay_kham, appointment.gio_kham)
    if (!moc || Date.now() >= moc.dongDatOnline.getTime()) {
      return fail(res, 409, 'Đã quá hạn xin dời (trước giờ khám 30 phút).')
    }

    const phuongAn = (await sinhPhuongAnDoi({ appointment, duocLanWalkIn: false }))[index]
    if (!phuongAn) return fail(res, 400, 'Phương án không còn khả dụng, vui lòng tải lại danh sách')

    await apDungPhuongAn({
      appointment,
      phuongAn,
      lyDoDoi: 'khach_yeu_cau',
      actorUserId: req.user.id,
    })
    return ok(
      res,
      ketQua(appointment),
      `Đã dời lịch. Bạn đã dùng ${appointment.so_lan_doi_khach_yeu_cau}/${TRAN_DOI_KHACH_YEU_CAU} lần dời.`,
    )
  } catch (err) {
    return fail(res, err.statusCode ?? 500, err.message)
  }
}

function ketQua(appointment) {
  return {
    id: appointment._id,
    ma_lich_hen: appointment.ma_lich_hen,
    ngay_kham: appointment.ngay_kham,
    gio_kham: appointment.gio_kham,
    doctor_id: appointment.doctor_id,
    ly_do_doi: appointment.ly_do_doi,
    so_lan_doi_khach_yeu_cau: appointment.so_lan_doi_khach_yeu_cau,
  }
}
