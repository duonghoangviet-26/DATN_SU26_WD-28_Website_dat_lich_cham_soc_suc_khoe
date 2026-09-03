import mongoose from 'mongoose'
import {
  BacSi,
  DonThuoc,
  GiaDinh,
  HangDoi,
  HoSoBenhNhan,
  KetQuaKham,
  KetQuaKhamTai,
  KetQuaKhamMui,
  KetQuaKhamHong,
  LichHen,
  NguoiDung,
  NhatKyThaoTac,
  ThanhVien,
} from '../../models/index.js'
import { fail, ok } from '../../utils/response.js'

const PATIENT_ROLES = ['user', 'patient']
const PATIENT_EDIT_FIELDS = ['ho_ten', 'so_dien_thoai', 'anh_dai_dien', 'status']
const MEMBER_EDIT_FIELDS = ['ngay_sinh', 'gioi_tinh', 'nhom_mau', 'di_ung', 'benh_nen']
const DOCTOR_ACCOUNT_SIGNAL_QUERY = [
  { ho_ten: /^BS\./i },
  { email: /^doctor[._-]/i },
  { email: /@doctor\./i },
]

async function getDoctorUserIds() {
  const doctors = await BacSi.find({ user_id: { $ne: null } }).select('user_id').lean()
  return doctors.map((doctor) => doctor.user_id)
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value)
}

function normalizeId(value) {
  if (!value) return null
  return value.toString()
}

function normalizeUser(user) {
  if (!user) return null
  return {
    id: normalizeId(user._id),
    email: user.email,
    ho_ten: user.ho_ten,
    so_dien_thoai: user.so_dien_thoai || null,
    anh_dai_dien: user.anh_dai_dien || null,
    role: user.role,
    status: user.status,
    ngay_xoa: user.ngay_xoa || null,
    ngay_tao: user.ngay_tao || null,
    ngay_cap_nhat: user.ngay_cap_nhat || null,
  }
}

function normalizeMember(member) {
  if (!member) return null
  return {
    id: normalizeId(member._id),
    ho_ten: member.ho_ten,
    ngay_sinh: member.ngay_sinh || null,
    gioi_tinh: member.gioi_tinh || null,
    quan_he: member.quan_he || null,
    nhom_mau: member.nhom_mau || null,
    di_ung: member.di_ung || null,
    benh_nen: member.benh_nen || null,
    la_chu_ho: Boolean(member.la_chu_ho),
    ngay_xoa: member.ngay_xoa || null,
  }
}

function comparable(value) {
  if (value instanceof Date) return value.toISOString()
  if (value === undefined || value === '') return null
  return value
}

function pickChangedFields(oldData, newData, fields) {
  const oldLogData = {}
  const newLogData = {}

  for (const field of fields) {
    if (!(field in newData)) continue

    const oldValue = comparable(oldData?.[field])
    const newValue = comparable(newData[field])
    if (String(oldValue ?? '') !== String(newValue ?? '')) {
      oldLogData[field] = oldValue
      newLogData[field] = newValue
    }
  }

  return { oldLogData, newLogData }
}

async function findPatientOr404(res, id) {
  if (!isObjectId(id)) {
    fail(res, 400, 'ID benh nhan khong hop le')
    return null
  }

  const patient = await NguoiDung.findOne({
    _id: id,
    role: { $in: PATIENT_ROLES },
    $nor: DOCTOR_ACCOUNT_SIGNAL_QUERY,
  }).lean()

  if (patient) {
    const doctorProfile = await BacSi.exists({ user_id: patient._id })
    if (doctorProfile) {
      fail(res, 404, 'Khong tim thay benh nhan')
      return null
    }
    return patient
  }

  // Fallback check standalone walk-in profile in HoSoBenhNhan
  const profile = await HoSoBenhNhan.findOne({ _id: id, trang_thai: 'active' }).lean()
  if (profile) {
    return {
      _id: profile._id,
      ho_ten: profile.ho_ten,
      so_dien_thoai: profile.so_dien_thoai || null,
      email: profile.email || null,
      role: 'patient',
      status: 'active',
      ngay_tao: profile.ngay_tao || profile.createdAt || new Date(),
      is_walk_in: true,
      profile_obj: profile,
    }
  }

  fail(res, 404, 'Khong tim thay benh nhan')
  return null
}

async function getPatientMemberIds(patientId) {
  let families = await GiaDinh.find({ user_id: patientId }).select('_id').lean()
  let familyIds = families.map((family) => family._id)

  if (familyIds.length === 0) {
    const linkedMember = await ThanhVien.findOne({
      ngay_xoa: null,
      $or: [{ ho_so_benh_nhan_id: patientId }, { tai_khoan_id: patientId }],
    }).select('family_id').lean()

    if (linkedMember?.family_id) {
      familyIds = [linkedMember.family_id]
    }
  }

  const members = await ThanhVien.find({
    ngay_xoa: null,
    $or: [
      { tai_khoan_id: patientId },
      { ho_so_benh_nhan_id: patientId },
      ...(familyIds.length > 0 ? [{ family_id: { $in: familyIds } }] : []),
    ],
  }).lean()

  return {
    familyIds,
    members,
    memberIds: members.map((member) => member._id),
  }
}

