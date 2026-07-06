import 'dotenv/config'
import mongoose from 'mongoose'

import BacSi from '../src/models/BacSi.js'
import LichHen from '../src/models/LichHen.js'
import HoaDon from '../src/models/HoaDon.js'
import ThanhToan from '../src/models/ThanhToan.js'
import DonThuoc from '../src/models/DonThuoc.js'
import ThongBao from '../src/models/ThongBao.js'
import CauHinhPhongKham from '../src/models/CauHinhPhongKham.js'

function toId(value) {
  return value ? value.toString() : 'unknown'
}

function pushIssue(issues, collection, documentId, reason) {
  issues.push({ collection, documentId, reason })
}

async function ensureModelsReady() {
  await Promise.all([
    BacSi.init(),
    LichHen.init(),
    HoaDon.init(),
    ThanhToan.init(),
    DonThuoc.init(),
    ThongBao.init(),
    CauHinhPhongKham.init(),
  ])
}

async function checkDoctors(issues) {
  const doctors = await BacSi.find({}, { _id: 1, phi_kham: 1, trang_thai: 1 }).lean()

  for (const doctor of doctors) {
    if (typeof doctor.phi_kham !== 'number' || !Number.isFinite(doctor.phi_kham)) {
      pushIssue(issues, 'bac_si', toId(doctor._id), 'missing_phi_kham')
    }

    if (!doctor.trang_thai) {
      pushIssue(issues, 'bac_si', toId(doctor._id), 'missing_trang_thai')
    }
  }
}

async function checkAppointments(issues) {
  const doctors = await BacSi.find({}, { _id: 1, chi_nhanh_id: 1, phi_kham: 1 }).lean()
  const doctorMap = new Map(doctors.map((doctor) => [doctor._id.toString(), doctor]))

  const invoiceAppointmentIds = await HoaDon.distinct('appointment_id')
  const invoiceAppointmentIdSet = new Set(invoiceAppointmentIds.filter(Boolean).map((id) => id.toString()))

  const appointments = await LichHen.find({}, { _id: 1, doctor_id: 1, chi_nhanh_id: 1 }).lean()

  for (const appointment of appointments) {
    const doctorId = appointment.doctor_id?.toString?.() ?? null
    const doctor = doctorId ? doctorMap.get(doctorId) : null

    if (!appointment.chi_nhanh_id && doctor?.chi_nhanh_id) {
      pushIssue(issues, 'lich_hen', toId(appointment._id), 'missing_chi_nhanh_id_while_doctor_has_branch')
    }

    const canRequireInvoice =
      doctor &&
      typeof doctor.phi_kham === 'number' &&
      Number.isFinite(doctor.phi_kham) &&
      doctor.phi_kham >= 0

    if (canRequireInvoice && !invoiceAppointmentIdSet.has(appointment._id.toString())) {
      pushIssue(issues, 'lich_hen', toId(appointment._id), 'missing_hoa_don_for_valid_appointment')
    }
  }
}

async function checkInvoices(issues) {
  const duplicates = await HoaDon.aggregate([
    {
      $group: {
        _id: '$appointment_id',
        count: { $sum: 1 },
        ids: { $push: '$_id' },
      },
    },
    {
      $match: {
        _id: { $ne: null },
        count: { $gt: 1 },
      },
    },
  ])

  for (const duplicate of duplicates) {
    for (const id of duplicate.ids) {
      pushIssue(issues, 'hoa_don', toId(id), `duplicate_appointment_id:${toId(duplicate._id)}`)
    }
  }
}

async function checkPayments(issues) {
  const invalidPayments = await ThanhToan.find(
    {
      $and: [
        {
          $or: [
            { appointment_id: null },
            { appointment_id: { $exists: false } },
          ],
        },
        {
          $or: [
            { hoa_don_id: null },
            { hoa_don_id: { $exists: false } },
          ],
        },
      ],
    },
    { _id: 1 }
  ).lean()

  for (const payment of invalidPayments) {
    pushIssue(issues, 'thanh_toan', toId(payment._id), 'new_payment_missing_hoa_don_id')
  }
}

async function checkPrescriptions(issues) {
  const prescriptions = await DonThuoc.find(
    {
      $or: [
        { ket_qua_kham_id: null },
        { ket_qua_kham_id: { $exists: false } },
      ],
    },
    { _id: 1 }
  ).lean()

  for (const prescription of prescriptions) {
    pushIssue(issues, 'don_thuoc', toId(prescription._id), 'missing_ket_qua_kham_id')
  }
}

async function checkNotifications(issues) {
  const notifications = await ThongBao.find(
    {
      $and: [
        {
          $or: [
            { ngay_gui_du_kien: null },
            { ngay_gui_du_kien: { $exists: false } },
          ],
        },
        {
          $or: [
            { kenh_gui: { $exists: true } },
            { da_gui: { $exists: true } },
            { thoi_diem_gui: { $exists: true } },
            { thoi_diem_doc: { $exists: true } },
            { du_lieu_dinh_kem: { $exists: true } },
          ],
        },
      ],
    },
    { _id: 1 }
  ).lean()

  for (const notification of notifications) {
    pushIssue(issues, 'thong_bao', toId(notification._id), 'new_notification_missing_ngay_gui_du_kien')
  }
}

async function checkClinicConfig(issues) {
  const count = await CauHinhPhongKham.countDocuments()
  if (count > 1) {
    const configs = await CauHinhPhongKham.find({}, { _id: 1 }).lean()
    for (const config of configs) {
      pushIssue(issues, 'cau_hinh_phong_kham', toId(config._id), 'multiple_singleton_documents')
    }
  }
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Missing MONGODB_URI')
  }

  await mongoose.connect(process.env.MONGODB_URI)

  try {
    await ensureModelsReady()

    const issues = []
    await checkDoctors(issues)
    await checkAppointments(issues)
    await checkInvoices(issues)
    await checkPayments(issues)
    await checkPrescriptions(issues)
    await checkNotifications(issues)
    await checkClinicConfig(issues)

    if (issues.length > 0) {
      for (const issue of issues) {
        console.error(`${issue.collection} | ${issue.documentId} | ${issue.reason}`)
      }
      process.exitCode = 1
      return
    }

    console.log('DATA_INTEGRITY_PASS')
  } finally {
    await mongoose.disconnect()
  }
}

await main()
