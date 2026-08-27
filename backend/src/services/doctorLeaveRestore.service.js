import { LichHen, LichLamViec, NghiPhepBacSi, NhatKyThaoTac, ThongBao } from '../models/index.js'
import { nhaChoDaGiu } from './appointmentReschedule.service.js'
import { TRANG_THAI_DE_XUAT_MO } from './rescheduleRules.js'
import { startOfDayUtc, startOfClinicDayUtc } from '../utils/clinicTime.js'

// ============================================================
// KHÔI PHỤC BÁO NGHỈ — bác sĩ đổi ý / lễ tân bấm nhầm (chốt 2026-08-23, A2/B1–B4)
// ============================================================
// Dùng `trang_thai = 'da_huy'` sẵn có trong enum của NghiPhepBacSi — KHÔNG đổi schema.
// `uniq_don_nghi_dang_hieu_luc` chỉ ràng buộc đơn `cho_duyet`/`da_duyet`, nên sau khi huỷ
// vẫn báo nghỉ lại được cùng khoảng ngày.
//
// Ba nhóm dữ liệu, ba cách xử lý khác nhau:
//   1. Slot bị đơn NÀY khoá, chưa ai đặt → mở lại (`active`).
//   2. Đề xuất dời CHƯA áp dụng          → huỷ, nhả chỗ giữ sẵn, báo đính chính cho khách (B3).
//   3. Lịch ĐÃ DỜI XONG                  → GIỮ NGUYÊN ở chỗ mới (B4), chỉ đếm để báo cáo.
//      Đảo ngược sẽ dời khách hai lần vì một quyết định của phòng khám.

function ngayKeTiep(value) {
  const d = startOfDayUtc(value)
  d.setUTCDate(d.getUTCDate() + 1)
  return d
}

/** Kiểm tra thuần — đơn này có được khôi phục không. */
export function kiemTraDuocKhoiPhuc(leave, now = new Date()) {
  if (leave?.trang_thai !== 'da_duyet') {
    return { hopLe: false, message: 'Chi khoi phuc duoc don nghi dang o trang thai da duyet.' }
  }
  if (startOfDayUtc(leave.den_ngay) < startOfClinicDayUtc(now)) {
    return { hopLe: false, message: 'Don nghi da qua ngay — khong khoi phuc duoc (B2).' }
  }
  return { hopLe: true }
}

/** Còn đơn nghỉ CẢ NGÀY nào khác đang phủ ngày này không (để biết có trả `lam_viec` được không). */
async function conDonNghiCaNgayKhac(leave, ngay, session) {
  const query = NghiPhepBacSi.findOne({
    _id: { $ne: leave._id },
    bac_si_id: leave.bac_si_id,
    trang_thai: 'da_duyet',
    gio_bat_dau: null,
    tu_ngay: { $lte: ngay },
    den_ngay: { $gte: ngay },
  })
  if (session) query.session(session)
  return Boolean(await query.lean())
}

/** Slot sẽ được mở lại nếu khôi phục — chỉ slot do CHÍNH đơn này khoá và chưa ai đặt. */
function laSlotDoDonNayKhoa(slot, leave) {
  return String(slot.nghi_phep_id ?? '') === String(leave._id)
    && slot.bi_khoa_boi_nghi_phep === true
    && slot.status === 'locked'
    && !slot.benh_nhan_id
}

/** Xem trước — KHÔNG ghi gì. Dùng cho modal xác nhận (hiện đúng con số trước khi bấm). */
export async function xemTruocKhoiPhuc(leave, session = null) {
  const kiemTra = kiemTraDuocKhoiPhuc(leave)
  if (!kiemTra.hopLe) throw Object.assign(new Error(kiemTra.message), { statusCode: 409 })

  const scheduleQuery = LichLamViec.find({
    doctor_id: leave.bac_si_id,
    ngay: { $gte: startOfDayUtc(leave.tu_ngay), $lt: ngayKeTiep(leave.den_ngay) },
  })
  if (session) scheduleQuery.session(session)
  const schedules = await scheduleQuery.lean()

  let soSlotMoLai = 0
  for (const schedule of schedules) {
    for (const slot of schedule.slots) {
      if (laSlotDoDonNayKhoa(slot, leave)) soSlotMoLai += 1
    }
  }

  const soDeXuatHuy = await LichHen.countDocuments({
    'de_xuat_doi.nghi_phep_id': leave._id,
    'de_xuat_doi.trang_thai': { $in: TRANG_THAI_DE_XUAT_MO },
  })
  const soDaDoi = await LichHen.countDocuments({
    'de_xuat_doi.nghi_phep_id': leave._id,
    'de_xuat_doi.trang_thai': 'da_ap_dung',
  })

  return {
    so_slot_mo_lai: soSlotMoLai,
    so_de_xuat_huy: soDeXuatHuy,
    so_lich_da_doi_giu_nguyen: soDaDoi,
  }
}