async function buildPatientSummary(patient) {
  if (patient.is_walk_in && patient.profile_obj) {
    const profile = patient.profile_obj
    const { members } = await getPatientMemberIds(profile._id)

    const appointments = await LichHen.find({ ho_so_benh_nhan_id: profile._id })
      .select('_id ngay_kham')
      .sort('-ngay_kham')
      .limit(1)
      .lean()
    const appointmentCount = await LichHen.countDocuments({ ho_so_benh_nhan_id: profile._id })
    const recordCount = await KetQuaKham.countDocuments({ ho_so_benh_nhan_id: profile._id })

    const primaryMember = {
      id: normalizeId(profile._id),
      ho_ten: profile.ho_ten,
      ngay_sinh: profile.ngay_sinh || null,
      gioi_tinh: profile.gioi_tinh || null,
      quan_he: 'Chủ hộ',
      nhom_mau: profile.nhom_mau || null,
      di_ung: profile.di_ung || null,
      benh_nen: profile.benh_nen || null,
      la_chu_ho: true,
    }

    const familyMemberList = members.length > 0 ? members : [primaryMember]

    return {
      id: normalizeId(profile._id),
      email: profile.email || null,
      ho_ten: profile.ho_ten,
      so_dien_thoai: profile.so_dien_thoai || null,
      anh_dai_dien: null,
      role: 'patient',
      status: 'active',
      primary_member: primaryMember,
      family_member_count: familyMemberList.length,
      appointment_count: appointmentCount,
      medical_record_count: recordCount,
      last_exam_at: appointments[0]?.ngay_kham || null,
      family_members: familyMemberList.map(normalizeMember),
    }
  }

  const { members, memberIds } = await getPatientMemberIds(patient._id)
  const appointmentQuery = {
    $or: [
      { user_id: patient._id },
      ...(memberIds.length > 0 ? [{ member_id: { $in: memberIds } }] : []),
    ],
  }
  const appointments = await LichHen.find(appointmentQuery)
    .select('_id ngay_kham')
    .sort('-ngay_kham')
    .limit(1)
    .lean()
  const appointmentCount = await LichHen.countDocuments(appointmentQuery)

  let recordCount = 0
  if (appointmentCount > 0 || memberIds.length > 0) {
    const appointmentIds = await LichHen.find(appointmentQuery).select('_id').lean()
    const queueRows = memberIds.length > 0
      ? await HangDoi.find({ member_id: { $in: memberIds } }).select('_id').lean()
      : []

    const recordConditions = [
      ...(appointmentIds.length > 0 ? [{ appointment_id: { $in: appointmentIds.map((item) => item._id) } }] : []),
      ...(queueRows.length > 0 ? [{ hang_doi_id: { $in: queueRows.map((item) => item._id) } }] : []),
    ]
    recordCount = recordConditions.length > 0
      ? await KetQuaKham.countDocuments({ $or: recordConditions })
      : 0
  }

  let primaryMemberObj = members.find((member) => member.la_chu_ho) || members[0] || null
  if (primaryMemberObj && (!primaryMemberObj.gioi_tinh || !primaryMemberObj.ngay_sinh)) {
    const patientProfile = await HoSoBenhNhan.findOne({ tai_khoan_id: patient._id, trang_thai: 'active' })
      .select('gioi_tinh ngay_sinh nhom_mau di_ung benh_nen')
      .lean()
    if (patientProfile) {
      if (!primaryMemberObj.gioi_tinh && patientProfile.gioi_tinh) primaryMemberObj.gioi_tinh = patientProfile.gioi_tinh
      if (!primaryMemberObj.ngay_sinh && patientProfile.ngay_sinh) primaryMemberObj.ngay_sinh = patientProfile.ngay_sinh
      if (!primaryMemberObj.nhom_mau && patientProfile.nhom_mau) primaryMemberObj.nhom_mau = patientProfile.nhom_mau
      if (!primaryMemberObj.di_ung && patientProfile.di_ung) primaryMemberObj.di_ung = patientProfile.di_ung
      if (!primaryMemberObj.benh_nen && patientProfile.benh_nen) primaryMemberObj.benh_nen = patientProfile.benh_nen
    }
  }

  return {
    ...normalizeUser(patient),
    primary_member: normalizeMember(primaryMemberObj),
    family_member_count: members.length,
    appointment_count: appointmentCount,
    medical_record_count: recordCount,
    last_exam_at: appointments[0]?.ngay_kham || null,
  }
}

