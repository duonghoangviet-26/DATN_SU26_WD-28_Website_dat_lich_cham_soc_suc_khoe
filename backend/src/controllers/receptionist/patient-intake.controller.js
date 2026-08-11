import mongoose from 'mongoose'
import { GiaDinh, HangDoi, HoSoBenhNhan, LichHen, NguoiDung, NhatKyThaoTac, ThanhVien } from '../../models/index.js'
import { created, fail, ok } from '../../utils/response.js'
import { startOfDayUtc } from '../../utils/clinicTime.js'
import {
  layKhaNangTiepNhanTaiQuay,
  tiepNhanHoSoVaoHangDoi,
} from '../../services/offlineIntake.service.js'
import {
  tinhSucChuaHangDoiOfflineTrungTam,
  tiepNhanOfflineVaoHangDoiTrungTam,
} from '../../services/centralOfflineQueue.service.js'
import { layDongSuaGanNhatChoNhieuHoSo } from '../../services/receptionistTimeline.service.js'

function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('84')) return `0${digits.slice(2)}`
  return digits
}

function normalizeName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function isValidPhone(phone) {
  return /^0\d{9,10}$/.test(phone)
}

export const ADMINISTRATIVE_PROFILE_FIELDS = [
  'ho_ten',
  'so_dien_thoai',
  'ngay_sinh',
  'gioi_tinh',
  'nhom_mau',
  'di_ung',
  'benh_nen',
  'dia_chi',
  'ghi_chu',
]

export const PROFESSIONAL_PROFILE_FIELDS = [
  'chan_doan',
  'ket_luan',
  'huong_dan_dieu_tri',
  'don_thuoc',
  'thuoc',
  'sinh_hieu',
  'ket_qua_kham',
  'trieu_chung_ban_dau',
  'ghi_chu_dieu_duong',
  'dich_vu_phat_sinh',
  'chi_dinh',
]

const UPDATE_REASON_FIELDS = ['ly_do', 'ly_do_cap_nhat']

function trimOrNull(value) {
  const text = String(value ?? '').trim()
  return text || null
}

function normalizeOptionalDate(value) {
  if (value === null || value === '') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error('Ngay sinh khong hop le'), { statusCode: 400 })
  }
  return date
}

export function normalizeAdministrativeProfileUpdate(body = {}) {
  const ly_do = String(body.ly_do_cap_nhat ?? body.ly_do ?? '').trim()
  if (!ly_do) {
    throw Object.assign(new Error('Can nhap ly do cap nhat ho so'), { statusCode: 400 })
  }

  const allowed = new Set([...ADMINISTRATIVE_PROFILE_FIELDS, ...UPDATE_REASON_FIELDS])
  const invalidFields = Object.keys(body).filter((key) => !allowed.has(key))
  const professionalFields = invalidFields.filter((key) => PROFESSIONAL_PROFILE_FIELDS.includes(key))
  if (professionalFields.length) {
    throw Object.assign(new Error(`Le tan khong duoc cap nhat truong chuyen mon: ${professionalFields.join(', ')}`), {
      statusCode: 403,
    })
  }
  if (invalidFields.length) {
    throw Object.assign(new Error(`Truong khong duoc phep cap nhat: ${invalidFields.join(', ')}`), { statusCode: 403 })
  }

  const update = {}
  if (Object.prototype.hasOwnProperty.call(body, 'ho_ten')) {
    const ho_ten = String(body.ho_ten ?? '').trim().replace(/\s+/g, ' ')
    if (!ho_ten) throw Object.assign(new Error('Ho ten la bat buoc'), { statusCode: 400 })
    update.ho_ten = ho_ten
  }
  if (Object.prototype.hasOwnProperty.call(body, 'so_dien_thoai')) {
    const so_dien_thoai = normalizePhone(body.so_dien_thoai)
    if (!isValidPhone(so_dien_thoai)) {
      throw Object.assign(new Error('So dien thoai khong dung dinh dang'), { statusCode: 400 })
    }
    update.so_dien_thoai = so_dien_thoai
    update.so_dien_thoai_tim_kiem = so_dien_thoai
  }
  if (Object.prototype.hasOwnProperty.call(body, 'ngay_sinh')) {
    update.ngay_sinh = normalizeOptionalDate(body.ngay_sinh)
  }
  if (Object.prototype.hasOwnProperty.call(body, 'gioi_tinh')) {
    const gioi_tinh = body.gioi_tinh === null || body.gioi_tinh === '' ? null : body.gioi_tinh
    if (gioi_tinh && !['nam', 'nu', 'khac'].includes(gioi_tinh)) {
      throw Object.assign(new Error('Gioi tinh khong hop le'), { statusCode: 400 })
    }
    update.gioi_tinh = gioi_tinh
  }
  if (Object.prototype.hasOwnProperty.call(body, 'nhom_mau')) {
    const nhom_mau = body.nhom_mau === null || body.nhom_mau === '' ? null : body.nhom_mau
    if (nhom_mau && !['A', 'B', 'AB', 'O'].includes(nhom_mau)) {
      throw Object.assign(new Error('Nhom mau khong hop le'), { statusCode: 400 })
    }
    update.nhom_mau = nhom_mau
  }
  for (const field of ['di_ung', 'benh_nen', 'dia_chi', 'ghi_chu']) {
    if (Object.prototype.hasOwnProperty.call(body, field)) update[field] = trimOrNull(body[field])
  }

  return { ly_do, update }
}

