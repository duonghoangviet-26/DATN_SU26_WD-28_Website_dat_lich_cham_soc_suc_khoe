import mongoose from 'mongoose';
import { MauLichLamViec, LichLamViec } from './backend/src/models/index.js';

mongoose.connect('mongodb://127.0.0.1:27017/DATN_VITAFAMILY')
  .then(async () => {
    const templates = await MauLichLamViec.find({}).lean();
    console.log('--- MauLichLamViec (Templates) ---');
    templates.forEach(t => console.log(`Doc ${t.doctor_id}: ca_lam_viec =`, t.ca_lam_viec));

    const docs = await LichLamViec.find({'slots.gio_bat_dau': { $gte: '18:00' }}).lean();
    console.log('\n--- LichLamViec (Actual schedules) ---');
    console.log(`Co ${docs.length} LichLamViec chua slot toi (> 18:00).`);
    if (docs.length > 0) {
       console.log('Example ngay:', docs[0].ngay);
    }

    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