function getDoctorName(doctor) {
  return doctor?.user_id?.ho_ten || doctor?.ho_ten || null
}

function getDoctorId(doctor) {
  return normalizeId(doctor?._id || doctor)
}

function getSpecialtyName(appointment, doctor) {
  return appointment?.specialty_id?.ten || doctor?.specialties?.[0]?.ten || null
}

function serializePrescription(prescription) {
  return {
    id: normalizeId(prescription._id),
    ghi_chu: prescription.ghi_chu || null,
    nguon: prescription.nguon,
    ngay_tao: prescription.ngay_tao || null,
    items: (prescription.items || []).map((item) => ({
      id: normalizeId(item._id),
      ten_thuoc: item.ten_thuoc,
      lieu_luong: item.lieu_luong || null,
      tan_suat: item.tan_suat || null,
      gio_uong: item.gio_uong || [],
      so_ngay: item.so_ngay,
      ghi_chu: item.ghi_chu || null,
    })),
  }
}

function extractImagesForResult(result, specialtyRecords = []) {
  const images = []
  const seenUrls = new Set()

  const addImg = (img) => {
    if (!img) return
    let url = ''
    let mo_ta = null
    let uploaded_at = null

    if (typeof img === 'string') {
      url = img
    } else if (typeof img === 'object') {
      url = img.url || img.hinh_anh || img.image_url || ''
      mo_ta = img.mo_ta || img.description || img.ghi_chu || null
      uploaded_at = img.uploaded_at || img.ngay_tao || null
    }

    if (url && !seenUrls.has(url)) {
      seenUrls.add(url)
      images.push({ url, mo_ta, uploaded_at })
    }
  }

  for (const item of specialtyRecords) {
    for (const img of item?.hinh_anh_noi_soi || []) addImg(img)
  }

  if (result) {
    for (const img of result.hinh_anh_noi_soi || []) addImg(img)
    for (const img of result.hinh_anh_kham || []) addImg(img)
    for (const img of result.hinh_anh || []) addImg(img)

    for (const dv of result.dich_vu_phat_sinh || []) {
      for (const img of dv.hinh_anh_ket_qua || []) addImg(img)
      for (const img of dv.hinh_anh_noi_soi || []) addImg(img)
      for (const img of dv.hinh_anh || []) addImg(img)
    }
  }

  return images
}

function serializeHistoryItem(result, prescriptions, specialtyRecords = []) {
  const appointment = result.appointment_id || null
  const queue = result.hang_doi_id || null
  const doctor = result.bac_si_phu_trach_id || appointment?.doctor_id || queue?.doctor_id || null

  return {
    id: normalizeId(result._id),
    appointment_id: normalizeId(appointment?._id),
    queue_id: normalizeId(queue?._id),
    ma_lich_hen: appointment?.ma_lich_hen || null,
    benh_nhan: appointment?.member_id?.ho_ten || appointment?.ten_khach || queue?.ten_benh_nhan || 'Benh nhan',
    ngay_kham: appointment?.ngay_kham || queue?.checkin_time || result.ngay_tao || null,
    gio_kham: appointment?.gio_kham || null,
    bac_si_id: getDoctorId(doctor),
    bac_si: getDoctorName(doctor),
    chuyen_khoa: getSpecialtyName(appointment, doctor),
    phong_kham: appointment?.phong_kham || queue?.phong_kham || doctor?.phong_kham_mac_dinh || null,
    chan_doan: result.chan_doan,
    huong_dan_dieu_tri: result.huong_dan_dieu_tri || null,
    ghi_chu: result.ghi_chu || null,
    status: result.status,
    don_thuoc: prescriptions.map(serializePrescription),
    hinh_anh_noi_soi: extractImagesForResult(result, specialtyRecords),
  }
}

