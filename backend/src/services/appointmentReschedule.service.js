import {
  BacSi, LichHen, LichLamViec, NguoiDung, NhatKyThaoTac, ThongBao,
} from '../models/index.js'
import { caCuaKhung } from '../models/MauLichLamViec.js'
import { daQuaCutoffOnline, isSlotInPast, quaSatGioBatDau } from '../utils/clinicTime.js'
import { ghiNhatKyLeTan } from './receptionistAudit.service.js'
import {
  dieuKienChiemSlot, capNhatSlotCuSauKhiDoi, TRANG_THAI_DE_XUAT_MO,
  SO_NGAY_TIM_PHUONG_AN, diemLechPhuongAn, khoangCachKhung,
} from './rescheduleRules.js'

// ============================================================
// ĐIỀU PHỐI DỜI LỊCH — rule mục 14 (bác sĩ nghỉ cả ca) + mục 15 (bận một khung)
// ============================================================
// ⛔ KHÔNG HOÀN TIỀN trong mọi trường hợp (mục 5). Tiền của khách chỉ được bảo toàn dưới
// dạng QUYỀN DỜI LỊCH. Vì vậy khi phòng khám làm hỏng kế hoạch của khách, hệ thống phải
// tự tìm được chỗ thay thế — không thể đẩy khách vào thế "mất chỗ mà cũng không lấy lại tiền".
//
// Thang đề xuất (chốt 2026-08-22, thay thế thứ tự bước-1/bước-2 cũ): MỘT danh sách ứng
// viên gộp (mọi bác sĩ cùng chuyên khoa × mọi slot còn trống trong ngày, kể cả bác sĩ cũ),
// sắp theo ĐỘ LỆCH PHÚT TUYỆT ĐỐI so với khung gốc tăng dần — ưu tiên ÍT LỆCH GIỜ NHẤT,
// không còn cứng nhắc "đổi người trước, đổi giờ sau". Lệch bằng nhau thì ưu tiên GIỮ BÁC SĨ
// CŨ (khách quen bác sĩ). Ứng viên bắt đầu trong vòng PHUT_DEM_DOI_LICH_TOI_THIEU tới bị
// loại vô điều kiện — ràng buộc vật lý "khách kịp tới nơi", áp cho mọi loại kể cả giữ giờ.
//
// Phương án số 1 (sau khi sắp) luôn được GIỮ CHỖ SẴN: quá hạn khách không phản hồi thì áp
// dụng nó, khách không bao giờ mất chỗ (mục 15).

/** Hạn khách phản hồi đề xuất, tính bằng giờ. Quá hạn → tự áp phương án đã giữ sẵn. */
export const GIO_HAN_PHAN_HOI = Number(process.env.DOI_LICH_HAN_PHAN_HOI_GIO || 12)

// G1 (2026-08-03): lịch ĐÃ THANH TOÁN trước đây không có hạn nào — kẹt vĩnh viễn ở
// cho_admin_duyet nếu admin quên duyệt, vì apDungDeXuatQuaHan chỉ quét cho_khach_chon.
// Nay cho_admin_duyet cũng có hạn (gấp đôi hạn khách, vì còn phải chờ người duyệt trước),
// quá hạn cũng tự áp phương án đã giữ sẵn — khách không bao giờ mất chỗ vì admin bận.
export const GIO_HAN_PHAN_HOI_ADMIN = Number(process.env.DOI_LICH_HAN_PHAN_HOI_ADMIN_GIO || 24)

/** Trần lấn slot walk-in: 1 slot/khung (mục 15). Ngoại lệ DUY NHẤT của "không lấn walk-in". */
const TRAN_LAN_WALK_IN_MOI_KHUNG = 1

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000)
}

export function slotConTrong(slot) {
  return slot.status === 'active' && !slot.benh_nhan_id && !slot.bi_khoa_boi_nghi_phep
}

/**
 * Sinh danh sách phương án dời cho MỘT lịch hẹn, theo đúng thứ tự thang ở mục 14.
 * KHÔNG giữ chỗ — chỉ liệt kê. Việc giữ chỗ do `giuChoPhuongAn()` làm.
 *
 * @param {object} opts.appointment - lịch hẹn cần dời
 * @param {boolean} opts.duocLanWalkIn - cho phép lấn slot walk-in (chỉ khi lỗi PHÒNG KHÁM)
 */
