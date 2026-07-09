import ThongTinPhongKham from '../../models/ThongTinPhongKham.js'
import ChuyenKhoa from '../../models/ChuyenKhoa.js'
import NhatKyThaoTac from '../../models/NhatKyThaoTac.js'
import BacSi from '../../models/BacSi.js'
import LichHen from '../../models/LichHen.js'
import {
  getSingletonClinic,
  getSingletonClinicIdOrThrow,
  sanitizeClinicPayload,
} from '../../services/admin/singleton-clinic.service.js'
import { ok, fail } from '../../utils/response.js'

const toSlug = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

async function getAuditLogs(loaiDoiTuong, doiTuongId) {
  const logs = await NhatKyThaoTac.find({ loai_doi_tuong: loaiDoiTuong, doi_tuong_id: doiTuongId })
    .populate('nguoi_thuc_hien_id', 'ho_ten')
    .sort({ ngay_tao: -1 })
    .lean()

  return logs.map((log) => ({
    id: log._id,
    thoi_gian: log.ngay_tao,
    hanh_dong: log.hanh_dong,
    nguoi_thay_doi: log.nguoi_thuc_hien_id?.ho_ten ?? 'He thong',
    mo_ta: log.ly_do ?? '',
  }))
}

async function writeAuditLog(req, hanhDong, doiTuongId, lyDo) {
  try {
    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: req.user?.id || null,
      vai_tro: req.user?.role || 'admin',
      hanh_dong: hanhDong,
      loai_doi_tuong: 'clinic_info',
      doi_tuong_id: doiTuongId,
      ly_do: lyDo,
    })
  } catch (_) {
    // Do not block the main flow if audit logging fails.
  }
}

async function writeSpecialtyAuditLog(req, hanhDong, specialtyId, lyDo) {
  try {
    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: req.user?.id || null,
      vai_tro: req.user?.role || 'admin',
      hanh_dong: hanhDong,
      loai_doi_tuong: 'specialty',
      doi_tuong_id: specialtyId,
      ly_do: lyDo,
    })
  } catch (_) {
    // Do not block the main flow if audit logging fails.
  }
}

async function checkDuplicateClinicInfo(data, excludeId = null) {
  const { dia_chi, so_dien_thoai, email, ban_do_url } = data
  const query = excludeId ? { _id: { $ne: excludeId } } : {}
  const errors = []

  if (dia_chi?.trim()) {
    const exists = await ThongTinPhongKham.findOne({ dia_chi: dia_chi.trim(), ...query })
    if (exists) errors.push('Dia chi nay da duoc su dung o chi nhanh khac')
  }

  if (so_dien_thoai?.trim()) {
    const exists = await ThongTinPhongKham.findOne({ so_dien_thoai: so_dien_thoai.trim(), ...query })
    if (exists) errors.push('So dien thoai nay da duoc su dung o chi nhanh khac')
  }

  if (email?.trim()) {
    const exists = await ThongTinPhongKham.findOne({
      email: email.trim().toLowerCase(),
      ...query,
    })
    if (exists) errors.push('Email nay da duoc su dung o chi nhanh khac')
  }

  if (ban_do_url?.trim()) {
    const exists = await ThongTinPhongKham.findOne({ ban_do_url: ban_do_url.trim(), ...query })
    if (exists) errors.push('URL ban do nay da duoc su dung o chi nhanh khac')
  }

  return errors
}