export async function getPatients(req, res) {
  try {
    const {
      keyword = '',
      status = '',
      page = 1,
      limit = 10,
      sort = '-ngay_tao',
      isDeleted = 'false',
    } = req.query

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1)
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50)
    const doctorUserIds = await getDoctorUserIds()
    const query = {
      role: { $in: PATIENT_ROLES },
      ...(doctorUserIds.length > 0 ? { _id: { $nin: doctorUserIds } } : {}),
      $nor: DOCTOR_ACCOUNT_SIGNAL_QUERY,
      ngay_xoa: isDeleted === 'true' ? { $ne: null } : null,
    }

    if (keyword) {
      query.$or = [
        { ho_ten: { $regex: keyword, $options: 'i' } },
        { email: { $regex: keyword, $options: 'i' } },
        { so_dien_thoai: { $regex: keyword, $options: 'i' } },
      ]
    }
    if (status) query.status = status

    const users = await NguoiDung.find(query).lean()
    const userPhoneSet = new Set(users.map((u) => u.so_dien_thoai).filter(Boolean))

    let virtualPatients = []
    if (isDeleted !== 'true' && (!status || status === 'active')) {
      const profileQuery = {
        trang_thai: 'active',
        tai_khoan_id: null,
      }
      if (keyword) {
        profileQuery.$or = [
          { ho_ten: { $regex: keyword, $options: 'i' } },
          { so_dien_thoai: { $regex: keyword, $options: 'i' } },
          { email: { $regex: keyword, $options: 'i' } },
        ]
      }

      const standaloneProfiles = await HoSoBenhNhan.find(profileQuery).lean()
      const filteredProfiles = standaloneProfiles.filter(
        (p) => !p.so_dien_thoai || !userPhoneSet.has(p.so_dien_thoai)
      )

      virtualPatients = filteredProfiles.map((p) => ({
        _id: p._id,
        ho_ten: p.ho_ten,
        so_dien_thoai: p.so_dien_thoai || null,
        email: p.email || null,
        role: 'patient',
        status: 'active',
        ngay_tao: p.ngay_tao || p.createdAt || new Date(),
        is_walk_in: true,
        profile_obj: p,
      }))
    }

    const allPatients = [...users, ...virtualPatients]
    const isDesc = sort.startsWith('-')
    allPatients.sort((a, b) => {
      const timeA = new Date(a.ngay_tao || 0).getTime()
      const timeB = new Date(b.ngay_tao || 0).getTime()
      return isDesc ? timeB - timeA : timeA - timeB
    })

    const total = allPatients.length
    const paginatedPatients = allPatients.slice((pageNumber - 1) * limitNumber, pageNumber * limitNumber)
    const data = await Promise.all(paginatedPatients.map(buildPatientSummary))

    return res.status(200).json({
      success: true,
      message: 'Lay danh sach benh nhan thanh cong',
      data,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber) || 1,
      },
    })
  } catch (error) {
    return fail(res, 500, 'Loi server: ' + error.message)
  }
}

export async function getPatientStatistics(req, res) {
  try {
    const doctorUserIds = await getDoctorUserIds()
    const baseQuery = {
      role: { $in: PATIENT_ROLES },
      ...(doctorUserIds.length > 0 ? { _id: { $nin: doctorUserIds } } : {}),
      $nor: DOCTOR_ACCOUNT_SIGNAL_QUERY,
    }

    const users = await NguoiDung.find({ ...baseQuery, ngay_xoa: null }).lean()
    const userPhoneSet = new Set(users.map((u) => u.so_dien_thoai).filter(Boolean))

    const standaloneProfiles = await HoSoBenhNhan.find({ trang_thai: 'active', tai_khoan_id: null }).lean()
    const walkInCount = standaloneProfiles.filter((p) => !p.so_dien_thoai || !userPhoneSet.has(p.so_dien_thoai)).length

    const activeUsers = users.filter((u) => u.status === 'active').length
    const lockedUsers = users.filter((u) => u.status === 'locked').length
    const deletedUsers = await NguoiDung.countDocuments({ ...baseQuery, ngay_xoa: { $ne: null } })

    const total = users.length + walkInCount
    const active = activeUsers + walkInCount
    const locked = lockedUsers
    const deleted = deletedUsers

    return ok(res, { total, active, locked, deleted }, 'Lay thong ke benh nhan thanh cong')
  } catch (error) {
    return fail(res, 500, 'Loi server: ' + error.message)
  }
}

export async function getPatientById(req, res) {
  try {
    const patient = await findPatientOr404(res, req.params.id)
    if (!patient) return null

    const { members } = await getPatientMemberIds(patient._id)
    const summary = await buildPatientSummary(patient)

    return ok(res, {
      ...summary,
      family_members: members.map(normalizeMember),
    }, 'Lay chi tiet benh nhan thanh cong')
  } catch (error) {
    return fail(res, 500, 'Loi server: ' + error.message)
  }
}

