import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../../src/config/db.js'
import ChuyenKhoa from '../../src/models/ChuyenKhoa.js'
import DichVu from '../../src/models/DichVu.js'

const PACKAGE_DEFINITIONS = [
  {
    specialtySlug: 'tai-mui-hong',
    ten: 'Khám sức khỏe đầu năm học trẻ em',
    mo_ta_ngan: 'Gói kiểm tra sức khỏe tai mũi họng cho trẻ trước năm học mới',
    mo_ta: 'Theo dõi tổng quát tai mũi họng, sàng lọc viêm amidan, VA và các vấn đề thường gặp ở trẻ em trước năm học mới.',
    gia: 320000,
    doi_tuong_ap_dung: 'tre_em',
  },
  {
    specialtySlug: 'tai-mui-hong',
    ten: 'Chăm sóc giọng nói',
    mo_ta_ngan: 'Gói theo dõi và tư vấn sức khỏe giọng nói định kỳ',
    mo_ta: 'Phù hợp với người thường xuyên sử dụng giọng nói, cần theo dõi thanh quản và tư vấn chăm sóc giọng.',
    gia: 380000,
    doi_tuong_ap_dung: 'khong_gioi_han',
  },
  {
    specialtySlug: 'tai-mui-hong',
    ten: 'Tầm soát viêm mũi xoang theo mùa',
    mo_ta_ngan: 'Gói kiểm tra tình trạng viêm mũi xoang theo thời điểm giao mùa',
    mo_ta: 'Theo dõi triệu chứng mũi xoang tái phát theo mùa, hỗ trợ phát hiện sớm tình trạng viêm kéo dài.',
    gia: 360000,
    doi_tuong_ap_dung: 'khong_gioi_han',
  },
  {
    specialtySlug: 'tai-mui-hong',
    ten: 'Khám định kỳ người cao tuổi',
    mo_ta_ngan: 'Gói tái khám tai mũi họng định kỳ cho người lớn tuổi',
    mo_ta: 'Theo dõi thính lực, họng thanh quản và các biểu hiện viêm kéo dài ở người cao tuổi.',
    gia: 420000,
    doi_tuong_ap_dung: 'nguoi_lon',
  },
  {
    specialtySlug: 'tai-mui-hong',
    ten: 'Gói gia đình theo năm',
    mo_ta_ngan: 'Gói chăm sóc tai mũi họng định kỳ cho cả gia đình',
    mo_ta: 'Gói theo dõi định kỳ trong năm cho các thành viên gia đình với trọng tâm tai mũi họng.',
    gia: 1250000,
    doi_tuong_ap_dung: 'gia_dinh',
  },
  {
    specialtySlug: 'nhi-khoa',
    ten: 'Khám tổng quát trẻ kết hợp TMH',
    mo_ta_ngan: 'Gói khám tổng quát nhi khoa kết hợp sàng lọc tai mũi họng cho trẻ',
    mo_ta: 'Theo dõi sức khỏe tổng quát trẻ em và kết hợp đánh giá các vấn đề tai mũi họng thường gặp.',
    gia: 450000,
    doi_tuong_ap_dung: 'tre_em',
  },
  {
    specialtySlug: 'da-lieu',
    ten: 'Theo dõi định kỳ da liễu cơ bản',
    mo_ta_ngan: 'Gói theo dõi da liễu cơ bản theo chu kỳ',
    mo_ta: 'Theo dõi các vấn đề da liễu cơ bản và tư vấn chăm sóc da định kỳ.',
    gia: 340000,
    doi_tuong_ap_dung: 'khong_gioi_han',
  },
]

async function main() {
  await connectDB()

  const specialties = await ChuyenKhoa.find({
    slug: { $in: [...new Set(PACKAGE_DEFINITIONS.map((item) => item.specialtySlug))] },
  })
    .select('_id slug ten')
    .lean()

  const specialtyMap = new Map(specialties.map((item) => [item.slug, item]))

  const results = []

  for (const item of PACKAGE_DEFINITIONS) {
    const specialty = specialtyMap.get(item.specialtySlug)
    if (!specialty) {
      throw new Error(`Khong tim thay chuyen khoa slug=${item.specialtySlug}`)
    }

    let doc = await DichVu.findOne({ ten: item.ten, specialty_id: specialty._id })
    if (!doc) {
      doc = new DichVu({
        ten: item.ten,
        specialty_id: specialty._id,
        nguoi_tao_id: null,
      })
    }

    doc.loai = 'related'
    doc.mo_ta_ngan = item.mo_ta_ngan
    doc.mo_ta = item.mo_ta
    doc.gia = item.gia
    doc.specialty_id = specialty._id
    doc.la_goi = true
    doc.doi_tuong_ap_dung = item.doi_tuong_ap_dung
    doc.status = 'active'
    doc.chuan_bi_truoc = null

    await doc.save()

    results.push({
      _id: doc._id,
      ten: doc.ten,
      specialty_id: doc.specialty_id,
      specialty_ten: specialty.ten,
      la_goi: doc.la_goi,
      doi_tuong_ap_dung: doc.doi_tuong_ap_dung,
      status: doc.status,
    })
  }

  console.log(JSON.stringify({ seededCount: results.length, results }, null, 2))
  await mongoose.disconnect()
}

main().catch(async (error) => {
  console.error(error)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})