export async function sinhPhuongAnDoi({
  appointment, duocLanWalkIn = false, now = new Date(), session = null, _chanDoan = null,
}) {
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
    // Mở rộng ra SO_NGAY_TIM_PHUONG_AN ngày (A3). Bác sĩ nghỉ cả ngày mà không có đồng
    // nghiệp cùng chuyên khoa trực hôm đó thì tìm trong ngày là chắc chắn ra rỗng.
    ngay: { $gte: ngay, $lt: addDays(ngay, SO_NGAY_TIM_PHUONG_AN) },
    trang_thai_ngay: 'lam_viec',
    trang_thai_xac_nhan: { $ne: 'tu_choi' },
  })
  if (session) scheduleQuery.session(session)
  const schedules = await scheduleQuery.lean()
  if (_chanDoan) _chanDoan.soLichLamViec = schedules.length

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

  // ── Một vòng lặp duy nhất: mọi bác sĩ (kể cả bác sĩ cũ) × mọi slot còn trống ─────────
  const ungVien = []
  for (const schedule of schedules) {
    const laBacSiCu = String(schedule.doctor_id) === String(appointment.doctor_id)
    if (!laBacSiCu && !idBacSiKhac.has(String(schedule.doctor_id))) continue

    for (const slot of schedule.slots) {
      if (!slotConTrong(slot) || daDat.has(String(slot._id))) continue
      if (slot.loai_slot === 'walk_in' && !duocLanWalkIn) continue
      if (isSlotInPast(schedule.ngay, slot.gio_bat_dau, now)) continue
      // Mốc T-30' KHÔNG áp cho phòng khám dời (mục 15) — mốc đó chỉ để chặn khách né mất
      // tiền. Nhưng ngưỡng đệm vật lý bên dưới vẫn áp dụng vô điều kiện.
      if (daQuaCutoffOnline(schedule.ngay, slot.gio_bat_dau, now) && !duocLanWalkIn) continue
      // Ràng buộc "khách kịp tới nơi" — áp cho MỌI ứng viên, kể cả lấn walk-in.
      if (quaSatGioBatDau(schedule.ngay, slot.gio_bat_dau, now)) continue

      const giuGio = slot.gio_bat_dau === gio
      const soNgayLech = Math.round((new Date(schedule.ngay) - new Date(ngay)) / 86400000)
      const cungNgay = soNgayLech === 0
      const lechPhut = diemLechPhuongAn({ gioSlot: slot.gio_bat_dau, gioGoc: gio, soNgayLech })
      const ten = tenBacSi.get(String(schedule.doctor_id)) ?? 'Bác sĩ'

      const nhanNgay = cungNgay
        ? ''
        : ` ${new Date(schedule.ngay).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`
        + (soNgayLech === 1 ? ' (mai)' : '')

      let moTa
      if (laBacSiCu && giuGio && cungNgay) moTa = `Giữ nguyên ${gio}, cùng bác sĩ`
      else if (laBacSiCu) moTa = `Cùng bác sĩ,${nhanNgay || ''} ${slot.gio_bat_dau}`.replace('  ', ' ')
      else if (giuGio && cungNgay) moTa = `Giữ nguyên ${gio}, đổi sang ${ten}`
      else moTa = `${ten},${nhanNgay || ''} ${slot.gio_bat_dau}`.replace('  ', ' ')

      ungVien.push({
        loai: (giuGio && cungNgay && !laBacSiCu) ? 'doi_bac_si' : 'doi_khung', // enum chỉ có 2 giá trị — mô tả chi tiết nằm ở mo_ta
        doctor_id: schedule.doctor_id,
        schedule_id: schedule._id,
        slot_id: slot._id,
        ngay: schedule.ngay,
        gio_bat_dau: slot.gio_bat_dau,
        bac_si_ten: laBacSiCu ? null : ten,
        mo_ta: moTa,
        lan_walk_in: slot.loai_slot === 'walk_in',
        _lechPhut: lechPhut,
        _giuBacSiCu: laBacSiCu,
      })
    }
  }

  ungVien.sort((a, b) => a._lechPhut - b._lechPhut
    || Number(b._giuBacSiCu) - Number(a._giuBacSiCu)
    || String(a.ngay).localeCompare(String(b.ngay))
    || a.gio_bat_dau.localeCompare(b.gio_bat_dau))

  if (_chanDoan) _chanDoan.soUngVienTruocLoc = ungVien.length

  // P1-7: TRƯỚC ĐÂY cắt slice(0,6) NGAY TẠI ĐÂY rồi mới gộp trùng và cắt trần walk-in —
  // một khung TMH có 2 slot giống hệt nhau nên 6 ứng viên có thể co lại còn 1 phương án.
  // Nay gộp và cắt trần TRƯỚC, cắt số lượng SAU CÙNG.
  const daLoc = capTranLanWalkIn(gopPhuongAnTrung(ungVien))
  return daLoc.slice(0, 4).map((pa) => {
    const { _lechPhut, _giuBacSiCu, ...rest } = pa
    return rest
  })
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
 * Lý do CỤ THỂ vì sao không tìm được phương án (A5). "Khong tim duoc phuong an nao" là câu
 * vô dụng với lễ tân đang cầm điện thoại — họ cần biết nên gọi khách hẹn ngày khác, hay chỉ
 * cần đợi vài phút vì đơn giản là quá sát giờ.
 */
