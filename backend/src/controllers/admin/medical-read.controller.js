import mongoose from 'mongoose'

import {
  KetQuaKham,
  KetQuaKhamTai,
  KetQuaKhamMui,
  KetQuaKhamHong,
  DonThuoc,
  SinhHieuKham,
} from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value)
}

function formatBaseExamResult(result) {
  return {
    _id: result._id,
    appointment_id: result.appointment_id ?? null,
    nguoi_nhap_id: result.nguoi_nhap_id ?? null,
    bac_si_phu_trach_id: result.bac_si_phu_trach_id ?? null,
    nguoi_xac_nhan_id: result.nguoi_xac_nhan_id ?? null,
    thoi_diem_xac_nhan: result.thoi_diem_xac_nhan ?? null,
    chan_doan: result.chan_doan,
    huong_dan_dieu_tri: result.huong_dan_dieu_tri ?? null,
    ghi_chu: result.ghi_chu ?? null,
    ngay_tai_kham: result.ngay_tai_kham ?? null,
    co_the_sua: result.co_the_sua,
    dich_vu_phat_sinh: result.dich_vu_phat_sinh ?? [],
    dich_vu_tu_choi: result.dich_vu_tu_choi ?? [],
    chi_dinh_tai_kham: result.chi_dinh_tai_kham,
    da_dat_lich_tai_kham: result.da_dat_lich_tai_kham,
    da_gui_cho_benh_nhan: result.da_gui_cho_benh_nhan,
    lich_su_sua: result.lich_su_sua ?? [],
    ngay_tao: result.ngay_tao ?? null,
    ngay_cap_nhat: result.ngay_cap_nhat ?? null,
  }
}

function formatSpecialtyResult(result) {
  return {
    _id: result._id,
    appointment_id: result.appointment_id ?? null,
    ket_qua_kham_id: result.ket_qua_kham_id ?? null,
    la_ket_qua_chinh: result.la_ket_qua_chinh,
    hinh_anh_noi_soi: result.hinh_anh_noi_soi ?? [],
    ngay_tao: result.ngay_tao ?? null,
    ngay_cap_nhat: result.ngay_cap_nhat ?? null,
  }
}

function formatPrescription(prescription) {
  // medical_record_id thực chất là _id của KetQuaKham (xem model DonThuoc.js) — KetQuaKham
  // không có ten_khach/ngay_kham (2 field đó thuộc LichHen), nên phải đọc qua appointment_id
  // đã populate lồng bên trong (xem .populate() ở getPrescriptions/getPrescriptionById).
  const record = prescription.medical_record_id
  const appt = record?.appointment_id
  return {
    _id: prescription._id,
    ket_qua_kham_id: prescription.ket_qua_kham_id?._id ?? prescription.ket_qua_kham_id ?? null,
    medical_record_id: record?._id ?? record ?? null,
    medical_record: record
      ? {
          _id: record._id ?? record,
          appointment_id: appt?._id ?? appt ?? null,
          ten_khach: appt?.ten_khach ?? null,
          ngay_kham: appt?.ngay_kham ?? null,
          chan_doan: record.chan_doan ?? null,
        }
      : null,
    member_id: prescription.member_id ?? null,
    ten_khach: prescription.ten_khach ?? null,
    doctor_id: prescription.doctor_id ?? null,
    nguon: prescription.nguon,
    ghi_chu: prescription.ghi_chu ?? null,
    items: prescription.items ?? [],
    ngay_tao: prescription.ngay_tao ?? null,
  }
}

function formatVitals(vitals) {
  return {
    _id: vitals._id,
    appointment_id: vitals.appointment_id ?? null,
    member_id: vitals.member_id ?? null,
    can_nang: vitals.can_nang ?? null,
    chieu_cao: vitals.chieu_cao ?? null,
    huyet_ap: vitals.huyet_ap ?? null,
    nhiet_do: vitals.nhiet_do ?? null,
    nhip_tim: vitals.nhip_tim ?? null,
    nguoi_do_id: vitals.nguoi_do_id ?? null,
    thoi_diem_do: vitals.thoi_diem_do ?? null,
    co_the_sua: vitals.co_the_sua,
    lich_su_cap_nhat: vitals.lich_su_cap_nhat ?? [],
    ngay_tao: vitals.ngay_tao ?? null,
    ngay_cap_nhat: vitals.ngay_cap_nhat ?? null,
  }
}

