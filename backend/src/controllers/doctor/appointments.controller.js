import mongoose from 'mongoose'
import { BacSi, DichVu, LichHen, LichLamViec, ThanhVien, NguoiDung, KetQuaKham, DonThuoc, HangDoi, SinhHieuKham, HoSoBenhNhan, NhatKyThaoTac } from '../../models/index.js'
import { ok, created, fail } from '../../utils/response.js'
import { isNgayTaiKhamHopLe } from '../../utils/validators.js'
import { emitDashboardAppointmentChanged } from '../../realtime/socket.js'
import { soSanhThuTuHangDoi, tinhBacUuTienDong } from '../../models/HangDoi.js'
import { startOfDayUtc } from '../../utils/clinicTime.js'
import { enrichAppointmentsWithPaymentData } from '../admin/appointment.controller.js'
import {
  getOwnedOfflineQueue,
  layPhienKham,
  taoChiDinhDichVu,
  upsertVitals,
} from '../../services/examSession.service.js'

// ============================================================
// B3 + B4 — Lịch hẹn & Kết quả khám (Bác sĩ)
// Routes: /api/doctor/appointments
// ============================================================

const PAYMENT_DEADLINE_HOURS = 2

async function getDocId(userId) {
  const d = await BacSi.findOne({ user_id: userId }).select('_id').lean()
  return d?._id ?? null
}

function clinicDayRange(value = new Date()) {
  const start = startOfDayUtc(value)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start, end }
}

async function formatAppointment(a) {
  const [user, member, profile, result] = await Promise.all([
    NguoiDung.findById(a.user_id).select('ho_ten so_dien_thoai').lean(),
    a.member_id ? ThanhVien.findById(a.member_id).select('ho_ten ngay_sinh gioi_tinh nhom_mau di_ung benh_nen').lean() : null,
    a.ho_so_benh_nhan_id ? HoSoBenhNhan.findById(a.ho_so_benh_nhan_id).select('ho_ten so_dien_thoai ngay_sinh gioi_tinh nhom_mau di_ung benh_nen dia_chi ghi_chu').lean() : null,
    KetQuaKham.findOne({ appointment_id: a._id }).select('status').lean(),
  ])

  const benh_nhan_ho_ten = member?.ho_ten ?? a.ten_khach ?? user?.ho_ten ?? 'Không rõ'
  const ngay_sinh = member?.ngay_sinh
  const tuoi = ngay_sinh
    ? new Date().getFullYear() - new Date(ngay_sinh).getFullYear()
    : undefined

  const isTaiKham = a.loai_lich_hen === 'tai_kham' || !!a.lich_hen_goc_id

  return {
    id:               a._id,
    ma_lich_hen:      a.ma_lich_hen ?? null,
    loai_lich_hen:    isTaiKham ? 'tai_kham' : (a.loai_lich_hen || 'kham_moi'),
    is_tai_kham:      isTaiKham,
    benh_nhan:        benh_nhan_ho_ten,
    benh_nhan_id:     a.user_id,
    ho_so_benh_nhan_id: a.ho_so_benh_nhan_id ?? null,
    so_dien_thoai:    a.so_dien_thoai_khach ?? user?.so_dien_thoai ?? null,
    ngay_kham:        a.ngay_kham,
    gio_kham:         a.gio_kham,
    loai_kham:        a.loai_kham,
    chuyen_khoa:      a.specialty_id?.ten ?? null,
    status:           a.status,
    payment_status:   a.payment_status,
    gia_kham:         a.gia_kham,
    ly_do_kham:       a.ly_do_kham,
    phong_kham:       a.phong_kham,
    dia_chi_kham:     a.dia_chi_kham,
    ten_dich_vu:      a.ten_dich_vu,
    tuoi,
    gioi_tinh:        member?.gioi_tinh ? { nam: 'Nam', nu: 'Nữ', khac: 'Khác' }[member.gioi_tinh] : undefined,
    di_ung:           member?.di_ung    ?? null,
    benh_nen:         member?.benh_nen  ?? null,
    da_co_ket_qua:    !!result,
    ket_qua_status:   result?.status ?? null,
    ly_do_huy:        a.ly_do_huy,
    payment_deadline: a.payment_deadline,
    // Ho so tai quay la nguon du phong cho lich khong co member_id.
    benh_nhan:        member?.ho_ten ?? profile?.ho_ten ?? benh_nhan_ho_ten,
    tuoi:             member?.ngay_sinh || profile?.ngay_sinh
      ? new Date().getFullYear() - new Date(member?.ngay_sinh ?? profile?.ngay_sinh).getFullYear()
      : tuoi,
    gioi_tinh:        { nam: 'Nam', nu: 'Nữ', khac: 'Khác' }[member?.gioi_tinh ?? profile?.gioi_tinh] ?? undefined,
    ngay_sinh:       member?.ngay_sinh ?? profile?.ngay_sinh ?? null,
    nhom_mau:        member?.nhom_mau ?? profile?.nhom_mau ?? null,
    di_ung:          member?.di_ung ?? profile?.di_ung ?? null,
    benh_nen:        member?.benh_nen ?? profile?.benh_nen ?? null,
    dia_chi:         profile?.dia_chi ?? null,
    ghi_chu:         profile?.ghi_chu ?? null,
    so_dien_thoai:   a.so_dien_thoai_khach ?? profile?.so_dien_thoai ?? user?.so_dien_thoai ?? null,
  }
}