export function moTaLyDoKhongCoPhuongAn({ soLichLamViec, soUngVienTruocLoc }) {
  if (soLichLamViec === 0) {
    return `Khong co bac si nao cung chuyen khoa truc trong ${SO_NGAY_TIM_PHUONG_AN} ngay toi — phai lien he khach de xep lai.`
  }
  if (soUngVienTruocLoc === 0) {
    return 'Co bac si truc nhung moi slot deu da kin hoac qua sat gio (<15 phut) — phai lien he khach.'
  }
  return 'Chi tim duoc it hon 2 phuong an — nen goi khach de thoa thuan truc tiep.'
}

/**
 * Như `sinhPhuongAnDoi` nhưng trả kèm chẩn đoán, để nơi gọi ghi được `ghi_chu` cụ thể.
 */
export async function sinhPhuongAnDoiKemChanDoan(opts) {
  const chanDoan = { soLichLamViec: 0, soUngVienTruocLoc: 0 }
  const phuongAn = await sinhPhuongAnDoi({ ...opts, _chanDoan: chanDoan })
  return { phuongAn, chanDoan }
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
 * Slot CŨ: mặc định `khoaSlotCu = true` chuyển `locked`, KHÔNG trả về pool (mục 15) — bác
 * sĩ bận thật, không bán lại cho ai. Khi khách TỰ dời (`khoaSlotCu = false`, mục 11), slot
 * cũ được trả về pool để bán lại — không thì mỗi lần khách dời là mất hẳn một chỗ bán được.
 */
export async function apDungPhuongAn({
  appointment,
  phuongAn,
  lyDoDoi = 'phong_kham',
  actorUserId = null,
  actorRole = null,
  session = null,
  hauToNhatKy = '',
  // Slot CŨ: khoá lại (lỗi phòng khám — mục 15) hay trả về pool (khách tự dời — mục 11).
  khoaSlotCu = true,
}) {
  const slotCu = { schedule_id: appointment.schedule_id, slot_id: appointment.slot_id }

  const chiem = await LichLamViec.updateOne(
    {
      _id: phuongAn.schedule_id,
      // Điều kiện chi tiết ở rescheduleRules.dieuKienChiemSlot — phân biệt `locked` do
      // GIỮ CHỖ cho chính lịch này với `locked` do bác sĩ NGHỈ (không bao giờ chiếm).
      slots: { $elemMatch: dieuKienChiemSlot(phuongAn) },
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

  // Slot cũ: khoá lại (lỗi phòng khám) hoặc trả về pool (khách tự dời) — mục 11 vs mục 15.
  if (slotCu.schedule_id && slotCu.slot_id) {
    await LichLamViec.updateOne(
      { _id: slotCu.schedule_id, 'slots._id': slotCu.slot_id },
      { $set: capNhatSlotCuSauKhiDoi(khoaSlotCu) },
      session ? { session } : {},
    )
  }

  const gioCu = appointment.gio_kham
  const ngayCu = appointment.ngay_kham
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
      + (phuongAn.lan_walk_in ? ' (LAN slot walk-in — ngoai le muc 15)' : '')
      + hauToNhatKy,
  }], session ? { session } : {})

  // Bổ sung cho DOI_LICH_HEN ở trên: DOI_LICH_HEN ghi việc gì xảy ra với lịch hẹn, LT_DOI_LICH
  // ghi ai ở quầy đã thao tác. Chỉ ghi nhánh lễ tân — khách tự dời trên app không thuộc nhật
  // ký ca trực. Gọi ngoài transaction nghiệp vụ (ghiNhatKyLeTan tự nuốt lỗi, không throw).
  if (actorRole === 'receptionist' || actorRole === 'admin') {
    await ghiNhatKyLeTan({
      hanhDong: 'LT_DOI_LICH',
      actorUserId,
      actorRole,
      loaiDoiTuong: 'appointment',
      doiTuongId: appointment._id,
      duLieuCu: { ngay_kham: ngayCu, gio_kham: gioCu },
      duLieuMoi: { ngay_kham: phuongAn.ngay, gio_kham: phuongAn.gio_bat_dau, ly_do_doi: lyDoDoi },
    })
  }

  return appointment
}