export async function updatePatient(req, res) {
  try {
    const patient = await findPatientOr404(res, req.params.id)
    if (!patient) return null

    const userUpdate = {}
    for (const field of PATIENT_EDIT_FIELDS) {
      if (field in req.body) {
        userUpdate[field] = req.body[field] === '' ? null : req.body[field]
      }
    }

    if (userUpdate.ho_ten !== undefined && !String(userUpdate.ho_ten || '').trim()) {
      return fail(res, 400, 'Ho ten benh nhan la bat buoc')
    }
    if (userUpdate.so_dien_thoai !== undefined && userUpdate.so_dien_thoai !== null) {
      const phoneStr = String(userUpdate.so_dien_thoai).trim()
      if (phoneStr) {
        const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/
        if (!phoneRegex.test(phoneStr)) {
          return fail(res, 400, 'So dien thoai khong hop le (phai la 10 chu so hop le, bat dau bang 03, 05, 07, 08, 09 hoac +84)')
        }
        const existingUser = await NguoiDung.findOne({
          _id: { $ne: patient._id },
          so_dien_thoai: phoneStr,
          ngay_xoa: null,
        })
        if (existingUser) {
          return fail(res, 400, 'Số điện thoại này đã được sử dụng bởi bệnh nhân khác')
        }
        userUpdate.so_dien_thoai = phoneStr
      } else {
        userUpdate.so_dien_thoai = null
      }
    }
    if (userUpdate.status !== undefined && !['active', 'locked'].includes(userUpdate.status)) {
      return fail(res, 400, 'Trang thai tai khoan khong hop le')
    }

    const { oldLogData: oldUserLog, newLogData: newUserLog } = pickChangedFields(
      patient,
      userUpdate,
      PATIENT_EDIT_FIELDS
    )

    const { members } = await getPatientMemberIds(patient._id)
    let primaryMember = members.find((member) => member.la_chu_ho) || members[0] || null
    const memberUpdate = {}
    for (const field of MEMBER_EDIT_FIELDS) {
      if (field in req.body) {
        memberUpdate[field] = req.body[field] === '' ? null : req.body[field]
      }
    }
    if (memberUpdate.ngay_sinh) {
      const birthDate = new Date(memberUpdate.ngay_sinh)
      if (Number.isNaN(birthDate.getTime()) || birthDate.getTime() >= Date.now()) {
        return fail(res, 400, 'Ngay sinh benh nhan khong hop le')
      }
      memberUpdate.ngay_sinh = birthDate
    }
    if (memberUpdate.gioi_tinh !== undefined && memberUpdate.gioi_tinh !== null && !['nam', 'nu', 'khac'].includes(memberUpdate.gioi_tinh)) {
      return fail(res, 400, 'Gioi tinh benh nhan khong hop le')
    }
    if (memberUpdate.nhom_mau !== undefined && memberUpdate.nhom_mau !== null && !['A', 'B', 'AB', 'O'].includes(memberUpdate.nhom_mau)) {
      return fail(res, 400, 'Nhom mau benh nhan khong hop le')
    }

    if (patient.is_walk_in) {
      const profileSyncData = {}
      if (userUpdate.ho_ten) profileSyncData.ho_ten = userUpdate.ho_ten
      if (userUpdate.so_dien_thoai !== undefined) {
        profileSyncData.so_dien_thoai = userUpdate.so_dien_thoai
        profileSyncData.so_dien_thoai_tim_kiem = userUpdate.so_dien_thoai
      }
      if (memberUpdate.ngay_sinh !== undefined) profileSyncData.ngay_sinh = memberUpdate.ngay_sinh
      if (memberUpdate.gioi_tinh !== undefined) profileSyncData.gioi_tinh = memberUpdate.gioi_tinh
      if (memberUpdate.nhom_mau !== undefined) profileSyncData.nhom_mau = memberUpdate.nhom_mau
      if (memberUpdate.di_ung !== undefined) profileSyncData.di_ung = memberUpdate.di_ung
      if (memberUpdate.benh_nen !== undefined) profileSyncData.benh_nen = memberUpdate.benh_nen

      if (Object.keys(profileSyncData).length > 0) {
        const oldProfile = patient.profile_obj || {}
        await HoSoBenhNhan.findByIdAndUpdate(patient._id, { $set: profileSyncData }, { runValidators: true })

        await NhatKyThaoTac.create({
          nguoi_thuc_hien_id: req.user.id,
          vai_tro: req.user.role,
          hanh_dong: 'UPDATE_PATIENT',
          loai_doi_tuong: 'patient',
          doi_tuong_id: patient._id,
          du_lieu_cu: pickChangedFields(oldProfile, profileSyncData, Object.keys(profileSyncData)).oldLogData,
          du_lieu_moi: pickChangedFields(oldProfile, profileSyncData, Object.keys(profileSyncData)).newLogData,
        })
      }

      const linkedMember = await ThanhVien.findOne({ ho_so_benh_nhan_id: patient._id })
      if (linkedMember) {
        const memberSync = {}
        if (userUpdate.ho_ten) memberSync.ho_ten = userUpdate.ho_ten
        if (memberUpdate.ngay_sinh !== undefined) memberSync.ngay_sinh = memberUpdate.ngay_sinh
        if (memberUpdate.gioi_tinh !== undefined) memberSync.gioi_tinh = memberUpdate.gioi_tinh
        if (memberUpdate.nhom_mau !== undefined) memberSync.nhom_mau = memberUpdate.nhom_mau
        if (memberUpdate.di_ung !== undefined) memberSync.di_ung = memberUpdate.di_ung
        if (memberUpdate.benh_nen !== undefined) memberSync.benh_nen = memberUpdate.benh_nen
        if (Object.keys(memberSync).length > 0) {
          await ThanhVien.findByIdAndUpdate(linkedMember._id, { $set: memberSync }, { runValidators: true })
        }
      }

      const updated = await getPatientById(req, res)
      return updated
    }

    if (!primaryMember) {
      let family = await GiaDinh.findOne({ user_id: patient._id })
      if (!family) {
        family = await GiaDinh.create({
          user_id: patient._id,
          ten_nhom: `Gia đình ${userUpdate.ho_ten || patient.ho_ten}`,
        })
      }
      primaryMember = await ThanhVien.create({
        family_id: family._id,
        tai_khoan_id: patient._id,
        ho_ten: userUpdate.ho_ten || patient.ho_ten,
        ngay_sinh: memberUpdate.ngay_sinh || new Date('1995-01-01'),
        gioi_tinh: memberUpdate.gioi_tinh || 'nam',
        la_chu_ho: true,
        nhom_mau: memberUpdate.nhom_mau || null,
        di_ung: memberUpdate.di_ung || null,
        benh_nen: memberUpdate.benh_nen || null,
      })
    }

    if (userUpdate.ho_ten && primaryMember && primaryMember.ho_ten !== userUpdate.ho_ten) {
      memberUpdate.ho_ten = userUpdate.ho_ten
    }

    const memberDiff = pickChangedFields(primaryMember, memberUpdate, ['ho_ten', ...MEMBER_EDIT_FIELDS])

    const hasUserChanges = Object.keys(newUserLog).length > 0
    const hasMemberChanges = Object.keys(memberDiff.newLogData).length > 0

    if (!hasUserChanges && !hasMemberChanges) {
      const unchanged = await getPatientById(req, res)
      return unchanged
    }

    if (hasUserChanges) {
      await NguoiDung.findByIdAndUpdate(patient._id, userUpdate, { runValidators: true })
    }
    if (hasMemberChanges && primaryMember) {
      await ThanhVien.findByIdAndUpdate(primaryMember._id, memberUpdate, { runValidators: true })
    }

    // Đồng bộ sang HoSoBenhNhan để phía Client (Trang hồ sơ bệnh nhân) cập nhật tức thì
    const profileSyncData = {}
    if (userUpdate.ho_ten) profileSyncData.ho_ten = userUpdate.ho_ten
    if (userUpdate.so_dien_thoai) {
      profileSyncData.so_dien_thoai = userUpdate.so_dien_thoai
      profileSyncData.so_dien_thoai_tim_kiem = userUpdate.so_dien_thoai
    }
    if (memberUpdate.ngay_sinh !== undefined) profileSyncData.ngay_sinh = memberUpdate.ngay_sinh
    if (memberUpdate.gioi_tinh !== undefined) profileSyncData.gioi_tinh = memberUpdate.gioi_tinh
    if (memberUpdate.nhom_mau !== undefined) profileSyncData.nhom_mau = memberUpdate.nhom_mau
    if (memberUpdate.di_ung !== undefined) profileSyncData.di_ung = memberUpdate.di_ung
    if (memberUpdate.benh_nen !== undefined) profileSyncData.benh_nen = memberUpdate.benh_nen

    if (Object.keys(profileSyncData).length > 0) {
      await HoSoBenhNhan.findOneAndUpdate(
        { tai_khoan_id: patient._id, trang_thai: 'active' },
        { $set: profileSyncData, $setOnInsert: { nguon_tao: 'online', trang_thai: 'active' } },
        { upsert: true, runValidators: true }
      )
    }

    const oldLogData = {
      ...(hasUserChanges ? oldUserLog : {}),
      ...(hasMemberChanges ? Object.fromEntries(Object.entries(memberDiff.oldLogData).map(([key, value]) => [`primary_member.${key}`, value])) : {}),
    }
    const newLogData = {
      ...(hasUserChanges ? newUserLog : {}),
      ...(hasMemberChanges ? Object.fromEntries(Object.entries(memberDiff.newLogData).map(([key, value]) => [`primary_member.${key}`, value])) : {}),
    }

    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: req.user.id,
      vai_tro: req.user.role,
      hanh_dong: 'UPDATE_PATIENT',
      loai_doi_tuong: 'patient',
      doi_tuong_id: patient._id,
      du_lieu_cu: oldLogData,
      du_lieu_moi: newLogData,
    })

    const updated = await NguoiDung.findById(patient._id).lean()
    const detail = await buildPatientSummary(updated)
    const nextMembers = (await getPatientMemberIds(patient._id)).members

    return ok(res, {
      ...detail,
      family_members: nextMembers.map(normalizeMember),
    }, 'Cap nhat benh nhan thanh cong')
  } catch (error) {
    return fail(res, 500, 'Loi server: ' + error.message)
  }
}

