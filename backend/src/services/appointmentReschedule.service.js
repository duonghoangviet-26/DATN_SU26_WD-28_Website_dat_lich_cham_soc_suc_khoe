import {
  BacSi, LichHen, LichLamViec, NguoiDung, NhatKyThaoTac, ThongBao,
} from '../models/index.js'
import { caCuaKhung } from '../models/MauLichLamViec.js'
import { daQuaCutoffOnline, isSlotInPast } from '../utils/clinicTime.js'

// ============================================================
// ĐIỀU PHỐI DỜI LỊCH — rule mục 14 (bác sĩ nghỉ cả ca) + mục 15 (bận một khung)
// ============================================================
// ⛔ KHÔNG HOÀN TIỀN trong mọi trường hợp (mục 5). Tiền của khách chỉ được bảo toàn dưới
// dạng QUYỀN DỜI LỊCH. Vì vậy khi phòng khám làm hỏng kế hoạch của khách, hệ thống phải
// tự tìm được chỗ thay thế — không thể đẩy khách vào thế "mất chỗ mà cũng không lấy lại tiền".
//
// Thang đề xuất, ưu tiên ÍT PHIỀN KHÁCH NHẤT trước:
//   1. Bác sĩ khác cùng chuyên khoa, GIỮ NGUYÊN khung giờ  → khách chỉ đổi người
//   2. Khung khác trong cùng ngày                          → khách đổi giờ
//
// Phương án số 1 luôn được GIỮ CHỖ SẴN: quá hạn khách không phản hồi thì áp dụng nó,
// khách không bao giờ mất chỗ (mục 15).

/** Hạn khách phản hồi đề xuất, tính bằng giờ. Quá hạn → tự áp phương án đã giữ sẵn. */
export const GIO_HAN_PHAN_HOI = Number(process.env.DOI_LICH_HAN_PHAN_HOI_GIO || 12)

/** Trần lấn slot walk-in: 1 slot/khung (mục 15). Ngoại lệ DUY NHẤT của "không lấn walk-in". */
const TRAN_LAN_WALK_IN_MOI_KHUNG = 1

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000)
}

function slotConTrong(slot) {
  return slot.status === 'active' && !slot.benh_nhan_id && !slot.bi_khoa_boi_nghi_phep
}

/**
 * Sinh danh sách phương án dời cho MỘT lịch hẹn, theo đúng thứ tự thang ở mục 14.
 * KHÔNG giữ chỗ — chỉ liệt kê. Việc giữ chỗ do `giuChoPhuongAn()` làm.
 *
 * @param {object} opts.appointment - lịch hẹn cần dời
 * @param {boolean} opts.duocLanWalkIn - cho phép lấn slot walk-in (chỉ khi lỗi PHÒNG KHÁM)
 */
