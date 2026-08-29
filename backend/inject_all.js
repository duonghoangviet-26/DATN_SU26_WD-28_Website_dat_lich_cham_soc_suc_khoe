import 'dotenv/config';
import mongoose from 'mongoose';
import { LichLamViec } from './src/models/index.js';
import { DEFAULT_SLOT_TIMES } from './src/services/scheduleGenerator.service.js';

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    // TÌM TẤT CẢ LỊCH TỪ NGÀY MAI TRỞ ĐI
    const docs = await LichLamViec.find({
        ngay: { $gte: new Date('2026-08-30T00:00:00Z') }
    });
    
    let updatedCount = 0;
    
    for (const doc of docs) {
        if (doc.slots.length === 15) {
            console.log(`Injecting evening slots for doctor ${doc.doctor_id} on date ${doc.ngay.toISOString()}...`);
            // Create evening slots (khung 15 -> 26)
            const eveningSlots = [];
            for (let khungIndex = 15; khungIndex <= 26; khungIndex++) {
                const [gio_bat_dau, gio_ket_thuc] = DEFAULT_SLOT_TIMES[khungIndex];
                
                // create 2 slots (so_slot_moi_khung = 2, using default config)
                for (let i = 0; i < 2; i++) {
                    eveningSlots.push({
                        gio_bat_dau,
                        gio_ket_thuc,
                        khung_index: khungIndex,
                        loai_slot: i < 1 ? 'online' : 'walk_in', // default 50% online
                        specialty_id: doc.slots[0].specialty_id,
                        phong_kham: doc.slots[0].phong_kham,
                        phong_id: doc.slots[0].phong_id,
                        status: 'active',
                        benh_nhan_id: null,
                        benh_nhan_tam_giu_id: null,
                        lock_expires_at: null,
                        pending_expired_at: null,
                        cancel_requested: false,
                        cancel_reason: null,
                        bi_khoa_boi_nghi_phep: false,
                        nghi_phep_id: null,
                    });
                }
            }
            
            doc.slots.push(...eveningSlots);
            await doc.save();
            updatedCount++;
        }
    }

    console.log(`Updated ${updatedCount} docs.`);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
