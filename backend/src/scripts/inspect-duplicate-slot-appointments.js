import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// READ-ONLY. In chi tiet cac cap (schedule_id, slot_id) bi TRUNG lich hen, de quyet dinh
// giu ban nao truoc khi tao unique partial index (rule muc 7).

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(path.resolve(__dirname, '../..'), '.env') })

const TRANG_THAI_CON_HIEU_LUC = [
  'pending', 'confirmed', 'checked_in', 'in_progress',
  'waiting_record', 'waiting_doctor_confirm', 'completed', 'no_show', 'skipped',
]

const client = new MongoClient(process.env.MONGODB_URI)

try {
  await client.connect()
  const db = client.db()
  const lichHen = db.collection('lich_hen')

  const nhomTrung = await lichHen.aggregate([
    {
      $match: {
        status: { $in: TRANG_THAI_CON_HIEU_LUC },
        schedule_id: { $ne: null },
        slot_id: { $ne: null },
      },
    },
    { $group: { _id: { schedule_id: '$schedule_id', slot_id: '$slot_id' }, ids: { $push: '$_id' } } },
    { $match: { 'ids.1': { $exists: true } } },
  ]).toArray()

  for (const [i, nhom] of nhomTrung.entries()) {
    console.log(`\n=== Nhom ${i + 1} — slot ${nhom._id.slot_id} (lich ${nhom._id.schedule_id}) ===`)

    const docs = await lichHen.find({ _id: { $in: nhom.ids } }).toArray()
    for (const d of docs) {
      const thanhToan = await db.collection('thanh_toan')
        .find({ appointment_id: d._id }).project({ status: 1, so_tien: 1 }).toArray()
      const hangDoi = await db.collection('hang_doi').countDocuments({ appointment_id: d._id })
      const ketQua = await db.collection('ket_qua_kham').countDocuments({ appointment_id: d._id })

      console.log([
        `  ma=${d.ma_lich_hen || '(trong)'}`,
        `id=${d._id}`,
        `status=${d.status}`,
        `payment=${d.payment_status}`,
        `ngay=${d.ngay_kham?.toISOString?.().slice(0, 10)}`,
        `gio=${d.gio_kham}`,
        `nguon=${d.hinh_thuc_dat_lich || 'null'}`,
        `tao=${d.ngay_tao?.toISOString?.().slice(0, 19) || '?'}`,
      ].join('  '))
      console.log(`      khach="${d.ten_khach || ''}" user_id=${d.user_id} member_id=${d.member_id}`)
      console.log(`      thanh_toan=[${thanhToan.map((t) => `${t.status}:${t.so_tien}`).join(', ') || 'khong co'}]  hang_doi=${hangDoi}  ket_qua_kham=${ketQua}`)
    }
  }

  console.log(`\nTong: ${nhomTrung.length} nhom trung`)
} finally {
  await client.close()
}