export async function sinhPhuongAnDoi({ appointment, duocLanWalkIn = false, now = new Date(), session = null }) {
  const ngay = appointment.ngay_kham
  const gio = appointment.gio_kham
  const specialtyId = appointment.specialty_id

  const doctors = await BacSi.find({
    specialties: specialtyId,
    trang_thai_duyet: 'approved',
    la_hien: true,
    _id: { $ne: appointment.doctor_id },
  }).populate('user_id', 'ho_ten').select('user_id').lean()

  const scheduleQuery = LichLamViec.find({
    ngay: { $gte: ngay, $lt: addDays(ngay, 1) },
    trang_thai_ngay: 'lam_viec',
    trang_thai_xac_nhan: { $ne: 'tu_choi' },
  })
  if (session) scheduleQuery.session(session)
  const schedules = await scheduleQuery.lean()

  const daDat = new Set(
    (await LichHen.find({
      schedule_id: { $in: schedules.map((s) => s._id) },
      status: { $ne: 'cancelled' },
      _id: { $ne: appointment._id },
    }).select('slot_id').lean())
      .filter((a) => a.slot_id).map((a) => String(a.slot_id)),
  )

  const tenBacSi = new Map(doctors.map((d) => [String(d._id), d.user_id?.ho_ten ?? 'Bác sĩ']))
  const idBacSiKhac = new Set(doctors.map((d) => String(d._id)))
  const phuongAn = []

  // ── Bước 1: bác sĩ khác, GIỮ NGUYÊN giờ ──────────────────────────────────
  for (const schedule of schedules) {
    if (!idBacSiKhac.has(String(schedule.doctor_id))) continue
    const slot = schedule.slots.find(
      (s) => s.gio_bat_dau === gio && slotConTrong(s) && !daDat.has(String(s._id))
        && (s.loai_slot !== 'walk_in' || duocLanWalkIn),
    )
    if (!slot) continue

    phuongAn.push({
      loai: 'doi_bac_si',
      doctor_id: schedule.doctor_id,
      schedule_id: schedule._id,
      slot_id: slot._id,
      ngay: schedule.ngay,
      gio_bat_dau: slot.gio_bat_dau,
      bac_si_ten: tenBacSi.get(String(schedule.doctor_id)) ?? 'Bác sĩ',
      mo_ta: `Giữ nguyên ${gio}, đổi sang ${tenBacSi.get(String(schedule.doctor_id)) ?? 'bác sĩ khác'}`,
      lan_walk_in: slot.loai_slot === 'walk_in',
    })
  }

  // ── Bước 2: khung khác trong ngày (kể cả chính bác sĩ cũ, khung khác) ────
  // Ưu tiên khung GẦN giờ cũ nhất để khách ít phải xoay lịch.
  const ungVienKhungKhac = []
  for (const schedule of schedules) {
    const laBacSiCu = String(schedule.doctor_id) === String(appointment.doctor_id)
    if (!laBacSiCu && !idBacSiKhac.has(String(schedule.doctor_id))) continue

    for (const slot of schedule.slots) {
      if (slot.gio_bat_dau === gio) continue
      if (!slotConTrong(slot) || daDat.has(String(slot._id))) continue
      if (slot.loai_slot === 'walk_in' && !duocLanWalkIn) continue
      if (isSlotInPast(schedule.ngay, slot.gio_bat_dau, now)) continue
      // Mốc T-30' KHÔNG áp cho phòng khám dời (mục 15) — mốc đó chỉ để chặn khách né mất
      // tiền. Nhưng vẫn không xếp vào khung đã bắt đầu: khách không kịp tới.
      if (daQuaCutoffOnline(schedule.ngay, slot.gio_bat_dau, now) && !duocLanWalkIn) continue

      ungVienKhungKhac.push({
        loai: 'doi_khung',
        doctor_id: schedule.doctor_id,
        schedule_id: schedule._id,
        slot_id: slot._id,
        ngay: schedule.ngay,
        gio_bat_dau: slot.gio_bat_dau,
        bac_si_ten: laBacSiCu ? null : (tenBacSi.get(String(schedule.doctor_id)) ?? 'Bác sĩ'),
        mo_ta: laBacSiCu
          ? `Cùng bác sĩ, đổi sang ${slot.gio_bat_dau}`
          : `${tenBacSi.get(String(schedule.doctor_id)) ?? 'Bác sĩ khác'}, ${slot.gio_bat_dau}`,
        lan_walk_in: slot.loai_slot === 'walk_in',
        _lechPhut: Math.abs(khoangCachKhung(slot.gio_bat_dau, gio)),
      })
    }
  }
  ungVienKhungKhac.sort((a, b) => a._lechPhut - b._lechPhut || a.gio_bat_dau.localeCompare(b.gio_bat_dau))

  // Giới hạn số phương án: đưa 10 lựa chọn cho khách chỉ làm họ khó chọn hơn.
  for (const item of ungVienKhungKhac.slice(0, 6)) {
    delete item._lechPhut
    phuongAn.push(item)
  }

  // Trần lấn walk-in: 1 slot/khung, và chỉ khi lỗi phòng khám (mục 15).
  return capTranLanWalkIn(gopPhuongAnTrung(phuongAn)).slice(0, 4)
}

function khoangCachKhung(a, b) {
  const phut = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number)
    return h * 60 + m
  }
  return phut(a) - phut(b)
}

