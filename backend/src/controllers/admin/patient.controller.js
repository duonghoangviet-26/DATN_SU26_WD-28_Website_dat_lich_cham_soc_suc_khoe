import mongoose from 'mongoose'
import {
  BacSi,
  DonThuoc,
  GiaDinh,
  HangDoi,
  KetQuaKham,
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
  if (!patient) {
    fail(res, 404, 'Khong tim thay benh nhan')
    return null
  }

  const doctorProfile = await BacSi.exists({ user_id: patient._id })
  if (doctorProfile) {
    fail(res, 404, 'Khong tim thay benh nhan')
    return null
  }

  return patient
}

async function getPatientMemberIds(patientId) {
  const families = await GiaDinh.find({ user_id: patientId }).select('_id').lean()
  const familyIds = families.map((family) => family._id)
  const members = await ThanhVien.find({
    ngay_xoa: null,
    $or: [
      { tai_khoan_id: patientId },
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

  return {
    ...normalizeUser(patient),
    primary_member: normalizeMember(members.find((member) => member.la_chu_ho) || members[0]),
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

function serializeHistoryItem(result, prescriptions) {
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

    const [patients, total] = await Promise.all([
      NguoiDung.find(query)
        .sort(sort)
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .lean(),
      NguoiDung.countDocuments(query),
    ])

    const data = await Promise.all(patients.map(buildPatientSummary))

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
    const [total, active, locked, deleted] = await Promise.all([
      NguoiDung.countDocuments({ ...baseQuery, ngay_xoa: null }),
      NguoiDung.countDocuments({ ...baseQuery, status: 'active', ngay_xoa: null }),
      NguoiDung.countDocuments({ ...baseQuery, status: 'locked', ngay_xoa: null }),
      NguoiDung.countDocuments({ ...baseQuery, ngay_xoa: { $ne: null } }),
    ])

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
    if (userUpdate.status !== undefined && !['active', 'locked'].includes(userUpdate.status)) {
      return fail(res, 400, 'Trang thai tai khoan khong hop le')
    }

    const { oldLogData: oldUserLog, newLogData: newUserLog } = pickChangedFields(
      patient,
      userUpdate,
      PATIENT_EDIT_FIELDS
    )

    const { members } = await getPatientMemberIds(patient._id)
    const primaryMember = members.find((member) => member.la_chu_ho) || members[0] || null
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

    const memberDiff = primaryMember
      ? pickChangedFields(primaryMember, memberUpdate, MEMBER_EDIT_FIELDS)
      : { oldLogData: {}, newLogData: {} }

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
    const appointmentQuery = {
      $or: [
        { user_id: patient._id },
        ...(memberIds.length > 0 ? [{ member_id: { $in: memberIds } }] : []),
      ],
    }
    const appointments = await LichHen.find(appointmentQuery).select('_id').lean()
    const appointmentIds = appointments.map((appointment) => appointment._id)
    const queues = memberIds.length > 0
      ? await HangDoi.find({ member_id: { $in: memberIds } }).select('_id').lean()
      : []
    const queueIds = queues.map((queue) => queue._id)

    if (appointmentIds.length === 0 && queueIds.length === 0) {
      return ok(res, [], 'Lay lich su kham benh thanh cong')
    }

    const results = await KetQuaKham.find({
      $or: [
        ...(appointmentIds.length > 0 ? [{ appointment_id: { $in: appointmentIds } }] : []),
        ...(queueIds.length > 0 ? [{ hang_doi_id: { $in: queueIds } }] : []),
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

    const prescriptions = await DonThuoc.find({
      ket_qua_kham_id: { $in: results.map((result) => result._id) },
    }).lean()
    const prescriptionMap = prescriptions.reduce((map, prescription) => {
      const key = normalizeId(prescription.ket_qua_kham_id)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(prescription)
      return map
    }, new Map())

    const history = results
      .map((result) => serializeHistoryItem(result, prescriptionMap.get(normalizeId(result._id)) || []))
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
