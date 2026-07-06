import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { runMigration } from './_migrationRunner.js'

const currentFile = fileURLToPath(import.meta.url)
const currentDir = path.dirname(currentFile)
const defaultReportPath = path.resolve(currentDir, '../../reports/migration/don-thuoc-missing-ket-qua-kham.md')

function resolveReportPath() {
  return process.env.DON_THUOC_REPORT_PATH || defaultReportPath
}

function writeReport(reportPath, entries) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })

  if (entries.length === 0) {
    fs.writeFileSync(reportPath, '# DonThuoc missing KetQuaKham\n\nKhong co ban ghi loi.\n')
    return
  }

  const lines = ['# DonThuoc missing KetQuaKham', '']

  for (const entry of entries) {
    lines.push(`- don_thuoc_id: ${entry.don_thuoc_id}`)
    lines.push(`  ly_do: ${entry.reason}`)
    if (entry.appointment_id) {
      lines.push(`  appointment_id: ${entry.appointment_id}`)
    }
    if (entry.medical_record_id) {
      lines.push(`  medical_record_id: ${entry.medical_record_id}`)
    }
  }

  fs.writeFileSync(reportPath, lines.join('\n') + '\n')
}

function buildKetQuaMap(results) {
  return new Map(
    results
      .filter((result) => result.appointment_id)
      .map((result) => [result.appointment_id.toString(), result._id])
  )
}

const result = await runMigration({
  name: '007-backfill-don-thuoc-ket-qua-kham-id',
  rollbackable: true,
  async up({ connection }) {
    const reportPath = resolveReportPath()
    const reportEntries = []
    let affectedDocuments = 0

    const ketQuaResults = await connection.collection('ket_qua_kham')
      .find({}, { projection: { _id: 1, appointment_id: 1 } })
      .toArray()
    const ketQuaByAppointmentId = buildKetQuaMap(ketQuaResults)

    const medicalRecords = await connection.collection('ho_so_y_te')
      .find({}, { projection: { _id: 1, appointment_id: 1 } })
      .toArray()
    const medicalRecordById = new Map(
      medicalRecords.map((record) => [record._id.toString(), record])
    )

    const prescriptions = await connection.collection('don_thuoc').find({
      $or: [{ ket_qua_kham_id: { $exists: false } }, { ket_qua_kham_id: null }],
    }).toArray()

    for (const prescription of prescriptions) {
      let ketQuaKhamId = null
      let reportReason = null

      if (prescription.appointment_id) {
        ketQuaKhamId = ketQuaByAppointmentId.get(prescription.appointment_id.toString()) || null
        if (!ketQuaKhamId) {
          reportReason = 'appointment_id_has_no_ket_qua_kham'
        }
      } else if (prescription.medical_record_id) {
        const medicalRecord = medicalRecordById.get(prescription.medical_record_id.toString())

        if (!medicalRecord) {
          reportReason = 'medical_record_not_found'
        } else if (!medicalRecord.appointment_id) {
          reportReason = 'medical_record_missing_appointment_id'
        } else {
          ketQuaKhamId = ketQuaByAppointmentId.get(medicalRecord.appointment_id.toString()) || null
          if (!ketQuaKhamId) {
            reportReason = 'medical_record_has_no_linked_ket_qua_kham'
          }
        }
      } else {
        reportReason = 'missing_mapping_source'
      }

      if (!ketQuaKhamId) {
        reportEntries.push({
          don_thuoc_id: prescription._id.toString(),
          appointment_id: prescription.appointment_id?.toString() || null,
          medical_record_id: prescription.medical_record_id?.toString() || null,
          reason: reportReason,
        })
        continue
      }

      const updateResult = await connection.collection('don_thuoc').updateOne(
        { _id: prescription._id },
        { $set: { ket_qua_kham_id: ketQuaKhamId } }
      )

      affectedDocuments += updateResult.modifiedCount
    }

    writeReport(reportPath, reportEntries)

    return affectedDocuments
  },
})

console.log(JSON.stringify(result))
