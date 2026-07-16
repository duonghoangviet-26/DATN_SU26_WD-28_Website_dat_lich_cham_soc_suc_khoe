import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { runMigration } from './_migrationRunner.js'

// ============================================================
// Backfill so_ngay cho DonThuoc.items tao truoc luc doi schema 2026-07-11
// (xem docs/Bác sĩ/Sua doi - Ngay tai kham va so ngay uong thuoc...).
// Cac item cu con ngay_bat_dau/ngay_ket_thuc (Date), thieu han so_ngay (Number)
// ma model hien tai yeu cau. Tinh so_ngay = so ngay chenh lech, kep [1, 90]
// (khop MAX_NGAY trong backend/src/models/DonThuoc.js). Sau do bo 2 field cu.
// ============================================================

const MIN_NGAY = 1
const MAX_NGAY = 90
const DEFAULT_SO_NGAY = 7 // dung khi thieu 1 trong 2 moc ngay (du lieu hong) - ghi vao bao cao de soat tay

const currentFile = fileURLToPath(import.meta.url)
const currentDir = path.dirname(currentFile)
const defaultReportPath = path.resolve(currentDir, '../../reports/migration/don-thuoc-backfill-so-ngay.md')

function resolveReportPath() {
  return process.env.DON_THUOC_SO_NGAY_REPORT_PATH || defaultReportPath
}

function writeReport(reportPath, entries) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })

  if (entries.length === 0) {
    fs.writeFileSync(reportPath, '# DonThuoc backfill so_ngay\n\nKhong co document nao can migrate.\n')
    return
  }

  const lines = ['# DonThuoc backfill so_ngay', '']
  for (const entry of entries) {
    lines.push(`- don_thuoc_id: ${entry.don_thuoc_id}`)
    lines.push(`  ten_thuoc: ${entry.ten_thuoc}`)
    lines.push(`  so_ngay_moi: ${entry.so_ngay}${entry.dung_mac_dinh ? ' (dung mac dinh - thieu moc ngay)' : ''}`)
  }
  fs.writeFileSync(reportPath, lines.join('\n') + '\n')
}

function tinhSoNgay(item) {
  if (!item.ngay_bat_dau || !item.ngay_ket_thuc) {
    return { so_ngay: DEFAULT_SO_NGAY, dung_mac_dinh: true }
  }
  const diffMs = new Date(item.ngay_ket_thuc) - new Date(item.ngay_bat_dau)
  const diffDays = Math.round(diffMs / 86400000)
  const so_ngay = Math.min(MAX_NGAY, Math.max(MIN_NGAY, diffDays || DEFAULT_SO_NGAY))
  return { so_ngay, dung_mac_dinh: false }
}

const result = await runMigration({
  name: '009-backfill-don-thuoc-so-ngay',
  rollbackable: false, // ghi de item cu (ngay_bat_dau/ngay_ket_thuc) - khong luu lai de rollback
  async up({ connection }) {
    const reportEntries = []
    let affectedDocuments = 0

    const prescriptions = await connection.collection('don_thuoc').find({
      items: { $elemMatch: { so_ngay: { $exists: false } } },
    }).toArray()

    for (const prescription of prescriptions) {
      const newItems = prescription.items.map((item) => {
        if (item.so_ngay !== undefined) return item // item nay da dung schema moi, giu nguyen

        const { ngay_bat_dau, ngay_ket_thuc, ...rest } = item
        const { so_ngay, dung_mac_dinh } = tinhSoNgay(item)

        reportEntries.push({
          don_thuoc_id: prescription._id.toString(),
          ten_thuoc: item.ten_thuoc ?? '(khong ro ten)',
          so_ngay,
          dung_mac_dinh,
        })

        return { ...rest, so_ngay }
      })

      const updateResult = await connection.collection('don_thuoc').updateOne(
        { _id: prescription._id },
        { $set: { items: newItems } }
      )
      affectedDocuments += updateResult.modifiedCount
    }

    writeReport(resolveReportPath(), reportEntries)

    return affectedDocuments
  },
})

console.log(JSON.stringify(result))
