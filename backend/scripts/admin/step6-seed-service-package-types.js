import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../../src/config/db.js'
import ChuyenKhoa from '../../src/models/ChuyenKhoa.js'
import DichVu from '../../src/models/DichVu.js'

const GENERATED_BY = 'step6-package-types'

const FALLBACK_REGULAR_SERVICES = {
  'nhi-khoa': [
    { ten: 'Kham nhi tong quat', gia: 220000, mo_ta_ngan: 'Dich vu kham tong quat cho tre em.' },
    { ten: 'Tu van dinh duong tre em', gia: 180000, mo_ta_ngan: 'Danh gia va tu van dinh duong theo do tuoi.' },
  ],
  'tai-mui-hong': [
    { ten: 'Noi soi tai mui hong', gia: 260000, mo_ta_ngan: 'Noi soi ho tro chan doan tai mui hong.' },
    { ten: 'Rua mui va ve sinh tai', gia: 140000, mo_ta_ngan: 'Dich vu ve sinh tai mui hong theo chi dinh.' },
  ],
  'da-lieu': [
    { ten: 'Soi da va tu van cham soc da', gia: 180000, mo_ta_ngan: 'Soi da co ban va tu van cham soc da.' },
    { ten: 'Cham soc viem da co ban', gia: 240000, mo_ta_ngan: 'Dich vu ho tro theo doi viem da co ban.' },
  ],
}

function roundToThousand(value) {
  return Math.max(1000, Math.round(value / 1000) * 1000)
}

async function ensureRegularServices(specialty) {
  let childServices = await DichVu.find({
    loai: 'related',
    specialty_id: specialty._id,
    status: 'active',
    la_goi: { $ne: true },
  })
    .select('_id ten gia')
    .sort({ gia: -1, ten: 1 })
    .lean()

  if (childServices.length > 0) return childServices

  const fallbackServices = FALLBACK_REGULAR_SERVICES[specialty.slug]
  if (!fallbackServices?.length) {
    throw new Error(`Chuyen khoa "${specialty.ten}" khong co dich vu le active va chua co fallback seed`)
  }

  for (const item of fallbackServices) {
    let doc = await DichVu.findOne({ ten: item.ten, specialty_id: specialty._id })
    if (!doc) {
      doc = new DichVu({
        ten: item.ten,
        nguoi_tao_id: null,
      })
    }

    doc.loai = 'related'
    doc.gia = item.gia
    doc.mo_ta_ngan = item.mo_ta_ngan
    doc.mo_ta = `Dich vu le nen de tinh gia goi. Seed: ${GENERATED_BY}.`
    doc.chuan_bi_truoc = null
    doc.specialty_id = specialty._id
    doc.la_goi = false
    doc.doi_tuong_ap_dung = null
    doc.status = 'active'
    doc.khu_vuc = []

    await doc.save()
  }

  childServices = await DichVu.find({
    loai: 'related',
    specialty_id: specialty._id,
    status: 'active',
    la_goi: { $ne: true },
  })
    .select('_id ten gia')
    .sort({ gia: -1, ten: 1 })
    .lean()

  return childServices
}