function comparableValue(value) {
  if (value instanceof Date) return value.toISOString()
  if (value && typeof value.toISOString === 'function') return value.toISOString()
  if (value === undefined) return null
  return value
}

export function buildAdministrativeProfileAuditDiff(profile, update) {
  const du_lieu_cu = {}
  const du_lieu_moi = {}
  const changed_fields = []
  for (const [field, nextValue] of Object.entries(update)) {
    if (field === 'so_dien_thoai_tim_kiem') continue
    const previousValue = profile[field] ?? null
    if (comparableValue(previousValue) === comparableValue(nextValue)) continue
    changed_fields.push(field)
    du_lieu_cu[field] = previousValue
    du_lieu_moi[field] = nextValue
  }
  return { changed_fields, du_lieu_cu, du_lieu_moi }
}

function phoneVariants(phone) {
  const normalized = normalizePhone(phone)
  return [...new Set([normalized, normalized.startsWith('0') ? `84${normalized.slice(1)}` : normalized])]
}

function serializeAccount(account) {
  if (!account) return null
  const providers = Array.isArray(account.providers) ? account.providers : []
  const coGoogle = providers.includes('google')
  const coEmail = providers.includes('local')
  return {
    id: String(account._id),
    email: account.email,
    ho_ten: account.ho_ten,
    so_dien_thoai: account.so_dien_thoai ?? null,
    providers,
    phuong_thuc_dang_nhap: coGoogle && coEmail ? 'google_va_email' : coGoogle ? 'google' : 'email',
    email_verified: Boolean(account.email_verified),
  }
}

function serializeProfile(profile) {
  return {
    id: String(profile._id),
    ho_ten: profile.ho_ten,
    so_dien_thoai: profile.so_dien_thoai,
    ngay_sinh: profile.ngay_sinh,
    gioi_tinh: profile.gioi_tinh,
    nhom_mau: profile.nhom_mau,
    di_ung: profile.di_ung,
    benh_nen: profile.benh_nen,
    dia_chi: profile.dia_chi,
    ghi_chu: profile.ghi_chu,
    nguon_tao: profile.nguon_tao,
    tai_khoan_id: profile.tai_khoan_id,
    nguoi_giam_ho_id: profile.nguoi_giam_ho_id,
    tai_khoan: serializeAccount(profile.tai_khoan_online),
    loai_lien_ket_tai_khoan: profile.loai_lien_ket_tai_khoan ?? null,
    member_id: profile.member_id,
    trang_thai: profile.trang_thai,
    nguoi_lien_he: profile.nguoi_lien_he ?? null,
    quan_he: profile.quan_he ?? null,
    nhom_gia_dinh: profile.nhom_gia_dinh ?? null,
    lich_hen_hom_nay: profile.lich_hen_hom_nay ?? [],
    luot_dang_cho_hom_nay: profile.luot_dang_cho_hom_nay ?? null,
    sua_gan_nhat: profile.sua_gan_nhat ?? null,
    lich_su_kham: profile.lich_su_kham ?? null,
  }
}