// Một khung chứa NHIỀU slot (TMH 2 slot/khung), nên cùng một bác sĩ ở cùng một giờ sẽ
// sinh ra nhiều phương án giống hệt nhau. Khách nhìn thấy hai lựa chọn y hệt thì không
// biết chọn cái nào — gộp lại, giữ slot đầu tiên.
function gopPhuongAnTrung(phuongAn) {
  const daCo = new Set()
  return phuongAn.filter((pa) => {
    const khoa = `${pa.doctor_id}|${pa.ngay?.toISOString?.() ?? pa.ngay}|${pa.gio_bat_dau}`
    if (daCo.has(khoa)) return false
    daCo.add(khoa)
    return true
  })
}

function capTranLanWalkIn(phuongAn) {
  const demTheoKhung = new Map()
  return phuongAn.filter((pa) => {
    if (!pa.lan_walk_in) return true
    const key = `${pa.schedule_id}|${pa.gio_bat_dau}`
    const da = demTheoKhung.get(key) ?? 0
    if (da >= TRAN_LAN_WALK_IN_MOI_KHUNG) return false
    demTheoKhung.set(key, da + 1)
    return true
  })
}

/**
 * Giữ chỗ cho MỘT phương án — dùng cho phương án số 1 để khách quá hạn không phản hồi
 * vẫn còn chỗ. Ghi `pending_payment` sẽ bị cron nhả mất, nên giữ bằng `locked` + gắn
 * bệnh nhân: chỗ này không bán cho ai khác, cũng không đòi khách trả thêm tiền.
 */
export async function giuChoPhuongAn(phuongAn, appointment, session = null) {
  const res = await LichLamViec.updateOne(
    {
      _id: phuongAn.schedule_id,
      slots: { $elemMatch: { _id: phuongAn.slot_id, status: 'active', benh_nhan_id: null } },
    },
    {
      $set: {
        'slots.$.status': 'locked',
        'slots.$.benh_nhan_tam_giu_id': appointment.user_id ?? null,
      },
    },
    session ? { session } : {},
  )
  return res.modifiedCount > 0
}

/** Nhả chỗ đã giữ sẵn khi khách chọn phương án khác. */
export async function nhaChoDaGiu(phuongAn, session = null) {
  if (!phuongAn?.da_giu_cho) return
  await LichLamViec.updateOne(
    {
      _id: phuongAn.schedule_id,
      slots: { $elemMatch: { _id: phuongAn.slot_id, status: 'locked' } },
    },
    { $set: { 'slots.$.status': 'active', 'slots.$.benh_nhan_tam_giu_id': null } },
    session ? { session } : {},
  )
}

/**
 * Áp dụng một phương án: chuyển lịch hẹn sang slot mới.
 *
 * Slot CŨ chuyển `locked`, KHÔNG trả về pool (mục 15) — bác sĩ bận thật, không bán lại
 * cho ai. Trả về pool sẽ khiến khách khác đặt vào rồi lại phải dời tiếp.
 */
