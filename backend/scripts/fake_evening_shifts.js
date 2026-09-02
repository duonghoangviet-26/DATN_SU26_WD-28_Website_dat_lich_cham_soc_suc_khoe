import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI is missing in .env");
  process.exit(1);
}

const slotSchema = new mongoose.Schema({
  gio_bat_dau: String,
  gio_ket_thuc: String,
  khung_index: Number,
  loai_slot: String,
  specialty_id: mongoose.Schema.Types.ObjectId,
  phong_kham: String,
  phong_id: mongoose.Schema.Types.ObjectId,
  status: String,
  benh_nhan_id: mongoose.Schema.Types.ObjectId,
  benh_nhan_tam_giu_id: mongoose.Schema.Types.ObjectId,
});

const doctorScheduleSchema = new mongoose.Schema({
  doctor_id: mongoose.Schema.Types.ObjectId,
  chi_nhanh_id: mongoose.Schema.Types.ObjectId,
  ngay: Date,
  trang_thai_ngay: String,
  trang_thai_xac_nhan: String,
  slots: [slotSchema]
}, { collection: 'lich_lam_viec' });

const LichLamViec = mongoose.model('LichLamViecFake', doctorScheduleSchema);
const BacSi = mongoose.model('BacSiFake', new mongoose.Schema({
  trang_thai_duyet: String,
  trang_thai: String,
  chi_nhanh_id: mongoose.Schema.Types.ObjectId,
  phong_kham_mac_dinh: String,
  specialties: [mongoose.Schema.Types.ObjectId]
}, { collection: 'bac_si' }));

const generateEveningSlots = (specialtyId, phongKham) => {
  const times = [
    ['18:00', '18:30'], ['18:30', '19:00'], ['19:00', '19:30'], ['19:30', '20:00'],
    ['20:00', '20:30'], ['20:30', '21:00'], ['21:00', '21:30'], ['21:30', '22:00'],
    ['22:00', '22:30'], ['22:30', '23:00'], ['23:00', '23:30'], ['23:30', '24:00']
  ];
  return times.map(([start, end]) => ({
    gio_bat_dau: start,
    gio_ket_thuc: end,
    khung_index: null, // Compatible with old format/no strict index
    loai_slot: 'online',
    specialty_id: specialtyId,
    phong_kham: phongKham,
    status: 'active',
    benh_nhan_id: null,
    benh_nhan_tam_giu_id: null
  }));
};

const startOfDateUTC = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB.");

    const today = startOfDateUTC(new Date());
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(today.getUTCDate() + 1);

    const targetDates = [today, tomorrow];

    const activeDoctors = await BacSi.find({
      trang_thai: 'active'
    }).lean();

    console.log(`Found ${activeDoctors.length} active doctors.`);

    for (const doctor of activeDoctors) {
      const docId = doctor._id;
      const specialtyId = (doctor.specialties && doctor.specialties.length > 0) ? doctor.specialties[0] : null;
      const phongKham = doctor.phong_kham_mac_dinh || 'Phòng khám tiêu chuẩn';
      const eveningSlots = generateEveningSlots(specialtyId, phongKham);

      for (const date of targetDates) {
        let schedule = await LichLamViec.findOne({ doctor_id: docId, ngay: date });

        if (schedule) {
          // Add slots if they don't already exist for 18:00
          const hasEvening = schedule.slots.some(s => s.gio_bat_dau === '18:00');
          if (!hasEvening) {
            schedule.slots.push(...eveningSlots);
            await schedule.save();
            console.log(`Updated schedule for doctor ${docId} on ${date.toISOString().split('T')[0]}`);
          }
        } else {
          // Create new schedule
          schedule = new LichLamViec({
            doctor_id: docId,
            chi_nhanh_id: doctor.chi_nhanh_id,
            ngay: date,
            trang_thai_ngay: 'lam_viec',
            trang_thai_xac_nhan: 'da_xac_nhan',
            slots: eveningSlots
          });
          await schedule.save();
          console.log(`Created new schedule for doctor ${docId} on ${date.toISOString().split('T')[0]}`);
        }
      }
    }

    console.log("Fake evening shifts successfully created for 2 days.");
  } catch (error) {
    console.error("Error generating fake slots:", error);
  } finally {
    mongoose.disconnect();
  }
}

main();
