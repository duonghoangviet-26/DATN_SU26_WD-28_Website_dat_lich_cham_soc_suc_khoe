import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../../src/config/db.js'
import ChuyenKhoa from '../../src/models/ChuyenKhoa.js'
import DichVu from '../../src/models/DichVu.js'

const VALID_PACKAGE_TYPES = new Set(['goi_don', 'goi_gia_dinh'])

async function getChildPriceTotal(packageDoc) {
  const childIds = packageDoc.dich_vu_con ?? []
  if (childIds.length === 0) return 0

  const children = await DichVu.find({ _id: { $in: childIds }, loai: 'related', la_goi: { $ne: true } })
    .select('_id gia')
    .lean()

  return children.reduce((sum, item) => sum + Number(item.gia || 0), 0)
}

async function main() {
  await connectDB()

  const specialties = await ChuyenKhoa.find({ status: 'active' })
    .select('_id ten slug')
    .sort({ thu_tu: 1, ten: 1 })
    .lean()

  const report = []
  const errors = []

  for (const specialty of specialties) {
    const packages = await DichVu.find({
      loai: 'related',
      specialty_id: specialty._id,
      la_goi: true,
      status: 'active',
    })
      .select('ten gia loai_goi so_nguoi_ap_dung dich_vu_con phan_tram_giam_gia')
      .sort({ ten: 1 })
      .lean()

    if (packages.length < 3 || packages.length > 4) {
      errors.push(`${specialty.ten}: can co 3-4 goi active, hien co ${packages.length}`)
    }

    const packageItems = []
    for (const packageDoc of packages) {
      if (!VALID_PACKAGE_TYPES.has(packageDoc.loai_goi)) {
        errors.push(`${specialty.ten}/${packageDoc.ten}: loai_goi khong hop le`)
      }
      if (!Number.isFinite(packageDoc.gia) || packageDoc.gia <= 0) {
        errors.push(`${specialty.ten}/${packageDoc.ten}: gia phai la so duong`)
      }
      if (!Number.isInteger(packageDoc.so_nguoi_ap_dung) || packageDoc.so_nguoi_ap_dung < 1) {
        errors.push(`${specialty.ten}/${packageDoc.ten}: so_nguoi_ap_dung khong hop le`)
      }
      if (!Array.isArray(packageDoc.dich_vu_con) || packageDoc.dich_vu_con.length === 0) {
        errors.push(`${specialty.ten}/${packageDoc.ten}: can co danh sach dich_vu_con`)
      }

      const childPriceTotal = await getChildPriceTotal(packageDoc)
      const retailComparable = childPriceTotal * Number(packageDoc.so_nguoi_ap_dung || 1)
      if (packageDoc.loai_goi === 'goi_gia_dinh' && !(packageDoc.gia < retailComparable)) {
        errors.push(`${specialty.ten}/${packageDoc.ten}: goi gia dinh phai re hon tong gia le tuong ung`)
      }

      packageItems.push({
        ten: packageDoc.ten,
        gia: packageDoc.gia,
        loai_goi: packageDoc.loai_goi,
        so_nguoi_ap_dung: packageDoc.so_nguoi_ap_dung,
        childPriceTotal,
        retailComparable,
      })
    }

    report.push({
      specialty_id: specialty._id,
      specialty_ten: specialty.ten,
      packageCount: packages.length,
      packages: packageItems,
    })
  }

  console.log(JSON.stringify({ ok: errors.length === 0, report, errors }, null, 2))

  await mongoose.disconnect()

  if (errors.length > 0) {
    process.exit(1)
  }
}

main().catch(async (error) => {
  console.error(error)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})