export async function apDungPhuongAn({
  appointment,
  phuongAn,
  lyDoDoi = 'phong_kham',
  actorUserId = null,
  actorRole = null,
  session = null,
}) {
  const slotCu = { schedule_id: appointment.schedule_id, slot_id: appointment.slot_id }

  const chiem = await LichLamViec.updateOne(
    {
      _id: phuongAn.schedule_id,
      // Chấp nhận cả `locked` (chỗ đã giữ sẵn cho chính khách này) lẫn `active`.
      slots: { $elemMatch: { _id: phuongAn.slot_id, status: { $in: ['active', 'locked'] } } },
    },
    {
      $set: {
        'slots.$.status': 'booked',
        'slots.$.benh_nhan_id': appointment.user_id ?? null,
        'slots.$.benh_nhan_tam_giu_id': null,
        'slots.$.pending_expired_at': null,
      },
    },
    session ? { session } : {},
  )
  if (chiem.modifiedCount === 0) {
    throw Object.assign(new Error('Chỗ này vừa có người khác nhận. Vui lòng chọn phương án khác.'), { statusCode: 409 })
  }

  // Slot cũ: khoá lại, không trả pool.
  if (slotCu.schedule_id && slotCu.slot_id) {
    await LichLamViec.updateOne(
      { _id: slotCu.schedule_id, 'slots._id': slotCu.slot_id },
      { $set: { 'slots.$.status': 'locked', 'slots.$.benh_nhan_id': null, 'slots.$.benh_nhan_tam_giu_id': null } },
      session ? { session } : {},
    )
  }

  const gioCu = appointment.gio_kham
  const bacSiCu = appointment.doctor_id

  appointment.doctor_id = phuongAn.doctor_id
  appointment.schedule_id = phuongAn.schedule_id
  appointment.slot_id = phuongAn.slot_id
  appointment.ngay_kham = phuongAn.ngay
  appointment.gio_kham = phuongAn.gio_bat_dau
  appointment.ly_do_doi = lyDoDoi
  if (lyDoDoi === 'khach_yeu_cau') {
    appointment.so_lan_doi_khach_yeu_cau = (appointment.so_lan_doi_khach_yeu_cau ?? 0) + 1
  }
  appointment.so_lan_thay_doi = (appointment.so_lan_thay_doi ?? 0) + 1
  if (appointment.de_xuat_doi) {
    appointment.de_xuat_doi.trang_thai = 'da_ap_dung'
  }
  await appointment.save(session ? { session } : {})

  await NhatKyThaoTac.create([{
    nguoi_thuc_hien_id: actorUserId,
    vai_tro: actorRole ?? (actorUserId ? 'user' : 'system'),
    hanh_dong: 'DOI_LICH_HEN',
    loai_doi_tuong: 'appointment',
    doi_tuong_id: appointment._id,
    du_lieu_cu: { doctor_id: bacSiCu, gio_kham: gioCu },
    du_lieu_moi: { doctor_id: phuongAn.doctor_id, gio_kham: phuongAn.gio_bat_dau, ly_do_doi: lyDoDoi },
    ly_do: `Doi lich ${appointment.ma_lich_hen ?? ''} tu ${gioCu} sang ${phuongAn.gio_bat_dau}`
      + (phuongAn.lan_walk_in ? ' (LAN slot walk-in — ngoai le muc 15)' : ''),
  }], session ? { session } : {})

  return appointment
}

/**
 * Tạo đề xuất dời cho mọi lịch hẹn bị ảnh hưởng bởi một đơn nghỉ (mục 14, 15).
 *
 * Lịch ĐÃ THANH TOÁN → `cho_admin_duyet`: tiền của khách không để một người tự định đoạt.
 * Lịch chưa thanh toán → `cho_khach_chon` luôn.
 */
export async function taoDeXuatDoiChoDonNghi(leave, { session = null, now = new Date(), appointmentIds = null } = {}) {
  const endExclusive = addDays(new Date(leave.den_ngay), 1)

  const query = {
    doctor_id: leave.bac_si_id,
    status: { $in: ['pending', 'confirmed'] },
    ngay_kham: { $gte: leave.tu_ngay, $lt: endExclusive },
  }
  if (Array.isArray(appointmentIds) && appointmentIds.length > 0) {
    query._id = { $in: appointmentIds }
  }

  let appointments = await LichHen.find(query).session(session)

  if (leave.gio_bat_dau && leave.gio_ket_thuc) {
    appointments = appointments.filter(
      (a) => a.gio_kham >= leave.gio_bat_dau && a.gio_kham < leave.gio_ket_thuc,
    )
  }

  const ketQua = []
  for (const appointment of appointments) {
    // Lỗi thuộc phòng khám nên khách được lấn slot walk-in (ngoại lệ duy nhất, mục 15).
    const phuongAn = await sinhPhuongAnDoi({ appointment, duocLanWalkIn: true, now, session })

    if (phuongAn.length > 0) {
      phuongAn[0].da_giu_cho = await giuChoPhuongAn(phuongAn[0], appointment, session)
    }

    const daThanhToan = appointment.payment_status === 'paid'
    appointment.de_xuat_doi = {
      nghi_phep_id: leave._id,
      trang_thai: daThanhToan ? 'cho_admin_duyet' : 'cho_khach_chon',
      han_phan_hoi: new Date(now.getTime() + GIO_HAN_PHAN_HOI * 3600_000),
      phuong_an: phuongAn,
      phuong_an_khach_chon: null,
      ghi_chu: phuongAn.length === 0
        ? 'Khong tim duoc phuong an nao trong ngay — phai lien he khach de xep ngay khac.'
        : null,
    }
    await appointment.save({ session })

    if (!daThanhToan) await guiThongBaoDeXuat(appointment, session)
    ketQua.push({ appointment_id: appointment._id, so_phuong_an: phuongAn.length, cho_admin_duyet: daThanhToan })
  }

  return ketQua
}