export async function getExamResults(req, res) {
  try {
    const filter = {}
    if (req.query.appointment_id) {
      if (!isValidObjectId(req.query.appointment_id)) {
        return fail(res, 400, 'appointment_id khong hop le')
      }
      filter.appointment_id = req.query.appointment_id
    }

    const results = await KetQuaKham.find(filter).sort({ ngay_tao: -1, _id: -1 }).lean()
    return ok(res, results.map(formatBaseExamResult))
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export async function getExamResultById(req, res) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return fail(res, 400, 'ID ket qua kham khong hop le')
    }

    const result = await KetQuaKham.findById(req.params.id).lean()
    if (!result) {
      return fail(res, 404, 'Khong tim thay ket qua kham')
    }

    return ok(res, formatBaseExamResult(result))
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export async function getSpecialtyResults(req, res) {
  try {
    const { type } = req.params
    const modelMap = {
      tai: KetQuaKhamTai,
      mui: KetQuaKhamMui,
      hong: KetQuaKhamHong,
    }

    const Model = modelMap[type]
    if (!Model) {
      return fail(res, 404, 'Khong tim thay loai ket qua chuyen khoa')
    }

    const filter = {}
    if (req.query.appointment_id) {
      if (!isValidObjectId(req.query.appointment_id)) {
        return fail(res, 400, 'appointment_id khong hop le')
      }
      filter.appointment_id = req.query.appointment_id
    }

    const results = await Model.find(filter).sort({ ngay_tao: -1, _id: -1 }).lean()
    return ok(res, results.map(formatSpecialtyResult))
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export async function getPrescriptions(req, res) {
  try {
    const filter = {}
    if (req.query.ket_qua_kham_id) {
      if (!isValidObjectId(req.query.ket_qua_kham_id)) {
        return fail(res, 400, 'ket_qua_kham_id khong hop le')
      }
      filter.ket_qua_kham_id = req.query.ket_qua_kham_id
    }

    const prescriptions = await DonThuoc.find(filter)
      .populate({
        path: 'medical_record_id',
        select: 'appointment_id chan_doan',
        populate: { path: 'appointment_id', select: 'ten_khach ngay_kham' },
      })
      .sort({ ngay_tao: -1, _id: -1 })
      .lean()

    return ok(res, prescriptions.map(formatPrescription))
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export async function getPrescriptionById(req, res) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return fail(res, 400, 'ID don thuoc khong hop le')
    }

    const prescription = await DonThuoc.findById(req.params.id)
      .populate({
        path: 'medical_record_id',
        select: 'appointment_id chan_doan',
        populate: { path: 'appointment_id', select: 'ten_khach ngay_kham' },
      })
      .lean()

    if (!prescription) {
      return fail(res, 404, 'Khong tim thay don thuoc')
    }

    return ok(res, formatPrescription(prescription))
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export async function getVitals(req, res) {
  try {
    const filter = {}
    if (req.query.appointment_id) {
      if (!isValidObjectId(req.query.appointment_id)) {
        return fail(res, 400, 'appointment_id khong hop le')
      }
      filter.appointment_id = req.query.appointment_id
    }

    const vitals = await SinhHieuKham.find(filter).sort({ ngay_tao: -1, _id: -1 }).lean()
    return ok(res, vitals.map(formatVitals))
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export async function getVitalById(req, res) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return fail(res, 400, 'ID sinh hieu kham khong hop le')
    }

    const vitals = await SinhHieuKham.findById(req.params.id).lean()
    if (!vitals) {
      return fail(res, 404, 'Khong tim thay sinh hieu kham')
    }

    return ok(res, formatVitals(vitals))
  } catch (error) {
    return fail(res, 500, error.message)
  }
}
