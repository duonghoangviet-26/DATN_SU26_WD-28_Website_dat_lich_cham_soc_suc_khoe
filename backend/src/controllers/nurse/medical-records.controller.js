import { HangDoi, KetQuaKham, SinhHieuKham, LichHen } from '../../models/index.js'
import { ok, created, fail } from '../../utils/response.js'
import { getMyDoctorIdsToday } from '../../utils/nurse-scope.js'
import { isNgayTaiKhamHopLe } from '../../utils/validators.js'

// ============================================================
// Hồ sơ khám do y tá nhập — neo theo LƯỢT KHÁM (HangDoi.hang_doi_id), chạy cho cả
// online lẫn offline. Uỷ quyền qua getMyDoctorIdsToday (KHÔNG dùng LichHen.nurse_id —
// field đó không được gán khi đặt online, xem spec M6). Y tá KHÔNG tự set da_xac_nhan /
// LichHen.completed — chỉ bác sĩ xác nhận (endpoint doctor có sẵn).
// ============================================================

// Tìm entry hàng đợi thuộc bác sĩ mà y tá đang trực hôm nay.
async function findEntryInShift(hangDoiId, nurseId) {
  const doctorIds = (await getMyDoctorIdsToday(nurseId)).map(String)
  const entry = await HangDoi.findById(hangDoiId).lean()
  if (!entry) return { entry: null, error: [404, 'Không tìm thấy lượt khám'] }
  if (!doctorIds.includes(String(entry.doctor_id))) {
    return { entry: null, error: [403, 'Lượt khám này không thuộc bác sĩ bạn phụ trách hôm nay'] }
  }
  return { entry, error: null }
}

// Khóa gắn cho hồ sơ/sinh hiệu: offline chỉ hang_doi_id; online điền thêm appointment_id.
function keysFromEntry(entry) {
  const keys = { hang_doi_id: entry._id }
  if (entry.appointment_id) keys.appointment_id = entry.appointment_id
  return keys
}

async function upsertVitals(entry, nurseId, sinhHieu) {
  if (!sinhHieu) return
  const { can_nang, chieu_cao, huyet_ap, nhiet_do, nhip_tim } = sinhHieu
  await SinhHieuKham.findOneAndUpdate(
    { hang_doi_id: entry._id },
    { $set: { ...keysFromEntry(entry), member_id: entry.member_id ?? null,
      can_nang, chieu_cao, huyet_ap, nhiet_do, nhip_tim, nguoi_do_id: nurseId, thoi_diem_do: new Date() } },
    { upsert: true, setDefaultsOnInsert: true },
  )
}

function formatResult(r) {
  return {
    id: r._id, hang_doi_id: r.hang_doi_id, appointment_id: r.appointment_id ?? null,
    status: r.status, chan_doan: r.chan_doan, huong_dan_dieu_tri: r.huong_dan_dieu_tri,
    ghi_chu: r.ghi_chu, trieu_chung_ban_dau: r.trieu_chung_ban_dau, ghi_chu_dieu_duong: r.ghi_chu_dieu_duong,
    ngay_tai_kham: r.ngay_tai_kham, doctor_revision_note: r.doctor_revision_note,
    submitted_at: r.submitted_at, ngay_tao: r.ngay_tao,
  }
}

// ─── GET /api/nurse/medical-records?status= ─────────────────────────────────
export async function list(req, res) {
  try {
    const { status } = req.query
    const filter = { nguoi_nhap_id: req.user.id }
    if (status) filter.status = status
    const results = await KetQuaKham.find(filter)
      .populate({ path: 'hang_doi_id', select: 'ten_benh_nhan doctor_id nguon checkin_time' })
      .sort({ ngay_tao: -1 }).lean()
    const data = results.map((r) => ({
      id: r._id, hang_doi_id: r.hang_doi_id?._id ?? r.hang_doi_id ?? null,
      appointment_id: r.appointment_id ?? null,
      benh_nhan: r.hang_doi_id?.ten_benh_nhan ?? 'Không rõ',
      nguon: r.hang_doi_id?.nguon ?? null,
      ngay_kham: r.hang_doi_id?.checkin_time ?? r.ngay_tao, status: r.status,
    }))
    return ok(res, data)
  } catch (err) { return fail(res, 500, err.message) }
}

