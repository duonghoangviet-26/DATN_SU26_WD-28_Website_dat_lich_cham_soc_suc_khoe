import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  ChuyenKhoa,
  DichVu,
  BacSi,
  LichHen,
  HoaDon,
  LichLamViec,
} from '../models/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '../../.env') })

const uri = process.env.MONGODB_URI

if (!uri) {
  console.error('Missing MONGODB_URI')
  process.exit(1)
}

async function remapDoctorSpecialties(oldId, newId) {
  const doctors = await BacSi.find({ specialties: oldId }).select('_id specialties')
  for (const doctor of doctors) {
    const next = doctor.specialties
      .map((id) => String(id))
      .filter((id) => id !== String(oldId))

    if (!next.includes(String(newId))) next.push(String(newId))

    doctor.specialties = next
    await doctor.save()
  }
}

async function remapScheduleSlots(oldId, newId) {
  const schedules = await LichLamViec.find({ 'slots.specialty_id': oldId })
  for (const schedule of schedules) {
    let changed = false
    for (const slot of schedule.slots) {
      if (String(slot.specialty_id) === String(oldId)) {
        slot.specialty_id = newId
        changed = true
      }
    }
    if (changed) await schedule.save()
  }
}

async function run() {
  await mongoose.connect(uri)

  const [nhi, daLieu, tmh, noiKhoa, rangHamMat] = await Promise.all([
    ChuyenKhoa.findOne({ ten: 'Nhi khoa' }),
    ChuyenKhoa.findOne({ ten: 'Da liễu' }),
    ChuyenKhoa.findOne({ ten: 'Tai Mũi Họng' }),
    ChuyenKhoa.findOne({ ten: 'Nội khoa' }),
    ChuyenKhoa.findOne({ ten: 'Răng hàm mặt' }),
  ])

  if (!nhi || !daLieu || !tmh) {
    throw new Error('Khong tim thay du 3 chuyen khoa muc tieu: Nhi khoa, Da lieu, Tai Mui Hong')
  }

  const mappings = [
    noiKhoa ? { from: noiKhoa, to: daLieu } : null,
    rangHamMat ? { from: rangHamMat, to: tmh } : null,
  ].filter(Boolean)

  for (const mapping of mappings) {
    await DichVu.updateMany({ specialty_id: mapping.from._id }, { $set: { specialty_id: mapping.to._id } })
    await LichHen.updateMany({ specialty_id: mapping.from._id }, { $set: { specialty_id: mapping.to._id } })
    await HoaDon.updateMany({ specialty_id: mapping.from._id }, { $set: { specialty_id: mapping.to._id } })
    await remapDoctorSpecialties(mapping.from._id, mapping.to._id)
    await remapScheduleSlots(mapping.from._id, mapping.to._id)
    await ChuyenKhoa.updateOne({ _id: mapping.from._id }, { $set: { status: 'hidden' } })
  }

  await ChuyenKhoa.updateMany(
    { _id: { $in: [nhi._id, daLieu._id, tmh._id] } },
    { $set: { status: 'active' } }
  )

  const active = await ChuyenKhoa.find({ status: 'active' }).sort({ thu_tu: 1, ten: 1 }).select('ten status')
  const dangling = await Promise.all([
    noiKhoa ? DichVu.countDocuments({ specialty_id: noiKhoa._id }) : 0,
    noiKhoa ? LichHen.countDocuments({ specialty_id: noiKhoa._id }) : 0,
    noiKhoa ? HoaDon.countDocuments({ specialty_id: noiKhoa._id }) : 0,
    rangHamMat ? DichVu.countDocuments({ specialty_id: rangHamMat._id }) : 0,
    rangHamMat ? LichHen.countDocuments({ specialty_id: rangHamMat._id }) : 0,
    rangHamMat ? HoaDon.countDocuments({ specialty_id: rangHamMat._id }) : 0,
  ])

  console.log('Active specialties:')
  for (const item of active) {
    console.log(`- ${item.ten} (${item.status})`)
  }

  console.log('Dangling counts on hidden specialties:')
  console.log(JSON.stringify({
    noiKhoa: {
      dichVu: dangling[0],
      lichHen: dangling[1],
      hoaDon: dangling[2],
    },
    rangHamMat: {
      dichVu: dangling[3],
      lichHen: dangling[4],
      hoaDon: dangling[5],
    },
  }, null, 2))

  await mongoose.disconnect()
}

run().catch(async (error) => {
  console.error(error)
  try {
    await mongoose.disconnect()
  } catch {}
  process.exit(1)
})
