import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    try {
      const db = mongoose.connection.db;
      
      const hangDois = await db.collection('hang_doi').find({}).toArray();
      let updatedCount = 0;

      for (const h of hangDois) {
        if (h.ho_so_benh_nhan_id) {
          const prevRecord = await db.collection('ket_qua_kham').findOne({
            ho_so_benh_nhan_id: h.ho_so_benh_nhan_id,
            _id: { $ne: h.ket_qua_kham_id }
          });
          const prevAppt = await db.collection('lich_hen').findOne({
            ho_so_benh_nhan_id: h.ho_so_benh_nhan_id,
            status: 'completed',
            _id: { $ne: h.appointment_id }
          });

          if (prevRecord || prevAppt) {
            const lichHenGocId = h.lich_hen_goc_id || (prevRecord ? prevRecord.appointment_id : (prevAppt ? prevAppt._id : null));
            await db.collection('hang_doi').updateOne(
              { _id: h._id },
              { $set: { loai_lich_hen: 'tai_kham', ...(lichHenGocId ? { lich_hen_goc_id: lichHenGocId } : {}) } }
            );
            console.log(`Updated HangDoi ${h._id} (${h.ten_benh_nhan}) to loai_lich_hen: 'tai_kham'`);
            updatedCount++;
          }
        }
      }
      console.log(`\nUpdated ${updatedCount} total HangDoi entries.`);
    } catch (e) {
      console.error(e)
    }
    process.exit(0)
  })