/**
 * Chọn tay TỰ DO một slot ngoài danh sách gợi ý (mục 15, chốt 2026-08-22) — dùng khi khách
 * có yêu cầu riêng mà `sinhPhuongAnDoi()` không (hoặc chưa) đề xuất tới. CHỈ áp dụng cho
 * lịch hẹn đang có `de_xuat_doi` mở do nghỉ đột xuất; không dùng cho dời lịch thủ công khác
 * (đó vẫn là `rescheduleAppointment` cũ, ngoài phạm vi hàm này).
 */
export async function chonPhuongAnTuDo({
  appointment, doctorId, scheduleId, slotId, actorUserId = null, actorRole = null, now = new Date(), session = null,
}) {
  if (!['cho_khach_chon', 'cho_admin_duyet'].includes(appointment.de_xuat_doi?.trang_thai)) {
    throw Object.assign(new Error('Lich hen khong co de xuat doi lich dang mo.'), { statusCode: 409 })
  }

  const scheduleQuery = LichLamViec.findOne({ _id: scheduleId, doctor_id: doctorId })
  if (session) scheduleQuery.session(session)
  const schedule = await scheduleQuery.lean()
  if (!schedule) throw Object.assign(new Error('Khong tim thay lich lam viec cua bac si nay.'), { statusCode: 400 })

  const slot = schedule.slots.find((s) => String(s._id) === String(slotId))
  if (!slot) throw Object.assign(new Error('Khong tim thay slot.'), { statusCode: 400 })
  if (!slotConTrong(slot)) throw Object.assign(new Error('Slot nay khong con trong.'), { statusCode: 409 })

  // Không được đổi chuyên khoa — ràng buộc y khoa, không phải tuỳ chọn thương mại.
  const specialtyIdGoc = String(appointment.specialty_id?._id ?? appointment.specialty_id ?? '')
  if (slot.specialty_id && specialtyIdGoc && String(slot.specialty_id) !== specialtyIdGoc) {
    throw Object.assign(new Error('Slot nay khac chuyen khoa voi lich hen goc.'), { statusCode: 400 })
  }
  if (isSlotInPast(schedule.ngay, slot.gio_bat_dau, now)) {
    throw Object.assign(new Error('Slot da qua gio, khong the chon.'), { statusCode: 400 })
  }
  if (quaSatGioBatDau(schedule.ngay, slot.gio_bat_dau, now)) {
    throw Object.assign(new Error('Slot qua sat gio hien tai, khach khong kip toi.'), { statusCode: 400 })
  }

  const trung = await LichHen.exists({
    schedule_id: schedule._id,
    slot_id: slot._id,
    status: { $ne: 'cancelled' },
    _id: { $ne: appointment._id },
  })
  if (trung) throw Object.assign(new Error('Slot nay vua co lich hen khac chiem.'), { statusCode: 409 })

  const phuongAn = {
    loai: slot.gio_bat_dau === appointment.gio_kham ? 'doi_bac_si' : 'doi_khung',
    doctor_id: schedule.doctor_id,
    schedule_id: schedule._id,
    slot_id: slot._id,
    ngay: schedule.ngay,
    gio_bat_dau: slot.gio_bat_dau,
    lan_walk_in: slot.loai_slot === 'walk_in',
  }

  // Đóng phương án đang giữ sẵn (nếu có) trước khi chuyển sang slot khác do lễ tân chọn tay.
  const dangGiuCho = (appointment.de_xuat_doi.phuong_an ?? []).find(
    (pa) => pa.da_giu_cho && String(pa.slot_id) !== String(slot._id),
  )
  if (dangGiuCho) await nhaChoDaGiu(dangGiuCho, session)

  return apDungPhuongAn({
    appointment,
    phuongAn,
    lyDoDoi: 'phong_kham',
    actorUserId,
    actorRole,
    session,
    hauToNhatKy: ' (CHON TAY)',
  })
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
    // P1-6: lịch hẹn đã có đề xuất CÒN MỞ (dính hai đơn nghỉ liên tiếp) nay được sinh lại.
    // Phải nhả chỗ đã giữ ở đề xuất cũ trước, nếu không một lịch hẹn giữ hai chỗ cùng lúc.
    const dxCu = appointment.de_xuat_doi
    if (dxCu && TRANG_THAI_DE_XUAT_MO.includes(dxCu.trang_thai)) {
      for (const pa of dxCu.phuong_an ?? []) await nhaChoDaGiu(pa, session)
    }

    // Lỗi thuộc phòng khám nên khách được lấn slot walk-in (ngoại lệ duy nhất, mục 15).
    const { phuongAn, chanDoan } = await sinhPhuongAnDoiKemChanDoan({
      appointment, duocLanWalkIn: true, now, session,
    })

    if (phuongAn.length > 0) {
      phuongAn[0].da_giu_cho = await giuChoPhuongAn(phuongAn[0], appointment, session)
    }

    const daThanhToan = appointment.payment_status === 'paid'
    // G1 (2026-08-03): trước đây chỉ khách CHƯA thanh toán được gán han_phan_hoi — khách ĐÃ
    // thanh toán (nhóm cần bảo vệ nhất dưới chính sách không hoàn tiền) lại không có hạn nào,
    // kẹt vĩnh viễn ở cho_admin_duyet nếu không ai duyệt. Nay cả hai trạng thái đều có hạn.
    appointment.de_xuat_doi = {
      nghi_phep_id: leave._id,
      trang_thai: daThanhToan ? 'cho_admin_duyet' : 'cho_khach_chon',
      han_phan_hoi: new Date(now.getTime() + (daThanhToan ? GIO_HAN_PHAN_HOI_ADMIN : GIO_HAN_PHAN_HOI) * 3600_000),
      phuong_an: phuongAn,
      phuong_an_khach_chon: null,
      ghi_chu: phuongAn.length === 0 ? moTaLyDoKhongCoPhuongAn(chanDoan) : null,
    }
    await appointment.save({ session })

    // G1: trước đây `if (!daThanhToan)` chặn thông báo cho khách đã trả tiền — họ không biết
    // gì cho tới khi admin bấm duyệt. Chính sách không hoàn tiền buộc khách phải được báo NGAY,
    // admin duyệt chỉ để xác nhận phương án cuối chứ không phải cổng chặn thông tin.
    await guiThongBaoDeXuat(appointment, session)
    ketQua.push({ appointment_id: appointment._id, so_phuong_an: phuongAn.length, cho_admin_duyet: daThanhToan })
  }

  return ketQua
}