function packageDefinitionsForSpecialty(specialty, childServices) {
  if (childServices.length === 0) {
    throw new Error(`Chuyen khoa "${specialty.ten}" khong co dich vu le active de lam co so tinh gia goi`)
  }

  const sortedChildren = [...childServices].sort((a, b) => Number(b.gia || 0) - Number(a.gia || 0))
  const primary = sortedChildren[0]
  const secondary = sortedChildren[1] ?? sortedChildren[0]
  const baseOne = Number(primary.gia || 0)
  const baseTwo = Number(primary.gia || 0) + Number(secondary.gia || 0)

  return [
    {
      ten: `${specialty.ten} ca nhan co ban`,
      loai_goi: 'goi_don',
      so_nguoi_ap_dung: 1,
      dich_vu_con: [primary._id],
      phan_tram_giam_gia: 0,
      gia: roundToThousand(baseOne),
      doi_tuong_ap_dung: 'khong_gioi_han',
      mo_ta_ngan: `Goi ca nhan co ban cho chuyen khoa ${specialty.ten}.`,
      mo_ta: `Bao gom dich vu le "${primary.ten}" lam co so tham khao gia.`,
    },
    {
      ten: `${specialty.ten} ca nhan chuyen sau`,
      loai_goi: 'goi_don',
      so_nguoi_ap_dung: 1,
      dich_vu_con: [primary._id, secondary._id],
      phan_tram_giam_gia: 5,
      gia: roundToThousand(baseTwo * 0.95),
      doi_tuong_ap_dung: 'khong_gioi_han',
      mo_ta_ngan: `Goi ca nhan chuyen sau gom nhieu dich vu lien quan cua ${specialty.ten}.`,
      mo_ta: `Gia goi duoc tinh tu tong dich vu le va giam 5% cho goi ca nhan chuyen sau.`,
    },
    {
      ten: `${specialty.ten} gia dinh 3 thanh vien`,
      loai_goi: 'goi_gia_dinh',
      so_nguoi_ap_dung: 3,
      dich_vu_con: [primary._id],
      phan_tram_giam_gia: 15,
      gia: roundToThousand(baseOne * 3 * 0.85),
      doi_tuong_ap_dung: 'gia_dinh',
      mo_ta_ngan: `Goi gia dinh 3 thanh vien cho chuyen khoa ${specialty.ten}.`,
      mo_ta: `Re hon 15% so voi mua le dich vu "${primary.ten}" cho 3 nguoi.`,
    },
    {
      ten: `${specialty.ten} gia dinh 4 thanh vien`,
      loai_goi: 'goi_gia_dinh',
      so_nguoi_ap_dung: 4,
      dich_vu_con: [primary._id],
      phan_tram_giam_gia: 20,
      gia: roundToThousand(baseOne * 4 * 0.8),
      doi_tuong_ap_dung: 'gia_dinh',
      mo_ta_ngan: `Goi gia dinh 4 thanh vien cho chuyen khoa ${specialty.ten}.`,
      mo_ta: `Re hon 20% so voi mua le dich vu "${primary.ten}" cho 4 nguoi.`,
    },
  ]
}

async function main() {
  await connectDB()

  const specialties = await ChuyenKhoa.find({ status: 'active' })
    .select('_id ten slug')
    .sort({ thu_tu: 1, ten: 1 })
    .lean()

  if (specialties.length === 0) {
    throw new Error('Khong co chuyen khoa active de seed goi dich vu')
  }

  const results = []

  for (const specialty of specialties) {
    const childServices = await ensureRegularServices(specialty)

    const definitions = packageDefinitionsForSpecialty(specialty, childServices)
    const generatedNames = definitions.map((item) => item.ten)

    await DichVu.updateMany(
      {
        loai: 'related',
        specialty_id: specialty._id,
        la_goi: true,
        ten: { $nin: generatedNames },
      },
      { $set: { status: 'inactive' } }
    )

    const specialtyResults = []
    for (const item of definitions) {
      let doc = await DichVu.findOne({ ten: item.ten, specialty_id: specialty._id })
      if (!doc) {
        doc = new DichVu({
          ten: item.ten,
          nguoi_tao_id: null,
        })
      }

      doc.loai = 'related'
      doc.gia = item.gia
      doc.mo_ta_ngan = item.mo_ta_ngan
      doc.mo_ta = `${item.mo_ta}\n\nSeed: ${GENERATED_BY}.`
      doc.chuan_bi_truoc = null
      doc.specialty_id = specialty._id
      doc.la_goi = true
      doc.doi_tuong_ap_dung = item.doi_tuong_ap_dung
      doc.loai_goi = item.loai_goi
      doc.so_nguoi_ap_dung = item.so_nguoi_ap_dung
      doc.dich_vu_con = item.dich_vu_con
      doc.phan_tram_giam_gia = item.phan_tram_giam_gia
      doc.khu_vuc = []
      doc.status = 'active'

      await doc.save()

      specialtyResults.push({
        id: doc._id,
        ten: doc.ten,
        loai_goi: doc.loai_goi,
        so_nguoi_ap_dung: doc.so_nguoi_ap_dung,
        gia: doc.gia,
        dich_vu_con: doc.dich_vu_con,
        phan_tram_giam_gia: doc.phan_tram_giam_gia,
      })
    }

    results.push({
      specialty_id: specialty._id,
      specialty_ten: specialty.ten,
      childServiceCount: childServices.length,
      packageCount: specialtyResults.length,
      packages: specialtyResults,
    })
  }

  console.log(JSON.stringify({ seededSpecialtyCount: results.length, results }, null, 2))
  await mongoose.disconnect()
}

main().catch(async (error) => {
  console.error(error)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})