// E-10 — "khám lần thứ N". Gộp HAI nguồn hoàn thành:
//   - HangDoi.trang_thai='hoan_thanh': mốc bác sĩ bấm "hoàn thành khám", xảy ra cho MỌI lượt
//     (walk-in lẫn có lịch hẹn) — nguồn chính, không phân biệt appointment_id.
//   - LichHen.status='completed': chỉ dùng cho lịch hẹn KHÔNG có HangDoi hoàn thành tương ứng
//     (dữ liệu cũ trước khi luồng check-in hợp nhất — mục 9). Nếu không loại trừ theo
//     appointment_id đã có trong HangDoi thì MỘT lượt khám qua LichHen sẽ bị đếm hai lần vì
//     bác sĩ luôn đi qua HangDoi.hoan_thanh trước khi hồ sơ khám mới chuyển 'completed'.
export function gomLichSuKham(hangDoiHoanThanh, lichHenHoanThanh, profileIds) {
  const coveredAppointmentIds = new Set(
    hangDoiHoanThanh.filter((entry) => entry.appointment_id).map((entry) => String(entry.appointment_id)),
  )
  const visitsByProfile = new Map(profileIds.map((id) => [String(id), []]))

  for (const entry of hangDoiHoanThanh) {
    const key = String(entry.ho_so_benh_nhan_id)
    visitsByProfile.get(key)?.push({
      ngay: entry.thoi_diem_ket_thuc ?? entry.checkin_time,
      bac_si: entry.doctor_id?.user_id?.ho_ten ?? null,
    })
  }
  for (const appointment of lichHenHoanThanh) {
    if (coveredAppointmentIds.has(String(appointment._id))) continue
    const key = String(appointment.ho_so_benh_nhan_id)
    visitsByProfile.get(key)?.push({
      ngay: appointment.ngay_kham,
      bac_si: appointment.doctor_id?.user_id?.ho_ten ?? null,
    })
  }

  const result = new Map()
  for (const [key, visits] of visitsByProfile) {
    if (visits.length === 0) { result.set(key, null); continue }
    visits.sort((a, b) => new Date(b.ngay).getTime() - new Date(a.ngay).getTime())
    result.set(key, { so_lan: visits.length, lan_gan_nhat: visits[0].ngay, bac_si_gan_nhat: visits[0].bac_si })
  }
  return result
}

async function layLichSuKhamChoNhieuHoSo(profileIds) {
  if (profileIds.length === 0) return new Map()
  const doctorPopulate = { path: 'doctor_id', select: 'user_id', populate: { path: 'user_id', select: 'ho_ten' } }
  const [hangDoiHoanThanh, lichHenHoanThanh] = await Promise.all([
    HangDoi.find({ ho_so_benh_nhan_id: { $in: profileIds }, trang_thai: 'hoan_thanh' })
      .select('ho_so_benh_nhan_id appointment_id doctor_id thoi_diem_ket_thuc checkin_time')
      .populate(doctorPopulate)
      .lean(),
    LichHen.find({ ho_so_benh_nhan_id: { $in: profileIds }, status: 'completed' })
      .select('ho_so_benh_nhan_id doctor_id ngay_kham')
      .populate(doctorPopulate)
      .lean(),
  ])
  return gomLichSuKham(hangDoiHoanThanh, lichHenHoanThanh, profileIds)
}

