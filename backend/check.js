import 'dotenv/config';
import mongoose from 'mongoose';
import { MauLichLamViec, LichLamViec } from './src/models/index.js';

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const docs = await LichLamViec.find({
        ngay: new Date('2026-08-29T00:00:00Z')
    }).lean();
    console.log(`Co ${docs.length} LichLamViec cho ngay 2026-08-29`);
    if(docs.length > 0) {
        docs.forEach(d => {
            console.log(`Doc ID: ${d.doctor_id}, status: ${d.trang_thai_ngay}, slots length: ${d.slots.length}`);
            const lastSlot = d.slots[d.slots.length - 1];
            console.log(`   Last slot: ${lastSlot?.gio_bat_dau} - ${lastSlot?.gio_ket_thuc}`);
        });
    }

    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
