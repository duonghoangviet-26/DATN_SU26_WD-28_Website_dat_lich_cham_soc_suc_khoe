import mongoose from 'mongoose'

import {
  buildMarkdownTable,
  connectMongooseForExpectedDb,
  docFilePath,
  printConnectionMeta,
  writeTextFile,
} from './_shared.js'

const appointmentStatusEnum = ['pending', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show']
const appointmentPaymentEnum = ['unpaid', 'partial', 'paid', 'refunded']
const feeLineEnum = ['phi_kham', 'dich_vu', 'thu_thuat', 'giam_tru_bao_hiem']
const paymentTypeEnum = ['phi_dat_lich', 'dat_coc', 'thanh_toan_bo_sung']
const paymentMethodEnum = ['tien_mat', 'chuyen_khoan', 'vi_dien_tu', 'the_ngan_hang']

function pushIssue(issues, collection, documentId, field, reason) {
  issues.push({ collection, documentId, field, reason })
}

async function main() {
  const meta = await connectMongooseForExpectedDb()
  printConnectionMeta(meta)

  try {
    const db = mongoose.connection.db
    const collections = await db.listCollections({}, { nameOnly: true }).toArray()
    const counts = []

    for (const item of collections) {
      counts.push({
        name: item.name,
        count: await db.collection(item.name).countDocuments(),
      })
    }

    const issues = []

    const [doctors, appointments, invoices, payments, prescriptions, notifications, clinicConfigs] = await Promise.all([
      db.collection('bac_si').find({}, { projection: { _id: 1, phi_kham: 1, trang_thai: 1, chi_nhanh_id: 1 } }).toArray(),
      db.collection('lich_hen').find({}, { projection: { _id: 1, chi_nhanh_id: 1, specialty_id: 1, ma_lich_hen: 1, trang_thai_den: 1, so_lan_thay_doi: 1, dat_ho: 1, payment_status: 1, status: 1 } }).toArray(),
      db.collection('hoa_don').find({}, { projection: { _id: 1, appointment_id: 1, so_hoa_don: 1, chi_tiet_thu_phi: 1 } }).toArray(),
      db.collection('thanh_toan').find({}, { projection: { _id: 1, hoa_don_id: 1, appointment_id: 1, loai_thanh_toan: 1, phuong_thuc: 1 } }).toArray(),
      db.collection('don_thuoc').find({}, { projection: { _id: 1, ket_qua_kham_id: 1, medical_record_id: 1, appointment_id: 1 } }).toArray(),
      db.collection('thong_bao').find({}, { projection: { _id: 1, user_id: 1, ngay_gui_du_kien: 1, kenh_gui: 1, da_gui: 1, thoi_diem_gui: 1, thoi_diem_doc: 1, du_lieu_dinh_kem: 1 } }).toArray(),
      db.collection('cau_hinh_phong_kham').find({}, { projection: { _id: 1, singleton_key: 1 } }).toArray(),
    ])

    for (const doctor of doctors) {
      if (typeof doctor.phi_kham !== 'number') pushIssue(issues, 'bac_si', doctor._id, 'phi_kham', 'missing_or_invalid')
      if (!doctor.trang_thai) pushIssue(issues, 'bac_si', doctor._id, 'trang_thai', 'missing_or_null')
      if (!doctor.chi_nhanh_id) pushIssue(issues, 'bac_si', doctor._id, 'chi_nhanh_id', 'missing_or_null')
    }

    for (const appointment of appointments) {
      if (!appointment.chi_nhanh_id) pushIssue(issues, 'lich_hen', appointment._id, 'chi_nhanh_id', 'missing_or_null')
      if (!appointment.specialty_id) pushIssue(issues, 'lich_hen', appointment._id, 'specialty_id', 'missing_or_null')
      if (!appointment.ma_lich_hen) pushIssue(issues, 'lich_hen', appointment._id, 'ma_lich_hen', 'missing_or_null')
      if (!appointment.trang_thai_den) pushIssue(issues, 'lich_hen', appointment._id, 'trang_thai_den', 'missing_or_null')
      if (appointment.so_lan_thay_doi === undefined) pushIssue(issues, 'lich_hen', appointment._id, 'so_lan_thay_doi', 'missing')
      if (appointment.dat_ho === undefined) pushIssue(issues, 'lich_hen', appointment._id, 'dat_ho', 'missing')
      if (appointment.payment_status && !appointmentPaymentEnum.includes(appointment.payment_status)) {
        pushIssue(issues, 'lich_hen', appointment._id, 'payment_status', `invalid_enum:${appointment.payment_status}`)
      }
      if (appointment.status && !appointmentStatusEnum.includes(appointment.status)) {
        pushIssue(issues, 'lich_hen', appointment._id, 'status', `invalid_enum:${appointment.status}`)
      }
    }

    const invoiceByAppointment = new Map()
    const invoiceByNumber = new Map()
    for (const invoice of invoices) {
      if (!invoice.appointment_id) pushIssue(issues, 'hoa_don', invoice._id, 'appointment_id', 'missing_or_null')
      if (!invoice.so_hoa_don) pushIssue(issues, 'hoa_don', invoice._id, 'so_hoa_don', 'missing_or_null')
      if (!Array.isArray(invoice.chi_tiet_thu_phi) || invoice.chi_tiet_thu_phi.length === 0) {
        pushIssue(issues, 'hoa_don', invoice._id, 'chi_tiet_thu_phi', 'missing_or_empty')
      }
      for (const item of invoice.chi_tiet_thu_phi ?? []) {
        if (!feeLineEnum.includes(item.loai)) {
          pushIssue(issues, 'hoa_don', invoice._id, 'chi_tiet_thu_phi.loai', `invalid_enum:${item.loai}`)
        }
      }
      const appointmentKey = invoice.appointment_id?.toString?.()
      if (appointmentKey) {
        invoiceByAppointment.set(appointmentKey, (invoiceByAppointment.get(appointmentKey) || 0) + 1)
      }
      if (invoice.so_hoa_don) {
        invoiceByNumber.set(invoice.so_hoa_don, (invoiceByNumber.get(invoice.so_hoa_don) || 0) + 1)
      }
    }

    for (const [key, count] of invoiceByAppointment) {
      if (count > 1) pushIssue(issues, 'hoa_don', key, 'appointment_id', 'duplicate')
    }
    for (const [key, count] of invoiceByNumber) {
      if (count > 1) pushIssue(issues, 'hoa_don', key, 'so_hoa_don', 'duplicate')
    }

    const paymentIndexes = await db.collection('thanh_toan').indexes()
    const appointmentIndex = paymentIndexes.find((item) => JSON.stringify(item.key) === JSON.stringify({ appointment_id: 1 }))
    if (!appointmentIndex || !appointmentIndex.sparse) {
      pushIssue(issues, 'thanh_toan', 'index', 'appointment_id', 'index_not_sparse')
    }

    for (const payment of payments) {
      if (!payment.hoa_don_id && !payment.appointment_id) {
        pushIssue(issues, 'thanh_toan', payment._id, 'hoa_don_id', 'missing_for_new_payment')
      }
      if (payment.loai_thanh_toan && !paymentTypeEnum.includes(payment.loai_thanh_toan)) {
        pushIssue(issues, 'thanh_toan', payment._id, 'loai_thanh_toan', `invalid_enum:${payment.loai_thanh_toan}`)
      }
      if (payment.phuong_thuc && !paymentMethodEnum.includes(payment.phuong_thuc)) {
        pushIssue(issues, 'thanh_toan', payment._id, 'phuong_thuc', `invalid_enum:${payment.phuong_thuc}`)
      }
    }

    for (const prescription of prescriptions) {
      if (!prescription.ket_qua_kham_id) pushIssue(issues, 'don_thuoc', prescription._id, 'ket_qua_kham_id', 'missing_or_null')
      if (Object.prototype.hasOwnProperty.call(prescription, 'medicalRecordId')) {
        pushIssue(issues, 'don_thuoc', prescription._id, 'medical_record_id', 'renamed_incorrectly')
      }
    }

    for (const notification of notifications) {
      if (!notification.user_id) pushIssue(issues, 'thong_bao', notification._id, 'user_id', 'missing_or_null')
      const looksNew = notification.kenh_gui !== undefined || notification.da_gui !== undefined || notification.thoi_diem_gui !== undefined || notification.thoi_diem_doc !== undefined || notification.du_lieu_dinh_kem !== undefined
      if (looksNew && !notification.ngay_gui_du_kien) {
        pushIssue(issues, 'thong_bao', notification._id, 'ngay_gui_du_kien', 'missing_or_null')
      }
    }

    if (clinicConfigs.length === 0) pushIssue(issues, 'cau_hinh_phong_kham', 'none', 'singleton_key', 'missing_document')
    if (clinicConfigs.length > 1) pushIssue(issues, 'cau_hinh_phong_kham', 'many', 'singleton_key', 'multiple_documents')
    for (const config of clinicConfigs) {
      if (config.singleton_key !== 'CAU_HINH_PHONG_KHAM') {
        pushIssue(issues, 'cau_hinh_phong_kham', config._id, 'singleton_key', 'invalid_value')
      }
    }

    const orphanChecks = [
      { source: 'lich_hen', field: 'doctor_id', target: 'bac_si' },
      { source: 'lich_hen', field: 'specialty_id', target: 'chuyen_khoa' },
      { source: 'lich_hen', field: 'chi_nhanh_id', target: 'thong_tin_phong_kham' },
      { source: 'hoa_don', field: 'appointment_id', target: 'lich_hen' },
      { source: 'thanh_toan', field: 'hoa_don_id', target: 'hoa_don' },
      { source: 'ket_qua_kham', field: 'appointment_id', target: 'lich_hen' },
      { source: 'ket_qua_kham_tai', field: 'ket_qua_kham_id', target: 'ket_qua_kham' },
      { source: 'ket_qua_kham_mui', field: 'ket_qua_kham_id', target: 'ket_qua_kham' },
      { source: 'ket_qua_kham_hong', field: 'ket_qua_kham_id', target: 'ket_qua_kham' },
      { source: 'don_thuoc', field: 'ket_qua_kham_id', target: 'ket_qua_kham' },
      { source: 'sinh_hieu_kham', field: 'appointment_id', target: 'lich_hen' },
      { source: 'thong_bao', field: 'user_id', target: 'nguoi_dung' },
    ]

    for (const check of orphanChecks) {
      const targetIds = new Set((await db.collection(check.target).distinct('_id')).map((id) => id.toString()))
      const docs = await db.collection(check.source).find({ [check.field]: { $exists: true, $ne: null } }, { projection: { _id: 1, [check.field]: 1 } }).toArray()
      for (const doc of docs) {
        if (!targetIds.has(doc[check.field].toString())) {
          pushIssue(issues, check.source, doc._id, check.field, `orphan_ref_to_${check.target}`)
        }
      }
    }

    const indexRows = []
    for (const name of ['bac_si', 'lich_hen', 'hoa_don', 'thanh_toan', 'don_thuoc', 'thong_bao', 'cau_hinh_phong_kham']) {
      const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext()
      indexRows.push([
        name,
        exists ? (await db.collection(name).indexes()).map((index) => index.name).join(', ') : '(missing collection)',
      ])
    }

    const countRows = counts
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((row) => [row.name, String(row.count)])

    const issueRows = issues.map((issue) => [
      issue.collection,
      issue.documentId?.toString?.() ?? String(issue.documentId),
      issue.field,
      issue.reason,
    ])

    const report = [
      '# Old DB Audit',
      '',
      `- Host: ${meta.host}`,
      `- Database: ${meta.databaseName}`,
      `- NODE_ENV: ${meta.nodeEnv}`,
      `- Thoi diem chay: ${meta.runAt}`,
      '',
      '## Collection Counts',
      '',
      buildMarkdownTable(['Collection', 'Count'], countRows),
      '## Important Indexes',
      '',
      buildMarkdownTable(['Collection', 'Indexes'], indexRows),
      '## Issues',
      '',
      issueRows.length > 0
        ? buildMarkdownTable(['Collection', 'Document', 'Field', 'Reason'], issueRows)
        : 'Khong phat hien issue.\n',
    ].join('\n')

    await writeTextFile(docFilePath('01-old-db-audit.md'), report)

    if (issues.length > 0) {
      console.log('OLD_DB_HAS_ISSUES')
    }
    console.log('OLD_DB_AUDIT_DONE')
  } finally {
    await mongoose.disconnect()
  }
}

await main()
