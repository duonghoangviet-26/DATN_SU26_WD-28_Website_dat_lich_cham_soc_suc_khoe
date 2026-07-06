import mongoose from 'mongoose'

import {
  connectMongooseForExpectedDb,
  printConnectionMeta,
  stateFilePath,
  writeJsonFile,
} from './_shared.js'

function toId(value) {
  return value ? value.toString() : 'unknown'
}

function addResult(results, group, name, pass, detail = '') {
  results.push({ group, name, pass, detail })
}

async function main() {
  const meta = await connectMongooseForExpectedDb()
  printConnectionMeta(meta)

  try {
    const db = mongoose.connection.db
    const results = []
    const errors = []

    const countRules = [
      ['NguoiDung', 'nguoi_dung', 10],
      ['BacSi', 'bac_si', 3],
      ['ThanhVien', 'thanh_vien', 5],
      ['KhachVangLai', 'khach_vang_lai', 2],
      ['LichLamViec', 'lich_lam_viec', 7],
      ['LichHen', 'lich_hen', 12],
      ['ThanhToan', 'thanh_toan', 5],
      ['KetQuaKham', 'ket_qua_kham', 3],
      ['DonThuoc', 'don_thuoc', 2],
      ['ThongBao', 'thong_bao', 5],
    ]

    const counts = {}
    for (const [label, collection, min] of countRules) {
      const count = await db.collection(collection).countDocuments()
      counts[collection] = count
      const pass = count >= min
      addResult(results, 'count', label, pass, `${count} >= ${min}`)
      if (!pass) errors.push(`${collection}: count ${count} < ${min}`)
    }

    const clinicConfigCount = await db.collection('cau_hinh_phong_kham').countDocuments()
    counts.cau_hinh_phong_kham = clinicConfigCount
    addResult(results, 'count', 'CauHinhPhongKham', clinicConfigCount === 1, `${clinicConfigCount} === 1`)
    if (clinicConfigCount !== 1) errors.push(`cau_hinh_phong_kham: expected 1 got ${clinicConfigCount}`)

    const appointmentsCount = await db.collection('lich_hen').countDocuments()
    const invoicesCount = await db.collection('hoa_don').countDocuments()
    addResult(results, 'count', 'HoaDon_vs_LichHen', invoicesCount >= appointmentsCount, `${invoicesCount} >= ${appointmentsCount}`)
    if (invoicesCount < appointmentsCount) errors.push(`hoa_don: ${invoicesCount} < lich_hen: ${appointmentsCount}`)

    const requiredFieldChecks = [
      ['bac_si', { $or: [{ phi_kham: { $exists: false } }, { phi_kham: null }] }, 'phi_kham'],
      ['bac_si', { $or: [{ trang_thai: { $exists: false } }, { trang_thai: null }] }, 'trang_thai'],
      ['lich_hen', { $or: [{ ma_lich_hen: { $exists: false } }, { ma_lich_hen: null }] }, 'ma_lich_hen'],
      ['lich_hen', { $or: [{ chi_nhanh_id: { $exists: false } }, { chi_nhanh_id: null }] }, 'chi_nhanh_id'],
      ['lich_hen', { $or: [{ specialty_id: { $exists: false } }, { specialty_id: null }] }, 'specialty_id'],
      ['hoa_don', { $or: [{ appointment_id: { $exists: false } }, { appointment_id: null }] }, 'appointment_id'],
      ['hoa_don', { $or: [{ so_hoa_don: { $exists: false } }, { so_hoa_don: null }] }, 'so_hoa_don'],
      ['thanh_toan', { $and: [{ appointment_id: { $exists: false } }, { $or: [{ hoa_don_id: { $exists: false } }, { hoa_don_id: null }] }] }, 'hoa_don_id'],
      ['don_thuoc', { $or: [{ ket_qua_kham_id: { $exists: false } }, { ket_qua_kham_id: null }] }, 'ket_qua_kham_id'],
      ['thong_bao', { $or: [{ user_id: { $exists: false } }, { user_id: null }] }, 'user_id'],
      ['thong_bao', { $or: [{ ngay_gui_du_kien: { $exists: false } }, { ngay_gui_du_kien: null }] }, 'ngay_gui_du_kien'],
    ]

    for (const [collection, filter, field] of requiredFieldChecks) {
      const count = await db.collection(collection).countDocuments(filter)
      const pass = count === 0
      addResult(results, 'field', `${collection}.${field}`, pass, `missing=${count}`)
      if (!pass) errors.push(`${collection}.${field}: missing ${count}`)
    }

    const invalidFeeLineCount = await db.collection('hoa_don').countDocuments({
      'chi_tiet_thu_phi.loai': { $nin: ['phi_kham', 'dich_vu', 'thu_thuat', 'giam_tru_bao_hiem'] },
    })
    addResult(results, 'field', 'hoa_don.chi_tiet_thu_phi.loai', invalidFeeLineCount === 0, `invalid=${invalidFeeLineCount}`)
    if (invalidFeeLineCount > 0) errors.push(`hoa_don.chi_tiet_thu_phi.loai invalid ${invalidFeeLineCount}`)

    const refs = [
      ['LichHen.doctor_id', 'lich_hen', 'doctor_id', 'bac_si'],
      ['LichHen.chi_nhanh_id', 'lich_hen', 'chi_nhanh_id', 'thong_tin_phong_kham'],
      ['LichHen.specialty_id', 'lich_hen', 'specialty_id', 'chuyen_khoa'],
      ['HoaDon.appointment_id', 'hoa_don', 'appointment_id', 'lich_hen'],
      ['ThanhToan.hoa_don_id', 'thanh_toan', 'hoa_don_id', 'hoa_don'],
      ['KetQuaKham.appointment_id', 'ket_qua_kham', 'appointment_id', 'lich_hen'],
      ['KetQuaKhamTai.ket_qua_kham_id', 'ket_qua_kham_tai', 'ket_qua_kham_id', 'ket_qua_kham'],
      ['KetQuaKhamMui.ket_qua_kham_id', 'ket_qua_kham_mui', 'ket_qua_kham_id', 'ket_qua_kham'],
      ['KetQuaKhamHong.ket_qua_kham_id', 'ket_qua_kham_hong', 'ket_qua_kham_id', 'ket_qua_kham'],
      ['DonThuoc.ket_qua_kham_id', 'don_thuoc', 'ket_qua_kham_id', 'ket_qua_kham'],
      ['SinhHieuKham.appointment_id', 'sinh_hieu_kham', 'appointment_id', 'lich_hen'],
      ['ThongBao.user_id', 'thong_bao', 'user_id', 'nguoi_dung'],
      ['HoanTien.nguoi_xu_ly_id', 'hoan_tien', 'nguoi_xu_ly_id', 'nguoi_dung'],
      ['LichSuLichHen.nguoi_thay_doi_id', 'lich_su_lich_hen', 'nguoi_thay_doi_id', 'nguoi_dung'],
    ]

    for (const [label, sourceCollection, field, targetCollection] of refs) {
      const targetIds = new Set((await db.collection(targetCollection).distinct('_id')).map((id) => id.toString()))
      const docs = await db.collection(sourceCollection).find({ [field]: { $exists: true, $ne: null } }, { projection: { _id: 1, [field]: 1 } }).toArray()
      const orphanIds = docs.filter((doc) => !targetIds.has(doc[field].toString())).map((doc) => toId(doc._id))
      const pass = orphanIds.length === 0
      addResult(results, 'ref', label, pass, pass ? '0 orphan' : orphanIds.join(', '))
      if (!pass) errors.push(`${label}: orphan ${orphanIds.join(', ')}`)
    }

    const duplicateChecks = [
      ['HoaDon.appointment_id', 'hoa_don', '$appointment_id'],
      ['HoaDon.so_hoa_don', 'hoa_don', '$so_hoa_don'],
      ['LichHen.ma_lich_hen', 'lich_hen', '$ma_lich_hen'],
      ['CauHinhPhongKham.singleton_key', 'cau_hinh_phong_kham', '$singleton_key'],
      ['SinhHieuKham.appointment_id', 'sinh_hieu_kham', '$appointment_id'],
      ['KetQuaKham.appointment_id', 'ket_qua_kham', '$appointment_id'],
    ]

    for (const [label, collection, groupId] of duplicateChecks) {
      const duplicates = await db.collection(collection).aggregate([
        { $group: { _id: groupId, count: { $sum: 1 } } },
        { $match: { _id: { $ne: null }, count: { $gt: 1 } } },
      ]).toArray()
      const pass = duplicates.length === 0
      addResult(results, 'duplicate', label, pass, pass ? '0 duplicate' : JSON.stringify(duplicates))
      if (!pass) errors.push(`${label}: duplicate found`)
    }

    await writeJsonFile(stateFilePath('validation-results.json'), {
      validatedAt: new Date().toISOString(),
      results,
      errors,
      counts,
    })

    if (errors.length > 0) {
      for (const error of errors) {
        console.error(error)
      }
      console.log('DEMO_DATA_VALIDATE_FAIL')
      process.exitCode = 1
      return
    }

    console.log('DEMO_DATA_VALIDATE_PASS')
  } finally {
    await mongoose.disconnect()
  }
}

await main()
