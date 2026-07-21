import { LichHen, KetQuaKham, ThanhVien, SinhHieuKham, HangDoi } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'
import { getMyDoctorIdsOnDate } from '../../utils/nurse-scope.js'

// ============================================================
// Hàng đợi & chi tiết lịch hẹn (Y tá)
// Routes: /api/nurse/appointments
// Phạm vi = lịch hẹn của các BÁC SĨ y tá được phân công trực trong ngày
// (LichLamViec.nurse_id, qua getMyDoctorIdsOnDate) — nhất quán với medical-records/queue.
// Danh tính y tá lấy từ req.user.id (token) — KHÔNG tin nurseId từ FE.
// ============================================================

const GIOI_TINH_LABEL = { nam: 'Nam', nu: 'Nữ', khac: 'Khác' }

// Trạng thái coi là "đang trong luồng khám" — loại pending (chưa xác nhận, chưa tới lượt xử lý
// của y tá) và cancelled/no_show (không cần y tá xử lý nữa) ra khỏi hàng đợi mặc định.
// waiting_record/skipped thêm ở Kế hoạch 1 (DB CHANGES 2026-07-15) — bắt buộc có ở đây, nếu không
// lịch hẹn "biến mất" khỏi hàng đợi ngay khi y tá kết thúc khám (Kế hoạch 2: finish -> waiting_record).
const QUEUE_STATUSES = ['confirmed', 'checked_in', 'in_progress', 'waiting_record', 'waiting_doctor_confirm', 'completed', 'skipped']

// Escape ký tự đặc biệt để tìm kiếm regex an toàn (tránh injection/ReDoS từ input).
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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
    const { date, status, q } = req.query
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20))
    const day = date ? new Date(date) : new Date()
    const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1)

    // Phạm vi: chỉ bác sĩ y tá trực trong ngày đó. Không có ca → không có dữ liệu.
    const doctorIds = await getMyDoctorIdsOnDate(req.user.id, day)
    if (doctorIds.length === 0) return ok(res, { items: [], total: 0, page, limit })

    const filter = { doctor_id: { $in: doctorIds }, ngay_kham: { $gte: dayStart, $lt: dayEnd } }
    filter.status = status || { $in: QUEUE_STATUSES }

    // Tìm kiếm (backend): mã lịch hẹn / tên khách vãng lai / tên thành viên (join ThanhVien).
    if (q && q.trim()) {
      const rx = new RegExp(escapeRegex(q.trim()), 'i')
      const memberIds = await ThanhVien.find({ ho_ten: rx }).distinct('_id')
      filter.$or = [{ ma_lich_hen: rx }, { ten_khach: rx }, { member_id: { $in: memberIds } }]
    }

    const total = await LichHen.countDocuments(filter)
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
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()

    const items = await Promise.all(appts.map(formatQueueItem))
    return ok(res, { items, total, page, limit })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/nurse/appointments/pending-records?date= ──────────────────────
// Danh sách lịch trong ca đang ở bước cần y tá nhập/theo dõi hồ sơ.
// CHỈ ĐỌC — KHÔNG tạo hồ sơ tự động. Loại hủy/không đến (không nằm trong 2 status dưới)
// và loại hồ sơ đã xác nhận (khi đó lịch đã 'completed', không còn ở waiting_*).
const GIAI_DOAN_WEIGHT = { chua_tao: 0, yeu_cau_chinh_sua: 0, ban_nhap: 1, cho_xac_nhan: 2 }

export async function pendingRecords(req, res) {
  try {
    const { date } = req.query
    const day = date ? new Date(date) : new Date()
    const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1)

    const doctorIds = await getMyDoctorIdsOnDate(req.user.id, day)
    if (doctorIds.length === 0) return ok(res, [])

    const appts = await LichHen.find({
      doctor_id: { $in: doctorIds },
      ngay_kham: { $gte: dayStart, $lt: dayEnd },
      status: { $in: ['waiting_record', 'waiting_doctor_confirm'] },
    })
      .populate({ path: 'doctor_id', select: 'specialties', populate: [{ path: 'user_id', select: 'ho_ten' }] })
      .lean()

    const items = await Promise.all(appts.map(async (a) => {
      const [member, record] = await Promise.all([
        a.member_id ? ThanhVien.findById(a.member_id).select('ho_ten ngay_sinh gioi_tinh').lean() : null,
        KetQuaKham.findOne({ appointment_id: a._id }).select('status').lean(),
      ])
      const giai_doan = record ? record.status : 'chua_tao'
      const tuoi = member?.ngay_sinh ? new Date().getFullYear() - new Date(member.ngay_sinh).getFullYear() : undefined
      return {
        id: a._id,
        ma_lich_hen: a.ma_lich_hen ?? null,
        benh_nhan: member?.ho_ten ?? a.ten_khach ?? 'Không rõ',
        tuoi,
        gioi_tinh: member?.gioi_tinh ? GIOI_TINH_LABEL[member.gioi_tinh] : undefined,
        ngay_kham: a.ngay_kham,
        gio_kham: a.gio_kham,
        bac_si: a.doctor_id?.user_id?.ho_ten ?? null,
        status: a.status,
        giai_doan,
      }
    }))

    // Loại hồ sơ đã xác nhận (phòng hờ) + sort theo mức ưu tiên rồi giờ hẹn.
    const filtered = items.filter((i) => i.giai_doan !== 'da_xac_nhan')
    filtered.sort((x, y) => {
      const w = (GIAI_DOAN_WEIGHT[x.giai_doan] ?? 3) - (GIAI_DOAN_WEIGHT[y.giai_doan] ?? 3)
      return w !== 0 ? w : (x.gio_kham || '').localeCompare(y.gio_kham || '')
    })
    return ok(res, filtered)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/nurse/appointments/:id ─────────────────────────────────────────
export async function getById(req, res) {
  try {
    // Bước 1 — kiểm tra phạm vi RẺ trước khi tải dữ liệu bệnh nhân (không lộ PII nếu ngoài ca).
    const scope = await LichHen.findById(req.params.id).select('doctor_id ngay_kham').lean()
    if (!scope) return fail(res, 404, 'Không tìm thấy lịch hẹn hoặc không thuộc ca của bạn')
    const doctorIds = await getMyDoctorIdsOnDate(req.user.id, scope.ngay_kham)
    if (!doctorIds.includes(String(scope.doctor_id))) {
      return fail(res, 404, 'Không tìm thấy lịch hẹn hoặc không thuộc ca của bạn')
    }

    const a = await LichHen.findById(req.params.id)
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

    const [result, vitals, queueEntry] = await Promise.all([
      KetQuaKham.findOne({ appointment_id: a._id })
        .populate('lich_su_sua.nguoi_sua_id', 'ho_ten')
        .populate('nguoi_xac_nhan_id', 'ho_ten')
        .lean(),
      SinhHieuKham.findOne({ appointment_id: a._id }).lean(),
      HangDoi.findOne({ appointment_id: a._id }).select('trang_thai').lean(),
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
      trang_thai_den: a.trang_thai_den ?? null,
      da_check_in: a.trang_thai_den === 'da_den' || !!queueEntry,
      hang_doi_trang_thai: queueEntry?.trang_thai ?? null,
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
        // Thông tin xác nhận (chỉ đọc) — hiển thị khi status='da_xac_nhan'. Null khi chưa xác nhận.
        thoi_diem_xac_nhan: result.thoi_diem_xac_nhan ?? null,
        nguoi_xac_nhan: result.nguoi_xac_nhan_id?.ho_ten ?? null,
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