/** Báo khách kèm ≥2 lựa chọn và hạn phản hồi (mục 15 — quyền của khách). */
export async function guiThongBaoDeXuat(appointment, session = null) {
  const dx = appointment.de_xuat_doi
  if (!dx?.phuong_an?.length) return

  const danhSach = dx.phuong_an.map((pa, i) => `${i + 1}. ${pa.mo_ta}`).join('\n')
  const noiDung = `Bác sĩ bận đột xuất ở khung ${appointment.gio_kham}. Bạn KHÔNG mất tiền — `
    + `vui lòng chọn một trong các phương án sau:\n${danhSach}\n`
    + `Nếu không phản hồi trước ${dx.han_phan_hoi?.toLocaleString('vi-VN')}, chúng tôi giữ sẵn phương án 1 cho bạn.`

  if (!appointment.user_id) {
    await NhatKyThaoTac.create([{
      nguoi_thuc_hien_id: null,
      vai_tro: 'system',
      hanh_dong: 'CUSTOMER_CONTACT_REQUIRED',
      loai_doi_tuong: 'appointment',
      doi_tuong_id: appointment._id,
      ly_do: 'Khach khong co tai khoan, can le tan goi thu cong ve de xuat doi lich',
      du_lieu_moi: {
        action: 'reschedule_proposal',
        appointment_id: appointment._id,
        ma_lich_hen: appointment.ma_lich_hen ?? null,
        ten_khach: appointment.ten_khach ?? null,
        so_dien_thoai_khach: appointment.so_dien_thoai_khach ?? null,
        email_khach: appointment.email_khach ?? null,
        noi_dung: noiDung,
      },
    }], session ? { session } : {})
    return
  }

  await ThongBao.create([{
    user_id: appointment.user_id,
    tieu_de: 'Lịch khám của bạn cần đổi',
    noi_dung: noiDung,
    loai: 'appointment',
    related_id: appointment._id,
    related_type: 'lich_hen',
    ngay_gui_du_kien: new Date(),
  }], session ? { session } : {})
}

/**
 * Quá hạn khách không phản hồi → áp phương án đã giữ sẵn. Khách KHÔNG BAO GIỜ mất chỗ
 * chỉ vì không kịp trả lời (mục 15).
 */
export async function apDungDeXuatQuaHan(now = new Date()) {
  const danhSach = await LichHen.find({
    'de_xuat_doi.trang_thai': 'cho_khach_chon',
    'de_xuat_doi.han_phan_hoi': { $lte: now },
    status: { $in: ['pending', 'confirmed'] },
  })

  let daAp = 0
  for (const appointment of danhSach) {
    const phuongAn = appointment.de_xuat_doi?.phuong_an?.[0]
    if (!phuongAn) {
      appointment.de_xuat_doi.trang_thai = 'da_huy'
      appointment.de_xuat_doi.ghi_chu = 'Qua han ma khong co phuong an nao — can lien he khach thu cong.'
      await appointment.save()
      continue
    }
    try {
      await apDungPhuongAn({ appointment, phuongAn, lyDoDoi: 'phong_kham' })
      daAp += 1
    } catch {
      // Chỗ giữ sẵn vừa mất -> để nguyên trạng thái cho người xử lý tay, không nuốt lỗi.
      appointment.de_xuat_doi.ghi_chu = 'Cho giu san khong con — can xep tay.'
      await appointment.save()
    }
  }
  return daAp
}
