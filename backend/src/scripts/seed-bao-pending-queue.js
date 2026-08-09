import '../config/timezone.js'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

import { BacSi, HangDoi, HoSoBenhNhan, NguoiDung } from '../models/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })

const TAG = 'TEST-BS-BAO-QUEUE-20260808'
const CLINIC_DATE_KEY = '2026-08-08'
const FIXED_DOCTOR_NAME = 'BS. Lê Quốc Bảo'

const FIXTURES = [
  {
    profileName: 'Nguyễn Thị Minh An',
    phone: '0901234501',
    birthDate: '1996-04-12',
    gender: 'nu',
    checkinTime: '2026-08-08T08:15:00+07:00',
  },
  {
    profileName: 'Trần Gia Huy',
    phone: '0901234502',
    birthDate: '2013-09-21',
    gender: 'nam',
    checkinTime: '2026-08-08T08:22:00+07:00',
  },
]

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Thiếu MONGODB_URI trong backend/.env')
  }

  await mongoose.connect(process.env.MONGODB_URI)

  const doctor = await BacSi.findOne({ trang_thai: 'active', trang_thai_duyet: 'approved' })
    .populate('user_id', 'ho_ten email')
    .lean()

  const doctorByName = doctor?.user_id?.ho_ten === FIXED_DOCTOR_NAME
    ? doctor
    : await BacSi.findOne({ trang_thai: 'active', trang_thai_duyet: 'approved' })
      .populate({
        path: 'user_id',
        select: 'ho_ten email',
        match: { ho_ten: FIXED_DOCTOR_NAME },
      })
      .lean()

  const targetDoctor = doctorByName?.user_id?.ho_ten === FIXED_DOCTOR_NAME
    ? doctorByName
    : await BacSi.find()
      .populate('user_id', 'ho_ten email')
      .lean()
      .then((items) => items.find((item) => item.user_id?.ho_ten === FIXED_DOCTOR_NAME) ?? null)

  if (!targetDoctor) {
    throw new Error(`Không tìm thấy bác sĩ "${FIXED_DOCTOR_NAME}"`)
  }

  const receptionistUser = await NguoiDung.findOne({ vai_tro: 'receptionist' }).select('_id').lean()

  const existingProfiles = await HoSoBenhNhan.find({ ghi_chu: TAG }).select('_id').lean()
  const existingProfileIds = existingProfiles.map((item) => item._id)
  if (existingProfileIds.length) {
    await HangDoi.deleteMany({
      ho_so_benh_nhan_id: { $in: existingProfileIds },
      doctor_id: targetDoctor._id,
      ngay_checkin_key: CLINIC_DATE_KEY,
      trang_thai: { $in: ['dang_cho', 'da_goi', 'trong_phong'] },
    })
  }
  await HoSoBenhNhan.deleteMany({ ghi_chu: TAG })

  const baseQueueNumber = await HangDoi.countDocuments({ ngay_checkin_key: CLINIC_DATE_KEY })
  const created = []

  for (const [index, fixture] of FIXTURES.entries()) {
    const profile = await HoSoBenhNhan.create({
      ho_ten: fixture.profileName,
      so_dien_thoai: fixture.phone,
      so_dien_thoai_tim_kiem: fixture.phone,
      ngay_sinh: new Date(`${fixture.birthDate}T00:00:00+07:00`),
      gioi_tinh: fixture.gender,
      nguon_tao: 'tai_quay',
      trang_thai: 'active',
      ghi_chu: TAG,
    })

    const queueNumber = baseQueueNumber + index + 1
    const queueCode = `Q${CLINIC_DATE_KEY.replace(/-/g, '').slice(2)}-${String(queueNumber).padStart(3, '0')}`

    const queueEntry = await HangDoi.create({
      nguon: 'offline',
      ho_so_benh_nhan_id: profile._id,
      ten_benh_nhan: fixture.profileName,
      so_dien_thoai: fixture.phone,
      ngay_sinh: new Date(`${fixture.birthDate}T00:00:00+07:00`),
      gioi_tinh: fixture.gender,
      specialty_id: targetDoctor.specialties?.[0] ?? null,
      doctor_id: targetDoctor._id,
      phong_kham: targetDoctor.phong_kham_mac_dinh ?? null,
      muc_uu_tien: 'offline',
      trang_thai: 'dang_cho',
      checkin_time: new Date(fixture.checkinTime),
      ngay_checkin_key: CLINIC_DATE_KEY,
      so_thu_tu_checkin: queueNumber,
      ma_so_thu_tu: queueCode,
      nguoi_tiep_nhan_id: receptionistUser?._id ?? null,
      vai_tro_tiep_nhan: receptionistUser?._id ? 'receptionist' : null,
      ghi_chu: TAG,
    })

    created.push({
      profileId: String(profile._id),
      queueId: String(queueEntry._id),
      name: fixture.profileName,
      phone: fixture.phone,
      checkinTime: fixture.checkinTime,
      queueCode,
    })
  }

  const waitingNow = await HangDoi.find({
    doctor_id: targetDoctor._id,
    ngay_checkin_key: CLINIC_DATE_KEY,
    trang_thai: { $in: ['dang_cho', 'da_goi', 'trong_phong'] },
  })
    .select('ten_benh_nhan so_dien_thoai trang_thai ma_so_thu_tu checkin_time')
    .sort({ checkin_time: 1 })
    .lean()

  console.log(JSON.stringify({
    doctor: {
      id: String(targetDoctor._id),
      name: targetDoctor.user_id?.ho_ten,
      email: targetDoctor.user_id?.email ?? null,
      room: targetDoctor.phong_kham_mac_dinh ?? null,
    },
    inserted: created,
    waitingCount: waitingNow.length,
    waitingNow: waitingNow.map((item) => ({
      id: String(item._id),
      name: item.ten_benh_nhan,
      phone: item.so_dien_thoai,
      status: item.trang_thai,
      queueCode: item.ma_so_thu_tu ?? null,
      checkinTime: item.checkin_time,
    })),
  }, null, 2))

  await mongoose.disconnect()
}

main().catch(async (error) => {
  console.error(error)
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
  process.exit(1)
})
