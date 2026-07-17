import { BacSi, LichHen, LichLamViec, ThanhVien, NguoiDung, KetQuaKham, DonThuoc, HangDoi } from '../../models/index.js'
import { ok, created, fail } from '../../utils/response.js'
import { isNgayTaiKhamHopLe } from '../../utils/validators.js'

// ============================================================
// B3 + B4 — Lịch hẹn & Kết quả khám (Bác sĩ)
// Routes: /api/doctor/appointments
// ============================================================

const PAYMENT_DEADLINE_HOURS = 2

async function getDocId(userId) {
  const d = await BacSi.findOne({ user_id: userId }).select('_id').lean()
  return d?._id ?? null
}

async function formatAppointment(a) {
  const [user, member, result] = await Promise.all([
    NguoiDung.findById(a.user_id).select('ho_ten so_dien_thoai').lean(),
    a.member_id ? ThanhVien.findById(a.member_id).select('ho_ten ngay_sinh gioi_tinh di_ung benh_nen').lean() : null,
    KetQuaKham.findOne({ appointment_id: a._id }).select('status').lean(),
  ])

  const benh_nhan_ho_ten = member?.ho_ten ?? a.ten_khach ?? user?.ho_ten ?? 'Không rõ'
  const ngay_sinh = member?.ngay_sinh
  const tuoi = ngay_sinh
    ? new Date().getFullYear() - new Date(ngay_sinh).getFullYear()
    : undefined

  return {
    id:               a._id,
    ma_lich_hen:      a.ma_lich_hen ?? null,
    benh_nhan:        benh_nhan_ho_ten,
    benh_nhan_id:     a.user_id,
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
    if (date)   filter.ngay_kham = { $gte: new Date(date), $lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1)) }

    const appointments = await LichHen.find(filter)
      .populate('specialty_id', 'ten')
      .sort({ ngay_kham: 1, gio_kham: 1 })
      .lean()

    const result = await Promise.all(appointments.map(formatAppointment))
    return ok(res, result)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/doctor/queue?date= ────────────────────────────────────────────