function khoangHomNay(now = new Date()) {
  const start = startOfDayUtc(now)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start, end }
}

function serializeAppointment(appointment) {
  return {
    id: String(appointment._id),
    tai_khoan_id: appointment.user_id ? String(appointment.user_id._id ?? appointment.user_id) : null,
    ma_lich_hen: appointment.ma_lich_hen ?? null,
    ngay_kham: appointment.ngay_kham,
    gio_kham: appointment.gio_kham,
    gio_ket_thuc: appointment.gio_ket_thuc ?? null,
    status: appointment.status,
    payment_status: appointment.payment_status,
    ten_khach: appointment.ten_khach ?? null,
    so_dien_thoai_khach: appointment.so_dien_thoai_khach ?? null,
    nam_sinh_khach: appointment.nam_sinh_khach ?? null,
    nguon: appointment.nguon ?? (appointment.hinh_thuc_dat_lich === 'receptionist' ? 'tai_cho' : 'online'),
    doctor: appointment.doctor_id
      ? {
          id: String(appointment.doctor_id._id ?? appointment.doctor_id),
          ho_ten: appointment.doctor_id.user_id?.ho_ten ?? null,
        }
      : null,
    chuyen_khoa: appointment.specialty_id
      ? { id: String(appointment.specialty_id._id ?? appointment.specialty_id), ten: appointment.specialty_id.ten ?? null }
      : null,
    phong_kham: appointment.phong_kham ?? null,
  }
}

function appointmentMatchesProfile(appointment, profile) {
  const profileId = String(profile._id)
  if (appointment.ho_so_benh_nhan_id && String(appointment.ho_so_benh_nhan_id) === profileId) return true
  if (appointment.member_id && profile.member_id && String(appointment.member_id) === String(profile.member_id)) return true

  // `user_id` tren lich dat ho la nguoi dat, khong phai nguoi kham. Chi dung no de
  // gan lich tu dat cho ban than khi lich khong co member/dat_ho rieng.
  const isProxyAppointment = Boolean(appointment.member_id || appointment.nguoi_dat_ho_id)
  if (!isProxyAppointment && appointment.user_id && profile.tai_khoan_id
    && String(appointment.user_id) === String(profile.tai_khoan_id)) return true

  return false
}

