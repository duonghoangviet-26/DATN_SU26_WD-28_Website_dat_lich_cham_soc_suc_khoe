import { LichHen, KetQuaKham, ThanhVien, SinhHieuKham } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'

// ============================================================
// Hàng đợi & chi tiết lịch hẹn (Y tá)
// Routes: /api/nurse/appointments
// Mọi hàm đều lọc theo nurse_id = req.user.id (từ token) — KHÔNG tin nurseId từ FE.
// ============================================================

const GIOI_TINH_LABEL = { nam: 'Nam', nu: 'Nữ', khac: 'Khác' }

// Trạng thái coi là "đang trong luồng khám" — loại pending (chưa xác nhận, chưa tới lượt xử lý
// của y tá) và cancelled/no_show (không cần y tá xử lý nữa) ra khỏi hàng đợi mặc định.
// waiting_record/skipped thêm ở Kế hoạch 1 (DB CHANGES 2026-07-15) — bắt buộc có ở đây, nếu không
// lịch hẹn "biến mất" khỏi hàng đợi ngay khi y tá kết thúc khám (Kế hoạch 2: finish -> waiting_record).
const QUEUE_STATUSES = ['confirmed', 'checked_in', 'in_progress', 'waiting_record', 'waiting_doctor_confirm', 'completed', 'skipped']

async function formatQueueItem(a) {
  const [member, result] = await Promise.all([
    a.member_id ? ThanhVien.findById(a.member_id).select('ho_ten ngay_sinh gioi_tinh').lean() : null,
    KetQuaKham.findOne({ appointment_id: a._id }).select('status').lean(),
  ])

  const tuoi = member?.ngay_sinh ? new Date().getFullYear() - new Date(member.ngay_sinh).getFullYear() : undefined

  return {
    id: a._id,
    ma_lich_hen: a.ma_lich_hen ?? null,
    benh_nhan: member?.ho_ten ?? a.ten_khach ?? 'Không rõ',
    tuoi,
    gioi_tinh: member?.gioi_tinh ? GIOI_TINH_LABEL[member.gioi_tinh] : undefined,
    ngay_kham: a.ngay_kham,
    gio_kham: a.gio_kham,
    ly_do_kham: a.ly_do_kham,
    ten_dich_vu: a.ten_dich_vu,
    bac_si: a.doctor_id?.user_id?.ho_ten ?? null,
    chuyen_khoa: (a.doctor_id?.specialties || []).map((s) => s.ten).join(', ') || null,
    phong_kham: a.phong_kham,
    loai_kham: a.loai_kham,
    status: a.status,
    payment_status: a.payment_status,
    da_co_ket_qua: !!result,
    ket_qua_status: result?.status ?? null,
  }
}

// ─── GET /api/nurse/appointments?date=&status= ──────────────────────────────
// Mặc định: hàng đợi hôm nay (không hiển thị pending/cancelled/no_show — mục V đặc tả).
// Sắp xếp theo gio_kham — hệ thống hiện CHƯA có checkin_time/queue_number thật (chưa triển
// khai luồng check-in lễ tân), nên đây là thứ tự gần đúng nhất hiện có, không phải hàng đợi
// thời gian thực theo đúng nghĩa "ai đến trước khám trước".
export async function listQueue(req, res) {
  try {
    const { date, status } = req.query
    const filter = { nurse_id: req.user.id }
    filter.status = status || { $in: QUEUE_STATUSES }

    const day = date ? new Date(date) : new Date()
    const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1)
    filter.ngay_kham = { $gte: dayStart, $lt: dayEnd }

    const appts = await LichHen.find(filter)
      .populate({
        path: 'doctor_id',
        select: 'specialties',
        populate: [
          { path: 'user_id', select: 'ho_ten' },
          { path: 'specialties', select: 'ten' },
        ],
      })
      .sort({ gio_kham: 1 })
      .lean()

    const data = await Promise.all(appts.map(formatQueueItem))
    return ok(res, data)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/nurse/appointments/:id ─────────────────────────────────────────
export async function getById(req, res) {
  try {
    const a = await LichHen.findOne({ _id: req.params.id, nurse_id: req.user.id })
      .populate('member_id', 'ho_ten ngay_sinh gioi_tinh benh_nen di_ung')
      .populate({
        path: 'doctor_id',
        select: 'specialties phong_kham_mac_dinh',
        populate: [
          { path: 'user_id', select: 'ho_ten' },
          { path: 'specialties', select: 'ten' },
        ],
      })
      .lean()
    if (!a) return fail(res, 404, 'Không tìm thấy lịch hẹn hoặc không thuộc ca của bạn')

    const [result, vitals] = await Promise.all([
      KetQuaKham.findOne({ appointment_id: a._id }).populate('lich_su_sua.nguoi_sua_id', 'ho_ten').lean(),
      SinhHieuKham.findOne({ appointment_id: a._id }).lean(),
    ])

    const member = a.member_id
    const tuoi = member?.ngay_sinh ? new Date().getFullYear() - new Date(member.ngay_sinh).getFullYear() : undefined

    return ok(res, {
      id: a._id,
      ma_lich_hen: a.ma_lich_hen ?? null,
      benh_nhan: member?.ho_ten ?? a.ten_khach ?? 'Không rõ',
      tuoi,
      gioi_tinh: member?.gioi_tinh ? GIOI_TINH_LABEL[member.gioi_tinh] : undefined,
      so_dien_thoai: a.so_dien_thoai_khach ?? null,
      benh_nen: member?.benh_nen ?? null,
      di_ung: member?.di_ung ?? null,
      ngay_kham: a.ngay_kham,
      gio_kham: a.gio_kham,
      bac_si: a.doctor_id?.user_id?.ho_ten ?? null,
      chuyen_khoa: (a.doctor_id?.specialties || []).map((s) => s.ten).join(', ') || null,
      phong_kham: a.phong_kham,
      dia_chi_kham: a.dia_chi_kham,
      ten_dich_vu: a.ten_dich_vu,
      loai_kham: a.loai_kham,
      ly_do_kham: a.ly_do_kham,
      status: a.status,
      payment_status: a.payment_status,
      da_co_ket_qua: !!result,
      ket_qua: result ? {
        id: result._id,
        status: result.status,
        chan_doan: result.chan_doan,
        huong_dan_dieu_tri: result.huong_dan_dieu_tri,
        ghi_chu: result.ghi_chu,
        trieu_chung_ban_dau: result.trieu_chung_ban_dau,
        ghi_chu_dieu_duong: result.ghi_chu_dieu_duong,
        ngay_tai_kham: result.ngay_tai_kham,
        doctor_revision_note: result.doctor_revision_note,
        // Y tá trước đây chỉ thấy lý do yêu cầu chỉnh sửa MỚI NHẤT (doctor_revision_note),
        // không thấy toàn bộ lịch sử như bác sĩ — xem docs/Bác sĩ/Audit tong the, GAP-013.
        lich_su_sua: result.lich_su_sua ?? [],
      } : null,
      sinh_hieu: vitals ? {
        can_nang: vitals.can_nang,
        chieu_cao: vitals.chieu_cao,
        huyet_ap: vitals.huyet_ap,
        nhiet_do: vitals.nhiet_do,
        nhip_tim: vitals.nhip_tim,
      } : null,
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