/**
 * Sinh lại phương án cho những lịch hẹn có chỗ GIỮ SẴN vừa bị một đơn nghỉ khác vô hiệu
 * (P0-3). Những lịch này thuộc bác sĩ KHÁC — chúng chỉ mượn slot của bác sĩ vừa báo nghỉ.
 *
 * PHẢI gọi SAU khi đã khoá slot, để `sinhPhuongAnDoi` nhìn thấy slot mới khoá là không
 * khả dụng. Giữ nguyên `nghi_phep_id` gốc — đề xuất vẫn thuộc về đơn nghỉ ban đầu.
 */
export async function sinhLaiDeXuatChoLichMatCho(slotIds, { session = null, now = new Date() } = {}) {
  if (!Array.isArray(slotIds) || slotIds.length === 0) return []

  const danhSach = await LichHen.find({
    'de_xuat_doi.trang_thai': { $in: TRANG_THAI_DE_XUAT_MO },
    // Chỉ khớp phương án ĐANG THỰC SỰ GIỮ CHỖ (da_giu_cho: true) — không phải bất kỳ phương
    // án nào trong danh sách gợi ý. Nếu chỉ lọc theo slot_id, một phương án KHÔNG được chọn
    // (chưa từng giữ chỗ thật) của lịch hẹn X có thể trùng slot vừa bị đơn nghỉ KHÁC vô hiệu,
    // khiến X bị nhả nhầm chỗ đang giữ hợp lệ của chính nó (vi phạm mục 15: khách không được
    // mất chỗ khi không có lý do chính đáng).
    'de_xuat_doi.phuong_an': { $elemMatch: { slot_id: { $in: slotIds }, da_giu_cho: true } },
    status: { $in: ['pending', 'confirmed'] },
  }).session(session)

  const ketQua = []
  for (const appointment of danhSach) {
    // Nhả nốt các chỗ giữ sẵn CÒN hợp lệ ở phương án cũ — sắp thay bằng phương án mới.
    for (const pa of appointment.de_xuat_doi.phuong_an ?? []) await nhaChoDaGiu(pa, session)

    const phuongAn = await sinhPhuongAnDoi({ appointment, duocLanWalkIn: true, now, session })
    if (phuongAn.length > 0) {
      phuongAn[0].da_giu_cho = await giuChoPhuongAn(phuongAn[0], appointment, session)
    }

    const choAdminDuyet = appointment.de_xuat_doi.trang_thai === 'cho_admin_duyet'
    appointment.de_xuat_doi.phuong_an = phuongAn
    appointment.de_xuat_doi.phuong_an_khach_chon = null
    appointment.de_xuat_doi.han_phan_hoi = new Date(
      now.getTime() + (choAdminDuyet ? GIO_HAN_PHAN_HOI_ADMIN : GIO_HAN_PHAN_HOI) * 3600_000,
    )
    appointment.de_xuat_doi.ghi_chu = phuongAn.length === 0
      ? 'Cho giu san mat vi mot bac si khac cung bao nghi — khong tim duoc phuong an moi, phai lien he khach.'
      : 'Cho giu san mat vi mot bac si khac cung bao nghi — da sinh phuong an moi va giu cho lai.'
    await appointment.save({ session })

    await guiThongBaoDeXuat(appointment, session)
    ketQua.push({ appointment_id: appointment._id, so_phuong_an: phuongAn.length })
  }

  return ketQua
}