// ─── GET /api/doctor/appointments?status=&date= ─────────────────────────────
export async function list(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    const { status, date } = req.query
    const filter = { doctor_id: docId }
    if (status) filter.status = status
    if (date) {
      const { start, end } = clinicDayRange(date)
      filter.ngay_kham = { $gte: start, $lt: end }
    }

    const appointments = await LichHen.find(filter)
      .populate('specialty_id', 'ten')
      .sort({ ngay_kham: 1, gio_kham: 1 })
      .lean()
      
    const enrichedAppointments = await enrichAppointmentsWithPaymentData(appointments, { persist: true })

    const result = await Promise.all(enrichedAppointments.map(formatAppointment))
    return ok(res, result)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/doctor/queue?date= ────────────────────────────────────────────
// "Hồ sơ chờ khám" — toàn bộ lượt khám (online + offline) đã check-in gán cho bác sĩ này.
// Neo trên HangDoi; join KetQuaKham theo hang_doi_id (và appointment_id cho dữ liệu cũ).
// Thứ tự ưu tiên nay tính động qua `soSanhThuTuHangDoi()` — xem models/HangDoi.js.

function trangThaiTongHop(entry, kq) {
  if (entry.trang_thai === 'cancelled') return 'da_huy'
  if (entry.trang_thai === 'skipped') return 'bo_luot'
  if (entry.trang_thai === 'dang_cho') return 'dang_cho'
  if (entry.trang_thai === 'da_goi') return 'da_goi'
  if (entry.trang_thai === 'trong_phong') return 'trong_phong'
  // hoan_thanh: phân theo trạng thái hồ sơ
  if (!kq || kq.status === 'ban_nhap') return 'cho_nhap_ho_so'
  if (kq.status === 'cho_xac_nhan' || kq.status === 'yeu_cau_chinh_sua') return 'cho_xac_nhan'
  if (kq.status === 'da_xac_nhan') return 'da_xong'
  return 'cho_nhap_ho_so'
}

export async function examQueue(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    const { start: dayStart, end: dayEnd } = clinicDayRange(req.query.date ?? new Date())

    const entries = await HangDoi.find({ doctor_id: docId, checkin_time: { $gte: dayStart, $lt: dayEnd } }).lean()
    if (entries.length === 0) return ok(res, [])

    // Join hồ sơ: gom theo hang_doi_id (mới) + appointment_id (dữ liệu cũ).
    const hangDoiIds = entries.map((e) => e._id)
    const apptIds = entries.filter((e) => e.appointment_id).map((e) => e.appointment_id)
    const profileIds = entries.filter((e) => e.ho_so_benh_nhan_id).map((e) => e.ho_so_benh_nhan_id)
    const memberIds = entries.filter((e) => e.member_id).map((e) => e.member_id)
    const [profiles, members, results, appts, prevKetQuaKhams] = await Promise.all([
      profileIds.length
        ? HoSoBenhNhan.find({ _id: { $in: profileIds } }).select('ho_ten so_dien_thoai ngay_sinh gioi_tinh nhom_mau di_ung benh_nen dia_chi ghi_chu').lean()
        : [],
      memberIds.length
        ? ThanhVien.find({ _id: { $in: memberIds } }).select('ho_ten ngay_sinh gioi_tinh nhom_mau di_ung benh_nen').lean()
        : [],
      KetQuaKham.find({
        $or: [{ hang_doi_id: { $in: hangDoiIds } }, { appointment_id: { $in: apptIds } }],
      }).select('hang_doi_id appointment_id status').lean(),
      apptIds.length
        ? LichHen.find({ _id: { $in: apptIds } }).select('loai_lich_hen lich_hen_goc_id ly_do_kham').lean()
        : [],
      profileIds.length
        ? KetQuaKham.find({ ho_so_benh_nhan_id: { $in: profileIds } }).select('ho_so_benh_nhan_id').lean()
        : [],
    ])
    const profileById = new Map(profiles.map((profile) => [String(profile._id), profile]))
    const memberById = new Map(members.map((member) => [String(member._id), member]))
    const apptById = new Map(appts.map((a) => [String(a._id), a]))
    const kqByHangDoi = new Map(results.filter((r) => r.hang_doi_id).map((r) => [String(r.hang_doi_id), r]))
    const kqByAppt = new Map(results.filter((r) => r.appointment_id).map((r) => [String(r.appointment_id), r]))
    const profileHasPrevExam = new Set(prevKetQuaKhams.map((k) => String(k.ho_so_benh_nhan_id)))

    // Bậc ưu tiên tính ĐỘNG (rule mục 6) — `muc_uu_tien` trong DB chỉ là snapshot lúc
    // check-in, dùng nó để xếp thứ tự sẽ phạt oan người đến sớm.
    const now = new Date()
    const rows = entries
      .sort((a, b) => soSanhThuTuHangDoi(a, b, now))
      .map((e) => {
        const profile = e.ho_so_benh_nhan_id ? profileById.get(String(e.ho_so_benh_nhan_id)) : null
        const member = e.member_id ? memberById.get(String(e.member_id)) : null
        const ngaySinh = e.ngay_sinh ?? member?.ngay_sinh ?? profile?.ngay_sinh ?? null
        const kq = kqByHangDoi.get(String(e._id)) || (e.appointment_id ? kqByAppt.get(String(e.appointment_id)) : null)
        const appt = e.appointment_id ? apptById.get(String(e.appointment_id)) : null

        const isTaiKham = e.loai_lich_hen === 'tai_kham' ||
          !!e.lich_hen_goc_id ||
          appt?.loai_lich_hen === 'tai_kham' ||
          !!appt?.lich_hen_goc_id

        return {
          id: e._id,
          appointment_id: e.appointment_id ?? null,
          ho_so_benh_nhan_id: e.ho_so_benh_nhan_id ?? null,
          nguon: e.nguon,
          loai_lich_hen: isTaiKham ? 'tai_kham' : 'kham_moi',
          ten_benh_nhan: e.ten_benh_nhan,
          so_dien_thoai: e.so_dien_thoai ?? profile?.so_dien_thoai ?? null,
          ngay_sinh: ngaySinh,
          tuoi: e.tuoi ?? (ngaySinh ? new Date().getFullYear() - new Date(ngaySinh).getFullYear() : null),
          gioi_tinh: e.gioi_tinh ?? member?.gioi_tinh ?? profile?.gioi_tinh ?? null,
          nhom_mau: e.nhom_mau ?? member?.nhom_mau ?? profile?.nhom_mau ?? null,
          di_ung: e.di_ung ?? member?.di_ung ?? profile?.di_ung ?? null,
          benh_nen: e.benh_nen ?? member?.benh_nen ?? profile?.benh_nen ?? null,
          dia_chi: e.dia_chi ?? profile?.dia_chi ?? null,
          ghi_chu: e.ghi_chu ?? profile?.ghi_chu ?? null,
          phong_kham: e.phong_kham ?? null,
          muc_uu_tien: tinhBacUuTienDong(e, now),
          hang_doi_trang_thai: e.trang_thai,
          checkin_time: e.checkin_time,
          ket_qua_id: kq?._id ?? null,
          ket_qua_status: kq?.status ?? null,
          trang_thai_tong_hop: trangThaiTongHop(e, kq),
        }
      })
    return ok(res, rows)
    return ok(res, rows)
  } catch (err) { return fail(res, 500, err.message) }
}