// ─── GET /api/nurse/medical-records/revisions ───────────────────────────────
export async function listRevisions(req, res) {
  try {
    const results = await KetQuaKham.find({ nguoi_nhap_id: req.user.id, status: 'yeu_cau_chinh_sua' })
      .populate({ path: 'hang_doi_id', select: 'ten_benh_nhan doctor_id nguon checkin_time' })
      .sort({ ngay_cap_nhat: -1 }).lean()
    const data = results.map((r) => ({
      id: r._id, hang_doi_id: r.hang_doi_id?._id ?? r.hang_doi_id ?? null,
      benh_nhan: r.hang_doi_id?.ten_benh_nhan ?? 'Không rõ',
      doctor_revision_note: r.doctor_revision_note, thoi_diem_yeu_cau: r.ngay_cap_nhat,
    }))
    return ok(res, data)
  } catch (err) { return fail(res, 500, err.message) }
}

// ─── GET /api/nurse/medical-records/:id ─────────────────────────────────────
export async function getById(req, res) {
  try {
    const result = await KetQuaKham.findOne({ _id: req.params.id, nguoi_nhap_id: req.user.id }).lean()
    if (!result) return fail(res, 404, 'Không tìm thấy hồ sơ khám hoặc không thuộc bạn')
    return ok(res, formatResult(result))
  } catch (err) { return fail(res, 500, err.message) }
}