/**
 * G3 (2026-08-03): khách đang ở bước THANH TOÁN cho một slot mà bác sĩ VỪA báo nghỉ (slot đã
 * bị `lockSlotsForLeave`/`lockSlotsForSuddenLeave` khoá đúng lúc khách bấm xác nhận). Tiền vẫn
 * được thu (chính sách không hoàn tiền — từ chối thu sau khi đã hứa slot còn tệ hơn), nhưng
 * KHÔNG được chốt `booked` cho một bác sĩ đã nghỉ. Đẩy thẳng vào luồng đề xuất dời — cùng cách
 * xử lý một lịch hẹn thường bị ảnh hưởng bởi đơn nghỉ (mục 14/15), chỉ khác là chạy ngay tại
 * đây thay vì trong `taoDeXuatDoiChoDonNghi` (lịch này chưa kịp tồn tại lúc hàm đó quét DB).
 */
export async function xuLyThanhToanTrungLichNghi({ appointment, slot, session }) {
  // `appointment` o day den tu loadOwnedPaymentBundle, co doctor_id/specialty_id da POPULATE
  // (Document long, khong phai ObjectId tho). sinhPhuongAnDoi dung 2 truong nay lam dieu kien
  // query ($ne, membership trong mang specialties) — dua thang Document vao de an toan, chuan
  // hoa ve ObjectId truoc thay vi dua vao Mongoose tu ep kieu ngam.
  const appointmentChoDeXuat = {
    _id: appointment._id,
    ngay_kham: appointment.ngay_kham,
    gio_kham: appointment.gio_kham,
    specialty_id: appointment.specialty_id?._id ?? appointment.specialty_id,
    doctor_id: appointment.doctor_id?._id ?? appointment.doctor_id,
  }
  const phuongAn = await sinhPhuongAnDoi({ appointment: appointmentChoDeXuat, duocLanWalkIn: true, session })

  if (phuongAn.length > 0) {
    phuongAn[0].da_giu_cho = await giuChoPhuongAn(phuongAn[0], appointment, session)
  }

  appointment.de_xuat_doi = {
    nghi_phep_id: slot.nghi_phep_id ?? null,
    // Khách vừa thanh toán xong (payment_status đã 'paid' trước khi hàm này được gọi) — luôn
    // là nhóm cho_admin_duyet, không có nhánh cho_khach_chon ở đây.
    trang_thai: 'cho_admin_duyet',
    han_phan_hoi: new Date(Date.now() + GIO_HAN_PHAN_HOI_ADMIN * 3600_000),
    phuong_an: phuongAn,
    phuong_an_khach_chon: null,
    ghi_chu: phuongAn.length === 0
      ? 'Bac si bao nghi dung luc khach thanh toan — khong tim duoc phuong an trong ngay, phai lien he khach.'
      : 'Bac si bao nghi dung luc khach dang thanh toan — da giu cho phuong an 1, cho Admin duyet.',
  }
  await appointment.save({ session })
  await guiThongBaoDeXuat(appointment, session)
}

