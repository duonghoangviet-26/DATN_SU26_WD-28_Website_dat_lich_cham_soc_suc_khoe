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
      
      const user = await db.collection('nguoi_dung').findOne({ email: 'lt14062006meitu@gmail.com' });
      console.log('User:', user ? { _id: user._id, email: user.email, ho_ten: user.ho_ten } : 'NOT FOUND');
      
      if (user) {
        const userObjId = user._id;
        const userStrId = String(user._id);

        // All LichHen for this user
        const allLichHens = await db.collection('lich_hen').find({
          $or: [
            { user_id: userObjId },
            { nguoi_tao_id: userObjId },
            { nguoi_dat_ho_id: userObjId },
            { email_khach: 'lt14062006meitu@gmail.com' },
            { ten_khach: user.ho_ten }
          ]
        }).toArray();

        console.log(`\nFound ${allLichHens.length} total LichHen records for this user:`);
        for (const lh of allLichHens) {
          console.log(`- _id: ${lh._id} | status: ${lh.status} | ngay_kham: ${lh.ngay_kham} | user_id: ${lh.user_id} | nguoi_dat_ho_id: ${lh.nguoi_dat_ho_id} | ten_khach: ${lh.ten_khach}`);
        }
      }

    } catch (e) {
      console.error(e)
    }
    process.exit(0)
  })
