import '../config/timezone.js'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

import { BacSi, HangDoi, NguoiDung, TrangThaiPhongKham } from '../models/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })

const TAG = 'TEST-BS-BAO-QUEUE-20260808'
const CLINIC_DATE_KEY = '2026-08-08'
const FIXED_DOCTOR_NAME = 'BS. Lê Quốc Bảo'

function normalizeRoomDate(dateValue) {
  return new Date(`${CLINIC_DATE_KEY}T00:00:00+07:00`)
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Thiếu MONGODB_URI trong backend/.env')
  }

  await mongoose.connect(process.env.MONGODB_URI)

  const doctor = await BacSi.findOne({ trang_thai: 'active', trang_thai_duyet: 'approved' })
    .populate('user_id', 'ho_ten email')
    .lean()

  const targetDoctor = doctor?.user_id?.ho_ten === FIXED_DOCTOR_NAME
    ? doctor
    : await BacSi.find()
      .populate('user_id', 'ho_ten email')
      .lean()
      .then((items) => items.find((item) => item.user_id?.ho_ten === FIXED_DOCTOR_NAME) ?? null)

  if (!targetDoctor) {
    throw new Error(`Không tìm thấy bác sĩ "${FIXED_DOCTOR_NAME}"`)
  }

  const receptionistUser = await NguoiDung.findOne({ vai_tro: 'receptionist' }).select('_id').lean()
  const roomDate = normalizeRoomDate()

  const queues = await HangDoi.find({
    doctor_id: targetDoctor._id,
    ngay_checkin_key: CLINIC_DATE_KEY,
    ghi_chu: TAG,
    trang_thai: { $in: ['dang_cho', 'da_goi', 'trong_phong'] },
  })
    .sort({ checkin_time: 1, ngay_tao: 1 })

  if (queues.length === 0) {
    throw new Error(`Không tìm thấy hồ sơ test với tag ${TAG}`)
  }

  const room = await TrangThaiPhongKham.findOneAndUpdate(
    { doctor_id: targetDoctor._id, ngay: roomDate },
    {
      $setOnInsert: {
        doctor_id: targetDoctor._id,
        ngay: roomDate,
        phong_kham: targetDoctor.phong_kham_mac_dinh ?? null,
        thoi_gian_kham_tb_phut: 20,
      },
    },
    { new: true, upsert: true },
  )

  const activeQueue = queues.find((item) => item.trang_thai === 'trong_phong') ?? queues[0]
  const waitingQueue = queues.find((item) => String(item._id) !== String(activeQueue._id)) ?? null
  const startTime = new Date(`${CLINIC_DATE_KEY}T16:30:00+07:00`)

  if (waitingQueue) {
    await HangDoi.updateOne(
      { _id: waitingQueue._id },
      {
        $set: {
          trang_thai: 'da_goi',
          thoi_diem_goi: startTime,
          nguoi_tiep_nhan_id: receptionistUser?._id ?? waitingQueue.nguoi_tiep_nhan_id ?? null,
          vai_tro_tiep_nhan: receptionistUser?._id ? 'receptionist' : waitingQueue.vai_tro_tiep_nhan ?? null,
        },
      },
    )
  }

  await HangDoi.updateOne(
    { _id: activeQueue._id },
    {
      $set: {
        trang_thai: 'trong_phong',
        thoi_diem_vao_phong: startTime,
        thoi_diem_goi: activeQueue.thoi_diem_goi ?? startTime,
        nguoi_tiep_nhan_id: receptionistUser?._id ?? activeQueue.nguoi_tiep_nhan_id ?? null,
        vai_tro_tiep_nhan: receptionistUser?._id ? 'receptionist' : activeQueue.vai_tro_tiep_nhan ?? null,
      },
    },
  )

  await TrangThaiPhongKham.updateOne(
    { _id: room._id },
    {
      $set: {
        trang_thai: 'dang_kham',
        benh_nhan_hien_tai_id: activeQueue._id,
        thoi_diem_doi: startTime,
        nguoi_dieu_khien_id: receptionistUser?._id ?? null,
        nguoi_dieu_khien_vai_tro: receptionistUser?._id ? 'receptionist' : 'system',
      },
    },
  )

  const refreshed = await HangDoi.find({
    doctor_id: targetDoctor._id,
    ngay_checkin_key: CLINIC_DATE_KEY,
    ghi_chu: TAG,
  })
    .select('ten_benh_nhan so_dien_thoai trang_thai thoi_diem_goi thoi_diem_vao_phong checkin_time')
    .sort({ checkin_time: 1 })
    .lean()

  const roomAfter = await TrangThaiPhongKham.findById(room._id)
    .select('trang_thai benh_nhan_hien_tai_id phong_kham thoi_diem_doi')
    .lean()

  console.log(JSON.stringify({
    doctor: {
      id: String(targetDoctor._id),
      name: targetDoctor.user_id?.ho_ten,
      email: targetDoctor.user_id?.email ?? null,
      room: targetDoctor.phong_kham_mac_dinh ?? null,
    },
    room: {
      id: String(roomAfter._id),
      status: roomAfter.trang_thai,
      currentPatientId: String(roomAfter.benh_nhan_hien_tai_id),
      roomName: roomAfter.phong_kham ?? null,
      changedAt: roomAfter.thoi_diem_doi,
    },
    queue: refreshed.map((item) => ({
      name: item.ten_benh_nhan,
      phone: item.so_dien_thoai,
      status: item.trang_thai,
      callTime: item.thoi_diem_goi ?? null,
      roomTime: item.thoi_diem_vao_phong ?? null,
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