export const getClinicLogs = async (req, res) => {
  try {
    const logs = await getAuditLogs('clinic_info', req.params.id)
    return ok(res, logs)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const getCurrentClinicLogs = async (_req, res) => {
  try {
    const clinic = await getSingletonClinic()
    if (!clinic) return ok(res, [])

    const logs = await getAuditLogs('clinic_info', clinic._id)
    return ok(res, logs)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const getSpecialtyLogs = async (req, res) => {
  try {
    const specialtyId = req.params.specialtyId ?? req.params.id
    const logs = await getAuditLogs('specialty', specialtyId)
    return ok(res, logs)
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export const getAllClinics = async (req, res) => {
  try {
    const status = req.query.status
    const filter = status ? { trang_thai: status } : {}
    const clinics = await ThongTinPhongKham.find(filter).sort({ ngay_tao: 1 })
    return ok(res, clinics)
  } catch (error) {
    return fail(res, 500, 'Loi server khi lay danh sach phong kham: ' + error.message)
  }
}

export const getCurrentClinic = async (_req, res) => {
  try {
    const clinic = await getSingletonClinic()
    return ok(res, clinic)
  } catch (error) {
    return fail(res, 500, 'Loi server khi lay thong tin phong kham: ' + error.message)
  }
}

export const getClinicById = async (req, res) => {
  try {
    const clinic = await ThongTinPhongKham.findById(req.params.id)
    if (!clinic) return fail(res, 404, 'Khong tim thay phong kham')
    return ok(res, clinic)
  } catch (error) {
    return fail(res, 500, 'Loi server: ' + error.message)
  }
}

export const createClinic = async (req, res) => {
  try {
    const payload = sanitizeClinicPayload(req.body)
    if (!payload.ten?.trim()) return fail(res, 400, 'Ten phong kham la bat buoc')

    const existingClinic = await getSingletonClinic()
    if (existingClinic) {
      return fail(res, 409, 'He thong chi duoc phep co 1 phong kham. Hay cap nhat ban ghi hien tai.')
    }

    const duplicateErrors = await checkDuplicateClinicInfo(payload)
    if (duplicateErrors.length > 0) {
      return fail(res, 400, duplicateErrors.join(', '))
    }

    const newClinic = await ThongTinPhongKham.create(payload)
    await writeAuditLog(req, 'CREATE_CLINIC_INFO', newClinic._id, `Tao thong tin phong kham "${newClinic.ten}"`)

    return ok(res, newClinic, 'Tao thong tin phong kham thanh cong')
  } catch (error) {
    return fail(res, 400, 'Du lieu khong hop le: ' + error.message)
  }
}

export const upsertCurrentClinic = async (req, res) => {
  try {
    const payload = sanitizeClinicPayload(req.body)
    if (!payload.ten?.trim()) {
      return fail(res, 400, 'Ten phong kham la bat buoc')
    }

    const currentClinic = await getSingletonClinic()
    const duplicateErrors = await checkDuplicateClinicInfo(payload, currentClinic?._id ?? null)
    if (duplicateErrors.length > 0) {
      return fail(res, 400, duplicateErrors.join(', '))
    }

    let clinic
    let action
    let message

    if (!currentClinic) {
      clinic = await ThongTinPhongKham.create(payload)
      action = 'CREATE_CLINIC_INFO'
      message = 'Tao thong tin phong kham thanh cong'
    } else {
      clinic = await ThongTinPhongKham.findByIdAndUpdate(
        currentClinic._id,
        { $set: payload },
        { new: true, runValidators: true }
      )
      action = 'UPDATE_CLINIC_INFO'
      message = 'Cap nhat thong tin phong kham thanh cong'
    }

    await writeAuditLog(req, action, clinic._id, `${action === 'CREATE_CLINIC_INFO' ? 'Tao' : 'Cap nhat'} thong tin phong kham "${clinic.ten}"`)
    return ok(res, clinic, message)
  } catch (error) {
    return fail(res, 400, 'Du lieu khong hop le: ' + error.message)
  }
}

export const updateClinicInfo = async (req, res) => {
  try {
    const payload = sanitizeClinicPayload(req.body)
    if (payload.ten !== undefined && !payload.ten?.trim()) {
      return fail(res, 400, 'Ten phong kham khong duoc de trong')
    }

    const duplicateErrors = await checkDuplicateClinicInfo(payload, req.params.id)
    if (duplicateErrors.length > 0) {
      return fail(res, 400, duplicateErrors.join(', '))
    }

    const updated = await ThongTinPhongKham.findByIdAndUpdate(
      req.params.id,
      { $set: payload },
      { new: true, runValidators: true }
    )

    if (!updated) {
      return fail(res, 404, 'Khong tim thay phong kham de cap nhat')
    }

    if (payload.trang_thai === 'inactive') {
      await ChuyenKhoa.updateMany({ phong_kham_id: req.params.id }, { status: 'hidden' })
    } else if (payload.trang_thai === 'active') {
      await ChuyenKhoa.updateMany({ phong_kham_id: req.params.id }, { status: 'active' })
    }

    await writeAuditLog(req, 'UPDATE_CLINIC_INFO', updated._id, `Cap nhat thong tin phong kham "${updated.ten}"`)
    return ok(res, updated, 'Cap nhat thong tin phong kham thanh cong')
  } catch (error) {
    return fail(res, 400, 'Du lieu cap nhat khong hop le: ' + error.message)
  }
}

export const deleteClinic = async (req, res) => {
  try {
    const specialties = await ChuyenKhoa.find({ phong_kham_id: req.params.id }).select('_id').lean()
    if (specialties.length > 0) {
      const specialtyIds = specialties.map((item) => item._id)
      const doctors = await BacSi.find({ specialties: { $in: specialtyIds } }).select('_id').lean()

      if (doctors.length > 0) {
        const doctorIds = doctors.map((item) => item._id)
        const activeAppointments = await LichHen.countDocuments({
          doctor_id: { $in: doctorIds },
          status: { $in: ['pending', 'confirmed'] },
        })

        if (activeAppointments > 0) {
          return fail(res, 400, `Khong the ngung hoat dong phong kham vi con ${activeAppointments} lich hen dang cho kham hoac da xac nhan.`)
        }
      }
    }

    const deleted = await ThongTinPhongKham.findByIdAndUpdate(
      req.params.id,
      { trang_thai: 'inactive' },
      { new: true }
    )
    if (!deleted) return fail(res, 404, 'Khong tim thay phong kham')

    await ChuyenKhoa.updateMany({ phong_kham_id: req.params.id }, { status: 'hidden' })
    await writeAuditLog(req, 'HIDE_CLINIC_INFO', deleted._id, `Ngung hoat dong phong kham "${deleted.ten}"`)

    return ok(res, deleted, 'Da ngung hoat dong phong kham va cac chuyen khoa truc thuoc')
  } catch (error) {
    return fail(res, 500, 'Loi server khi xoa: ' + error.message)
  }
}

export const getSpecialtiesByClinic = async (req, res) => {
  try {
    const clinicId = await getSingletonClinicIdOrThrow()
    if (String(req.params.id) !== String(clinicId)) {
      return fail(res, 404, 'Khong tim thay phong kham')
    }

    const specialties = await ChuyenKhoa.find({ phong_kham_id: clinicId })
      .sort({ thu_tu: 1, ngay_tao: 1 })
      .lean()

    const specialtiesWithCount = await Promise.all(
      specialties.map(async (specialty) => ({
        ...specialty,
        doctor_count: await BacSi.countDocuments({ specialties: specialty._id }),
      }))
    )

    return ok(res, specialtiesWithCount)
  } catch (error) {
    return fail(res, 500, 'Loi server: ' + error.message)
  }
}

export const getDoctorsBySpecialty = async (req, res) => {
  try {
    const specialtyId = req.params.specialtyId ?? req.params.id
    const doctors = await BacSi.find({ specialties: specialtyId })
      .populate('user_id', 'ho_ten')
      .lean()

    const result = doctors.map((doctor) => ({
      _id: doctor._id,
      user_id: doctor.user_id ? doctor.user_id._id : null,
      ho_ten: doctor.user_id ? doctor.user_id.ho_ten : 'N/A',
      bang_cap: doctor.bang_cap || 'N/A',
    }))

    return ok(res, result)
  } catch (error) {
    return fail(res, 500, 'Loi server khi lay danh sach bac si: ' + error.message)
  }
}

export const createSpecialtyForClinic = async (req, res) => {
  try {
    const { id } = req.params
    const { ten, mo_ta, icon_url, thu_tu } = req.body

    if (!ten || !ten.trim()) {
      return fail(res, 400, 'Ten chuyen khoa la bat buoc')
    }

    const clinic = await getSingletonClinic()
    if (!clinic || String(clinic._id) !== String(id)) {
      return fail(res, 404, 'Khong tim thay phong kham')
    }

    const specialty = await ChuyenKhoa.create({
      phong_kham_id: clinic._id,
      ten: ten.trim(),
      mo_ta: mo_ta || null,
      icon_url: icon_url || null,
      thu_tu: thu_tu ?? 0,
    })

    await writeSpecialtyAuditLog(req, 'CREATE_SPECIALTY', specialty._id, `Them chuyen khoa "${specialty.ten}" cho phong kham`)
    return ok(res, specialty.toObject(), 'Da them chuyen khoa moi')
  } catch (error) {
    if (error.code === 11000) {
      return fail(res, 409, 'Ten chuyen khoa nay da ton tai trong phong kham')
    }
    return fail(res, 400, 'Loi du lieu: ' + error.message)
  }
}

export const updateSpecialty = async (req, res) => {
  try {
    const { specialtyId } = req.params
    const { ten, mo_ta, icon_url, thu_tu } = req.body

    if (!ten || !ten.trim()) {
      return fail(res, 400, 'Ten chuyen khoa la bat buoc')
    }

    const updated = await ChuyenKhoa.findByIdAndUpdate(
      specialtyId,
      {
        ten: ten.trim(),
        slug: toSlug(ten.trim()),
        mo_ta: mo_ta || null,
        icon_url: icon_url || null,
        thu_tu: thu_tu ?? 0,
      },
      { new: true, runValidators: true }
    ).lean()

    if (!updated) return fail(res, 404, 'Khong tim thay chuyen khoa')

    await writeSpecialtyAuditLog(req, 'UPDATE_SPECIALTY', updated._id, `Cap nhat thong tin chuyen khoa "${updated.ten}"`)
    return ok(res, updated, 'Da cap nhat chuyen khoa')
  } catch (error) {
    if (error.code === 11000) {
      return fail(res, 409, 'Ten chuyen khoa nay da ton tai trong phong kham')
    }
    return fail(res, 400, 'Loi du lieu: ' + error.message)
  }
}

export const toggleSpecialty = async (req, res) => {
  try {
    const { specialtyId } = req.params
    const specialty = await ChuyenKhoa.findById(specialtyId)
    if (!specialty) return fail(res, 404, 'Khong tim thay chuyen khoa')

    specialty.status = specialty.status === 'active' ? 'hidden' : 'active'
    await specialty.save()

    await writeSpecialtyAuditLog(
      req,
      specialty.status === 'hidden' ? 'HIDE_SPECIALTY' : 'SHOW_SPECIALTY',
      specialty._id,
      `${specialty.status === 'hidden' ? 'An' : 'Hien'} chuyen khoa "${specialty.ten}"`
    )

    return ok(res, specialty.toObject(), `Da ${specialty.status === 'active' ? 'hien' : 'an'} chuyen khoa`)
  } catch (error) {
    return fail(res, 500, 'Loi server: ' + error.message)
  }
}

export const copySpecialty = async (_req, res) => {
  return fail(res, 400, 'He thong chi co 1 phong kham. Khong ho tro sao chep chuyen khoa giua nhieu chi nhanh.')
}