// "Hồ sơ chờ khám" — toàn bộ lượt khám (online + offline) đã check-in gán cho bác sĩ này.
// Neo trên HangDoi; join KetQuaKham theo hang_doi_id (và appointment_id cho dữ liệu cũ).
const HANGDOI_WEIGHT = { online_uu_tien: 0, online_thuong: 1, offline: 2 }

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

    const day = req.query.date ? new Date(req.query.date) : new Date()
    const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1)

    const entries = await HangDoi.find({ doctor_id: docId, checkin_time: { $gte: dayStart, $lt: dayEnd } }).lean()
    if (entries.length === 0) return ok(res, [])

    // Join hồ sơ: gom theo hang_doi_id (mới) + appointment_id (dữ liệu cũ).
    const hangDoiIds = entries.map((e) => e._id)
    const apptIds = entries.filter((e) => e.appointment_id).map((e) => e.appointment_id)
    const results = await KetQuaKham.find({
      $or: [{ hang_doi_id: { $in: hangDoiIds } }, { appointment_id: { $in: apptIds } }],
    }).select('hang_doi_id appointment_id status').lean()
    const kqByHangDoi = new Map(results.filter((r) => r.hang_doi_id).map((r) => [String(r.hang_doi_id), r]))
    const kqByAppt = new Map(results.filter((r) => r.appointment_id).map((r) => [String(r.appointment_id), r]))

    const rows = entries
      .sort((a, b) => (HANGDOI_WEIGHT[a.muc_uu_tien] - HANGDOI_WEIGHT[b.muc_uu_tien]) || (new Date(a.checkin_time) - new Date(b.checkin_time)))
      .map((e) => {
        const kq = kqByHangDoi.get(String(e._id)) || (e.appointment_id ? kqByAppt.get(String(e.appointment_id)) : null)
        return {
          id: e._id,
          appointment_id: e.appointment_id ?? null,
          nguon: e.nguon,
          ten_benh_nhan: e.ten_benh_nhan,
          tuoi: e.tuoi ?? null,
          gioi_tinh: e.gioi_tinh ?? null,
          phong_kham: e.phong_kham ?? null,
          muc_uu_tien: e.muc_uu_tien,
          hang_doi_trang_thai: e.trang_thai,
          checkin_time: e.checkin_time,
          ket_qua_id: kq?._id ?? null,
          ket_qua_status: kq?.status ?? null,
          trang_thai_tong_hop: trangThaiTongHop(e, kq),
        }
      })
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

    a.status = 'confirmed'
    if (a.payment_status === 'unpaid') {
      a.payment_deadline = new Date(Date.now() + PAYMENT_DEADLINE_HOURS * 3600 * 1000)
    }
    await a.save()

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
    // hàng đợi động của y tá (Kế hoạch 2: queue.controller.js intoRoom()/finish()), KHÔNG chỉ qua
    // luồng xác nhận cũ ('confirmed'). Bác sĩ vẫn có thể tự đánh dấu hoàn thành bất kể y tá đã
    // nhập hồ sơ hay chưa (giữ nguyên hành vi "không bắt buộc đã nhập kết quả" đã có từ trước).
    if (!['confirmed', 'in_progress', 'waiting_record'].includes(a.status)) {
      return fail(res, 409, 'Chỉ đánh dấu hoàn thành cho lịch hẹn đã xác nhận, đang khám, hoặc đang chờ nhập hồ sơ')
    }

    a.status = 'completed'
    await a.save()

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
async function applyResultEdits(result, body, appt, docId) {
  const { chan_doan, huong_dan_dieu_tri, ghi_chu, ngay_tai_kham, thuoc } = body

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

// ─── POST /api/doctor/appointments/:id/result ───────────────────────────────
export async function createResult(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    const a = await LichHen.findOne({ _id: req.params.id, doctor_id: docId })
    if (!a) return fail(res, 404, 'Không tìm thấy lịch hẹn')
    // Cho phép cả 'completed' — bác sĩ có thể đã bấm "Hoàn thành" (complete()) trước
    // khi nhập kết quả khám, xem comment tại complete() ở trên.
    // Cho phép cả 'in_progress'/'waiting_record' — bác sĩ có thể tự nhập kết quả trực tiếp (bỏ
    // qua luồng nháp của y tá) ngay sau khi bệnh nhân đã vào phòng qua hàng đợi động (Kế hoạch 2).
    if (!['confirmed', 'in_progress', 'waiting_record', 'completed'].includes(a.status)) {
      return fail(res, 409, 'Chỉ nhập kết quả khi lịch hẹn đã xác nhận, đang khám, chờ nhập hồ sơ, hoặc đã hoàn thành')
    }

    const exists = await KetQuaKham.exists({ appointment_id: a._id })
    if (exists) return fail(res, 409, 'Kết quả khám đã tồn tại, hãy dùng PUT để cập nhật')

    const { chan_doan, huong_dan_dieu_tri, ghi_chu, ngay_tai_kham, thuoc } = req.body
    if (!chan_doan?.trim()) return fail(res, 400, 'Chẩn đoán là bắt buộc')

    // Ngày tái khám phải sau ngày khám hiện tại — không cho chọn trùng ngày khám hoặc quá khứ.
    if (ngay_tai_kham && !isNgayTaiKhamHopLe(ngay_tai_kham, a.ngay_kham)) {
      return fail(res, 400, 'Ngày tái khám phải từ ngày tiếp theo sau ngày khám')
    }

    // Bác sĩ tự nhập hồ sơ (không qua y tá) → coi như đã xác nhận ngay, không bắt bác sĩ
    // tự xác nhận lại hồ sơ do chính mình viết (quyết định 2026-07-11 — khác luồng y tá
    // nhập, vốn luôn bắt đầu 'ban_nhap' và bắt buộc qua bước bác sĩ xác nhận ở createDraft()).
    const result = await KetQuaKham.create({
      appointment_id:      a._id,
      nguoi_nhap_id:        req.user.id,
      bac_si_phu_trach_id:  docId,
      status:               'da_xac_nhan',
      nguoi_xac_nhan_id:    req.user.id,
      thoi_diem_xac_nhan:   new Date(),
      chan_doan:          chan_doan.trim(),
      huong_dan_dieu_tri: huong_dan_dieu_tri?.trim() || null,
      ghi_chu:            ghi_chu?.trim() || null,
      ngay_tai_kham:      ngay_tai_kham ? new Date(ngay_tai_kham) : null,
      lich_su_sua: [{
        nguoi_sua_id: req.user.id,
        thoi_diem_sua: new Date(),
        noi_dung: 'Bác sĩ tự nhập và xác nhận hồ sơ khám',
      }],
    })

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

    // Đánh dấu lịch hẹn hoàn thành (nếu chưa — có thể đã completed từ trước).
    // Không tự complete nếu hồ sơ có dịch vụ phát sinh — phải chờ thanh toán phần
    // phát sinh đó trước (xem nhánh tương ứng trong confirmResult()).
    if (a.status !== 'completed' && result.dich_vu_phat_sinh.length === 0) {
      a.status = 'completed'
      await a.save()
    }

    return created(res, {
      ...result.toObject(),
      id:   result._id,
      thuoc: prescription?.items ?? [],
    }, 'Đã lưu kết quả khám')
  } catch (err) {
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
export async function updateResult(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    const a = await LichHen.findOne({ _id: req.params.id, doctor_id: docId }).select('_id ngay_kham member_id ten_khach').lean()
    if (!a) return fail(res, 404, 'Không tìm thấy lịch hẹn')

    const result = await KetQuaKham.findOne({ appointment_id: a._id })
    if (!result) return fail(res, 404, 'Chưa có kết quả khám')
    // Hồ sơ đã xác nhận là CHỐT — khóa ngay lập tức, không chờ mốc 24h nào cả (trước đây chỉ
    // dựa vào co_the_sua, nhưng field này chưa từng được cron nào set false trong thực tế nên
    // hồ sơ đã xác nhận vẫn sửa được vô thời hạn — xem docs/Bác sĩ/Audit tong the, GAP-001).
    // Muốn sửa hồ sơ đã xác nhận phải qua luồng "yêu cầu chỉnh sửa" (nurse) đã có sẵn.
    if (result.status === 'da_xac_nhan') return fail(res, 403, 'Hồ sơ đã xác nhận, không thể sửa trực tiếp')
    if (!result.co_the_sua) return fail(res, 403, 'Kết quả đã khóa, không thể sửa')

    // Áp dụng chỉnh sửa (dùng chung applyResultEdits với confirmResult) — validate ngày tái
    // khám + upsert/xóa đơn thuốc. Trước đây updateResult() không đọc `thuoc` nên sửa đơn
    // (kể cả so_ngay) bị bỏ qua — xem docs/Bác sĩ (2026-07-16).
    const edit = await applyResultEdits(result, req.body, a, docId)
    if (!edit.ok) return fail(res, edit.status, edit.message)

    // Sửa xong hồ sơ đang "cần chỉnh sửa" → tự động quay lại "chờ xác nhận" (trước đây không có
    // đường quay lại, hồ sơ bị kẹt vĩnh viễn ở yeu_cau_chinh_sua — xem audit trước, mục 12.1).
    if (result.status === 'yeu_cau_chinh_sua') {
      result.status = 'cho_xac_nhan'
      result.submitted_at = new Date()
    }
    await result.save()

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
// Bác sĩ xác nhận hồ sơ khám đang 'cho_xac_nhan' (vd hồ sơ do y tá nhập — module y tá
// chưa triển khai, nhưng field/luồng xác nhận này dùng chung bất kể ai nhập).
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

    // "Lưu & Xác nhận" một thao tác: bác sĩ xem hồ sơ, sửa trực tiếp (nếu cần) rồi chốt luôn —
    // thay cho luồng "yêu cầu chỉnh sửa" đẩy ngược về y tá (đã gỡ). Body chỉnh sửa là tùy chọn:
    // gửi kèm thì áp dụng qua applyResultEdits (dùng chung logic với updateResult) trước khi
    // set da_xac_nhan, tất cả trong cùng một save() — không để trạng thái nửa vời.
    const edit = await applyResultEdits(result, req.body ?? {}, a, docId)
    if (!edit.ok) return fail(res, edit.status, edit.message)

    // Ghi rõ có sửa hay không để đối chiếu lịch sử sau này.
    const coSua = ['chan_doan', 'huong_dan_dieu_tri', 'ghi_chu', 'ngay_tai_kham', 'thuoc']
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

    // Hồ sơ đã có nghĩa là ca khám coi như xong — đề phòng trường hợp appointment
    // chưa ở 'completed' (vd sau này luồng y tá nhập không tự complete như createResult hiện tại).
    // Không tự complete nếu còn dịch vụ phát sinh chưa xử lý thanh toán — appointment
    // giữ nguyên trạng thái hiện tại cho tới khi lễ tân/thu ngân xác nhận xong phần phát sinh.
    if (a.status !== 'completed' && result.dich_vu_phat_sinh.length === 0) {
      a.status = 'completed'
      await a.save()
    }

    return ok(res, { id: result._id, status: result.status, appointment_status: a.status }, 'Đã xác nhận hồ sơ khám')
  } catch (err) {
    if (err.name === 'ValidationError') return fail(res, 400, err.message)
    return fail(res, 500, err.message)
  }
}

// Luồng "yêu cầu chỉnh sửa" (đẩy hồ sơ ngược về y tá) ĐÃ GỠ 2026-07-16: bác sĩ sửa trực tiếp
// khi xác nhận (xem confirmResult + applyResultEdits). Giá trị enum 'yeu_cau_chinh_sua' vẫn
// giữ trong KetQuaKham schema cho dữ liệu cũ. Xem docs/Bác sĩ/Thiet ke - Gop sua va xac nhan...

// ─── GET /api/doctor/appointments/pending-results?status= ───────────────────
// Danh sách hồ sơ khám của chính bác sĩ đang đăng nhập — lọc qua bac_si_phu_trach_id
// (không qua LichHen.doctor_id) vì đây là field chuyên trách nghiệp vụ xác nhận hồ sơ,
// được gán sẵn khi tạo (xem createResult).
// - Không truyền status: giữ nguyên hành vi cũ, chỉ trả 'cho_xac_nhan' (Dashboard đang
//   dùng gọi không tham số để đếm số hồ sơ CẦN xử lý — không được đổi mặc định).
// - status='all': trả cả 3 trạng thái liên quan tới bác sĩ (không gồm 'ban_nhap' — đó là
//   nháp của y tá, chưa gửi bác sĩ) để bác sĩ tra cứu lại hồ sơ đã xử lý.
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
      .populate({
        path: 'appointment_id',
        select: 'ngay_kham ten_dich_vu user_id member_id ten_khach',
        populate: [
          { path: 'user_id', select: 'ho_ten' },
          { path: 'member_id', select: 'ho_ten' },
        ],
      })
      .sort({ ngay_tao: sortOrder })
      .lean()

    const data = results
      .filter((r) => r.appointment_id) // phòng vệ nếu lịch hẹn gốc bị xóa (không nên xảy ra)
      .map((r) => {
        const a = r.appointment_id
        return {
          id:             r._id,
          appointment_id: a._id,
          ngay_kham:      a.ngay_kham,
          benh_nhan:      a.member_id?.ho_ten ?? a.ten_khach ?? a.user_id?.ho_ten ?? 'Không rõ',
          ten_dich_vu:    a.ten_dich_vu ?? null,
          nguoi_nhap:     r.nguoi_nhap_id?.ho_ten ?? null,
          status:         r.status,
        }
      })

    return ok(res, data)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