/**
 * Báo khách kèm ≥2 lựa chọn và hạn phản hồi (mục 15 — quyền của khách).
 *
 * G1 (2026-08-03): khách ĐÃ THANH TOÁN (`cho_admin_duyet`) trước đây KHÔNG được gọi hàm này
 * — im lặng hoàn toàn cho tới khi admin duyệt. Nay luôn báo, nhưng giọng khác: khách chưa
 * thanh toán được CHỌN ngay; khách đã thanh toán chỉ được báo đã GIỮ SẴN chỗ, chờ admin xác
 * nhận cuối (nút chọn phía frontend tự khoá khi trang_thai='cho_admin_duyet' — xem
 * RescheduleModal.tsx). Đồng thời luôn tạo việc "cần liên hệ" cho lễ tân khi cho_admin_duyet,
 * kể cả khách có tài khoản — vì đây là nhóm cần lễ tân theo dõi tới khi admin duyệt xong,
 * khác cho_khach_chon vốn khách tự xử lý được qua app.
 */
export async function guiThongBaoDeXuat(appointment, session = null) {
  const dx = appointment.de_xuat_doi
  if (!dx?.phuong_an?.length) return

  const choAdminDuyet = dx.trang_thai === 'cho_admin_duyet'
  const danhSach = dx.phuong_an.map((pa, i) => `${i + 1}. ${pa.mo_ta}`).join('\n')
  const noiDung = choAdminDuyet
    ? `Bác sĩ bận đột xuất ở khung ${appointment.gio_kham}. Bạn KHÔNG mất tiền — chúng tôi đã `
      + `GIỮ SẴN chỗ cho bạn:\n${dx.phuong_an[0].mo_ta}\n`
      + `Đang chờ xác nhận cuối cùng, chúng tôi sẽ báo lại trong ${GIO_HAN_PHAN_HOI_ADMIN}h.`
    : `Bác sĩ bận đột xuất ở khung ${appointment.gio_kham}. Bạn KHÔNG mất tiền — `
      + `vui lòng chọn một trong các phương án sau:\n${danhSach}\n`
      + `Nếu không phản hồi trước ${dx.han_phan_hoi?.toLocaleString('vi-VN')}, chúng tôi giữ sẵn phương án 1 cho bạn.`

  if (appointment.user_id) {
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

  if (choAdminDuyet || !appointment.user_id) {
    await NhatKyThaoTac.create([{
      nguoi_thuc_hien_id: null,
      vai_tro: 'system',
      hanh_dong: 'CUSTOMER_CONTACT_REQUIRED',
      loai_doi_tuong: 'appointment',
      doi_tuong_id: appointment._id,
      ly_do: choAdminDuyet
        ? 'Khach da thanh toan, dang cho Admin duyet phuong an — le tan theo doi va lien he neu can'
        : 'Khach khong co tai khoan, can le tan goi thu cong ve de xuat doi lich',
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
  }
}

/**
 * Quá hạn không có ai xử lý → áp phương án đã giữ sẵn. Khách KHÔNG BAO GIỜ mất chỗ chỉ vì
 * không kịp trả lời (mục 15) — hoặc vì admin bận không kịp duyệt (G1, 2026-08-03: trước đây
 * chỉ quét 'cho_khach_chon', lịch ĐÃ THANH TOÁN treo ở 'cho_admin_duyet' không có lưới an
 * toàn nào, có thể kẹt tới ngày khám rồi bị quét thành no_show — mất trắng tiền oan).
 */
export async function apDungDeXuatQuaHan(now = new Date()) {
  const danhSach = await LichHen.find({
    'de_xuat_doi.trang_thai': { $in: ['cho_khach_chon', 'cho_admin_duyet'] },
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
