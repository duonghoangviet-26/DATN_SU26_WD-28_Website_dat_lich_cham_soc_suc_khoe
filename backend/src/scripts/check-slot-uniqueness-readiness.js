import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// ============================================================
// KIEM TRA SAN SANG cho unique partial index {schedule_id, slot_id}
// Rule muc 7: moi slot <-> toi da 1 LichHen. Rang buoc nay hien CHI ton tai trong code.
// ============================================================
// READ-ONLY tuyet doi. Tao index tren du lieu con trung se THAT BAI giua chung, nen phai
// do truoc: (1) MongoDB co ho tro $in trong partialFilterExpression khong (>= 5.3),
// (2) da co cap (schedule_id, slot_id) nao trung o lich chua huy chua.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(path.resolve(__dirname, '../..'), '.env') })

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('Thieu MONGODB_URI trong backend/.env')
  process.exit(1)
}

const TRANG_THAI_CON_HIEU_LUC = [
  'pending', 'confirmed', 'checked_in', 'in_progress',
  'waiting_record', 'waiting_doctor_confirm', 'completed', 'no_show', 'skipped',
]

const client = new MongoClient(uri)

try {
  await client.connect()
  const db = client.db()

  const buildInfo = await db.admin().command({ buildInfo: 1 })
  const [major, minor] = buildInfo.version.split('.').map(Number)
  const hoTroInTrongPartial = major > 5 || (major === 5 && minor >= 3)

  console.log(`MongoDB version         : ${buildInfo.version}`)
  console.log(`Ho tro $in trong partial: ${hoTroInTrongPartial ? 'CO' : 'KHONG (can >= 5.3)'}`)

  const lichHen = db.collection('lich_hen')
  const tong = await lichHen.countDocuments({})
  const conHieuLuc = await lichHen.countDocuments({
    status: { $in: TRANG_THAI_CON_HIEU_LUC },
    schedule_id: { $ne: null },
    slot_id: { $ne: null },
  })

  const trung = await lichHen.aggregate([
    {
      $match: {
        status: { $in: TRANG_THAI_CON_HIEU_LUC },
        schedule_id: { $ne: null },
        slot_id: { $ne: null },
      },
    },
    { $group: { _id: { schedule_id: '$schedule_id', slot_id: '$slot_id' }, so: { $sum: 1 }, ma: { $push: '$ma_lich_hen' } } },
    { $match: { so: { $gt: 1 } } },
    { $sort: { so: -1 } },
  ]).toArray()

  console.log(`\nTong lich hen           : ${tong}`)
  console.log(`Lich con hieu luc co slot: ${conHieuLuc}`)
  console.log(`Cap (schedule, slot) trung: ${trung.length}`)

  for (const nhom of trung.slice(0, 20)) {
    console.log(`  - slot ${nhom._id.slot_id} co ${nhom.so} lich: ${nhom.ma.join(', ')}`)
  }
  if (trung.length > 20) console.log(`  ... con ${trung.length - 20} nhom nua`)

  const indexes = await lichHen.indexes()
  const daCo = indexes.find((i) => i.name?.includes('schedule_id_1_slot_id_1'))
  console.log(`\nIndex hien co           : ${daCo ? daCo.name : 'chua co'}`)

  console.log(
    `\nKET LUAN: ${
      !hoTroInTrongPartial
        ? 'KHONG the tao partial index dang $in tren phien ban nay.'
        : trung.length === 0
          ? 'SAN SANG — co the tao unique partial index.'
          : `CHUA SAN SANG — phai xu ly ${trung.length} nhom trung truoc.`
    }`
  )
} finally {
  await client.close()
}