// ─── POST /api/nurse/medical-records ────────────────────────────────────────
export async function createDraft(req, res) {
  try {
    const { hang_doi_id, appointment_id, chan_doan, huong_dan_dieu_tri, ghi_chu, trieu_chung_ban_dau, ghi_chu_dieu_duong, ngay_tai_kham, sinh_hieu } = req.body

    // Tương thích ngược: UI cũ gọi bằng appointment_id (lịch hẹn) thay vì hang_doi_id
    // (lượt khám hàng đợi). Ưu tiên hang_doi_id nếu có; nếu không, tự resolve từ
    // appointment_id sang lượt khám đã check-in tương ứng.
    let resolvedHangDoiId = hang_doi_id
    if (!resolvedHangDoiId) {
      if (appointment_id) {
        const enc = await HangDoi.findOne({ appointment_id }).select('_id').lean()
        if (!enc) return fail(res, 409, 'Bệnh nhân chưa được check-in vào hàng đợi, chưa thể nhập hồ sơ')
        resolvedHangDoiId = enc._id
      } else {
        return fail(res, 400, 'Thiếu hang_doi_id hoặc appointment_id')
      }
    }

    const { entry, error } = await findEntryInShift(resolvedHangDoiId, req.user.id)
    if (error) return fail(res, ...error)
    if (['cancelled', 'skipped'].includes(entry.trang_thai)) {
      return fail(res, 409, 'Không thể nhập hồ sơ cho lượt khám đã hủy/bỏ lượt')
    }
    if (await KetQuaKham.exists({ hang_doi_id: entry._id })) {
      return fail(res, 409, 'Hồ sơ khám đã tồn tại cho lượt khám này')
    }
    if (entry.appointment_id && await KetQuaKham.exists({ appointment_id: entry.appointment_id })) {
      return fail(res, 409, 'Hồ sơ khám đã tồn tại cho lịch hẹn này')
    }
    if (!chan_doan?.trim()) return fail(res, 400, 'Chẩn đoán là bắt buộc')
    if (ngay_tai_kham && !isNgayTaiKhamHopLe(ngay_tai_kham, entry.checkin_time)) {
      return fail(res, 400, 'Ngày tái khám phải từ ngày tiếp theo sau ngày khám')
    }

    const result = await KetQuaKham.create({
      ...keysFromEntry(entry),
      nguoi_nhap_id: req.user.id,
      bac_si_phu_trach_id: entry.doctor_id,
      status: 'ban_nhap',
      chan_doan: chan_doan.trim(),
      huong_dan_dieu_tri: huong_dan_dieu_tri?.trim() || null,
      ghi_chu: ghi_chu?.trim() || null,
      trieu_chung_ban_dau: trieu_chung_ban_dau?.trim() || null,
      ghi_chu_dieu_duong: ghi_chu_dieu_duong?.trim() || null,
      ngay_tai_kham: ngay_tai_kham ? new Date(ngay_tai_kham) : null,
    })
    await upsertVitals(entry, req.user.id, sinh_hieu)
    return created(res, formatResult(result), 'Đã lưu nháp hồ sơ khám')
  } catch (err) {
    if (err.name === 'ValidationError') return fail(res, 400, err.message)
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/nurse/medical-records/:id ───────────────────────────────────
export async function update(req, res) {
  try {
    const result = await KetQuaKham.findOne({ _id: req.params.id, nguoi_nhap_id: req.user.id })
    if (!result) return fail(res, 404, 'Không tìm thấy hồ sơ khám hoặc không thuộc bạn')
    if (!['ban_nhap', 'yeu_cau_chinh_sua'].includes(result.status)) {
      return fail(res, 409, 'Chỉ sửa được hồ sơ đang nháp hoặc đang cần chỉnh sửa')
    }
    const entry = await HangDoi.findById(result.hang_doi_id).lean()
    const { chan_doan, huong_dan_dieu_tri, ghi_chu, trieu_chung_ban_dau, ghi_chu_dieu_duong, ngay_tai_kham, sinh_hieu } = req.body
    if (chan_doan) result.chan_doan = chan_doan.trim()
    if (huong_dan_dieu_tri !== undefined) result.huong_dan_dieu_tri = huong_dan_dieu_tri?.trim() || null
    if (ghi_chu !== undefined) result.ghi_chu = ghi_chu?.trim() || null
    if (trieu_chung_ban_dau !== undefined) result.trieu_chung_ban_dau = trieu_chung_ban_dau?.trim() || null
    if (ghi_chu_dieu_duong !== undefined) result.ghi_chu_dieu_duong = ghi_chu_dieu_duong?.trim() || null
    if (ngay_tai_kham !== undefined) {
      if (ngay_tai_kham && !isNgayTaiKhamHopLe(ngay_tai_kham, entry?.checkin_time)) {
        return fail(res, 400, 'Ngày tái khám phải từ ngày tiếp theo sau ngày khám')
      }
      result.ngay_tai_kham = ngay_tai_kham ? new Date(ngay_tai_kham) : null
    }
    await result.save()
    if (sinh_hieu && entry) await upsertVitals(entry, req.user.id, sinh_hieu)
    return ok(res, formatResult(result), 'Đã cập nhật hồ sơ khám')
  } catch (err) {
    if (err.name === 'ValidationError') return fail(res, 400, err.message)
    return fail(res, 500, err.message)
  }
}

// Chuyển DRAFT/NEED_REVISION -> WAITING_DOCTOR_CONFIRM. Online: cập nhật LichHen.status.
async function submitForDoctorConfirm(req, res, allowedFromStatuses) {
  try {
    const result = await KetQuaKham.findOne({ _id: req.params.id, nguoi_nhap_id: req.user.id })
    if (!result) return fail(res, 404, 'Không tìm thấy hồ sơ khám hoặc không thuộc bạn')
    if (!allowedFromStatuses.includes(result.status)) {
      return fail(res, 409, `Chỉ gửi được hồ sơ đang ở trạng thái: ${allowedFromStatuses.join(', ')}`)
    }
    result.status = 'cho_xac_nhan'
    result.submitted_at = new Date()
    await result.save()
    // Online: đồng bộ LichHen để bác sĩ thấy có hồ sơ chờ (offline không có LichHen — bỏ qua).
    if (result.appointment_id) {
      const a = await LichHen.findById(result.appointment_id)
      if (a && !['completed', 'cancelled', 'no_show'].includes(a.status)) {
        a.status = 'waiting_doctor_confirm'
        await a.save()
      }
    }
    return ok(res, { id: result._id, status: result.status }, 'Đã gửi hồ sơ cho bác sĩ xác nhận')
  } catch (err) { return fail(res, 500, err.message) }
}

export async function submit(req, res) { return submitForDoctorConfirm(req, res, ['ban_nhap']) }
export async function resubmit(req, res) { return submitForDoctorConfirm(req, res, ['yeu_cau_chinh_sua']) }
