import mongoose from 'mongoose'
import {
  BacSi, LichLamViec, LichHen,
  ChuyenKhoa, DichVu, GiaDinh, ThanhVien, HoaDon, ThanhToan, DanhGia, NguoiDung, HoSoChiTietBacSi,
} from '../../models/index.js'
import {
  cancelAppointmentWithPaymentSync,
  withOptionalTransaction,
} from '../../services/bookingPaymentState.service.js'
// Doi gio phong kham (UTC+7) -> moc tuyet doi. TRUOC DAY file nay tu viet buildSlotDateTime
// bang setUTCHours(hours) — hieu "08:00" thanh 08:00Z = 15:00 gio VN, lech 7 tieng, khien he
// thong chao ban va THU TIEN khung gio da troi qua. Xem docs/Phan tich truoc khi sua... (2026-07-25).
import {
  buildSlotDateTime,
  daQuaCutoffOnline,
  hanGiuChoCoGian,
  isSlotInPast,
} from '../../utils/clinicTime.js'
import { donDepSlotTruocKhiDoc } from '../../services/slotRelease.service.js'
import {
  chonBacSiChoKhung,
  layGiaKhamChuyenKhoa,
  layKhungTrongCuaChuyenKhoa,
} from '../../services/doctorAssignment.service.js'
import { ok, created, fail } from '../../utils/response.js'
import {
  emitAdminRealtime,
  emitDashboardAppointmentChanged,
  emitDashboardRevenueChanged,
} from '../../realtime/socket.js'

const PAYMENT_HOLD_MINUTES = Number(process.env.PAYMENT_HOLD_MINUTES || process.env.VNPAY_SESSION_MINUTES || 15)

// Phiên bản điều khoản đặt lịch (gồm chính sách KHÔNG HOÀN TIỀN — rule mục 5).
// Đổi nội dung điều khoản thì PHẢI tăng số này, nếu không lịch hẹn cũ và mới cùng trỏ về
// một version mà nội dung lại khác nhau — mất giá trị làm bằng chứng.
const DIEU_KHOAN_VERSION = process.env.DIEU_KHOAN_VERSION || '2026-07-26.v1'

function getPaymentDeadline(now = new Date()) {
  return new Date(now.getTime() + PAYMENT_HOLD_MINUTES * 60 * 1000)
}

function parseDateOnly(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setUTCHours(0, 0, 0, 0)
  return date
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000)
}

function getTodayDateOnly() {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  return today
}

// buildSlotDateTime / isSlotInPast: nay dung chung tu utils/clinicTime.js (xem import o dau file).

// Trang thai coi la con chiem mot luot kham. `cancelled` va `no_show` KHONG tinh:
// khach da huy thi thoi, khach no_show thi da mat 100% tien roi (rule muc 5) — chan ho
// dat lai trong ngay chi la phat chong len phat.
const TRANG_THAI_CHIEM_LUOT = [
  'pending', 'confirmed', 'checked_in', 'in_progress',
  'waiting_record', 'waiting_doctor_confirm', 'completed',
]

// Dinh danh NGUOI DUOC KHAM, khong phai nguoi dat.
// Rule muc 5: gioi han tinh theo `member_id` vi mot tai khoan dat cho ca gia dinh —
// tinh theo `user_id` se chan nham me dat cho hai con trong cung mot ngay.
function dinhDanhNguoiDuocKham(userId, memberId) {
  return memberId ? { member_id: memberId } : { user_id: userId, member_id: null }
}

function normalizeBookingPhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.startsWith('84') ? `0${digits.slice(2)}` : digits
}

function normalizeBookingName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function dinhDanhNguoiDuocKhamTrongPayload({ userId, memberId, tenKhach, soDienThoaiKhach, bookingFor = 'other' }) {
  if (bookingFor === 'self') return [dinhDanhNguoiDuocKham(userId, null)]
  if (memberId || bookingFor === 'member') return [{ member_id: memberId }]
  if (tenKhach && soDienThoaiKhach) {
    const phone = normalizeBookingPhone(soDienThoaiKhach)
    const escapedName = normalizeBookingName(tenKhach).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return [{
      ten_khach: { $regex: `^${escapedName}$`, $options: 'i' },
      so_dien_thoai_khach: { $in: [soDienThoaiKhach, phone] },
      member_id: null,
    }]
  }
  return [dinhDanhNguoiDuocKham(userId, null)]
}

// Rule muc 5: toi da 1 slot `pending_payment` dang hoat dong / nguoi duoc kham.
// Dat moi thi NHA giu cho cu ngay, khong de khach om nhieu cho cung luc.
async function nhaGiuChoCuCuaNguoiKham({ userId, memberId, tenKhach, soDienThoaiKhach, bookingFor, session }) {
  const identityFilters = dinhDanhNguoiDuocKhamTrongPayload({ userId, memberId, tenKhach, soDienThoaiKhach, bookingFor })
  const dangGiu = await LichHen.find({
    $or: identityFilters,
    status: 'pending',
    payment_status: 'unpaid',
  }).select('_id').session(session).lean()

  for (const item of dangGiu) {
    await cancelAppointmentWithPaymentSync({
      appointmentId: item._id,
      actorUserId: userId,
      actorRole: 'user',
      channel: 'patient_rebook',
      reason: 'Tu dong huy giu cho cu vi benh nhan dat luot moi (rule muc 5)',
      session,
    })
  }

  return dangGiu.length
}

// Rule dat ho: 1 lich dang hieu luc / ngay / nguoi duoc kham.
// Gioi han theo BAC SI (ban cu) vo nghia khi he thong tu gan bac si (muc 12) — khach
// khong chon nguoi thi khong the lay nguoi lam don vi dem.
async function timLuotTrungTrongNgay({ userId, memberId, tenKhach, soDienThoaiKhach, bookingFor, ngay, session }) {
  const identityFilters = dinhDanhNguoiDuocKhamTrongPayload({ userId, memberId, tenKhach, soDienThoaiKhach, bookingFor })
  return LichHen.findOne({
    $or: identityFilters,
    ngay_kham: { $gte: ngay, $lt: addDays(ngay, 1) },
    status: { $in: TRANG_THAI_CHIEM_LUOT },
  }).select('ma_lich_hen gio_kham status').session(session).lean()
}

