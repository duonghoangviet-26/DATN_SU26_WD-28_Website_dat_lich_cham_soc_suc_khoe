import { BacSi, LichHen, LichLamViec, ThanhVien, NguoiDung, KetQuaKham, DonThuoc } from '../../models/index.js'
import { ok, created, fail } from '../../utils/response.js'

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

// ─── GET /api/doctor/appointments/:id ───────────────────────────────────────
export async function getById(req, res) {
  try {
    const docId = await getDocId(req.user.id)
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
    if (['completed', 'cancelled'].includes(a.status)) {
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
    if (a.status !== 'confirmed') {
      return fail(res, 409, 'Chỉ đánh dấu hoàn thành cho lịch hẹn đã xác nhận')
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

    const result = await KetQuaKham.findOne({ appointment_id: a._id }).lean()
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

// ─── POST /api/doctor/appointments/:id/result ───────────────────────────────
export async function createResult(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    const a = await LichHen.findOne({ _id: req.params.id, doctor_id: docId })
    if (!a) return fail(res, 404, 'Không tìm thấy lịch hẹn')
    // Cho phép cả 'completed' — bác sĩ có thể đã bấm "Hoàn thành" (complete()) trước
    // khi nhập kết quả khám, xem comment tại complete() ở trên.
    if (!['confirmed', 'completed'].includes(a.status)) {
      return fail(res, 409, 'Chỉ nhập kết quả khi lịch hẹn đã xác nhận hoặc đã hoàn thành')
    }

    const exists = await KetQuaKham.exists({ appointment_id: a._id })
    if (exists) return fail(res, 409, 'Kết quả khám đã tồn tại, hãy dùng PUT để cập nhật')

    const { chan_doan, huong_dan_dieu_tri, ghi_chu, ngay_tai_kham, thuoc } = req.body
    if (!chan_doan?.trim()) return fail(res, 400, 'Chẩn đoán là bắt buộc')

    const result = await KetQuaKham.create({
      appointment_id:      a._id,
      nguoi_nhap_id:        req.user.id,
      bac_si_phu_trach_id:  docId,
      chan_doan:          chan_doan.trim(),
      huong_dan_dieu_tri: huong_dan_dieu_tri?.trim() || null,
      ghi_chu:            ghi_chu?.trim() || null,
      ngay_tai_kham:      ngay_tai_kham ? new Date(ngay_tai_kham) : null,
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

    // Đánh dấu lịch hẹn hoàn thành (nếu chưa — có thể đã completed từ trước)
    if (a.status !== 'completed') {
      a.status = 'completed'
      await a.save()
    }

    return created(res, {
      ...result.toObject(),
      id:   result._id,
      thuoc: prescription?.items ?? [],
    }, 'Đã lưu kết quả khám')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PUT /api/doctor/appointments/:id/result ────────────────────────────────
export async function updateResult(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    const a = await LichHen.findOne({ _id: req.params.id, doctor_id: docId }).select('_id').lean()
    if (!a) return fail(res, 404, 'Không tìm thấy lịch hẹn')

    const result = await KetQuaKham.findOne({ appointment_id: a._id })
    if (!result) return fail(res, 404, 'Chưa có kết quả khám')
    if (!result.co_the_sua) return fail(res, 403, 'Kết quả đã khóa sau 24 giờ, không thể sửa')

    const { chan_doan, huong_dan_dieu_tri, ghi_chu, ngay_tai_kham } = req.body
    if (chan_doan)           result.chan_doan          = chan_doan.trim()
    if (huong_dan_dieu_tri !== undefined) result.huong_dan_dieu_tri = huong_dan_dieu_tri?.trim() || null
    if (ghi_chu    !== undefined) result.ghi_chu       = ghi_chu?.trim() || null
    if (ngay_tai_kham !== undefined) result.ngay_tai_kham = ngay_tai_kham ? new Date(ngay_tai_kham) : null
    await result.save()

    return ok(res, { ...result.toObject(), id: result._id }, 'Đã cập nhật kết quả khám')
  } catch (err) {
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

    result.status = 'da_xac_nhan'
    result.nguoi_xac_nhan_id = req.user.id
    result.thoi_diem_xac_nhan = new Date()
    await result.save()

    // Hồ sơ đã có nghĩa là ca khám coi như xong — đề phòng trường hợp appointment
    // chưa ở 'completed' (vd sau này luồng y tá nhập không tự complete như createResult hiện tại).
    if (a.status !== 'completed') {
      a.status = 'completed'
      await a.save()
    }

    return ok(res, { id: result._id, status: result.status, appointment_status: a.status }, 'Đã xác nhận hồ sơ khám')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/doctor/appointments/:id/result/request-revision ─────────────
// Bác sĩ yêu cầu chỉnh sửa lại hồ sơ khám đang 'cho_xac_nhan' (vd hồ sơ do y tá nhập thiếu/sai).
export async function requestResultRevision(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    const a = await LichHen.findOne({ _id: req.params.id, doctor_id: docId }).select('_id').lean()
    if (!a) return fail(res, 404, 'Không tìm thấy lịch hẹn')

    const { ly_do } = req.body
    if (!ly_do?.trim()) return fail(res, 400, 'Bắt buộc nhập lý do yêu cầu chỉnh sửa')

    const result = await KetQuaKham.findOne({ appointment_id: a._id })
    if (!result) return fail(res, 404, 'Chưa có hồ sơ khám')
    if (result.status !== 'cho_xac_nhan') {
      return fail(res, 409, 'Chỉ yêu cầu chỉnh sửa hồ sơ đang chờ xác nhận')
    }

    result.status = 'yeu_cau_chinh_sua'
    result.lich_su_sua.push({
      nguoi_sua_id: req.user.id,
      thoi_diem_sua: new Date(),
      noi_dung: `Yêu cầu chỉnh sửa: ${ly_do.trim()}`,
    })
    await result.save()

    return ok(res, { id: result._id, status: result.status }, 'Đã gửi yêu cầu chỉnh sửa hồ sơ')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/doctor/appointments/pending-results ────────────────────────────
// Danh sách hồ sơ khám 'cho_xac_nhan' (WAITING_DOCTOR_CONFIRM) của chính bác sĩ đang đăng nhập —
// lọc qua bac_si_phu_trach_id (không qua LichHen.doctor_id) vì đây là field chuyên trách nghiệp vụ
// xác nhận hồ sơ, được gán sẵn khi tạo (xem createResult).
export async function listPendingResults(req, res) {
  try {
    const docId = await getDocId(req.user.id)
    if (!docId) return fail(res, 404, 'Không tìm thấy hồ sơ bác sĩ')

    const results = await KetQuaKham.find({ bac_si_phu_trach_id: docId, status: 'cho_xac_nhan' })
      .populate('nguoi_nhap_id', 'ho_ten')
      .populate({
        path: 'appointment_id',
        select: 'ngay_kham ten_dich_vu user_id member_id ten_khach',
        populate: [
          { path: 'user_id', select: 'ho_ten' },
          { path: 'member_id', select: 'ho_ten' },
        ],
      })
      .sort({ ngay_tao: 1 })
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