export async function softDeletePatient(req, res) {
  try {
    const patient = await findPatientOr404(res, req.params.id)
    if (!patient) return null

    if (patient.ngay_xoa) {
      return fail(res, 400, 'Benh nhan da nam trong thung rac')
    }

    const deletedAt = new Date()
    await NguoiDung.findByIdAndUpdate(patient._id, { ngay_xoa: deletedAt }, { new: true })

    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: req.user.id,
      vai_tro: req.user.role,
      hanh_dong: 'SOFT_DELETE_PATIENT',
      loai_doi_tuong: 'patient',
      doi_tuong_id: patient._id,
      du_lieu_cu: { ngay_xoa: null },
      du_lieu_moi: { ngay_xoa: deletedAt.toISOString() },
    })

    return ok(res, null, 'Da xoa benh nhan vao thung rac')
  } catch (error) {
    return fail(res, 500, 'Loi server: ' + error.message)
  }
}

export async function restorePatient(req, res) {
  try {
    const patient = await findPatientOr404(res, req.params.id)
    if (!patient) return null

    if (!patient.ngay_xoa) {
      return fail(res, 400, 'Benh nhan chua bi xoa')
    }

    await NguoiDung.findByIdAndUpdate(patient._id, { ngay_xoa: null }, { new: true })

    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: req.user.id,
      vai_tro: req.user.role,
      hanh_dong: 'RESTORE_PATIENT',
      loai_doi_tuong: 'patient',
      doi_tuong_id: patient._id,
      du_lieu_cu: { ngay_xoa: patient.ngay_xoa },
      du_lieu_moi: { ngay_xoa: null },
    })

    const restored = await NguoiDung.findById(patient._id).lean()
    const detail = await buildPatientSummary(restored)
    const members = (await getPatientMemberIds(patient._id)).members

    return ok(res, {
      ...detail,
      family_members: members.map(normalizeMember),
    }, 'Khoi phuc benh nhan thanh cong')
  } catch (error) {
    return fail(res, 500, 'Loi server: ' + error.message)
  }
}

