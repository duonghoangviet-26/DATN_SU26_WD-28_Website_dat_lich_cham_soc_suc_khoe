import mongoose from 'mongoose'
import { GiaDinh, HangDoi, HoSoBenhNhan, LichHen, NguoiDung, ThanhVien } from '../../models/index.js'
import { created, fail, ok } from '../../utils/response.js'
import { startOfDayUtc } from '../../utils/clinicTime.js'
import {
  layKhaNangTiepNhanTaiQuay,
  tiepNhanHoSoVaoHangDoi,
} from '../../services/offlineIntake.service.js'

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
  }
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
  return [
    appointment.ho_so_benh_nhan_id,
    appointment.member_id && profile.member_id,
    appointment.user_id && profile.tai_khoan_id,
    appointment.nguoi_dat_ho_id && profile.nguoi_giam_ho_id,
  ].some((pair) => {
    if (Array.isArray(pair)) return String(pair[0]) === String(pair[1])
    return pair && String(pair) === profileId
  })
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
            trang_thai: { $in: ['dang_cho', 'da_goi', 'trong_phong', 'cho_dich_vu'] },
        }).select('_id ho_so_benh_nhan_id appointment_id trang_thai doctor_id phong_kham gio_hen_goc checkin_time so_thu_tu_checkin ma_so_thu_tu').lean()
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
            doctor_id: queue.doctor_id ? String(queue.doctor_id) : null,
            phong_kham: queue.phong_kham ?? null,
            checkin_time: queue.checkin_time,
            so_thu_tu_checkin: queue.so_thu_tu_checkin ?? null,
            ma_so_thu_tu: queue.ma_so_thu_tu ?? null,
          }
        : null
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
