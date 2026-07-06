import { runMigration } from './_migrationRunner.js'

async function backfillLichHen(connection) {
  let modifiedCount = 0

  const updates = [
    {
      filter: { trang_thai_den: { $exists: false } },
      update: { $set: { trang_thai_den: 'chua_den' } },
    },
    {
      filter: { so_lan_thay_doi: { $exists: false } },
      update: { $set: { so_lan_thay_doi: 0 } },
    },
    {
      filter: { dat_ho: { $exists: false } },
      update: { $set: { dat_ho: false } },
    },
  ]

  for (const entry of updates) {
    const result = await connection.collection('lich_hen').updateMany(entry.filter, entry.update)
    modifiedCount += result.modifiedCount
  }

  return modifiedCount
}

async function backfillBacSi(connection) {
  const result = await connection.collection('bac_si').updateMany(
    { trang_thai: { $exists: false } },
    { $set: { trang_thai: 'active' } }
  )

  return result.modifiedCount
}

async function backfillNguoiDung(connection) {
  let modifiedCount = 0

  const updates = [
    {
      filter: { so_lan_huy_trong_thang: { $exists: false } },
      update: { $set: { so_lan_huy_trong_thang: 0 } },
    },
    {
      filter: { tong_so_lan_huy_lich_su: { $exists: false } },
      update: { $set: { tong_so_lan_huy_lich_su: 0 } },
    },
    {
      filter: { bi_han_che_dat_lich: { $exists: false } },
      update: { $set: { bi_han_che_dat_lich: false } },
    },
  ]

  for (const entry of updates) {
    const result = await connection.collection('nguoi_dung').updateMany(entry.filter, entry.update)
    modifiedCount += result.modifiedCount
  }

  return modifiedCount
}

const result = await runMigration({
  name: '004-backfill-default-fields',
  rollbackable: true,
  async up({ connection }) {
    let affectedDocuments = 0

    affectedDocuments += await backfillLichHen(connection)
    affectedDocuments += await backfillBacSi(connection)
    affectedDocuments += await backfillNguoiDung(connection)

    return affectedDocuments
  },
})

console.log(JSON.stringify(result))