async function setPatientStatus(req, res, nextStatus) {
  const patient = await findPatientOr404(res, req.params.id)
  if (!patient) return null

  if (patient.ngay_xoa) {
    return fail(res, 400, 'Benh nhan dang nam trong thung rac')
  }

  if (patient.status === nextStatus) {
    return fail(
      res,
      400,
      nextStatus === 'active' ? 'Benh nhan da duoc mo khoa' : 'Benh nhan da bi khoa'
    )
  }

  const updated = await NguoiDung.findByIdAndUpdate(
    patient._id,
    { status: nextStatus },
    { new: true, runValidators: true }
  ).lean()

  await NhatKyThaoTac.create({
    nguoi_thuc_hien_id: req.user.id,
    vai_tro: req.user.role,
    hanh_dong: nextStatus === 'active' ? 'UNLOCK_PATIENT' : 'LOCK_PATIENT',
    loai_doi_tuong: 'patient',
    doi_tuong_id: patient._id,
    du_lieu_cu: { status: patient.status },
    du_lieu_moi: { status: nextStatus },
  })

  const detail = await buildPatientSummary(updated)
  const members = (await getPatientMemberIds(patient._id)).members

  return ok(res, {
    ...detail,
    family_members: members.map(normalizeMember),
  }, nextStatus === 'active' ? 'Mo khoa benh nhan thanh cong' : 'Khoa benh nhan thanh cong')
}

export async function lockPatient(req, res) {
  try {
    return await setPatientStatus(req, res, 'locked')
  } catch (error) {
    return fail(res, 500, 'Loi server: ' + error.message)
  }
}

export async function unlockPatient(req, res) {
  try {
    return await setPatientStatus(req, res, 'active')
  } catch (error) {
    return fail(res, 500, 'Loi server: ' + error.message)
  }
}

