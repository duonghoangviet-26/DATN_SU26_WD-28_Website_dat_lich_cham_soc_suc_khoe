import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import { runMigration } from './_migrationRunner.js'

const currentFile = fileURLToPath(import.meta.url)
const currentDir = path.dirname(currentFile)
const defaultReportPath = path.join(currentDir, 'reports', '003-backfill-specialty-id-report.json')

const missingSpecialtyFilter = {
  $or: [{ specialty_id: { $exists: false } }, { specialty_id: null }],
}

function resolveReportPath() {
  return process.env.BACKFILL_SPECIALTY_REPORT_PATH || defaultReportPath
}

function writeReport(reportPath, entries) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, JSON.stringify(entries, null, 2))
}

async function buildDoctorSpecialtyMap(connection) {
  const doctors = await connection.collection('bac_si')
    .find(
      {},
      { projection: { _id: 1, specialties: 1 } }
    )
    .toArray()

  return new Map(
    doctors.map((doctor) => {
      const firstSpecialty = Array.isArray(doctor.specialties) && doctor.specialties.length > 0
        ? doctor.specialties[0]
        : null

      return [doctor._id.toString(), firstSpecialty]
    })
  )
}

const result = await runMigration({
  name: '003-backfill-specialty-id',
  rollbackable: true,
  async up({ connection }) {
    const reportPath = resolveReportPath()
    const doctorSpecialtyMap = await buildDoctorSpecialtyMap(connection)
    const appointments = await connection.collection('lich_hen')
      .find({
        ...missingSpecialtyFilter,
        doctor_id: { $exists: true, $ne: null },
      })
      .toArray()

    const reportEntries = []
    let affectedDocuments = 0

    for (const appointment of appointments) {
      const doctorId = appointment.doctor_id.toString()
      const resolvedSpecialtyId = doctorSpecialtyMap.get(doctorId)

      if (!resolvedSpecialtyId) {
        reportEntries.push({
          appointment_id: appointment._id.toString(),
          doctor_id: doctorId,
          reason: 'doctor_has_no_specialties',
        })
        continue
      }

      if (!mongoose.Types.ObjectId.isValid(resolvedSpecialtyId)) {
        reportEntries.push({
          appointment_id: appointment._id.toString(),
          doctor_id: doctorId,
          reason: 'doctor_first_specialty_invalid',
        })
        continue
      }

      const updateResult = await connection.collection('lich_hen').updateOne(
        { _id: appointment._id },
        { $set: { specialty_id: new mongoose.Types.ObjectId(resolvedSpecialtyId) } }
      )

      affectedDocuments += updateResult.modifiedCount
    }

    writeReport(reportPath, reportEntries)

    return affectedDocuments
  },
})

console.log(JSON.stringify(result))
