import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { runMigration } from './_migrationRunner.js'

const currentFile = fileURLToPath(import.meta.url)
const currentDir = path.dirname(currentFile)
const defaultReportPath = path.resolve(currentDir, '../../reports/migration/thanh-toan-missing-hoa-don.md')

function resolveReportPath() {
  return process.env.THANH_TOAN_MISSING_HOA_DON_REPORT_PATH || defaultReportPath
}

function writeReport(reportPath, entries) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })

  if (entries.length === 0) {
    fs.writeFileSync(reportPath, '# ThanhToan missing HoaDon\n\nKhong co ban ghi loi.\n')
    return
  }

  const lines = ['# ThanhToan missing HoaDon', '']

  for (const entry of entries) {
    lines.push(`- thanh_toan_id: ${entry.thanh_toan_id}`)
    lines.push(`  appointment_id: ${entry.appointment_id}`)
    lines.push(`  ly_do: ${entry.reason}`)
  }

  fs.writeFileSync(reportPath, lines.join('\n') + '\n')
}

const result = await runMigration({
  name: '006-attach-hoa-don-id-to-legacy-thanh-toan',
  rollbackable: true,
  async up({ connection }) {
    const reportPath = resolveReportPath()
    const reportEntries = []
    let affectedDocuments = 0

    const invoices = await connection.collection('hoa_don')
      .find({}, { projection: { _id: 1, appointment_id: 1 } })
      .toArray()

    const invoiceByAppointmentId = new Map(
      invoices
        .filter((invoice) => invoice.appointment_id)
        .map((invoice) => [invoice.appointment_id.toString(), invoice._id])
    )

    const legacyPayments = await connection.collection('thanh_toan').find({
      appointment_id: { $exists: true, $ne: null },
      $or: [{ hoa_don_id: { $exists: false } }, { hoa_don_id: null }],
    }).toArray()

    for (const payment of legacyPayments) {
      const appointmentId = payment.appointment_id.toString()
      const invoiceId = invoiceByAppointmentId.get(appointmentId)

      if (!invoiceId) {
        reportEntries.push({
          thanh_toan_id: payment._id.toString(),
          appointment_id: appointmentId,
          reason: 'missing_hoa_don',
        })
        continue
      }

      const updateResult = await connection.collection('thanh_toan').updateOne(
        { _id: payment._id },
        { $set: { hoa_don_id: invoiceId } }
      )

      affectedDocuments += updateResult.modifiedCount
    }

    writeReport(reportPath, reportEntries)

    return affectedDocuments
  },
})

console.log(JSON.stringify(result))