export const searchPatientProfiles = async (req, res) => {
  try {
    const phone = normalizePhone(req.query.phone)
    if (!isValidPhone(phone)) {
      return fail(res, 400, 'Số điện thoại không đúng định dạng')
    }

    const phoneAccounts = await NguoiDung.find({
      role: { $in: ['user', 'patient'] },
      status: 'active',
      ngay_xoa: null,
      so_dien_thoai: { $in: phoneVariants(phone) },
    }).select('_id').lean()
    const phoneAccountIds = phoneAccounts.map((account) => account._id)
    const profileIdentityFilters = [
      { so_dien_thoai_tim_kiem: phone },
      ...(phoneAccountIds.length
        ? [{ tai_khoan_id: { $in: phoneAccountIds } }, { nguoi_giam_ho_id: { $in: phoneAccountIds } }]
        : []),
    ]
    const profiles = await HoSoBenhNhan.find({
      trang_thai: 'active',
      $or: profileIdentityFilters,
    })
      .sort({ ho_ten: 1, ngay_tao: 1 })
      .lean()

    const { start, end } = khoangHomNay()
    const profileIds = profiles.map((profile) => profile._id)
    const memberIds = profiles.filter((profile) => profile.member_id).map((profile) => profile.member_id)
    const profileAccountIds = profiles
      .flatMap((profile) => [profile.tai_khoan_id, profile.nguoi_giam_ho_id])
      .filter(Boolean)

    const [members] = await Promise.all([
      memberIds.length
        ? ThanhVien.find({ _id: { $in: memberIds } }).select('ho_ten quan_he la_chu_ho tai_khoan_id family_id ngay_sinh gioi_tinh nhom_mau di_ung benh_nen').lean()
        : [],
    ])

    const memberById = new Map(members.map((member) => [String(member._id), member]))
    const familyIds = members.map((member) => member.family_id).filter(Boolean)
    const familyRows = familyIds.length
      ? await GiaDinh.find({ _id: { $in: familyIds } }).select('user_id ten_nhom').lean()
      : []
    const familyById = new Map(familyRows.map((family) => [String(family._id), family]))
    const accountIds = [...new Set([
      ...profileAccountIds.map(String),
      ...phoneAccountIds.map(String),
      ...members.map((member) => member.tai_khoan_id).filter(Boolean).map(String),
      ...familyRows.map((family) => family.user_id).filter(Boolean).map(String),
    ])]
    const accountRows = await NguoiDung.find({
      role: { $in: ['user', 'patient'] },
      status: 'active',
      ngay_xoa: null,
      $or: [
        ...(accountIds.length ? [{ _id: { $in: accountIds } }] : []),
        { so_dien_thoai: { $in: phoneVariants(phone) } },
      ],
    }).select('ho_ten email so_dien_thoai providers email_verified last_login_provider').lean()
    const accountById = new Map(accountRows.map((account) => [String(account._id), account]))

    for (const profile of profiles) {
      const member = profile.member_id ? memberById.get(String(profile.member_id)) : null
      const family = member?.family_id ? familyById.get(String(member.family_id)) : null
      profile.ngay_sinh ??= member?.ngay_sinh ?? null
      profile.gioi_tinh ??= member?.gioi_tinh ?? null
      profile.nhom_mau ??= member?.nhom_mau ?? null
      profile.di_ung ??= member?.di_ung ?? null
      profile.benh_nen ??= member?.benh_nen ?? null
      const contactId = profile.tai_khoan_id
        ?? profile.nguoi_giam_ho_id
        ?? member?.tai_khoan_id
        ?? family?.user_id
      const contact = contactId ? accountById.get(String(contactId)) : null
      profile.tai_khoan_online = contact
      profile.loai_lien_ket_tai_khoan = profile.tai_khoan_id
        ? 'benh_nhan'
        : (profile.nguoi_giam_ho_id || member?.tai_khoan_id || family?.user_id ? 'nguoi_dat_ho' : null)
      profile.nguoi_lien_he = contact
        ? { id: String(contact._id), ho_ten: contact.ho_ten, so_dien_thoai: contact.so_dien_thoai ?? null }
        : null
      profile.quan_he = member?.la_chu_ho ? 'ban_than' : (member?.quan_he ?? null)
      profile.nhom_gia_dinh = family?.ten_nhom ?? null
    }

    const appointmentSelect = 'ma_lich_hen ngay_kham gio_kham gio_ket_thuc status payment_status nguon hinh_thuc_dat_lich doctor_id specialty_id phong_kham ho_so_benh_nhan_id member_id user_id nguoi_dat_ho_id so_dien_thoai_khach ten_khach nam_sinh_khach'
    const appointmentPopulate = (query) => query
      .select(appointmentSelect)
      .populate({ path: 'doctor_id', select: 'user_id', populate: { path: 'user_id', select: 'ho_ten' } })
      .populate('specialty_id', 'ten')
      .sort({ gio_kham: 1 })

    const appointmentQuery = {
      loai_kham: 'clinic',
      ngay_kham: { $gte: start, $lt: end },
      status: { $nin: ['cancelled', 'no_show', 'completed', 'skipped'] },
      $or: [
        ...(profileIds.length ? [{ ho_so_benh_nhan_id: { $in: profileIds } }] : []),
        ...(memberIds.length ? [{ member_id: { $in: memberIds } }] : []),
        ...(accountIds.length ? [{ user_id: { $in: accountIds } }, { nguoi_dat_ho_id: { $in: accountIds } }] : []),
        { so_dien_thoai_khach: phone },
      ],
    }

    const [appointments, activeQueues, accountAppointments] = await Promise.all([
      appointmentPopulate(LichHen.find(appointmentQuery)).lean(),
      profileIds.length
        ? HangDoi.find({
            ho_so_benh_nhan_id: { $in: profileIds },
            checkin_time: { $gte: start, $lt: end },
            trang_thai: { $in: ['cho_dieu_phoi', 'dang_cho', 'da_goi', 'trong_phong', 'cho_dich_vu'] },
        }).select('_id ho_so_benh_nhan_id appointment_id trang_thai specialty_id doctor_id phong_kham gio_hen_goc checkin_time so_thu_tu_checkin ma_so_thu_tu').lean()
        : [],
      accountIds.length
        ? appointmentPopulate(LichHen.find({
            loai_kham: 'clinic',
            ngay_kham: { $gte: start, $lt: end },
            // Chỉ đưa lịch còn hiệu lực vào luồng tiếp đón. Lịch đã hủy/không đến/hoàn tất
            // không phải là lịch có thể check-in nên không hiển thị ở đây.
            status: { $in: ['pending', 'confirmed', 'checked_in', 'in_progress', 'waiting_record', 'waiting_doctor_confirm'] },
            $or: [
              { user_id: { $in: accountIds } },
              { nguoi_dat_ho_id: { $in: accountIds } },
              { so_dien_thoai_khach: phone },
            ],
          })).lean()
        : [],
    ])

    const legacyPhoneAppointments = appointments.filter((appointment) =>
      !appointment.ho_so_benh_nhan_id
      && !appointment.member_id
      && !appointment.user_id
      && !appointment.nguoi_dat_ho_id
      && normalizePhone(appointment.so_dien_thoai_khach) === phone,
    )

    // Gom "sửa gần nhất" cho CẢ danh sách trong 1 truy vấn — tránh N+1 (E-1).
    const suaGanNhatByProfile = await layDongSuaGanNhatChoNhieuHoSo(profiles)
    // Gom "khám lần thứ N" cho CẢ danh sách trong 2 truy vấn — tránh N+1 (E-10).
    const lichSuKhamByProfile = await layLichSuKhamChoNhieuHoSo(profileIds)

    for (const profile of profiles) {
      const related = appointments.filter((appointment) => appointmentMatchesProfile(appointment, profile))
      // Chỉ tự gắn lịch cũ theo SĐT khi số này chỉ có đúng một hồ sơ. Nếu có nhiều hồ sơ,
      // không được đoán người bệnh — lễ tân phải chọn bằng mã lịch/họ tên/ngày sinh.
      if (profiles.length === 1) related.push(...legacyPhoneAppointments)
      profile.lich_hen_hom_nay = [...new Map(related.map((item) => [String(item._id), serializeAppointment(item)])).values()]
      const queue = activeQueues.find((item) => String(item.ho_so_benh_nhan_id) === String(profile._id))
      profile.luot_dang_cho_hom_nay = queue
        ? {
            id: String(queue._id),
            trang_thai: queue.trang_thai,
            specialty_id: queue.specialty_id ? String(queue.specialty_id) : null,
            doctor_id: queue.doctor_id ? String(queue.doctor_id) : null,
            phong_kham: queue.phong_kham ?? null,
            checkin_time: queue.checkin_time,
            so_thu_tu_checkin: queue.so_thu_tu_checkin ?? null,
            ma_so_thu_tu: queue.ma_so_thu_tu ?? null,
          }
        : null
      profile.sua_gan_nhat = suaGanNhatByProfile.get(String(profile._id)) ?? null
      profile.lich_su_kham = lichSuKhamByProfile.get(String(profile._id)) ?? null
    }

    const ambiguousAppointments = profiles.length > 1
      ? legacyPhoneAppointments.map(serializeAppointment)
      : []

    return ok(res, {
      phone,
      profiles: profiles.map(serializeProfile),
      accounts: accountRows.map(serializeAccount),
      account_appointments: accountAppointments.map(serializeAppointment),
      total: profiles.length,
      can_tao_moi: true,
      ambiguous_appointments: ambiguousAppointments,
      checked_at: new Date(),
    })
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const createPatientProfile = async (req, res) => {
  try {
    const {
      ho_ten: rawName,
      so_dien_thoai: rawPhone,
      ngay_sinh,
      gioi_tinh,
      nhom_mau,
      di_ung,
      benh_nen,
      dia_chi,
      ghi_chu,
      tai_khoan_id,
    } = req.body
    const ho_ten = String(rawName ?? '').trim().replace(/\s+/g, ' ')
    const so_dien_thoai = normalizePhone(rawPhone)

    if (!ho_ten) return fail(res, 400, 'Họ tên là bắt buộc')
    if (!isValidPhone(so_dien_thoai)) return fail(res, 400, 'Số điện thoại không đúng định dạng')
    if (gioi_tinh && !['nam', 'nu', 'khac'].includes(gioi_tinh)) {
      return fail(res, 400, 'Giới tính không hợp lệ')
    }

    if (nhom_mau && !['A', 'B', 'AB', 'O'].includes(nhom_mau)) {
      return fail(res, 400, 'NhÃ³m mÃ¡u khÃ´ng há»£p lá»‡')
    }

    if (ngay_sinh && Number.isNaN(new Date(ngay_sinh).getTime())) {
      return fail(res, 400, 'Ngày sinh không hợp lệ')
    }

    let linkedAccount = null
    if (tai_khoan_id) {
      if (!mongoose.Types.ObjectId.isValid(tai_khoan_id)) return fail(res, 400, 'Mã tài khoản không hợp lệ')
      linkedAccount = await NguoiDung.findOne({
        _id: tai_khoan_id,
        role: { $in: ['user', 'patient'] },
        status: 'active',
        ngay_xoa: null,
      }).lean()
      if (!linkedAccount) return fail(res, 404, 'Không tìm thấy tài khoản bệnh nhân đang hoạt động')
      if (linkedAccount.so_dien_thoai && !phoneVariants(linkedAccount.so_dien_thoai).includes(so_dien_thoai)) {
        return fail(res, 409, 'Số điện thoại hồ sơ không khớp với tài khoản đã chọn')
      }
    }

    // Không gộp tự động chỉ vì trùng số điện thoại; một người giám hộ có thể
    // dùng cùng số cho nhiều hồ sơ. Chỉ cảnh báo khi dữ liệu nhận diện trùng hẳn.
    const duplicate = await HoSoBenhNhan.findOne({
      so_dien_thoai_tim_kiem: so_dien_thoai,
      trang_thai: 'active',
      ho_ten: { $regex: `^${ho_ten.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      ...(ngay_sinh ? { ngay_sinh: new Date(ngay_sinh) } : {}),
    }).lean()

    if (duplicate) {
      return fail(res, 409, `Hồ sơ đã tồn tại: ${duplicate._id}`)
    }

    const profile = await HoSoBenhNhan.create({
      ho_ten,
      so_dien_thoai,
      so_dien_thoai_tim_kiem: so_dien_thoai,
      ngay_sinh: ngay_sinh ? new Date(ngay_sinh) : null,
      gioi_tinh: gioi_tinh || null,
      nhom_mau: nhom_mau || null,
      di_ung: di_ung?.trim() || null,
      benh_nen: benh_nen?.trim() || null,
      dia_chi: dia_chi?.trim() || null,
      ghi_chu: ghi_chu?.trim() || null,
      // Khong tu dong gan tai khoan theo so dien thoai vi day co the la so cua nguoi giam ho.
      tai_khoan_id: linkedAccount?._id ?? null,
      nguon_tao: 'tai_quay',
      trang_thai: 'active',
    })

    return created(res, { profile: serializeProfile({ ...profile.toObject(), tai_khoan_online: linkedAccount }) }, 'Đã tạo hồ sơ bệnh nhân')
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return fail(res, 400, error.message)
    }
    return fail(res, 500, error.message)
  }
}

export const updatePatientProfileAdministrative = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 400, 'Ma ho so benh nhan khong hop le')
    }

    const profile = await HoSoBenhNhan.findOne({ _id: req.params.id, trang_thai: 'active' })
    if (!profile) return fail(res, 404, 'Khong tim thay ho so benh nhan dang hoat dong')

    const { ly_do, update } = normalizeAdministrativeProfileUpdate(req.body)
    const diff = buildAdministrativeProfileAuditDiff(profile, update)
    if (diff.changed_fields.length === 0) {
      return fail(res, 400, 'Khong co thong tin ho so nao thay doi')
    }

    const updated = await HoSoBenhNhan.findOneAndUpdate(
      { _id: profile._id, trang_thai: 'active' },
      { $set: update },
      { new: true, runValidators: true },
    ).lean()

    const actorRole = req.user?.role === 'admin' ? 'admin' : 'receptionist'
    const audit = await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: req.user?._id ?? req.user?.id ?? null,
      vai_tro: actorRole,
      hanh_dong: 'UPDATE_PATIENT_PROFILE_ADMINISTRATIVE',
      loai_doi_tuong: 'patient_profile',
      doi_tuong_id: profile._id,
      ly_do,
      du_lieu_cu: {
        changed_fields: diff.changed_fields,
        ...diff.du_lieu_cu,
      },
      du_lieu_moi: {
        changed_fields: diff.changed_fields,
        ...diff.du_lieu_moi,
      },
    })

    return ok(res, {
      profile: serializeProfile(updated),
      audit_id: String(audit._id),
      changed_fields: diff.changed_fields,
    }, 'Da cap nhat ho so benh nhan')
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return fail(res, 400, error.message)
    }
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

export const getOfflineAvailability = async (req, res) => {
  try {
    const data = await layKhaNangTiepNhanTaiQuay({
      specialtyId: req.query.specialty_id ?? null,
    })
    return ok(res, data)
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

export const getCentralOfflineCapacity = async (req, res) => {
  try {
    const data = await tinhSucChuaHangDoiOfflineTrungTam({
      specialtyId: req.query.specialty_id ?? null,
      includeNewPatient: String(req.query.include_new_patient ?? 'true') !== 'false',
    })
    return ok(res, data)
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

export const intakeCentralOfflineQueue = async (req, res) => {
  try {
    const result = await tiepNhanOfflineVaoHangDoiTrungTam({
      hoSoBenhNhanId: req.body.ho_so_benh_nhan_id,
      specialtyId: req.body.specialty_id,
      bacSiUuTienId: req.body.bac_si_uu_tien_id ?? null,
      lyDoUuTien: req.body.ly_do_uu_tien ?? null,
      mucUuTienTiepNhan: req.body.muc_uu_tien_tiep_nhan ?? 'binh_thuong',
      xacNhanCanhBao: Boolean(req.body.xac_nhan_canh_bao),
      actorUserId: req.user?._id ?? req.user?.id ?? null,
      actorRole: 'receptionist',
    })
    return created(res, result, 'Da tiep nhan khach vang lai vao hang doi trung tam')
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

export const checkInPatientProfile = async (req, res) => {
  try {
    const result = await tiepNhanHoSoVaoHangDoi({
      hoSoBenhNhanId: req.body.ho_so_benh_nhan_id,
      scheduleId: req.body.schedule_id ?? null,
      slotId: req.body.slot_id ?? null,
      actorUserId: req.user?._id ?? req.user?.id ?? null,
      actorRole: 'receptionist',
    })
    return created(res, result, 'Đã tiếp nhận bệnh nhân vào hàng đợi')
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}