export async function getPatientExamHistory(req, res) {
  try {
    const patient = await findPatientOr404(res, req.params.id)
    if (!patient) return null

    const { memberIds } = await getPatientMemberIds(patient._id)
    const patientProfiles = await HoSoBenhNhan.find({
      $or: [
        { tai_khoan_id: patient._id },
        { nguoi_giam_ho_id: patient._id },
        ...(patient.so_dien_thoai ? [{ so_dien_thoai: patient.so_dien_thoai }] : [])
      ]
    }).select('_id').lean()
    const profileIds = patientProfiles.map((p) => p._id)

    const appointmentQuery = {
      $or: [
        { user_id: patient._id },
        ...(memberIds.length > 0 ? [{ member_id: { $in: memberIds } }] : []),
        ...(profileIds.length > 0 ? [{ ho_so_benh_nhan_id: { $in: profileIds } }] : []),
      ],
    }
    const appointments = await LichHen.find(appointmentQuery).select('_id').lean()
    const appointmentIds = appointments.map((appointment) => appointment._id)
    const queues = (memberIds.length > 0 || profileIds.length > 0)
      ? await HangDoi.find({
          $or: [
            ...(memberIds.length > 0 ? [{ member_id: { $in: memberIds } }] : []),
            ...(profileIds.length > 0 ? [{ ho_so_benh_nhan_id: { $in: profileIds } }] : []),
          ]
        }).select('_id').lean()
      : []
    const queueIds = queues.map((queue) => queue._id)

    if (appointmentIds.length === 0 && queueIds.length === 0 && profileIds.length === 0) {
      return ok(res, [], 'Lay lich su kham benh thanh cong')
    }

    const results = await KetQuaKham.find({
      $or: [
        ...(appointmentIds.length > 0 ? [{ appointment_id: { $in: appointmentIds } }] : []),
        ...(queueIds.length > 0 ? [{ hang_doi_id: { $in: queueIds } }] : []),
        ...(profileIds.length > 0 ? [{ ho_so_benh_nhan_id: { $in: profileIds } }] : []),
      ],
    })
      .populate({
        path: 'appointment_id',
        select: 'ma_lich_hen member_id doctor_id specialty_id ngay_kham gio_kham phong_kham ten_khach',
        populate: [
          { path: 'member_id', select: 'ho_ten' },
          { path: 'specialty_id', select: 'ten' },
          {
            path: 'doctor_id',
            select: 'user_id specialties phong_kham_mac_dinh',
            populate: [
              { path: 'user_id', select: 'ho_ten email' },
              { path: 'specialties', select: 'ten' },
            ],
          },
        ],
      })
      .populate({
        path: 'hang_doi_id',
        select: 'ten_benh_nhan doctor_id specialty_id phong_kham checkin_time',
        populate: [
          { path: 'specialty_id', select: 'ten' },
          {
            path: 'doctor_id',
            select: 'user_id specialties phong_kham_mac_dinh',
            populate: [
              { path: 'user_id', select: 'ho_ten email' },
              { path: 'specialties', select: 'ten' },
            ],
          },
        ],
      })
      .populate({
        path: 'bac_si_phu_trach_id',
        select: 'user_id specialties phong_kham_mac_dinh',
        populate: [
          { path: 'user_id', select: 'ho_ten email' },
          { path: 'specialties', select: 'ten' },
        ],
      })
      .sort('-ngay_tao')
      .lean()

    const [prescriptions, taiResults, muiResults, hongResults] = await Promise.all([
      DonThuoc.find({
        ket_qua_kham_id: { $in: results.map((result) => result._id) },
      }).lean(),
      appointmentIds.length > 0 ? KetQuaKhamTai.find({ appointment_id: { $in: appointmentIds } }).lean() : [],
      appointmentIds.length > 0 ? KetQuaKhamMui.find({ appointment_id: { $in: appointmentIds } }).lean() : [],
      appointmentIds.length > 0 ? KetQuaKhamHong.find({ appointment_id: { $in: appointmentIds } }).lean() : [],
    ])

    const prescriptionMap = prescriptions.reduce((map, prescription) => {
      const key = normalizeId(prescription.ket_qua_kham_id)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(prescription)
      return map
    }, new Map())

    const specialtyImageMap = new Map()
    const appendSpecialtyList = (list) => {
      for (const item of list) {
        const key = normalizeId(item.appointment_id) || normalizeId(item.ket_qua_kham_id)
        if (!key) continue
        if (!specialtyImageMap.has(key)) specialtyImageMap.set(key, [])
        specialtyImageMap.get(key).push(item)
      }
    }
    appendSpecialtyList(taiResults)
    appendSpecialtyList(muiResults)
    appendSpecialtyList(hongResults)

    const history = results
      .map((result) => {
        const resIdKey = normalizeId(result._id)
        const apptIdKey = normalizeId(result.appointment_id?._id)
        const specList = [
          ...(specialtyImageMap.get(resIdKey) || []),
          ...(specialtyImageMap.get(apptIdKey) || []),
        ]
        return serializeHistoryItem(result, prescriptionMap.get(resIdKey) || [], specList)
      })
      .sort((left, right) => new Date(right.ngay_kham || 0) - new Date(left.ngay_kham || 0))

    return ok(res, history, 'Lay lich su kham benh thanh cong')
  } catch (error) {
    return fail(res, 500, 'Loi server: ' + error.message)
  }
}

export async function getPatientAuditLogs(req, res) {
  try {
    const patient = await findPatientOr404(res, req.params.id)
    if (!patient) return null

    const logs = await NhatKyThaoTac.find({
      doi_tuong_id: patient._id,
      loai_doi_tuong: { $in: ['patient', 'user'] },
    })
      .populate('nguoi_thuc_hien_id', 'ho_ten email anh_dai_dien')
      .sort('-ngay_tao')
      .limit(100)
      .lean()

    return ok(res, logs, 'Lay lich su chinh sua benh nhan thanh cong')
  } catch (error) {
    return fail(res, 500, 'Loi server: ' + error.message)
  }
}
