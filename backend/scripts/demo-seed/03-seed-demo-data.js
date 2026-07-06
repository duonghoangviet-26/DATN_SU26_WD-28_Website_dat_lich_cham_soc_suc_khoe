import path from 'path'
import mongoose from 'mongoose'

import {
  docFilePath,
  printConnectionMeta,
  readJsonFileIfExists,
  stateFilePath,
  connectMongooseForExpectedDb,
  writeJsonFile,
  writeTextFile,
  resetCollectionPlans,
} from './_shared.js'
import { buildDemoDataset } from './_demo-dataset.js'
import {
  BacSi,
  CaiDatThanhToan,
  CauHinhPhongKham,
  ChuyenKhoa,
  Counter,
  DichVu,
  DonThuoc,
  GiaDinh,
  HoaDon,
  HoSoYTe,
  HoanTien,
  KetQuaKham,
  KetQuaKhamHong,
  KetQuaKhamMui,
  KetQuaKhamTai,
  KhachVangLai,
  LichHen,
  LichLamViec,
  LichSuLichHen,
  NghiPhepBacSi,
  NguoiDung,
  SinhHieuKham,
  ThanhToan,
  ThanhVien,
  ThongBao,
  ThongTinPhongKham,
} from '../../src/models/index.js'
import { tinhTrangThaiHoaDon } from '../../src/services/hoaDon.service.js'

function modelMap() {
  return {
    NguoiDung,
    GiaDinh,
    ThanhVien,
    BacSi,
    LichLamViec,
    LichHen,
    HoaDon,
    ThanhToan,
    HoanTien,
    ThongBao,
    KetQuaKham,
    KetQuaKhamTai,
    KetQuaKhamMui,
    KetQuaKhamHong,
    DonThuoc,
    SinhHieuKham,
    CauHinhPhongKham,
    KhachVangLai,
    NghiPhepBacSi,
    LichSuLichHen,
    Counter,
    ThongTinPhongKham,
    ChuyenKhoa,
    HoSoYTe,
    DichVu,
    CaiDatThanhToan,
  }
}

async function validateDocs(Model, docs) {
  for (const doc of docs) {
    const instance = new Model(doc)
    await instance.validate()
  }
}

async function replaceAll(Model, docs) {
  if (docs.length === 0) return

  await Model.collection.bulkWrite(
    docs.map((doc) => ({
      replaceOne: {
        filter: { _id: doc._id },
        replacement: doc,
        upsert: true,
      },
    })),
    { ordered: true }
  )
}

async function countCollections(db) {
  const rows = {}

  for (const plan of resetCollectionPlans) {
    const exists = await db.listCollections({ name: plan.name }, { nameOnly: true }).hasNext()
    rows[plan.name] = exists ? await db.collection(plan.name).countDocuments() : 0
  }

  return rows
}

function buildDemoAccountsMarkdown(accounts) {
  const lines = [
    '# Demo Accounts',
    '',
    '| Role | Ho ten | Email | Password |',
    '| --- | --- | --- | --- |',
  ]

  for (const account of accounts) {
    lines.push(`| ${account.role} | ${account.ho_ten} | ${account.email} | ${account.password} |`)
  }

  lines.push('')
  return lines.join('\n')
}

async function main() {
  const meta = await connectMongooseForExpectedDb()
  printConnectionMeta(meta)

  try {
    const dataset = await buildDemoDataset()
    const models = modelMap()
    const db = mongoose.connection.db

    await Promise.all(
      Object.values(models)
        .filter((Model) => typeof Model.init === 'function')
        .map((Model) => Model.init())
    )

    await validateDocs(CauHinhPhongKham, dataset.clinicConfig)
    await validateDocs(ThongTinPhongKham, dataset.branches)
    await validateDocs(ChuyenKhoa, dataset.specialties)
    await validateDocs(CaiDatThanhToan, dataset.paymentSettings)
    await validateDocs(NguoiDung, dataset.users)
    await validateDocs(GiaDinh, dataset.families)
    await validateDocs(ThanhVien, dataset.members)
    await validateDocs(BacSi, dataset.doctors)
    await validateDocs(KhachVangLai, dataset.guests)
    await validateDocs(DichVu, dataset.services)
    await validateDocs(LichLamViec, dataset.schedules)
    await validateDocs(LichHen, dataset.appointments)
    await validateDocs(HoaDon, dataset.invoices)
    await validateDocs(ThanhToan, dataset.payments)
    await validateDocs(HoSoYTe, dataset.medicalRecords)
    await validateDocs(SinhHieuKham, dataset.vitals)
    await validateDocs(KetQuaKham, dataset.exams)
    await validateDocs(KetQuaKhamTai, dataset.specializedResults.tai)
    await validateDocs(KetQuaKhamMui, dataset.specializedResults.mui)
    await validateDocs(KetQuaKhamHong, dataset.specializedResults.hong)
    await validateDocs(DonThuoc, dataset.prescriptions)
    await validateDocs(HoanTien, dataset.refunds)
    await validateDocs(ThongBao, dataset.notifications)
    await validateDocs(NghiPhepBacSi, dataset.leaves)
    await validateDocs(LichSuLichHen, dataset.histories)
    await validateDocs(Counter, dataset.counters)

    await replaceAll(CauHinhPhongKham, dataset.clinicConfig)
    await replaceAll(ThongTinPhongKham, dataset.branches)
    await replaceAll(ChuyenKhoa, dataset.specialties)
    await replaceAll(CaiDatThanhToan, dataset.paymentSettings)
    await replaceAll(NguoiDung, dataset.users)
    await replaceAll(GiaDinh, dataset.families)
    await replaceAll(ThanhVien, dataset.members)
    await replaceAll(BacSi, dataset.doctors)
    await replaceAll(KhachVangLai, dataset.guests)
    await replaceAll(DichVu, dataset.services)
    await replaceAll(LichLamViec, dataset.schedules)
    await replaceAll(LichHen, dataset.appointments)
    await replaceAll(HoaDon, dataset.invoices)
    await replaceAll(ThanhToan, dataset.payments)
    await replaceAll(HoSoYTe, dataset.medicalRecords)
    await replaceAll(SinhHieuKham, dataset.vitals)
    await replaceAll(KetQuaKham, dataset.exams)
    await replaceAll(KetQuaKhamTai, dataset.specializedResults.tai)
    await replaceAll(KetQuaKhamMui, dataset.specializedResults.mui)
    await replaceAll(KetQuaKhamHong, dataset.specializedResults.hong)
    await replaceAll(DonThuoc, dataset.prescriptions)
    await replaceAll(HoanTien, dataset.refunds)
    await replaceAll(ThongBao, dataset.notifications)
    await replaceAll(NghiPhepBacSi, dataset.leaves)
    await replaceAll(LichSuLichHen, dataset.histories)
    await replaceAll(Counter, dataset.counters)

    for (const invoice of dataset.invoices) {
      await tinhTrangThaiHoaDon(invoice._id)
    }

    const countsAfterSeed = await countCollections(db)
    const statePath = stateFilePath('reset-state.json')
    const previousState = await readJsonFileIfExists(statePath, {})
    const nextState = {
      ...previousState,
      seededAt: new Date().toISOString(),
      countsAfterSeed,
    }

    await writeJsonFile(statePath, nextState)
    await writeJsonFile(stateFilePath('seed-counts.json'), countsAfterSeed)
    await writeTextFile(docFilePath('demo-accounts.md'), buildDemoAccountsMarkdown(dataset.demoAccounts))

    console.log('DEMO_DATA_SEED_DONE')
  } finally {
    await mongoose.disconnect()
  }
}

await main()
