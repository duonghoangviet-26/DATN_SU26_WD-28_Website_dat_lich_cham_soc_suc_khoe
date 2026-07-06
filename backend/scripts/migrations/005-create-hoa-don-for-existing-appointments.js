import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import { runMigration } from './_migrationRunner.js'

const currentFile = fileURLToPath(import.meta.url)
const currentDir = path.dirname(currentFile)
const defaultReportPath = path.resolve(currentDir, '../../reports/migration/hoa-don-create-skipped.md')

function resolveReportPath() {
  return process.env.HOA_DON_SKIP_REPORT_PATH || defaultReportPath
}

function formatDatePart(date) {
  const year = String(date.getUTCFullYear()).slice(-2)
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

async function nextInvoiceNumber(connection, invoiceDate) {
  const datePart = formatDatePart(invoiceDate)
  const counter = await connection.collection('counters').findOneAndUpdate(
    { key: `so_hoa_don_${datePart}` },
    {
      $inc: { seq: 1 },
      $setOnInsert: { key: `so_hoa_don_${datePart}` },
    },
    {
      upsert: true,
      returnDocument: 'after',
    }
  )

  const counterDocument = counter?.value ?? counter
  const sequence = String(counterDocument.seq).padStart(4, '0')
  return `HD-${datePart}-${sequence}`
}

function writeSkipReport(reportPath, entries) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })

  if (entries.length === 0) {
    fs.writeFileSync(reportPath, '# HoaDon create skipped\n\nKhong co lich hen bi skip.\n')
    return
  }

  const lines = ['# HoaDon create skipped', '']

  for (const entry of entries) {
    lines.push(`- appointment_id: ${entry.appointment_id}`)
    lines.push(`  ly_do: ${entry.reason}`)
    if (entry.doctor_id) {
      lines.push(`  doctor_id: ${entry.doctor_id}`)
    }
  }

  fs.writeFileSync(reportPath, lines.join('\n') + '\n')
}

const result = await runMigration({
  name: '005-create-hoa-don-for-existing-appointments',
  rollbackable: true,
  async up({ connection }) {
    const reportPath = resolveReportPath()
    const skipEntries = []
    let affectedDocuments = 0

    const existingInvoiceAppointmentIds = await connection.collection('hoa_don').distinct('appointment_id')
    const existingAppointmentSet = new Set(
      existingInvoiceAppointmentIds.filter(Boolean).map((value) => value.toString())
    )

    const doctors = await connection.collection('bac_si')
      .find({}, { projection: { _id: 1, phi_kham: 1 } })
      .toArray()
    const doctorMap = new Map(doctors.map((doctor) => [doctor._id.toString(), doctor]))

    const appointments = await connection.collection('lich_hen').find({}).sort({ ngay_tao: 1, _id: 1 }).toArray()

    for (const appointment of appointments) {
      if (existingAppointmentSet.has(appointment._id.toString())) {
        continue
      }

      const doctorId = appointment.doctor_id ? appointment.doctor_id.toString() : null
      const doctor = doctorId ? doctorMap.get(doctorId) : null

      if (!doctor) {
        skipEntries.push({
          appointment_id: appointment._id.toString(),
          doctor_id: doctorId,
          reason: 'missing_doctor',
        })
        continue
      }

      if (typeof doctor.phi_kham !== 'number' || !Number.isFinite(doctor.phi_kham) || doctor.phi_kham < 0) {
        skipEntries.push({
          appointment_id: appointment._id.toString(),
          doctor_id: doctorId,
          reason: 'missing_phi_kham',
        })
        continue
      }

      const invoiceDate = appointment.ngay_tao instanceof Date
        ? appointment.ngay_tao
        : appointment.ngay_kham instanceof Date
          ? appointment.ngay_kham
          : new Date()

      const soHoaDon = await nextInvoiceNumber(connection, invoiceDate)

      await connection.collection('hoa_don').insertOne({
        appointment_id: appointment._id,
        so_hoa_don: soHoaDon,
        chi_nhanh_id: appointment.chi_nhanh_id ?? null,
        specialty_id: appointment.specialty_id ?? null,
        tong_tien_kham: doctor.phi_kham,
        chi_tiet_thu_phi: [
          {
            loai: 'phi_kham',
            ten: 'Phi kham',
            so_tien: doctor.phi_kham,
            so_luong: 1,
            thanh_tien: doctor.phi_kham,
            ghi_chu: null,
            created_at: new Date(),
          },
        ],
        tong_tien_phat_sinh: 0,
        tong_thanh_toan: doctor.phi_kham,
        trang_thai_hoa_don: 'chua_thanh_toan',
        ghi_chu_ke_toan: null,
        created_at: new Date(),
        updated_at: new Date(),
      })

      existingAppointmentSet.add(appointment._id.toString())
      affectedDocuments += 1
    }

    writeSkipReport(reportPath, skipEntries)

    return affectedDocuments
  },
})

console.log(JSON.stringify(result))