// ============================================================
// A5 — Đặt lịch khám (Bệnh nhân)
// Routes: /api/patient/booking
// ============================================================

function formatDatePart(date) {
  const year = String(date.getUTCFullYear()).slice(-2)
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

async function nextInvoiceNumber(session, invoiceDate) {
  const datePart = formatDatePart(invoiceDate)
  const counter = await mongoose.connection.collection('counters').findOneAndUpdate(
    { key: `so_hoa_don_${datePart}` },
    {
      $inc: { seq: 1 },
      $setOnInsert: { key: `so_hoa_don_${datePart}` },
    },
    {
      upsert: true,
      returnDocument: 'after',
      session,
    }
  )

  const counterDocument = counter?.value ?? counter
  const sequence = String(counterDocument.seq).padStart(4, '0')
  return `HD-${datePart}-${sequence}`
}

async function nextAppointmentCode(session, appointmentDate) {
  const datePart = formatDatePart(appointmentDate)
  const counter = await mongoose.connection.collection('counters').findOneAndUpdate(
    { key: `ma_lich_hen_${datePart}` },
    {
      $inc: { seq: 1 },
      $setOnInsert: { key: `ma_lich_hen_${datePart}` },
    },
    {
      upsert: true,
      returnDocument: 'after',
      session,
    }
  )

  const counterDocument = counter?.value ?? counter
  const sequence = String(counterDocument.seq).padStart(4, '0')
  return `LH-${datePart}-${sequence}`
}

// ─── GET /api/patient/booking/specialties ───────────────────────────────────
export async function getSpecialties(req, res) {
  try {
    const specialties = await ChuyenKhoa.find({ status: 'active' })
      .sort({ thu_tu: 1, ten: 1 })
      .select('ten mo_ta icon_url slug')
      .lean()
    return ok(res, specialties.map((s) => ({ id: s._id, ...s })))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/patient/booking/services ──────────────────────────────────────
export async function getServices(req, res) {
  try {
    const services = await DichVu.find({ status: 'active', loai: 'related' })
      .populate('specialty_id', 'ten')
      .sort({ ten: 1 })
      .lean()
    return ok(res, services.map((s) => ({
      id:         s._id,
      ten:        s.ten,
      loai:       s.loai,
      gia:        s.gia,
      mo_ta:      s.mo_ta,
      mo_ta_ngan: s.mo_ta_ngan,
      hinh_anh:   s.hinh_anh ?? null,
      thoi_gian_phut:        s.thoi_gian_phut,
      gio_dat_truoc_toi_thieu: s.gio_dat_truoc_toi_thieu,
      khu_vuc:    s.khu_vuc,
      chuyen_khoa: s.specialty_id?.ten ?? null,
    })))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/patient/booking/doctors?specialty_id=&service_id= ─────────────
export async function getDoctors(req, res) {
  try {
    const { specialty_id, service_id } = req.query
    const filter = { trang_thai_duyet: 'approved', la_hien: true }

    if (specialty_id && mongoose.Types.ObjectId.isValid(specialty_id)) {
      filter.specialties = specialty_id
    }
    if (service_id && mongoose.Types.ObjectId.isValid(service_id)) {
      filter.services = service_id
    }

    const doctors = await BacSi.find(filter)
      .populate('user_id',    'ho_ten anh_dai_dien')
      .populate('specialties','ten')
      .select('user_id specialties gia_kham so_nam_kinh_nghiem diem_danh_gia tong_danh_gia tuoi_nhan_kham_tu tieu_su bang_cap kinh_nghiem phong_kham_mac_dinh')
      .lean()

    return ok(res, doctors.map((d) => ({
      id:                 d._id,
      ho_ten:             d.user_id?.ho_ten,
      anh_dai_dien:       d.user_id?.anh_dai_dien,
      gia_kham:           d.gia_kham,
      so_nam_kinh_nghiem: d.so_nam_kinh_nghiem,
      diem_danh_gia:      d.diem_danh_gia,
      tong_danh_gia:      d.tong_danh_gia,
      tuoi_nhan_kham_tu:  d.tuoi_nhan_kham_tu,
      tieu_su:            d.tieu_su,
      bang_cap:           d.bang_cap || '',
      kinh_nghiem:        d.kinh_nghiem || '',
      phong_kham_mac_dinh: d.phong_kham_mac_dinh,
      specialties: (d.specialties ?? []).map((s) => ({ id: s._id, ten: s.ten })),
    })))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/patient/booking/doctors/:id ───────────────────────────────────
export async function getDoctorById(req, res) {
  try {
    const [doc, detailedProfile] = await Promise.all([
      BacSi.findOne({ _id: req.params.id, trang_thai_duyet: 'approved', la_hien: true })
        .populate('user_id',    'ho_ten anh_dai_dien so_dien_thoai')
        .populate('specialties','ten mo_ta icon_url slug')
        .populate('services',   'ten gia mo_ta_ngan khu_vuc')
        .lean(),
      HoSoChiTietBacSi.findOne({ doctor_id: req.params.id }).lean(),
    ])

    if (!doc) return fail(res, 404, 'Không tìm thấy bác sĩ')

    return ok(res, {
      id:                  doc._id,
      ho_ten:              doc.user_id?.ho_ten,
      anh_dai_dien:        doc.user_id?.anh_dai_dien,
      so_dien_thoai:       doc.user_id?.so_dien_thoai,
      gia_kham:            doc.gia_kham,
      so_nam_kinh_nghiem:  doc.so_nam_kinh_nghiem,
      diem_danh_gia:       doc.diem_danh_gia,
      tong_danh_gia:       doc.tong_danh_gia,
      tuoi_nhan_kham_tu:   doc.tuoi_nhan_kham_tu,
      tieu_su:             doc.tieu_su,
      bang_cap:            doc.bang_cap,
      kinh_nghiem:         doc.kinh_nghiem,
      phong_kham_mac_dinh: doc.phong_kham_mac_dinh,
      specialties: (doc.specialties ?? []).map((s) => ({ id: s._id, ten: s.ten, slug: s.slug })),
      services:    [],
      ho_so_chi_tiet:      detailedProfile || null,
    })
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/patient/booking/doctors/:id/slots?date=YYYY-MM-DD ─────────────
export async function getSlots(req, res) {
  try {
    const { date, specialty_id } = req.query
    if (!date) return fail(res, 400, 'Tham số date là bắt buộc (YYYY-MM-DD)')

    const ngayDate = parseDateOnly(date)
    if (!ngayDate) return fail(res, 400, 'Ngày không hợp lệ')
    if (ngayDate.getTime() < getTodayDateOnly().getTime()) return ok(res, [])

    // `:id` nhận ĐÍCH DANH một bác sĩ, hoặc 'all'/'auto' để gộp mọi bác sĩ khả dụng
    // (hợp đồng do nhánh client đặt ra — giữ nguyên để FE của họ không vỡ).
    const doctorIdParam = req.params.id
    const gopNhieuBacSi = !doctorIdParam || doctorIdParam === 'all' || doctorIdParam === 'auto'

    const doctorFilter = { trang_thai_duyet: 'approved', la_hien: true }
    if (!gopNhieuBacSi) {
      if (!mongoose.Types.ObjectId.isValid(doctorIdParam)) return fail(res, 400, 'ID bác sĩ không hợp lệ')
      doctorFilter._id = doctorIdParam
    }
    // Gộp nhiều bác sĩ mà KHÔNG lọc chuyên khoa thì khách chọn Tai Mũi Họng có thể bị xếp
    // bác sĩ Nhi khoa. Cho phép thu hẹp bằng `?specialty_id=`.
    if (specialty_id && mongoose.Types.ObjectId.isValid(specialty_id)) {
      doctorFilter.specialties = specialty_id
    }

    const doctors = await BacSi.find(doctorFilter).select('_id phong_kham_mac_dinh').lean()
    if (doctors.length === 0) {
      return gopNhieuBacSi ? ok(res, []) : fail(res, 404, 'Không tìm thấy bác sĩ')
    }
    const phongMacDinhTheoBacSi = new Map(doctors.map((d) => [String(d._id), d.phong_kham_mac_dinh ?? null]))

    // KHÔNG .lean() — cần document thật để `donDepSlotTruocKhiDoc()` cập nhật bản in-memory.
    const schedules = await LichLamViec.find({
      doctor_id: { $in: doctors.map((d) => d._id) },
      ngay: { $gte: ngayDate, $lt: addDays(ngayDate, 1) },
      trang_thai_ngay: 'lam_viec',
      trang_thai_xac_nhan: { $ne: 'tu_choi' },
    })
    if (schedules.length === 0) return ok(res, [])

    // QUÉT LAZY ngay TRƯỚC KHI đọc: (1) nhả giữ chỗ quá hạn — người đang tìm chỗ thấy luôn
    // chỗ vừa được giải phóng; (2) chuyển slot online đã qua mốc T-30' sang walk-in.
    // Cron 5' chỉ là lưới an toàn cho lịch không ai đọc tới. (rule mục 11)
    for (const schedule of schedules) await donDepSlotTruocKhiDoc(schedule)

    // Slot đã có LichHen còn hiệu lực -> không còn trống, dù `status` trong lịch có lệch.
    const bookedSlotIds = new Set(
      (await LichHen.find({
        doctor_id: { $in: schedules.map((s) => s.doctor_id) },
        ngay_kham: { $gte: ngayDate, $lt: addDays(ngayDate, 1) },
        status: { $ne: 'cancelled' },
      }).select('slot_id').lean())
        .filter((app) => app.slot_id)
        .map((app) => app.slot_id.toString())
    )

    // Gộp theo GIỜ và đếm `available_count`: một khung có nhiều slot (TMH 2 slot/khung) và
    // nhiều bác sĩ cùng trực, nên trả từng slot sẽ hiện cùng một giờ nhiều lần.
    const theoGio = new Map()
    for (const schedule of schedules) {
      for (const s of schedule.slots) {
        if (s.status !== 'active' || s.benh_nhan_id) continue
        // Slot bị khoá bởi nghỉ phép đã duyệt: createBooking ĐÃ chặn, nhưng getSlots trước
        // đây KHÔNG lọc -> vẫn chào bán rồi bấm đặt mới báo 409.
        if (s.bi_khoa_boi_nghi_phep) continue
        // Chỉ hiện slot ONLINE cho bệnh nhân tự đặt. Dùng "!== 'walk_in'" thay vì
        // "=== 'online'" để tương thích ngược với slot tạo TRƯỚC migration (thiếu loai_slot).
        if (s.loai_slot === 'walk_in') continue
        if (bookedSlotIds.has(s._id.toString())) continue
        if (isSlotInPast(ngayDate, s.gio_bat_dau)) continue
        // Cutoff T-30' (rule mục 11): quá mốc thì không chào bán online nữa.
        if (daQuaCutoffOnline(ngayDate, s.gio_bat_dau)) continue

        const hienCo = theoGio.get(s.gio_bat_dau)
        if (hienCo) {
          hienCo.available_count += 1
          continue
        }
        theoGio.set(s.gio_bat_dau, {
          id:          s._id,
          schedule_id: schedule._id,
          doctor_id:   schedule.doctor_id,
          gio_bat_dau:  s.gio_bat_dau,
          gio_ket_thuc: s.gio_ket_thuc,
          // Slot cũ chưa có phòng -> lấy phòng mặc định của bác sĩ. Không bịa tên phòng:
          // thà để null còn hơn cho bệnh nhân một số phòng không tồn tại.
          phong_kham:   s.phong_kham ?? phongMacDinhTheoBacSi.get(String(schedule.doctor_id)) ?? null,
          available_count: 1,
        })
      }
    }

    const slots = [...theoGio.values()].sort((a, b) => a.gio_bat_dau.localeCompare(b.gio_bat_dau))
    return ok(res, slots)
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/patient/booking/specialties/:id/slots?date=YYYY-MM-DD ─────────
// Luồng MẶC ĐỊNH (rule mục 12): bệnh nhân chọn chuyên khoa + ngày + khung giờ, hệ thống
// tự gán bác sĩ. Đường chọn đích danh bác sĩ (`/doctors/:id/slots`) vẫn giữ nguyên.
//
// Giá trả kèm ở đây vì rule yêu cầu hiển thị giá TRƯỚC khi giữ chỗ.
export async function getSpecialtySlots(req, res) {
  try {
    const { date } = req.query
    if (!date) return fail(res, 400, 'Tham số date là bắt buộc (YYYY-MM-DD)')

    const ngayDate = parseDateOnly(date)
    if (!ngayDate) return fail(res, 400, 'Ngày không hợp lệ')
    if (ngayDate.getTime() < getTodayDateOnly().getTime()) {
      return ok(res, { gia_kham: null, khung_gio: [] })
    }

    const { gia_kham, ten_chuyen_khoa } = await layGiaKhamChuyenKhoa(req.params.id)
    const khungGio = await layKhungTrongCuaChuyenKhoa(req.params.id, ngayDate)

    return ok(res, { ten_chuyen_khoa, gia_kham, ngay: ngayDate, khung_gio: khungGio })
  } catch (err) {
    return fail(res, err.statusCode ?? 500, err.message)
  }
}

// ─── POST /api/patient/booking ───────────────────────────────────────────────
export async function createBooking(req, res) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    async function rollbackFail(statusCode, message) {
      await session.abortTransaction()
      session.endSession()
      return fail(res, statusCode, message)
    }

    const {
      loai_kham,
      ngay_kham, ly_do_kham,
      member_id, ten_khach, so_dien_thoai_khach, nam_sinh_khach,
      booking_for = member_id ? 'member' : 'self',
      // Đường TỰ GÁN (rule mục 12): khách chỉ chọn chuyên khoa + khung giờ.
      // `gio_kham` là tên cũ do nhánh client dùng — nhận cả hai để FE của họ không vỡ.
      specialty_id: specialtyYeuCau, gio_bat_dau, gio_kham,
    } = req.body
    let { doctor_id, schedule_id, slot_id } = req.body
    const gioYeuCau = gio_bat_dau ?? gio_kham

    if (!loai_kham)  return rollbackFail(400, 'Loại khám là bắt buộc')
    if (loai_kham !== 'clinic') return rollbackFail(400, 'Dịch vụ tại nhà đã ngừng hỗ trợ đặt lịch mới')
    if (!ngay_kham)  return rollbackFail(400, 'Ngày khám là bắt buộc')
    if (!member_id && !ten_khach) return rollbackFail(400, 'Phải có member_id hoặc ten_khach')
    if (!['self', 'member', 'other'].includes(booking_for)) {
      return rollbackFail(400, 'Hình thức đặt hộ không hợp lệ')
    }
    if (booking_for === 'member' && !member_id) {
      return rollbackFail(400, 'Đặt cho thành viên phải có member_id')
    }
    if (booking_for === 'other' && (!ten_khach || !so_dien_thoai_khach)) {
      return rollbackFail(400, 'Đặt cho người khác phải có họ tên và số điện thoại người được khám')
    }
    if (so_dien_thoai_khach) {
      const cleanPhone = normalizeBookingPhone(so_dien_thoai_khach)
      if (!/^0\d{9,10}$/.test(cleanPhone)) {
        return rollbackFail(400, 'Số điện thoại liên hệ không đúng định dạng (phải có 10 chữ số, ví dụ 0912345678)')
      }
    }

    // ⛔ Không có bằng chứng khách đồng ý điều khoản KHÔNG HOÀN TIỀN thì KHÔNG được thu
    // tiền (rule mục 5). Thu trước rồi mới tranh cãi là phòng khám thua — phải chặn ở đây,
    // không phải nhắc nhở ở giao diện.
    if (req.body.dong_y_dieu_khoan !== true) {
      return rollbackFail(
        400,
        'Vui lòng xác nhận đã đọc và đồng ý điều khoản đặt lịch (bao gồm chính sách không hoàn tiền) trước khi giữ chỗ.',
      )
    }

    const appointmentDate = parseDateOnly(ngay_kham)
    if (!appointmentDate) return rollbackFail(400, 'Ngày khám không hợp lệ')

    // Phòng khám nghỉ Chủ nhật (getDay() === 0). Chặn phòng thủ ở backend
    // để tránh đặt lịch qua API trực tiếp vào ngày nghỉ.
    if (appointmentDate.getUTCDay() === 0) {
      return rollbackFail(400, 'Phòng khám không làm việc vào Chủ nhật. Vui lòng chọn ngày khác (Thứ 2 – Thứ 7).')
    }

    // ── Tự gán bác sĩ (rule mục 12) ─────────────────────────────────────────
    // Chạy TRƯỚC mọi kiểm tra khác để phần dưới không phải biết khách đã đi đường nào:
    // sau bước này luôn có đủ doctor_id + schedule_id + slot_id như đường chọn đích danh.
    //
    // Nhận CẢ HAI hợp đồng: `specialty_id` (bản này) và `doctor_id='auto'|'all'` (nhánh
    // client). Cả hai đều đi qua `chonBacSiChoKhung()` để có LỌC CHUYÊN KHOA + thứ tự gán
    // xác định — bản tự gán của nhánh client gộp mọi bác sĩ đã duyệt bất kể chuyên khoa,
    // nên khách chọn Tai Mũi Họng có thể bị xếp bác sĩ Nhi khoa.
    const yeuCauTuGan = !doctor_id || doctor_id === 'auto' || doctor_id === 'all'
    if (yeuCauTuGan) {
      if (!gioYeuCau) return rollbackFail(400, 'Thiếu khung giờ khám (gio_bat_dau)')

      // Không truyền chuyên khoa thì suy từ chính slot khách đã chọn trên lưới.
      let specialtyToAssign = specialtyYeuCau
      if (!specialtyToAssign && schedule_id && slot_id) {
        const lichGoc = await LichLamViec.findById(schedule_id).select('slots doctor_id').session(session).lean()
        const slotGoc = lichGoc?.slots?.find((x) => String(x._id) === String(slot_id))
        specialtyToAssign = slotGoc?.specialty_id ?? null
        if (!specialtyToAssign && lichGoc?.doctor_id) {
          const bsGoc = await BacSi.findById(lichGoc.doctor_id).select('specialties').session(session).lean()
          specialtyToAssign = bsGoc?.specialties?.[0] ?? null
        }
      }
      if (!specialtyToAssign) {
        return rollbackFail(400, 'Thiếu chuyên khoa nên chưa xếp được bác sĩ. Vui lòng chọn lại khung giờ.')
      }

      const daChon = await chonBacSiChoKhung({
        specialtyId: specialtyToAssign,
        ngay: appointmentDate,
        gioBatDau: gioYeuCau,
        userId: req.user.id,
        memberId: member_id || null,
        session,
      })
      if (!daChon) {
        return rollbackFail(409, `Khung ${gioYeuCau} đã hết chỗ. Vui lòng chọn khung giờ khác.`)
      }
      doctor_id = daChon.doctorId
      schedule_id = daChon.scheduleId
      slot_id = daChon.slotId
    }

    let doc = null
    if (loai_kham === 'clinic') {
      if (!doctor_id) return rollbackFail(400, 'Cần chọn bác sĩ hoặc chuyên khoa để hệ thống tự xếp')
      doc = await BacSi.findOne({ _id: doctor_id, trang_thai_duyet: 'approved', la_hien: true })
        .populate('specialties', 'ten')
        .session(session)
      if (!doc) return rollbackFail(404, 'Bác sĩ không tồn tại hoặc chưa được duyệt')
    }

    // Verify member thuộc family của user
    if (member_id) {
      const family = await GiaDinh.findOne({ user_id: req.user.id }).select('_id').lean()
      if (!family) return rollbackFail(404, 'Chưa có nhóm gia đình')
      const member = await ThanhVien.findOne({ _id: member_id, family_id: family._id, ngay_xoa: null }).session(session).lean()
      if (!member) return rollbackFail(404, 'Không tìm thấy thành viên trong gia đình')
    }

    // Hạn giữ chỗ: mặc định 15', nhưng CO GIÃN theo khung (rule mục 11) — gán đặt sau khi
    // biết giờ khung, ngay trước khi claim slot.
    // `schedule_id`/`slot_id` của nhánh client không còn cần: khối tự gán phía
    // trên đã ghi thẳng vào `schedule_id`/`slot_id`.
    let paymentDeadline = getPaymentDeadline()
    let gia_kham, ten_dich_vu, phong_kham = null, gio_dat
    let chi_nhanh_id = null
    let specialty_id = null

    if (loai_kham === 'clinic') {
      const isAutoAllocated = !doctor_id || doctor_id === 'auto' || doctor_id === 'all'

      if (isAutoAllocated) {
        // Tự động phân bổ bác sĩ ít tải nhất (Least Load Allocation)
        const approvedDoctors = await BacSi.find({ trang_thai_duyet: 'approved', la_hien: true })
          .populate('specialties', 'ten')
          .session(session)
        const approvedDocMap = Object.fromEntries(approvedDoctors.map((d) => [d._id.toString(), d]))

        if (approvedDoctors.length === 0) {
          return rollbackFail(404, 'Không có bác sĩ khả dụng trên hệ thống')
        }

        const candidateSchedules = await LichLamViec.find({
          doctor_id: { $in: approvedDoctors.map((d) => d._id) },
          ngay: { $gte: appointmentDate, $lt: addDays(appointmentDate, 1) },
          trang_thai_ngay: 'lam_viec',
          trang_thai_xac_nhan: { $ne: 'tu_choi' },
        }).session(session)

        let matchingCandidates = []

        for (const schedule of candidateSchedules) {
          const doctorObj = approvedDocMap[schedule.doctor_id.toString()]
          if (!doctorObj) continue

          for (const slot of schedule.slots) {
            const isMatch = (slot_id && slot._id.toString() === slot_id.toString()) ||
                            (gio_kham && slot.gio_bat_dau === gio_kham) ||
                            (!slot_id && !gio_kham)
            if (
              isMatch &&
              slot.status === 'active' &&
              !slot.benh_nhan_id &&
              !slot.bi_khoa_boi_nghi_phep &&
              slot.loai_slot !== 'walk_in' &&
              !isSlotInPast(appointmentDate, slot.gio_bat_dau)
            ) {
              matchingCandidates.push({
                doctor: doctorObj,
                schedule,
                slot,
              })
            }
          }
        }

        if (matchingCandidates.length === 0) {
          return rollbackFail(409, 'Khung giờ này đã được đặt hết, vui lòng chọn khung giờ khác')
        }

        // Đếm số lịch hẹn hiện tại của từng bác sĩ ứng viên trong ngày để chọn người ít tải nhất (Least Load)
        const candidateDocIds = matchingCandidates.map((c) => c.doctor._id)
        const apptCounts = await LichHen.aggregate([
          {
            $match: {
              doctor_id: { $in: candidateDocIds },
              ngay_kham: { $gte: appointmentDate, $lt: addDays(appointmentDate, 1) },
              status: { $ne: 'cancelled' },
            },
          },
          { $group: { _id: '$doctor_id', count: { $sum: 1 } } },
        ]).session(session)

        const countMap = Object.fromEntries(apptCounts.map((a) => [a._id.toString(), a.count]))

        matchingCandidates.sort((a, b) => {
          const countA = countMap[a.doctor._id.toString()] || 0
          const countB = countMap[b.doctor._id.toString()] || 0
          return countA - countB
        })

        const selectedCandidate = matchingCandidates[0]
        doc = selectedCandidate.doctor
        schedule_id = selectedCandidate.schedule._id
        slot_id = selectedCandidate.slot._id
      } else {
        doc = await BacSi.findOne({ _id: doctor_id, trang_thai_duyet: 'approved', la_hien: true })
          .populate('specialties', 'ten')
          .session(session)
        if (!doc) return rollbackFail(404, 'Bác sĩ không tồn tại hoặc chưa được duyệt')
      }

      if (!schedule_id || !slot_id) {
        return rollbackFail(400, 'Khám tại phòng khám yêu cầu schedule_id và slot_id')
      }

      // Atomic claim slot để tránh double-booking
      const scheduleForValidation = await LichLamViec.findOne({
        _id: schedule_id,
        doctor_id: doc._id,
        ngay: { $gte: appointmentDate, $lt: addDays(appointmentDate, 1) },
        trang_thai_ngay: 'lam_viec',
        trang_thai_xac_nhan: { $ne: 'tu_choi' },
      }).session(session)

      if (!scheduleForValidation) {
        return rollbackFail(400, 'Lịch làm việc không hợp lệ cho ngày khám đã chọn')
      }

      const slotForValidation = scheduleForValidation.slots.id(slot_id)
      if (!slotForValidation) {
        return rollbackFail(400, 'Khung giờ không thuộc lịch làm việc đã chọn')
      }
      if (slotForValidation.status !== 'active' || slotForValidation.benh_nhan_id || slotForValidation.bi_khoa_boi_nghi_phep) {
        return rollbackFail(409, 'Slot đã được đặt, vui lòng chọn khung giờ khác')
      }
      if (slotForValidation.loai_slot === 'walk_in') {
        return rollbackFail(409, 'Slot này dành cho tiếp nhận tại chỗ, không thể đặt online')
      }
      if (isSlotInPast(appointmentDate, slotForValidation.gio_bat_dau)) {
        return rollbackFail(400, 'Khung giờ đã qua, vui lòng chọn khung giờ khác')
      }
      // Cutoff T-30' (rule muc 11). Quet lazy o getSlots da doi slot nay sang walk_in nen
      // dieu kien 'loai_slot' phia tren thuong da chan roi — nhung khach co the bam dat tu
      // mot trang mo truoc do, hoac quet chua kip chay. Kiem lai bang MOC THOI GIAN moi la
      // nguon su that, khong dua vao trang thai du lieu.
      if (daQuaCutoffOnline(appointmentDate, slotForValidation.gio_bat_dau)) {
        return rollbackFail(
          409,
          'Khung giờ này đã đóng đặt online (trước giờ khám 30 phút). Vui lòng chọn khung khác hoặc đến quầy lễ tân.',
        )
      }

      // Overflow chỉ kiểm soát lượt walk-in tại quầy. Lịch online được đặt trước,
      // nên không bị chặn chỉ vì ca hiện tại đang trễ hoặc đang nghỉ giữa ca.
      // Các điều kiện an toàn cho online vẫn được kiểm tra ở trên: slot còn trống,
      // chưa qua giờ khám và chưa qua cutoff đặt online.

      // Giu cho CO GIAN: min(15', T-15' − now). Cua so co dinh 15' se de giu cho chet QUA
      // moc T-15' roi moi nha — dung luc le tan da het quyen ban khung do, ghe trong ma
      // khong ai ngoi duoc (rule muc 11).
      const hanGiuCho = hanGiuChoCoGian(appointmentDate, slotForValidation.gio_bat_dau)
      if (!hanGiuCho) {
        return rollbackFail(409, 'Khung giờ này đã quá hạn giữ chỗ. Vui lòng chọn khung khác.')
      }
      paymentDeadline = hanGiuCho

      // ── Chan trung luot (rule muc 5) ────────────────────────────────────────
      // Thu tu QUAN TRONG: nha giu cho cu TRUOC, roi moi dem luot con lai. Nguoc lai thi
      // chinh giu cho bo do cua khach se chan khach dat lai — day dung la tinh huong da
      // sinh ra 2 lich hen trung slot tren DB that (do 2026-07-26, slot ...83c3e8).
      await nhaGiuChoCuCuaNguoiKham({
        userId: req.user.id,
        memberId: member_id || null,
        tenKhach: ten_khach,
        soDienThoaiKhach: so_dien_thoai_khach,
        bookingFor: booking_for,
        session,
      })

      const luotTrung = await timLuotTrungTrongNgay({
        userId: req.user.id,
        memberId: member_id || null,
        tenKhach: ten_khach,
        soDienThoaiKhach: so_dien_thoai_khach,
        bookingFor: booking_for,
        ngay: appointmentDate,
        session,
      })
      if (luotTrung) {
        return rollbackFail(
          409,
          `Người được khám đã có lịch ${luotTrung.ma_lich_hen ?? ''} lúc ${luotTrung.gio_kham} trong ngày này. `
          + 'Mỗi người chỉ được đặt 1 lịch khám / ngày — vui lòng chọn ngày khác hoặc hủy lịch cũ.',
        )
      }

      // ⚠️ PHAI gói mọi điều kiện về slot trong MỘT $elemMatch. Viết rời từng khoá
      // ('slots._id', 'slots.status', ...) thì Mongo cho phép mỗi điều kiện khớp một PHẦN TỬ
      // KHÁC NHAU của mảng: chỉ cần trong ngày còn bất kỳ slot nào 'active' là điều kiện
      // status đã thoả, rồi toán tử `$` lại trỏ về phần tử khớp ĐẦU TIÊN — tức slot đang
      // pending_payment của người khác vẫn có thể bị cướp. (rule mục 9, P0)
      const updated = await LichLamViec.findOneAndUpdate(
        {
          _id:                  schedule_id,
          doctor_id:            doc._id,
          ngay: { $gte: appointmentDate, $lt: addDays(appointmentDate, 1) },
          trang_thai_ngay: 'lam_viec',
          trang_thai_xac_nhan: { $ne: 'tu_choi' },
          slots: {
            $elemMatch: {
              _id:          new mongoose.Types.ObjectId(String(slot_id)),
              status:       'active',
              benh_nhan_id: null,
              bi_khoa_boi_nghi_phep: { $ne: true },
              loai_slot:    { $ne: 'walk_in' },
            },
          },
        },
        {
          $set: {
            'slots.$.status': 'pending_payment',
            'slots.$.benh_nhan_id': req.user.id,
            'slots.$.pending_expired_at': paymentDeadline,
          },
        },
        { new: true, session },
      )
      if (!updated) return rollbackFail(409, 'Slot đã được đặt, vui lòng chọn khung giờ khác')

      const claimedSlot = updated.slots.id(slot_id)
      // Slot cũ (sinh trước khi có `phong_id` từ mẫu ca) chưa có phòng -> lấy phòng mặc
      // định của bác sĩ. KHÔNG hardcode tên phòng: thà để null còn hơn in cho bệnh nhân
      // một phòng không tồn tại rồi họ đi tìm không thấy.
      phong_kham = claimedSlot.phong_kham || doc.phong_kham_mac_dinh || null
      gio_dat    = claimedSlot.gio_bat_dau
      chi_nhanh_id = updated.chi_nhanh_id ?? doc.chi_nhanh_id ?? null
      specialty_id = claimedSlot.specialty_id ?? doc.specialties?.[0]?._id ?? null

      // GIÁ theo CHUYÊN KHOA, không theo bác sĩ (rule mục 12). Hệ thống tự gán bác sĩ nên
      // giá nhảy theo người khám sẽ sinh khiếu nại "sao người kia khám rẻ hơn tôi" —
      // khách đâu có chọn ai. `BacSi.gia_kham` giữ lại nhưng không dùng để tính tiền.
      try {
        const bangGia = await layGiaKhamChuyenKhoa(specialty_id, session)
        gia_kham = bangGia.gia_kham
        ten_dich_vu = bangGia.ten_chuyen_khoa
      } catch (err) {
        return rollbackFail(err.statusCode ?? 400, err.message)
      }
    }

    const booker = booking_for !== 'self'
      ? await NguoiDung.findById(req.user.id).select('ho_ten so_dien_thoai').session(session).lean()
      : null
    const appointmentCode = await nextAppointmentCode(session, new Date(ngay_kham))

    const [appointment] = await LichHen.create([{
      user_id:      req.user.id,
      member_id:    member_id    || null,
      doctor_id:    loai_kham === 'clinic' ? doc._id : null,
      schedule_id:  loai_kham === 'clinic' ? schedule_id  : null,
      slot_id:      loai_kham === 'clinic' ? slot_id      : null,
      service_id:   null,
      chi_nhanh_id,
      specialty_id,
      ma_lich_hen:  appointmentCode,
      loai_kham,
      hinh_thuc_dat_lich: 'patient',
      ngay_kham:    appointmentDate,
      gio_kham:     gio_dat,
      ly_do_kham:   ly_do_kham?.trim() || null,
      phong_kham:   loai_kham === 'clinic' ? phong_kham   : null,
      dia_chi_kham: null,
      status:         'pending',
      payment_status: 'unpaid',
      payment_deadline: paymentDeadline,
      gia_kham,
      ten_dich_vu,
      ten_khach:           ten_khach?.trim().replace(/\s+/g, ' ') || null,
      so_dien_thoai_khach: normalizeBookingPhone(so_dien_thoai_khach) || null,
      nam_sinh_khach:      nam_sinh_khach       || null,
      dat_ho:              booking_for !== 'self',
      nguoi_dat_ho_id:     booking_for !== 'self' ? req.user.id : null,
      nguoi_dat_ho_ten:    booking_for !== 'self' ? (booker?.ho_ten ?? null) : null,
      nguoi_dat_sdt:       booking_for !== 'self' ? (booker?.so_dien_thoai ?? null) : null,
      nguon: 'online',
      // Bằng chứng đồng ý điều khoản không hoàn tiền (rule mục 5) — lưu cùng lịch hẹn để
      // sau này đối chiếu được đúng bản điều khoản khách đã thấy.
      dieu_khoan_version: DIEU_KHOAN_VERSION,
      dieu_khoan_dong_y_luc: new Date(),
    }], { session })

    const invoiceDate = appointment.ngay_tao instanceof Date ? appointment.ngay_tao : new Date()
    const so_hoa_don = await nextInvoiceNumber(session, invoiceDate)

    const [invoice] = await HoaDon.create([{
      appointment_id: appointment._id,
      so_hoa_don,
      chi_nhanh_id,
      specialty_id,
      tong_tien_kham: gia_kham,
      chi_tiet_thu_phi: [
        {
          loai: 'phi_kham',
          ten: ten_dich_vu,
          so_tien: gia_kham,
          so_luong: 1,
          thanh_tien: gia_kham,
          ghi_chu: 'Phi dat lich online cho kham tai phong kham',
          created_at: new Date(),
        },
      ],
      tong_tien_phat_sinh: 0,
      tong_thanh_toan: gia_kham,
      trang_thai_hoa_don: 'chua_thanh_toan',
      ghi_chu_ke_toan: 'Tao tu luong dat lich online - cho xac nhan thanh toan',
    }], { session })

    const [payment] = await ThanhToan.create([{
      appointment_id: appointment._id,
      hoa_don_id: invoice._id,
      benh_nhan_id: req.user.id,
      so_tien: gia_kham,
      loai_thanh_toan: 'phi_dat_lich',
      phuong_thuc: req.body.phuong_thuc || 'chuyen_khoan',
      status: 'pending',
      ngay_thanh_toan: null,
      gateway_response: {
        provider: 'fake_gateway',
        created_from: 'patient_booking',
      },
    }], { session })

    await session.commitTransaction()
    session.endSession()
    emitDashboardRevenueChanged({
      ngay: invoice.created_at ?? invoiceDate,
      so_tien: invoice.tong_thanh_toan,
      loai: 'hoa_don',
    })
    emitAdminRealtime('admin:appointment_created', {
      appointment_id: appointment._id,
      payment_id: payment._id,
      invoice_id: invoice._id,
      doctor_id: appointment.doctor_id,
      schedule_id: appointment.schedule_id,
      slot_id: appointment.slot_id,
      ngay_kham: appointment.ngay_kham,
      gio_kham: appointment.gio_kham,
      status: appointment.status,
      payment_status: appointment.payment_status,
    })

    return created(res, {
      id:             appointment._id,
      appointment_id: appointment._id,
      invoice_id:     invoice._id,
      payment_id:     payment._id,
      so_hoa_don:     invoice.so_hoa_don,
      ma_giao_dich:   payment.ma_giao_dich,
      status:         appointment.status,
      payment_status: appointment.payment_status,
      payment_record_status: payment.status,
      invoice_status: invoice.trang_thai_hoa_don,
      gia_kham:       appointment.gia_kham,
      ten_dich_vu:    appointment.ten_dich_vu,
      ngay_kham:      appointment.ngay_kham,
      gio_kham:       appointment.gio_kham,
    }, 'Tao lich hen thanh cong, vui long tiep tuc xac nhan thanh toan')
  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/patient/booking/:id/cancel ──────────────────────────────────
// pending (home chưa được BS xác nhận): hủy tự do.
// confirmed (clinic auto-confirm hoặc home đã được BS xác nhận): chỉ hủy được nếu còn >24h
// trước giờ khám — trong vòng 24h phải gọi lễ tân (spec 2026-06-27 mục 7.1/7.3).
export async function cancelBooking(req, res) {
  try {
    const a = await LichHen.findOne({ _id: req.params.id, user_id: req.user.id })
    if (!a) return fail(res, 404, 'Không tìm thấy lịch hẹn')
    if (['completed', 'cancelled'].includes(a.status)) {
      return fail(res, 409, 'Lịch hẹn không thể hủy ở trạng thái hiện tại')
    }
    // gio_kham la gio phong kham (UTC+7). Truoc day dung setHours() truc tiep — duoi TZ=UTC
    // (config/timezone.js) no chinh la setUTCHours nen lech 7 tieng, chan huy sai thoi diem.
    const gioKham = buildSlotDateTime(a.ngay_kham, a.gio_kham)

    if (!gioKham || gioKham.getTime() < Date.now()) {
      return fail(res, 400, 'Không thể hủy lịch hẹn đã qua thời gian khám')
    }

    if (a.payment_status === 'paid') {
      return fail(res, 400, 'Lịch hẹn đã thanh toán không thể tự hủy trên ứng dụng, vui lòng liên hệ hotline phòng khám để được hỗ trợ hoàn tiền')
    }

    const diffMs = gioKham.getTime() - Date.now()
    const isWithin24h = diffMs < 24 * 3600 * 1000

    let refundPolicyNote = ''
    if (a.payment_status === 'paid') {
      refundPolicyNote = isWithin24h 
        ? ' (Hoàn tiền 50% theo chính sách hủy < 24h)' 
        : ' (Hoàn tiền 100% theo chính sách hủy > 24h)'
    }

    const reason = (req.body.ly_do?.trim() || 'Bệnh nhân hủy lịch') + refundPolicyNote
    const { appointment } = await withOptionalTransaction((session) =>
      cancelAppointmentWithPaymentSync({
        appointmentId: a._id,
        actorUserId: req.user.id,
        actorRole: 'user',
        channel: 'patient_cancel',
        reason,
        session,
      })
    )
    emitDashboardAppointmentChanged(a.status, appointment.status)

    return ok(res, { id: appointment._id, status: appointment.status, payment_status: appointment.payment_status }, 'Da huy lich hen')

    /*
    a.status          = 'cancelled'
    a.ly_do_huy       = req.body.ly_do?.trim() || 'Bệnh nhân hủy lịch'
    a.payment_deadline = null
    if (a.payment_status === 'paid') a.payment_status = 'refunded'
    await a.save()
    */

    return ok(res, { id: a._id, status: a.status, payment_status: a.payment_status }, 'Đã hủy lịch hẹn')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── GET /api/patient/booking/doctors/:id/reviews ───────────────────────────
export async function getDoctorReviews(req, res) {
  try {
    const doctorId = req.params.id
    const reviews = await DanhGia.find({ doctor_id: doctorId, status: 'visible', ngay_xoa: null })
      .populate('user_id', 'ho_ten')
      .sort({ ngay_tao: -1 })
      .lean()
    
    return ok(res, reviews.map((r) => ({
      id: r._id,
      benh_nhan: r.user_id?.ho_ten || 'Bệnh nhân ẩn danh',
      so_sao: r.so_sao,
      noi_dung: r.noi_dung,
      ngay_tao: r.ngay_tao,
    })))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── POST /api/patient/booking/doctors/:id/reviews ──────────────────────────
export async function createDoctorReview(req, res) {
  try {
    const doctorId = req.params.id
    const userId = req.user.id
    const { so_sao, noi_dung } = req.body

    if (!so_sao || so_sao < 1 || so_sao > 5) {
      return fail(res, 400, 'Số sao phải từ 1 đến 5')
    }

    // 1. Tìm lịch hẹn ĐÃ HOÀN THÀNH của người dùng này với bác sĩ này
    //    Chỉ lịch hẹn status='completed' mới đủ điều kiện đánh giá
    const appointments = await LichHen.find({
      user_id: userId,
      doctor_id: doctorId,
      status: 'completed',
    }).lean()

    if (appointments.length === 0) {
      return fail(res, 400, 'Bạn cần có ít nhất một lịch hẹn đã hoàn thành với bác sĩ này để viết đánh giá.')
    }

    // 2. Tìm lịch hẹn chưa được đánh giá
    let unreviewedAppointment = null
    for (const appt of appointments) {
      const existingReview = await DanhGia.findOne({ appointment_id: appt._id })
      if (!existingReview) {
        unreviewedAppointment = appt
        break
      }
    }

    if (!unreviewedAppointment) {
      return fail(res, 400, 'Bạn đã đánh giá tất cả các lịch hẹn với bác sĩ này.')
    }

    // 3. Tạo đánh giá mới
    const review = await DanhGia.create({
      appointment_id: unreviewedAppointment._id,
      user_id: userId,
      doctor_id: doctorId,
      so_sao: parseInt(so_sao),
      noi_dung: noi_dung || '',
      status: 'visible'
    })

    // 4. Cập nhật lại số sao trung bình & tổng số đánh giá của bác sĩ
    const result = await DanhGia.aggregate([
      {
        $match: {
          doctor_id: new mongoose.Types.ObjectId(doctorId),
          status: 'visible',
          ngay_xoa: null,
        },
      },
      {
        $group: {
          _id: '$doctor_id',
          trungBinhSao: { $avg: { $ifNull: ['$chi_tiet.danh_gia_bac_si', '$so_sao'] } },
          tongSo: { $sum: 1 },
        },
      },
    ])

    const info = result[0] || { trungBinhSao: 0, tongSo: 0 }
    const roundedRating = Math.round(info.trungBinhSao * 10) / 10

    await BacSi.updateOne(
      { _id: doctorId },
      {
        $set: {
          diem_danh_gia: roundedRating,
          tong_danh_gia: info.tongSo,
        },
      }
    )

    return ok(res, {
      id: review._id,
      so_sao: review.so_sao,
      noi_dung: review.noi_dung,
      ngay_tao: review.ngay_tao
    }, 'Đã gửi đánh giá thành công')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