// ─── GET /api/doctor/appointments/:id ───────────────────────────────────────
export async function getById(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')
    const a = await LichHen.findOne({ _id: req.params.id, doctor_id: docId })
      .populate('specialty_id', 'ten')
      .lean()
    if (!a) return fail(res, 404, 'Không tìm thấy lịch hẹn')
    return ok(res, await formatAppointment(a))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/doctor/appointments/:id/confirm ─────────────────────────────
// Chỉ dùng cho HOME — clinic auto-confirm khi thanh toán, bác sĩ không còn xác nhận
// (quyết định 2026-07-02, xem docs/superpowers/specs/2026-07-02-clinic-auto-confirm-decision.md)
export async function confirm(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    const a = await LichHen.findOne({ _id: req.params.id, doctor_id: docId })
    if (!a) return fail(res, 404, 'Không tìm thấy lịch hẹn')
    if (a.loai_kham !== 'home') {
      return fail(res, 409, 'Lịch khám tại phòng khám tự động xác nhận khi thanh toán — bác sĩ không cần xác nhận')
    }
    if (a.status !== 'pending') return fail(res, 409, 'Chỉ xác nhận lịch ở trạng thái chờ')

    // Quy tắc B3 #1: pending + ngay_kham < today → không được xác nhận (hết hạn).
    // FE (isExpiredPending) đã ẩn nút nhưng cần chặn cả server để tránh gọi API trực tiếp.
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    if (a.ngay_kham < todayStart) {
      return fail(res, 409, 'Lịch hẹn đã quá ngày khám, không thể xác nhận')
    }

    const oldStatus = a.status
    a.status = 'confirmed'
    if (a.payment_status === 'unpaid') {
      a.payment_deadline = new Date(Date.now() + PAYMENT_DEADLINE_HOURS * 3600 * 1000)
    }
    await a.save()
    emitDashboardAppointmentChanged(oldStatus, a.status)

    return ok(res, { id: a._id, status: a.status, payment_deadline: a.payment_deadline }, 'Đã xác nhận lịch hẹn')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/doctor/appointments/:id/cancel ──────────────────────────────
// 2 trường hợp:
//   - HOME, status='pending'   → từ chối ca chưa nhận (như cũ) — slot không tồn tại cho home.
//   - CLINIC, status='confirmed' → "Hủy khẩn cấp" (spec 2026-06-27 mục 7.2): bắt buộc lý do,
//     slot → 'locked' (KHÔNG trả về 'active' — bác sĩ không được tự nhận lại đúng ca đó).
export async function cancel(req, res) {
  try {
    const { ly_do } = req.body
    const docId = await getDocId(req.user.id)
    const a = await LichHen.findOne({ _id: req.params.id, doctor_id: docId })
    if (!a) return fail(res, 404, 'Không tìm thấy lịch hẹn')
    // Whitelist thay vì blacklist — trước đây chỉ loại 'completed'/'cancelled' nên 'no_show' và
    // 'skipped' (lịch đã ghi nhận không đến/bỏ lượt) vẫn hủy được, có thể kích hoạt hoàn tiền sai
    // cho lịch đã "chốt" là không đến (xem docs/Bác sĩ/Audit tong the, GAP-003).
    const CANCELLABLE_STATUSES = ['pending', 'confirmed', 'checked_in', 'in_progress', 'waiting_record', 'waiting_doctor_confirm']
    if (!CANCELLABLE_STATUSES.includes(a.status)) {
      return fail(res, 409, 'Không thể hủy lịch hẹn ở trạng thái này')
    }

    const isEmergency = a.loai_kham === 'clinic' && a.status === 'confirmed'
    if (isEmergency && !ly_do?.trim()) {
      return fail(res, 400, 'Hủy khẩn cấp bắt buộc phải nhập lý do')
    }

    const oldStatus = a.status
    a.status    = 'cancelled'
    a.ly_do_huy = ly_do?.trim() || 'Bác sĩ hủy lịch'
    a.payment_deadline = null
    if (a.payment_status === 'paid') a.payment_status = 'refunded'

    if (a.schedule_id && a.slot_id) {
      await LichLamViec.findOneAndUpdate(
        { _id: a.schedule_id, 'slots._id': a.slot_id },
        isEmergency
          ? { $set: { 'slots.$.status': 'locked' } }
          : { $set: { 'slots.$.status': 'active', 'slots.$.benh_nhan_id': null } },
      )
    }

    await a.save()
    emitDashboardAppointmentChanged(oldStatus, a.status)
    return ok(res, { id: a._id, status: a.status, payment_status: a.payment_status }, 'Đã hủy lịch hẹn')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/doctor/appointments/:id/complete ────────────────────────────
// Bác sĩ tự đánh dấu đã khám xong — KHÔNG bắt buộc đã nhập kết quả khám trước.
// da_co_ket_qua có thể vẫn false sau khi complete(); createResult() cho phép
// nhập kết quả cả khi status đã là 'completed' (xem guard trong createResult()).
export async function complete(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    const a = await LichHen.findOne({ _id: req.params.id, doctor_id: docId })
    if (!a) return fail(res, 404, 'Không tìm thấy lịch hẹn')
    // Cho phép complete() từ 'in_progress'/'waiting_record' — 2 trạng thái này giờ đạt được qua
    // hàng đợi động (queue.controller.js intoRoom()/finish()), KHÔNG chỉ qua luồng xác nhận cũ
    // ('confirmed'). Bác sĩ vẫn có thể tự đánh dấu hoàn thành bất kể đã nhập hồ sơ hay chưa (giữ
    // nguyên hành vi "không bắt buộc đã nhập kết quả" đã có từ trước).
    if (!['confirmed', 'in_progress', 'waiting_record'].includes(a.status)) {
      return fail(res, 409, 'Chỉ đánh dấu hoàn thành cho lịch hẹn đã xác nhận, đang khám, hoặc đang chờ nhập hồ sơ')
    }

    const oldStatus = a.status
    a.status = 'completed'
    await a.save()
    emitDashboardAppointmentChanged(oldStatus, a.status)

    const hasDone = await KetQuaKham.exists({ appointment_id: a._id })
    return ok(res, { id: a._id, status: a.status, da_co_ket_qua: !!hasDone }, 'Đã đánh dấu hoàn thành')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/doctor/appointments/:id/result ────────────────────────────────
export async function getResult(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    const a = await LichHen.findOne({ _id: req.params.id, doctor_id: docId }).select('_id').lean()
    if (!a) return fail(res, 404, 'Không tìm thấy lịch hẹn')

    const result = await KetQuaKham.findOne({ appointment_id: a._id })
      .populate('lich_su_sua.nguoi_sua_id', 'ho_ten')
      .lean()
    if (!result) return fail(res, 404, 'Chưa có kết quả khám')

    const prescription = await DonThuoc.findOne({ medical_record_id: result._id }).lean()
    return ok(res, {
      ...result,
      id: result._id,
      thuoc: prescription?.items ?? [],
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// Áp dụng các chỉnh sửa hồ sơ (chẩn đoán, hướng dẫn, ghi chú, ngày tái khám, đơn thuốc) từ
// req.body vào document `result` (CHƯA save — caller tự save sau khi set thêm status). Dùng
// CHUNG cho updateResult (sửa) và confirmResult (Lưu & Xác nhận) → 1 nguồn logic duy nhất.
// Trả { ok: true, prescription } hoặc { ok: false, status, message } khi validate thất bại.
// Lỗi schema đơn thuốc (so_ngay/gio_uong/ten_thuoc...) ném ValidationError để caller trả 400.
async function applyResultEdits(result, body, appt, docId, doctorUserId) {
  const { chan_doan, huong_dan_dieu_tri, ghi_chu, ngay_tai_kham, thuoc, sinh_hieu, dich_vu_phat_sinh } = body

  if (chan_doan !== undefined) {
    if (!chan_doan?.trim()) return { ok: false, status: 400, message: 'Chẩn đoán là bắt buộc' }
    result.chan_doan = chan_doan.trim()
  }
  if (huong_dan_dieu_tri !== undefined) result.huong_dan_dieu_tri = huong_dan_dieu_tri?.trim() || null
  if (ghi_chu !== undefined) result.ghi_chu = ghi_chu?.trim() || null
  if (ngay_tai_kham !== undefined) {
    if (ngay_tai_kham && !isNgayTaiKhamHopLe(ngay_tai_kham, appt.ngay_kham)) {
      return { ok: false, status: 400, message: 'Ngày tái khám phải từ ngày tiếp theo sau ngày khám' }
    }
    result.ngay_tai_kham = ngay_tai_kham ? new Date(ngay_tai_kham) : null
  }

  if (dich_vu_phat_sinh !== undefined) {
    const chiDinh = await taoChiDinhDichVu(dich_vu_phat_sinh, appt.specialty_id, docId)
    if (!chiDinh.ok) return chiDinh
    result.dich_vu_phat_sinh = chiDinh.lines
  }

  if (sinh_hieu) {
    await upsertVitals({
      appointmentId: appt?._id ?? null,
      hangDoiId: appt?._id ? null : result.hang_doi_id ?? null,
      memberId: appt?.member_id ?? null,
      doctorUserId,
      sinhHieu: sinh_hieu,
    })
  }

  // Đơn thuốc: cập nhật đơn đã có, tạo mới nếu bác sĩ thêm, hoặc xóa hẳn khi gửi mảng rỗng
  // (đơn thuốc không bắt buộc — không để đơn rỗng/mồ côi). thuoc=undefined → không đụng.
  let prescription = await DonThuoc.findOne({ medical_record_id: result._id })
  if (Array.isArray(thuoc) && thuoc.length) {
    if (prescription) {
      prescription.items = thuoc
      await prescription.save()
    } else {
      prescription = await DonThuoc.create({
        ket_qua_kham_id:   result._id,
        medical_record_id: result._id,
        member_id:         appt.member_id,
        ten_khach:         appt.ten_khach ?? null,
        doctor_id:         docId,
        nguon:             'bac_si',
        items:             thuoc,
      })
    }
  } else if (Array.isArray(thuoc) && thuoc.length === 0 && prescription) {
    await DonThuoc.deleteOne({ _id: prescription._id })
    prescription = null
  }

  return { ok: true, prescription }
}

const MEDICAL_RECORD_AUDIT_FIELDS = [
  'status',
  'chan_doan',
  'huong_dan_dieu_tri',
  'ghi_chu',
  'ngay_tai_kham',
  'dich_vu_phat_sinh',
  'thuoc',
]

async function snapshotMedicalRecord(result) {
  const prescription = await DonThuoc.findOne({ medical_record_id: result._id }).lean()
  return {
    status: result.status ?? null,
    chan_doan: result.chan_doan ?? null,
    huong_dan_dieu_tri: result.huong_dan_dieu_tri ?? null,
    ghi_chu: result.ghi_chu ?? null,
    ngay_tai_kham: result.ngay_tai_kham ?? null,
    dich_vu_phat_sinh: result.dich_vu_phat_sinh ?? [],
    thuoc: prescription?.items ?? [],
  }
}

function changedMedicalRecordFields(before, after) {
  return MEDICAL_RECORD_AUDIT_FIELDS.filter((field) => JSON.stringify(before[field] ?? null) !== JSON.stringify(after[field] ?? null))
}

async function auditDoctorMedicalRecordRevision({ result, actorUserId, reason, before, after }) {
  const changed_fields = changedMedicalRecordFields(before, after)
  if (changed_fields.length === 0) return
  await NhatKyThaoTac.create({
    nguoi_thuc_hien_id: actorUserId,
    vai_tro: 'doctor',
    hanh_dong: 'DOCTOR_REVISE_MEDICAL_RECORD',
    loai_doi_tuong: 'examination_result',
    doi_tuong_id: result._id,
    ly_do: reason || result.doctor_revision_note || 'Bac si cap nhat ho so kham',
    du_lieu_cu: { changed_fields, ...Object.fromEntries(changed_fields.map((field) => [field, before[field] ?? null])) },
    du_lieu_moi: { changed_fields, ...Object.fromEntries(changed_fields.map((field) => [field, after[field] ?? null])) },
  })
}

// ─── POST /api/doctor/appointments/:id/result ───────────────────────────────
export async function createResult(req, res) {
  let result = null
  try {
    const docId = await getDocId(req.user.id)
    const a = await LichHen.findOne({ _id: req.params.id, doctor_id: docId })
    if (!a) return fail(res, 404, 'Không tìm thấy lịch hẹn')
    // Cho phép cả 'completed' — bác sĩ có thể đã bấm "Hoàn thành" (complete()) trước
    // khi nhập kết quả khám, xem comment tại complete() ở trên.
    // Cho phép cả 'in_progress'/'waiting_record' — bác sĩ có thể tự nhập kết quả trực tiếp ngay
    // sau khi bệnh nhân đã vào phòng qua hàng đợi động.
    if (!['confirmed', 'in_progress', 'waiting_record', 'completed'].includes(a.status)) {
      return fail(res, 409, 'Chỉ nhập kết quả khi lịch hẹn đã xác nhận, đang khám, chờ nhập hồ sơ, hoặc đã hoàn thành')
    }

    const exists = await KetQuaKham.exists({ appointment_id: a._id })
    if (exists) return fail(res, 409, 'Kết quả khám đã tồn tại, hãy dùng PUT để cập nhật')

    const { chan_doan, huong_dan_dieu_tri, ghi_chu, ngay_tai_kham, thuoc, sinh_hieu, dich_vu_phat_sinh = [] } = req.body
    if (!chan_doan?.trim()) return fail(res, 400, 'Chẩn đoán là bắt buộc')

    // Ngày tái khám phải sau ngày khám hiện tại — không cho chọn trùng ngày khám hoặc quá khứ.
    if (ngay_tai_kham && !isNgayTaiKhamHopLe(ngay_tai_kham, a.ngay_kham)) {
      return fail(res, 400, 'Ngày tái khám phải từ ngày tiếp theo sau ngày khám')
    }

    // Bác sĩ tự nhập hồ sơ → coi như đã xác nhận ngay, không bắt bác sĩ tự xác nhận lại hồ sơ
    // do chính mình viết (quyết định 2026-07-11).
    const chiDinh = await taoChiDinhDichVu(dich_vu_phat_sinh, a.specialty_id, docId)
    if (!chiDinh.ok) return fail(res, chiDinh.status, chiDinh.message)

    result = await KetQuaKham.create({
      appointment_id:      a._id,
      ho_so_benh_nhan_id:  a.ho_so_benh_nhan_id ?? null,
      nguoi_nhap_id:        req.user.id,
      bac_si_phu_trach_id:  docId,
      status:               'da_xac_nhan',
      nguoi_xac_nhan_id:    req.user.id,
      thoi_diem_xac_nhan:   new Date(),
      chan_doan:          chan_doan.trim(),
      huong_dan_dieu_tri: huong_dan_dieu_tri?.trim() || null,
      ghi_chu:            ghi_chu?.trim() || null,
      ngay_tai_kham:      ngay_tai_kham ? new Date(ngay_tai_kham) : null,
      dich_vu_phat_sinh:  chiDinh.lines,
      lich_su_sua: [{
        nguoi_sua_id: req.user.id,
        thoi_diem_sua: new Date(),
        noi_dung: 'Bác sĩ tự nhập và xác nhận hồ sơ khám',
      }],
    })

    if (sinh_hieu) {
      await upsertVitals({ appointmentId: a._id, memberId: a.member_id, doctorUserId: req.user.id, sinhHieu: sinh_hieu })
    }

    // Kê đơn thuốc nếu có
    let prescription = null
    if (Array.isArray(thuoc) && thuoc.length) {
      prescription = await DonThuoc.create({
        ket_qua_kham_id:   result._id, // bắt buộc theo schema (DonThuoc.js) — thiếu field này sẽ bị Mongoose reject
        medical_record_id: result._id,
        member_id:         a.member_id,
        ten_khach:         a.ten_khach ?? null,
        doctor_id:         docId,
        nguon:             'bac_si',
        items:             thuoc,
      })
    }

    // Hoàn tất khám và hoàn tất thanh toán là hai trạng thái độc lập. Ngay khi
    // bác sĩ xác nhận hồ sơ, ca khám đã hoàn tất về mặt lâm sàng; lễ tân sẽ thu
    // khoản còn phải thu dựa trên snapshot dịch vụ trong hồ sơ ở bước sau.
    if (a.status !== 'completed') {
      const oldStatus = a.status
      a.status = 'completed'
      await a.save()
      emitDashboardAppointmentChanged(oldStatus, a.status)
    }

    return created(res, {
      ...result.toObject(),
      id:   result._id,
      thuoc: prescription?.items ?? [],
    }, 'Đã lưu kết quả khám')
  } catch (err) {
    // KetQuaKham được tạo TRƯỚC đơn thuốc (DonThuoc.create ở dưới cần result._id). Nếu đơn
    // thuốc validate fail (gio_uong sai HH:MM, so_ngay ngoài 1-90...) hoặc bất kỳ bước nào sau
    // đó lỗi, KetQuaKham đã lỡ persist với status='da_xac_nhan' (khóa sửa ngay) mà không có đơn
    // thuốc — bác sĩ nhận lỗi tưởng chưa lưu gì, nhưng hồ sơ mồ côi đã tồn tại và không thể sửa
    // lại qua updateResult (chặn bởi status da_xac_nhan) lẫn tạo lại (chặn bởi exists() → 409).
    // Rollback tại đây, cùng mẫu với createResultByQueue (offline) đã làm đúng từ trước.
    if (result?._id) {
      await KetQuaKham.deleteOne({ _id: result._id }).catch(() => {})
      await DonThuoc.deleteMany({ medical_record_id: result._id }).catch(() => {})
    }
    // 2 request tạo hồ sơ đồng thời cho cùng 1 appointment (race condition) đều qua được kiểm
    // tra `exists()` ở trên trước khi request đầu ghi xong — request thứ 2 chỉ bị chặn ở tầng DB
    // (index unique appointment_id, KetQuaKham.js:38-42), trả lỗi Mongo thô (11000) thay vì 409
    // thân thiện — sửa cho nhất quán với case exists() thường phát hiện được (xem GAP-011).
    if (err.code === 11000) return fail(res, 409, 'Kết quả khám đã tồn tại, hãy dùng PUT để cập nhật')
    if (err.name === 'ValidationError') return fail(res, 400, err.message)
    return fail(res, 500, err.message)
  }
}

// ─── PUT /api/doctor/appointments/:id/result ────────────────────────────────
// Danh mục chỉ định dành cho chính ca khám của bác sĩ. Thu ngân không chọn dịch vụ
// chuyên môn; họ chỉ đọc snapshot đã được lưu trong KetQuaKham.
export async function listRelatedServices(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    let specialtyId = null
    if (req.query.appointment_id) {
      const appointment = await LichHen.findOne({ _id: req.query.appointment_id, doctor_id: docId })
        .select('specialty_id').lean()
      if (!appointment) return fail(res, 404, 'Không tìm thấy lịch hẹn thuộc quyền của bác sĩ')
      specialtyId = appointment.specialty_id
    } else if (req.query.queue_id) {
      const entry = await getOwnedOfflineQueue(req.query.queue_id, docId)
      specialtyId = entry.specialty_id
    } else {
      return fail(res, 400, 'Cần cung cấp appointment_id hoặc queue_id')
    }

    const services = await DichVu.find({
      status: 'active',
      loai: 'related',
      $or: [{ specialty_id: specialtyId }, { specialty_id: null }],
    }).select('_id ten gia specialty_id').sort({ ten: 1 }).lean()
    return ok(res, services)
  } catch (err) {
    if (err.httpStatus) return fail(res, err.httpStatus, err.message)
    return fail(res, 500, err.message)
  }
}

export async function getResultByQueue(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')
    const entry = await getOwnedOfflineQueue(req.params.hangDoiId, docId)
    const result = await KetQuaKham.findOne({ hang_doi_id: entry._id }).lean()
    if (!result) return fail(res, 404, 'Chưa có kết quả khám')
    const prescription = await DonThuoc.findOne({ medical_record_id: result._id }).lean()
    return ok(res, { ...result, id: result._id, thuoc: prescription?.items ?? [] })
  } catch (err) {
    if (err.httpStatus) return fail(res, err.httpStatus, err.message)
    return fail(res, 500, err.message)
  }
}

export async function createResultByQueue(req, res) {
  let result = null
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')
    const entry = await getOwnedOfflineQueue(req.params.hangDoiId, docId)
    if (await KetQuaKham.exists({ hang_doi_id: entry._id })) {
      return fail(res, 409, 'Kết quả khám đã tồn tại, hãy dùng chức năng xem kết quả')
    }

    const { chan_doan, huong_dan_dieu_tri, ghi_chu, ngay_tai_kham, thuoc, sinh_hieu, dich_vu_phat_sinh = [] } = req.body
    if (!chan_doan?.trim()) return fail(res, 400, 'Chẩn đoán là bắt buộc')
    if (ngay_tai_kham && !isNgayTaiKhamHopLe(ngay_tai_kham, entry.checkin_time)) {
      return fail(res, 400, 'Ngày tái khám phải từ ngày tiếp theo sau ngày khám')
    }

    const chiDinh = await taoChiDinhDichVu(dich_vu_phat_sinh, entry.specialty_id, docId)
    if (!chiDinh.ok) return fail(res, chiDinh.status, chiDinh.message)

    result = await KetQuaKham.create({
      hang_doi_id: entry._id,
      ho_so_benh_nhan_id: entry.ho_so_benh_nhan_id,
      nguoi_nhap_id: req.user.id,
      bac_si_phu_trach_id: docId,
      status: 'da_xac_nhan',
      nguoi_xac_nhan_id: req.user.id,
      thoi_diem_xac_nhan: new Date(),
      chan_doan: chan_doan.trim(),
      huong_dan_dieu_tri: huong_dan_dieu_tri?.trim() || null,
      ghi_chu: ghi_chu?.trim() || null,
      ngay_tai_kham: ngay_tai_kham ? new Date(ngay_tai_kham) : null,
      dich_vu_phat_sinh: chiDinh.lines,
      lich_su_sua: [{
        nguoi_sua_id: req.user.id,
        thoi_diem_sua: new Date(),
        noi_dung: 'Bác sĩ nhập và xác nhận hồ sơ khám offline',
      }],
    })

    if (sinh_hieu) {
      await upsertVitals({ hangDoiId: entry._id, memberId: entry.member_id, doctorUserId: req.user.id, sinhHieu: sinh_hieu })
    }

    let prescription = null
    if (Array.isArray(thuoc) && thuoc.length) {
      prescription = await DonThuoc.create({
        ket_qua_kham_id: result._id,
        medical_record_id: result._id,
        member_id: entry.member_id ?? null,
        ten_khach: entry.ten_benh_nhan,
        doctor_id: docId,
        nguon: 'bac_si',
        items: thuoc,
      })
    }

    return created(res, { ...result.toObject(), id: result._id, thuoc: prescription?.items ?? [] }, 'Đã lưu kết quả khám offline')
  } catch (err) {
    if (result?._id) {
      await Promise.all([
        DonThuoc.deleteMany({ medical_record_id: result._id }),
        SinhHieuKham.deleteMany({ hang_doi_id: result.hang_doi_id }),
        KetQuaKham.deleteOne({ _id: result._id }),
      ]).catch(() => {})
    }
    if (err.code === 11000) return fail(res, 409, 'Kết quả khám đã tồn tại, hãy dùng chức năng xem kết quả')
    if (err.httpStatus) return fail(res, err.httpStatus, err.message)
    if (err.name === 'ValidationError') return fail(res, 400, err.message)
    return fail(res, 500, err.message)
  }
}

export async function updateResult(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    const a = await LichHen.findOne({ _id: req.params.id, doctor_id: docId }).select('_id ngay_kham member_id ten_khach specialty_id').lean()
    if (!a) return fail(res, 404, 'Không tìm thấy lịch hẹn')

    const result = await KetQuaKham.findOne({ appointment_id: a._id })
    if (!result) return fail(res, 404, 'Chưa có kết quả khám')
    // Hồ sơ đã xác nhận là CHỐT — khóa ngay lập tức, không chờ mốc 24h nào cả (trước đây chỉ
    // dựa vào co_the_sua, nhưng field này chưa từng được cron nào set false trong thực tế nên
    // hồ sơ đã xác nhận vẫn sửa được vô thời hạn — xem docs/Bác sĩ/Audit tong the, GAP-001).
    // Muốn sửa hồ sơ đã xác nhận phải qua luồng "yêu cầu chỉnh sửa" đã có sẵn.
    if (result.status === 'da_xac_nhan') return fail(res, 403, 'Hồ sơ đã xác nhận, không thể sửa trực tiếp')
    if (!result.co_the_sua) return fail(res, 403, 'Kết quả đã khóa, không thể sửa')

    const beforeSnapshot = await snapshotMedicalRecord(result)

    // Áp dụng chỉnh sửa (dùng chung applyResultEdits với confirmResult) — validate ngày tái
    // khám + upsert/xóa đơn thuốc. Trước đây updateResult() không đọc `thuoc` nên sửa đơn
    // (kể cả so_ngay) bị bỏ qua — xem docs/Bác sĩ (2026-07-16).
    const edit = await applyResultEdits(result, req.body, a, docId, req.user.id)
    if (!edit.ok) return fail(res, edit.status, edit.message)

    // Sửa xong hồ sơ đang "cần chỉnh sửa" → tự động quay lại "chờ xác nhận" (trước đây không có
    // đường quay lại, hồ sơ bị kẹt vĩnh viễn ở yeu_cau_chinh_sua — xem audit trước, mục 12.1).
    if (result.status === 'yeu_cau_chinh_sua') {
      result.status = 'cho_xac_nhan'
      result.submitted_at = new Date()
    }
    await result.save()
    const afterSnapshot = await snapshotMedicalRecord(result)
    await auditDoctorMedicalRecordRevision({
      result,
      actorUserId: req.user.id,
      reason: req.body?.ly_do_chinh_sua ?? req.body?.ly_do ?? null,
      before: beforeSnapshot,
      after: afterSnapshot,
    })

    return ok(res, {
      ...result.toObject(),
      id: result._id,
      thuoc: edit.prescription?.items ?? [],
    }, 'Đã cập nhật kết quả khám')
  } catch (err) {
    // Đơn thuốc sai (so_ngay<1/>90, thiếu ten_thuoc, gio_uong sai HH:MM) ném ValidationError —
    // trả 400 thay vì 500 thô để hội đồng gọi API trực tiếp không bắt được lỗi vặt (H1).
    if (err.name === 'ValidationError') return fail(res, 400, err.message)
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/doctor/appointments/:id/result/confirm ──────────────────────
// Bác sĩ xác nhận hồ sơ khám đang 'cho_xac_nhan' — dùng chung bất kể lịch sử ai đã nhập.
export async function confirmResult(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    const a = await LichHen.findOne({ _id: req.params.id, doctor_id: docId })
    if (!a) return fail(res, 404, 'Không tìm thấy lịch hẹn')

    const result = await KetQuaKham.findOne({ appointment_id: a._id })
    if (!result) return fail(res, 404, 'Chưa có hồ sơ khám')
    if (result.status !== 'cho_xac_nhan') {
      return fail(res, 409, 'Chỉ xác nhận được hồ sơ đang chờ xác nhận')
    }

    // "Lưu & Xác nhận" một thao tác: bác sĩ xem hồ sơ, sửa trực tiếp (nếu cần) rồi chốt luôn.
    // Body chỉnh sửa là tùy chọn:
    // gửi kèm thì áp dụng qua applyResultEdits (dùng chung logic với updateResult) trước khi
    // set da_xac_nhan, tất cả trong cùng một save() — không để trạng thái nửa vời.
    const edit = await applyResultEdits(result, req.body ?? {}, a, docId, req.user.id)
    if (!edit.ok) return fail(res, edit.status, edit.message)

    // Ghi rõ có sửa hay không để đối chiếu lịch sử sau này.
    const coSua = ['chan_doan', 'huong_dan_dieu_tri', 'ghi_chu', 'ngay_tai_kham', 'thuoc', 'dich_vu_phat_sinh']
      .some((k) => req.body?.[k] !== undefined)
    result.status = 'da_xac_nhan'
    result.nguoi_xac_nhan_id = req.user.id
    result.thoi_diem_xac_nhan = new Date()
    result.lich_su_sua.push({
      nguoi_sua_id: req.user.id,
      thoi_diem_sua: new Date(),
      noi_dung: coSua ? 'Bác sĩ chỉnh sửa và xác nhận hồ sơ khám' : 'Bác sĩ xác nhận hồ sơ khám',
    })
    await result.save()

    // Hồ sơ đã có nghĩa là ca khám coi như xong — đề phòng trường hợp appointment chưa ở 'completed'.
    // Không tự complete nếu còn dịch vụ phát sinh chưa xử lý thanh toán — appointment
    // giữ nguyên trạng thái hiện tại cho tới khi lễ tân/thu ngân xác nhận xong phần phát sinh.
    if (a.status !== 'completed' && result.dich_vu_phat_sinh.length === 0) {
      const oldStatus = a.status
      a.status = 'completed'
      await a.save()
      emitDashboardAppointmentChanged(oldStatus, a.status)
    }

    return ok(res, { id: result._id, status: result.status, appointment_status: a.status }, 'Đã xác nhận hồ sơ khám')
  } catch (err) {
    if (err.name === 'ValidationError') return fail(res, 400, err.message)
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/doctor/appointments/result/:ketQuaId/confirm-by-record ───────
// Xác nhận hồ sơ theo ket_qua_id — dùng cho lượt khám offline (không có LichHen).
// Online vẫn dùng endpoint cũ theo appointment_id. Chỉ bác sĩ phụ trách hồ sơ mới xác nhận.
export async function confirmResultByRecord(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    const result = await KetQuaKham.findOne({ _id: req.params.ketQuaId, bac_si_phu_trach_id: docId })
    if (!result) return fail(res, 404, 'Không tìm thấy hồ sơ khám')
    if (result.status !== 'cho_xac_nhan') {
      return fail(res, 409, 'Chỉ xác nhận được hồ sơ đang chờ xác nhận')
    }

    // appt chỉ có với hồ sơ online — dùng để validate ngày tái khám + tự complete LichHen.
    // Offline: KetQuaKham không có field member_id — lấy member_id/ten_khach/ngay_kham (checkin_time)
    // từ chính HangDoi (đã join qua hang_doi_id) để applyResultEdits tạo đơn thuốc mới (nếu có) đúng
    // chủ, tránh đơn thuốc mồ côi (member_id/ten_khach đều null) khi bác sĩ kê đơn lúc xác nhận offline.
    const appt = result.appointment_id ? await LichHen.findById(result.appointment_id) : null
    let fallback = { ngay_kham: null, member_id: null, ten_khach: null, specialty_id: null }
    if (!appt && result.hang_doi_id) {
      const entry = await HangDoi.findById(result.hang_doi_id).lean()
      fallback = {
        ngay_kham: entry?.checkin_time ?? null,
        member_id: entry?.member_id ?? null,
        ten_khach: entry?.ten_benh_nhan ?? null,
        specialty_id: entry?.specialty_id ?? null,
      }
    }
    const edit = await applyResultEdits(result, req.body ?? {}, appt ?? fallback, docId, req.user.id)
    if (!edit.ok) return fail(res, edit.status, edit.message)

    const coSua = ['chan_doan', 'huong_dan_dieu_tri', 'ghi_chu', 'ngay_tai_kham', 'thuoc', 'dich_vu_phat_sinh'].some((k) => req.body?.[k] !== undefined)
    result.status = 'da_xac_nhan'
    result.nguoi_xac_nhan_id = req.user.id
    result.thoi_diem_xac_nhan = new Date()
    result.lich_su_sua.push({ nguoi_sua_id: req.user.id, thoi_diem_sua: new Date(),
      noi_dung: coSua ? 'Bác sĩ chỉnh sửa và xác nhận hồ sơ khám' : 'Bác sĩ xác nhận hồ sơ khám' })
    await result.save()

    // Xác nhận hồ sơ là mốc kết thúc khám lâm sàng. Không giữ ca ở trạng thái
    // "chờ nhập hồ sơ" chỉ vì còn khoản phải thu; công nợ nằm ở hóa đơn.
    if (appt && appt.status !== 'completed') {
      const oldStatus = appt.status
      appt.status = 'completed'
      await appt.save()
      emitDashboardAppointmentChanged(oldStatus, appt.status)
    }
    return ok(res, { id: result._id, status: result.status }, 'Đã xác nhận hồ sơ khám')
  } catch (err) {
    if (err.name === 'ValidationError') return fail(res, 400, err.message)
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/doctor/appointments/result/:ketQuaId/print ─────────────────────
// Dữ liệu để in "Hồ sơ bệnh án" đưa cho bệnh nhân — chỉ hồ sơ ĐÃ XÁC NHẬN (chốt lâm sàng
// xong mới in). Dùng chung ketQuaId nên hoạt động cho cả online lẫn offline, khớp cách
// confirmResultByRecord đã định danh hồ sơ. Tái dùng layPhienKham() (đã có sẵn tính toán
// hoá đơn/đã thu/còn thiếu, dùng chung với "Bệnh nhân đã khám") thay vì tính lại từ đầu.
// LƯỢC BỎ hinh_anh khỏi dịch vụ phát sinh trước khi trả về: ảnh (vd nội soi) chỉ lưu DB để
// đối chiếu sau, không được đưa vào bản in cho bệnh nhân.
export async function getPrintData(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    const result = await KetQuaKham.findOne({ _id: req.params.ketQuaId, bac_si_phu_trach_id: docId })
      .select('status hang_doi_id appointment_id')
      .lean()
    if (!result) return fail(res, 404, 'Không tìm thấy hồ sơ khám')
    if (result.status !== 'da_xac_nhan') {
      return fail(res, 409, 'Chỉ in được hồ sơ đã xác nhận')
    }

    let hangDoiId = result.hang_doi_id
    if (!hangDoiId && result.appointment_id) {
      const entry = await HangDoi.findOne({ appointment_id: result.appointment_id }).select('_id').lean()
      hangDoiId = entry?._id ?? null
    }
    if (!hangDoiId) return fail(res, 404, 'Không tìm thấy lượt khám tương ứng để in')

    const [phien, doctor, entry] = await Promise.all([
      layPhienKham({ queueId: hangDoiId, docId }),
      BacSi.findById(docId).select('user_id specialties')
        .populate('user_id', 'ho_ten')
        .populate('specialties', 'ten')
        .lean(),
      HangDoi.findById(hangDoiId).select('checkin_time').lean(),
    ])

    return ok(res, {
      ...phien,
      ho_so: phien.ho_so ? {
        ...phien.ho_so,
        dich_vu_phat_sinh: (phien.ho_so.dich_vu_phat_sinh ?? []).map(({ hinh_anh, ...line }) => line),
      } : null,
      bac_si: {
        ho_ten: doctor?.user_id?.ho_ten ?? null,
        chuyen_khoa: (doctor?.specialties ?? []).map((s) => s.ten).join(', ') || null,
      },
      ngay_kham: entry?.checkin_time ?? null,
    })
  } catch (err) {
    return fail(res, err.httpStatus ?? err.statusCode ?? 500, err.message)
  }
}

// ─── PATCH /api/doctor/appointments/:id/result/request-revision ──────────────
// Bác sĩ đánh dấu hồ sơ 'cho_xac_nhan' của chính mình là "cần chỉnh sửa lại" kèm lý do, thay vì
// xác nhận luôn — dùng khi muốn tự sửa sau thay vì chốt ngay. "Lưu & Xác nhận" (confirmResult)
// VẪN giữ — bác sĩ chọn 1 trong 2. KetQuaKham -> yeu_cau_chinh_sua kèm lý do; LichHen ->
// waiting_record để hồ sơ hiện lại ở "Hồ sơ chờ khám" chờ nhập lại. Hai cập nhật NGUYÊN TỬ
// (transaction) tránh lệch trạng thái giữa hồ sơ và lịch hẹn. Chỉ từ 'cho_xac_nhan'; chỉ bác sĩ phụ trách.
export async function requestRevision(req, res) {
  const ly_do = (req.body?.ly_do ?? '').trim()
  if (!ly_do) return fail(res, 400, 'Cần nêu lý do yêu cầu chỉnh sửa')
  const docId = await getDocId(req.user.id)
  if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

  const session = await mongoose.startSession()
  try {
    let payload
    await session.withTransaction(async () => {
      const a = await LichHen.findOne({ _id: req.params.id, doctor_id: docId }).session(session)
      if (!a) throw Object.assign(new Error('Không tìm thấy lịch hẹn'), { httpStatus: 404 })
      const result = await KetQuaKham.findOne({ appointment_id: a._id }).session(session)
      if (!result) throw Object.assign(new Error('Chưa có hồ sơ khám'), { httpStatus: 404 })
      // Đọc trạng thái TƯƠI trong transaction — không tin trạng thái do FE gửi.
      if (result.status !== 'cho_xac_nhan') {
        throw Object.assign(new Error('Chỉ yêu cầu chỉnh sửa được hồ sơ đang chờ xác nhận'), { httpStatus: 409 })
      }

      result.status = 'yeu_cau_chinh_sua'
      result.doctor_revision_note = ly_do
      result.lich_su_sua.push({ nguoi_sua_id: req.user.id, thoi_diem_sua: new Date(),
        noi_dung: `Bác sĩ yêu cầu chỉnh sửa: ${ly_do}` })
      await result.save({ session })

      if (!['completed', 'cancelled', 'no_show'].includes(a.status)) {
        a.status = 'waiting_record'
        await a.save({ session })
      }
      payload = { id: result._id, status: result.status, appointment_status: a.status }
    })
    return ok(res, payload, 'Đã đánh dấu hồ sơ cần chỉnh sửa lại')
  } catch (err) {
    if (err.httpStatus) return fail(res, err.httpStatus, err.message)
    return fail(res, 500, err.message)
  } finally {
    await session.endSession()
  }
}

// ─── GET /api/doctor/appointments/pending-results?status= ───────────────────
// Danh sách hồ sơ khám của chính bác sĩ đang đăng nhập — lọc qua bac_si_phu_trach_id
// (không qua LichHen.doctor_id) vì đây là field chuyên trách nghiệp vụ xác nhận hồ sơ,
// được gán sẵn khi tạo (xem createResult).
// - Không truyền status: giữ nguyên hành vi cũ, chỉ trả 'cho_xac_nhan' (Dashboard đang
//   dùng gọi không tham số để đếm số hồ sơ CẦN xử lý — không được đổi mặc định).
// - status='all': trả cả 3 trạng thái liên quan tới bác sĩ (không gồm 'ban_nhap' — hồ sơ nháp
//   chưa gửi xác nhận) để bác sĩ tra cứu lại hồ sơ đã xử lý.
// - status=<giá trị cụ thể>: lọc đúng 1 trạng thái đó.
const DOCTOR_VISIBLE_RECORD_STATUSES = ['cho_xac_nhan', 'da_xac_nhan', 'yeu_cau_chinh_sua']

export async function listPendingResults(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    const { status } = req.query
    const filter = { bac_si_phu_trach_id: docId }
    if (!status) {
      filter.status = 'cho_xac_nhan'
    } else if (status !== 'all' && DOCTOR_VISIBLE_RECORD_STATUSES.includes(status)) {
      filter.status = status
    } else if (status !== 'all') {
      return fail(res, 400, 'Trạng thái lọc không hợp lệ')
    } else {
      filter.status = { $in: DOCTOR_VISIBLE_RECORD_STATUSES }
    }

    // Hàng chờ xử lý (mặc định) ưu tiên chờ lâu nhất trước; xem lại lịch sử thì mới nhất trước.
    const sortOrder = !status || status === 'cho_xac_nhan' ? 1 : -1

    const results = await KetQuaKham.find(filter)
      .populate('nguoi_nhap_id', 'ho_ten')
      .populate({ path: 'appointment_id', select: 'ngay_kham ten_dich_vu user_id member_id ten_khach',
        populate: [{ path: 'user_id', select: 'ho_ten' }, { path: 'member_id', select: 'ho_ten' }] })
      .populate({ path: 'hang_doi_id', select: 'ten_benh_nhan checkin_time nguon ho_so_benh_nhan_id' })
      .sort({ ngay_tao: sortOrder })
      .lean()

    const data = results.map((r) => {
      const a = r.appointment_id
      const hd = r.hang_doi_id
      return {
        id: r._id,
        appointment_id: a?._id ?? null,
        hang_doi_id: hd?._id ?? null,
        ho_so_benh_nhan_id: r.ho_so_benh_nhan_id ?? hd?.ho_so_benh_nhan_id ?? a?.ho_so_benh_nhan_id ?? null,
        ngay_kham: a?.ngay_kham ?? hd?.checkin_time ?? r.ngay_tao,
        benh_nhan: a?.member_id?.ho_ten ?? a?.ten_khach ?? a?.user_id?.ho_ten ?? hd?.ten_benh_nhan ?? 'Không rõ',
        ten_dich_vu: a?.ten_dich_vu ?? null,
        nguon: hd?.nguon ?? (a ? 'online' : null),
        nguoi_nhap: r.nguoi_nhap_id?.ho_ten ?? null,
        status: r.status,
      }
    })
    return ok(res, data)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// GET /api/doctor/appointments/patient-profiles/:id/history
// Lich su dung chung cua mot nguoi, gom ca lich hen online va luot offline.
export async function getPatientProfileHistory(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return fail(res, 400, 'Mã hồ sơ bệnh nhân không hợp lệ')

    const profile = await HoSoBenhNhan.findOne({ _id: req.params.id, trang_thai: 'active' })
      .select('ho_ten so_dien_thoai ngay_sinh gioi_tinh nhom_mau di_ung benh_nen dia_chi ghi_chu')
      .lean()
    if (!profile) return fail(res, 404, 'Không tìm thấy hồ sơ bệnh nhân')

    const [appointments, queueEntries] = await Promise.all([
      LichHen.find({ doctor_id: docId, ho_so_benh_nhan_id: profile._id })
        .select('ngay_kham gio_kham status payment_status ten_dich_vu gia_kham ma_lich_hen')
        .sort({ ngay_kham: -1, gio_kham: -1 })
        .lean(),
      HangDoi.find({ doctor_id: docId, ho_so_benh_nhan_id: profile._id })
        .select('checkin_time trang_thai nguon schedule_id slot_id appointment_id')
        .sort({ checkin_time: -1 })
        .lean(),
    ])

    const appointmentIds = appointments.map((appointment) => appointment._id)
    const queueIds = queueEntries.map((entry) => entry._id)
    const results = await KetQuaKham.find({
      $or: [
        ...(appointmentIds.length ? [{ appointment_id: { $in: appointmentIds } }] : []),
        ...(queueIds.length ? [{ hang_doi_id: { $in: queueIds } }] : []),
      ],
    }).select('appointment_id hang_doi_id status chan_doan huong_dan_dieu_tri ghi_chu ngay_tai_kham ngay_tao').lean()
    const resultByAppointment = new Map(results.filter((result) => result.appointment_id).map((result) => [String(result.appointment_id), result]))
    const resultByQueue = new Map(results.filter((result) => result.hang_doi_id).map((result) => [String(result.hang_doi_id), result]))

    const queueApptIds = new Set(queueEntries.map(e => String(e.appointment_id)).filter(id => id !== 'undefined' && id !== 'null'))
    const extraAppointments = appointments.filter(a => !queueApptIds.has(String(a._id)))

    const visits = [
      ...extraAppointments.map((appointment) => ({
        source: 'online',
        appointment_id: appointment._id,
        hang_doi_id: null,
        ngay_kham: appointment.ngay_kham,
        gio_kham: appointment.gio_kham,
        status: appointment.status,
        payment_status: appointment.payment_status,
        ten_dich_vu: appointment.ten_dich_vu,
        gia_kham: appointment.gia_kham,
        ma_lich_hen: appointment.ma_lich_hen,
        ket_qua: resultByAppointment.get(String(appointment._id)) ?? null,
      })),
      ...queueEntries.map((entry) => {
        const appt = appointments.find(a => String(a._id) === String(entry.appointment_id))
        return {
          source: entry.nguon || 'offline',
          appointment_id: entry.appointment_id || null,
          hang_doi_id: entry._id,
          ngay_kham: entry.checkin_time,
          gio_kham: appt ? appt.gio_kham : null,
          status: entry.trang_thai,
          payment_status: appt ? appt.payment_status : null,
          ten_dich_vu: appt ? appt.ten_dich_vu : null,
          gia_kham: appt ? appt.gia_kham : null,
          ma_lich_hen: appt ? appt.ma_lich_hen : null,
          ket_qua: resultByQueue.get(String(entry._id)) || (entry.appointment_id ? resultByAppointment.get(String(entry.appointment_id)) : null) || null,
        }
      }),
    ].sort((a, b) => new Date(b.ngay_kham).getTime() - new Date(a.ngay_kham).getTime())

    return ok(res, { profile, visits })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