/** Khôi phục thật. Gọi trong transaction đã mở sẵn (session bắt buộc — nhiều collection). */
export async function huyBaoNghi({ leave, actorUserId, actorRole, session, now = new Date() }) {
  const kiemTra = kiemTraDuocKhoiPhuc(leave, now)
  if (!kiemTra.hopLe) throw Object.assign(new Error(kiemTra.message), { statusCode: 409 })

  // ── 1. Mở khoá slot ──────────────────────────────────────────────────────
  const schedules = await LichLamViec.find({
    doctor_id: leave.bac_si_id,
    ngay: { $gte: startOfDayUtc(leave.tu_ngay), $lt: ngayKeTiep(leave.den_ngay) },
  }).session(session)

  let soSlotMoLai = 0
  for (const schedule of schedules) {
    let changed = false
    for (const slot of schedule.slots) {
      if (!laSlotDoDonNayKhoa(slot, leave)) continue
      slot.status = 'active'
      slot.bi_khoa_boi_nghi_phep = false
      slot.nghi_phep_id = null
      soSlotMoLai += 1
      changed = true
    }
    if (
      schedule.trang_thai_ngay === 'nghi_phep'
      && !(await conDonNghiCaNgayKhac(leave, schedule.ngay, session))
    ) {
      schedule.trang_thai_ngay = 'lam_viec'
      changed = true
    }
    if (changed) await schedule.save({ session })
  }

  // ── 2. Huỷ đề xuất CHƯA áp dụng + báo đính chính (B3, bắt buộc) ──────────
  const deXuatMo = await LichHen.find({
    'de_xuat_doi.nghi_phep_id': leave._id,
    'de_xuat_doi.trang_thai': { $in: TRANG_THAI_DE_XUAT_MO },
  }).session(session)

  for (const appointment of deXuatMo) {
    for (const pa of appointment.de_xuat_doi.phuong_an ?? []) await nhaChoDaGiu(pa, session)
    appointment.de_xuat_doi.trang_thai = 'da_huy'
    appointment.de_xuat_doi.ghi_chu = 'Bac si di lam lai — de xuat doi lich khong con hieu luc.'
    await appointment.save({ session })

    if (appointment.user_id) {
      await ThongBao.create([{
        user_id: appointment.user_id,
        tieu_de: 'Lịch khám của bạn giữ nguyên',
        noi_dung: `Bác sĩ đã đi làm trở lại. Lịch khám ${appointment.gio_kham} ngày `
          + `${new Date(appointment.ngay_kham).toLocaleDateString('vi-VN')} của bạn GIỮ NGUYÊN, `
          + 'bạn không cần đổi sang khung nào khác. Xin lỗi vì sự bất tiện.',
        loai: 'appointment',
        related_id: appointment._id,
        related_type: 'lich_hen',
        ngay_gui_du_kien: new Date(),
      }], { session })
    }
  }

  const soDaDoi = await LichHen.countDocuments({
    'de_xuat_doi.nghi_phep_id': leave._id,
    'de_xuat_doi.trang_thai': 'da_ap_dung',
  }).session(session)

  // ── 3. Đơn nghỉ ──────────────────────────────────────────────────────────
  leave.trang_thai = 'da_huy'
  leave.ghi_chu = `${leave.ghi_chu ?? ''} · Khoi phuc boi ${actorRole ?? 'he_thong'} luc `
    + `${now.toISOString()}`.trim()
  if (leave.ghi_chu.length > 500) leave.ghi_chu = leave.ghi_chu.slice(-500)
  await leave.save({ session })

  // ── 4. Nhật ký ───────────────────────────────────────────────────────────
  await NhatKyThaoTac.create([{
    nguoi_thuc_hien_id: actorUserId,
    vai_tro: actorRole ?? 'system',
    hanh_dong: 'HUY_BAO_NGHI',
    loai_doi_tuong: 'doctor_schedule',
    doi_tuong_id: leave._id,
    du_lieu_cu: { trang_thai: 'da_duyet' },
    du_lieu_moi: {
      trang_thai: 'da_huy',
      so_slot_mo_lai: soSlotMoLai,
      so_de_xuat_huy: deXuatMo.length,
      so_lich_da_doi_giu_nguyen: soDaDoi,
    },
    ly_do: `Khoi phuc bao nghi cua bac si ${leave.bac_si_id}`,
  }], { session })

  return {
    so_slot_mo_lai: soSlotMoLai,
    so_de_xuat_huy: deXuatMo.length,
    so_lich_da_doi_giu_nguyen: soDaDoi,
  }
}
