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
      console.log(`Found ${hangDois.length} HangDoi entries:`);
      for (const h of hangDois) {
        console.log({
          _id: h._id,
          ten_benh_nhan: h.ten_benh_nhan,
          nguon: h.nguon,
          loai_lich_hen: h.loai_lich_hen,
          lich_hen_goc_id: h.lich_hen_goc_id,
          appointment_id: h.appointment_id,
          ho_so_benh_nhan_id: h.ho_so_benh_nhan_id,
          trang_thai: h.trang_thai,
          checkin_time: h.checkin_time,
        });
        
        if (h.ho_so_benh_nhan_id) {
          const countRecords = await db.collection('ket_qua_kham').countDocuments({
            $or: [
              { ho_so_benh_nhan_id: h.ho_so_benh_nhan_id },
              ...(h.appointment_id ? [{ appointment_id: h.appointment_id }] : [])
            ]
          });
          console.log(`  -> Medical records count for ho_so_benh_nhan_id (${h.ho_so_benh_nhan_id}): ${countRecords}`);
        }
      }
    } catch (e) {
      console.error(e)
    }
    process.exit(0)
  })
