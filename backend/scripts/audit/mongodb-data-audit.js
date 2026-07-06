import 'dotenv/config'
import mongoose from 'mongoose'

function toId(value) {
  return value ? value.toString() : 'unknown'
}

function addIssue(issues, collection, documentId, field, reason, action) {
  issues.push({ collection, documentId, field, reason, action })
}

function summarizeIndexes(indexes) {
  return indexes.map((index) => {
    const flags = []
    if (index.unique) flags.push('unique')
    if (index.sparse) flags.push('sparse')
    if (typeof index.expireAfterSeconds === 'number') flags.push(`ttl=${index.expireAfterSeconds}`)
    return `${index.name}:${JSON.stringify(index.key)}${flags.length ? ` [${flags.join(',')}]` : ''}`
  })
}

async function listCollectionsWithMeta(db) {
  const collections = await db.listCollections({}, { nameOnly: true }).toArray()
  const rows = []

  for (const item of collections) {
    const collection = db.collection(item.name)
    const [count, indexes] = await Promise.all([
      collection.countDocuments(),
      collection.indexes(),
    ])

    rows.push({
      collection: item.name,
      count,
      indexes: summarizeIndexes(indexes),
    })
  }

  return rows.sort((a, b) => a.collection.localeCompare(b.collection))
}

async function checkDoctors(db, issues) {
  const doctors = db.collection('bac_si')

  const [missingPhi, missingTrangThai, missingChiNhanh] = await Promise.all([
    doctors.find({
      $or: [
        { phi_kham: { $exists: false } },
        { phi_kham: null },
        { phi_kham: { $lt: 0 } },
      ],
    }, { projection: { _id: 1, gia_kham: 1 } }).toArray(),
    doctors.find({
      $or: [
        { trang_thai: { $exists: false } },
        { trang_thai: null },
      ],
    }, { projection: { _id: 1 } }).toArray(),
    doctors.find({
      $or: [
        { chi_nhanh_id: { $exists: false } },
        { chi_nhanh_id: null },
      ],
    }, { projection: { _id: 1, gia_kham: 1, phi_kham: 1 } }).toArray(),
  ])

  for (const doctor of missingPhi) {
    const action = typeof doctor.gia_kham === 'number'
      ? 'co_the_backfill_tu_gia_kham'
      : 'can_nguon_gia_ro_rang'
    addIssue(issues, 'bac_si', toId(doctor._id), 'phi_kham', 'missing_or_invalid_phi_kham', action)
  }

  for (const doctor of missingTrangThai) {
    addIssue(issues, 'bac_si', toId(doctor._id), 'trang_thai', 'missing_trang_thai', 'co_the_backfill_default_active')
  }

  for (const doctor of missingChiNhanh) {
    addIssue(issues, 'bac_si', toId(doctor._id), 'chi_nhanh_id', 'missing_chi_nhanh_id', 'can_nguon_map_chi_nhanh')
  }
}

async function checkAppointments(db, issues) {
  const appointments = db.collection('lich_hen')
  const unresolvedSpecialty = []

  const [missingChiNhanh, missingDefaults, missingSpecialty] = await Promise.all([
    appointments.find({
      $or: [
        { chi_nhanh_id: { $exists: false } },
        { chi_nhanh_id: null },
      ],
    }, { projection: { _id: 1, doctor_id: 1 } }).toArray(),
    appointments.find({
      $or: [
        { trang_thai_den: { $exists: false } },
        { so_lan_thay_doi: { $exists: false } },
        { dat_ho: { $exists: false } },
      ],
    }, { projection: { _id: 1, trang_thai_den: 1, so_lan_thay_doi: 1, dat_ho: 1 } }).toArray(),
    appointments.find({
      $or: [
        { specialty_id: { $exists: false } },
        { specialty_id: null },
      ],
    }, { projection: { _id: 1, doctor_id: 1 } }).toArray(),
  ])

  const doctorIds = [...new Set(
    [...missingChiNhanh, ...missingSpecialty]
      .map((doc) => doc.doctor_id?.toString?.())
      .filter(Boolean)
  )].map((id) => new mongoose.Types.ObjectId(id))

  const doctors = await db.collection('bac_si')
    .find({ _id: { $in: doctorIds } }, { projection: { _id: 1, chi_nhanh_id: 1, specialties: 1 } })
    .toArray()
  const doctorMap = new Map(doctors.map((doctor) => [doctor._id.toString(), doctor]))

  for (const appointment of missingChiNhanh) {
    const doctor = appointment.doctor_id ? doctorMap.get(appointment.doctor_id.toString()) : null
    const action = doctor?.chi_nhanh_id ? 'co_the_backfill_tu_bac_si' : 'can_map_thu_cong'
    addIssue(issues, 'lich_hen', toId(appointment._id), 'chi_nhanh_id', 'missing_chi_nhanh_id', action)
  }

  for (const appointment of missingDefaults) {
    if (appointment.trang_thai_den === undefined) {
      addIssue(issues, 'lich_hen', toId(appointment._id), 'trang_thai_den', 'missing_default_field', 'co_the_backfill_default')
    }
    if (appointment.so_lan_thay_doi === undefined) {
      addIssue(issues, 'lich_hen', toId(appointment._id), 'so_lan_thay_doi', 'missing_default_field', 'co_the_backfill_default')
    }
    if (appointment.dat_ho === undefined) {
      addIssue(issues, 'lich_hen', toId(appointment._id), 'dat_ho', 'missing_default_field', 'co_the_backfill_default')
    }
  }

  for (const appointment of missingSpecialty) {
    const doctor = appointment.doctor_id ? doctorMap.get(appointment.doctor_id.toString()) : null
    const canMap = Array.isArray(doctor?.specialties) && doctor.specialties.length > 0
    addIssue(
      issues,
      'lich_hen',
      toId(appointment._id),
      'specialty_id',
      'missing_specialty_id',
      canMap ? 'co_the_backfill_tu_bac_si_specialties_0' : 'can_quyet_dinh_thu_cong'
    )

    if (!canMap) {
      unresolvedSpecialty.push(appointment)
    }
  }

  return { unresolvedSpecialty }
}

async function checkInvoices(db, issues) {
  const appointments = db.collection('lich_hen')
  const invoices = db.collection('hoa_don')

  const invoiceAppointmentIds = await invoices.distinct('appointment_id')
  const appointmentIdSet = new Set(invoiceAppointmentIds.filter(Boolean).map((id) => id.toString()))

  const missingInvoices = await appointments.find(
    { _id: { $nin: [...appointmentIdSet].map((id) => new mongoose.Types.ObjectId(id)) } },
    { projection: { _id: 1, doctor_id: 1 } }
  ).toArray()

  for (const appointment of missingInvoices) {
    addIssue(issues, 'lich_hen', toId(appointment._id), 'hoa_don', 'missing_hoa_don', 'co_the_tao_hoa_don_neu_du_doctor_phi_kham')
  }

  const [duplicateAppointments, duplicateSoHoaDon, invalidChiTiet] = await Promise.all([
    invoices.aggregate([
      { $group: { _id: '$appointment_id', count: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { _id: { $ne: null }, count: { $gt: 1 } } },
    ]).toArray(),
    invoices.aggregate([
      { $group: { _id: '$so_hoa_don', count: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { _id: { $ne: null }, count: { $gt: 1 } } },
    ]).toArray(),
    invoices.find({
      'chi_tiet_thu_phi.loai': { $nin: ['phi_kham', 'dich_vu', 'thu_thuat', 'giam_tru_bao_hiem'] },
    }, { projection: { _id: 1 } }).toArray(),
  ])

  for (const duplicate of duplicateAppointments) {
    for (const id of duplicate.ids) {
      addIssue(issues, 'hoa_don', toId(id), 'appointment_id', `duplicate_appointment_id:${toId(duplicate._id)}`, 'can_xu_ly_thu_cong')
    }
  }

  for (const duplicate of duplicateSoHoaDon) {
    for (const id of duplicate.ids) {
      addIssue(issues, 'hoa_don', toId(id), 'so_hoa_don', `duplicate_so_hoa_don:${duplicate._id}`, 'can_xu_ly_thu_cong')
    }
  }

  for (const invoice of invalidChiTiet) {
    addIssue(issues, 'hoa_don', toId(invoice._id), 'chi_tiet_thu_phi.loai', 'invalid_fee_line_type', 'can_review_chi_tiet')
  }
}

async function checkPayments(db, issues) {
  const payments = db.collection('thanh_toan')
  const legacyMissingInvoice = await payments.find({
    appointment_id: { $exists: true, $ne: null },
    $or: [{ hoa_don_id: { $exists: false } }, { hoa_don_id: null }],
  }, { projection: { _id: 1, appointment_id: 1 } }).toArray()

  const newMissingInvoice = await payments.find({
    $or: [{ hoa_don_id: { $exists: false } }, { hoa_don_id: null }],
    appointment_id: { $exists: false },
  }, { projection: { _id: 1 } }).toArray()

  for (const payment of legacyMissingInvoice) {
    addIssue(issues, 'thanh_toan', toId(payment._id), 'hoa_don_id', 'legacy_payment_missing_hoa_don_id', 'co_the_map_tu_appointment_id')
  }

  for (const payment of newMissingInvoice) {
    addIssue(issues, 'thanh_toan', toId(payment._id), 'hoa_don_id', 'new_payment_missing_hoa_don_id', 'can_fix_logic_or_data')
  }
}

async function checkInvoicesStatus(db, issues) {
  const invoices = await db.collection('hoa_don').find(
    {},
    { projection: { _id: 1, tong_thanh_toan: 1, trang_thai_hoa_don: 1 } }
  ).toArray()

  const payments = await db.collection('thanh_toan').find(
    { hoa_don_id: { $exists: true, $ne: null }, status: 'paid' },
    { projection: { _id: 1, hoa_don_id: 1, so_tien: 1 } }
  ).toArray()

  const sumByInvoice = new Map()
  for (const payment of payments) {
    const key = payment.hoa_don_id.toString()
    sumByInvoice.set(key, (sumByInvoice.get(key) || 0) + Number(payment.so_tien || 0))
  }

  for (const invoice of invoices) {
    const totalPaid = sumByInvoice.get(invoice._id.toString()) || 0
    const totalDue = Number(invoice.tong_thanh_toan || 0)
    const expectedStatus = totalPaid <= 0
      ? 'chua_thanh_toan'
      : totalPaid < totalDue
        ? 'da_dat_coc'
        : 'da_thanh_toan_du'

    if (invoice.trang_thai_hoa_don !== expectedStatus) {
      addIssue(
        issues,
        'hoa_don',
        toId(invoice._id),
        'trang_thai_hoa_don',
        `invoice_status_mismatch:${invoice.trang_thai_hoa_don}->${expectedStatus}`,
        'co_the_recalculate_bang_service'
      )
    }
  }
}

async function checkPrescriptions(db, issues) {
  const prescriptions = await db.collection('don_thuoc').find({
    $or: [{ ket_qua_kham_id: { $exists: false } }, { ket_qua_kham_id: null }],
  }, { projection: { _id: 1, appointment_id: 1, medical_record_id: 1 } }).toArray()

  for (const prescription of prescriptions) {
    const action = prescription.appointment_id || prescription.medical_record_id
      ? 'co_the_backfill_neu_map_duoc'
      : 'can_quyet_dinh_thu_cong'
    addIssue(issues, 'don_thuoc', toId(prescription._id), 'ket_qua_kham_id', 'missing_ket_qua_kham_id', action)
  }
}

async function checkClinicConfig(db, issues) {
  const configs = await db.collection('cau_hinh_phong_kham').find({}, { projection: { _id: 1, singleton_key: 1 } }).toArray()

  if (configs.length === 0) {
    addIssue(issues, 'cau_hinh_phong_kham', 'none', 'singleton_key', 'missing_singleton_config', 'co_the_seed_singleton')
    return
  }

  if (configs.length > 1) {
    for (const config of configs) {
      addIssue(issues, 'cau_hinh_phong_kham', toId(config._id), 'singleton_key', 'multiple_singleton_documents', 'can_review_thu_cong')
    }
  }

  const invalidSingleton = configs.filter((config) => config.singleton_key !== 'CAU_HINH_PHONG_KHAM')
  for (const config of invalidSingleton) {
    addIssue(issues, 'cau_hinh_phong_kham', toId(config._id), 'singleton_key', 'invalid_singleton_key', 'co_the_backfill_singleton_key')
  }
}

async function checkNotifications(db, issues) {
  const notifications = await db.collection('thong_bao').find(
    {
      $and: [
        {
          $or: [
            { ngay_gui_du_kien: { $exists: false } },
            { ngay_gui_du_kien: null },
          ],
        },
        {
          $or: [
            { kenh_gui: { $exists: true } },
            { da_gui: { $exists: true } },
            { thoi_diem_gui: { $exists: true } },
            { thoi_diem_doc: { $exists: true } },
            { du_lieu_dinh_kem: { $exists: true } },
          ],
        },
      ],
    },
    { projection: { _id: 1, user_id: 1 } }
  ).toArray()

  for (const notification of notifications) {
    addIssue(issues, 'thong_bao', toId(notification._id), 'ngay_gui_du_kien', 'new_notification_missing_ngay_gui_du_kien', 'can_backfill_neu_co_rule')
  }
}

async function checkOrphans(db, issues) {
  const [doctorIds, branchIds, specialtyIds, appointmentIds, invoiceIds, examIds, userIds] = await Promise.all([
    db.collection('bac_si').distinct('_id'),
    db.listCollections({ name: 'chi_nhanh' }, { nameOnly: true }).hasNext()
      ? db.collection('chi_nhanh').distinct('_id')
      : [],
    db.collection('chuyen_khoa').distinct('_id'),
    db.collection('lich_hen').distinct('_id'),
    db.collection('hoa_don').distinct('_id'),
    db.collection('ket_qua_kham').distinct('_id'),
    db.collection('nguoi_dung').distinct('_id'),
  ])

  const doctorSet = new Set(doctorIds.map((id) => id.toString()))
  const branchSet = new Set(branchIds.map((id) => id.toString()))
  const specialtySet = new Set(specialtyIds.map((id) => id.toString()))
  const appointmentSet = new Set(appointmentIds.map((id) => id.toString()))
  const invoiceSet = new Set(invoiceIds.map((id) => id.toString()))
  const examSet = new Set(examIds.map((id) => id.toString()))
  const userSet = new Set(userIds.map((id) => id.toString()))

  const [
    appointmentRefs,
    invoiceRefs,
    paymentRefs,
    prescriptionRefs,
    examRefs,
    vitalRefs,
    notificationRefs,
  ] = await Promise.all([
    db.collection('lich_hen').find({}, { projection: { _id: 1, doctor_id: 1, chi_nhanh_id: 1, specialty_id: 1 } }).toArray(),
    db.collection('hoa_don').find({}, { projection: { _id: 1, appointment_id: 1 } }).toArray(),
    db.collection('thanh_toan').find({}, { projection: { _id: 1, hoa_don_id: 1 } }).toArray(),
    db.collection('don_thuoc').find({}, { projection: { _id: 1, ket_qua_kham_id: 1 } }).toArray(),
    db.collection('ket_qua_kham').find({}, { projection: { _id: 1, appointment_id: 1 } }).toArray(),
    db.collection('sinh_hieu_kham').find({}, { projection: { _id: 1, appointment_id: 1 } }).toArray(),
    db.collection('thong_bao').find({}, { projection: { _id: 1, user_id: 1 } }).toArray(),
  ])

  for (const doc of appointmentRefs) {
    if (doc.doctor_id && !doctorSet.has(doc.doctor_id.toString())) {
      addIssue(issues, 'lich_hen', toId(doc._id), 'doctor_id', 'orphan_doctor_reference', 'can_review_thu_cong')
    }
    if (doc.chi_nhanh_id && branchSet.size > 0 && !branchSet.has(doc.chi_nhanh_id.toString())) {
      addIssue(issues, 'lich_hen', toId(doc._id), 'chi_nhanh_id', 'orphan_branch_reference', 'can_review_thu_cong')
    }
    if (doc.specialty_id && !specialtySet.has(doc.specialty_id.toString())) {
      addIssue(issues, 'lich_hen', toId(doc._id), 'specialty_id', 'orphan_specialty_reference', 'can_review_thu_cong')
    }
  }

  for (const doc of invoiceRefs) {
    if (doc.appointment_id && !appointmentSet.has(doc.appointment_id.toString())) {
      addIssue(issues, 'hoa_don', toId(doc._id), 'appointment_id', 'orphan_appointment_reference', 'can_review_thu_cong')
    }
  }

  for (const doc of paymentRefs) {
    if (doc.hoa_don_id && !invoiceSet.has(doc.hoa_don_id.toString())) {
      addIssue(issues, 'thanh_toan', toId(doc._id), 'hoa_don_id', 'orphan_invoice_reference', 'can_review_thu_cong')
    }
  }

  for (const doc of prescriptionRefs) {
    if (doc.ket_qua_kham_id && !examSet.has(doc.ket_qua_kham_id.toString())) {
      addIssue(issues, 'don_thuoc', toId(doc._id), 'ket_qua_kham_id', 'orphan_exam_reference', 'can_review_thu_cong')
    }
  }

  for (const doc of examRefs) {
    if (doc.appointment_id && !appointmentSet.has(doc.appointment_id.toString())) {
      addIssue(issues, 'ket_qua_kham', toId(doc._id), 'appointment_id', 'orphan_appointment_reference', 'can_review_thu_cong')
    }
  }

  for (const doc of vitalRefs) {
    if (doc.appointment_id && !appointmentSet.has(doc.appointment_id.toString())) {
      addIssue(issues, 'sinh_hieu_kham', toId(doc._id), 'appointment_id', 'orphan_appointment_reference', 'can_review_thu_cong')
    }
  }

  for (const doc of notificationRefs) {
    if (doc.user_id && !userSet.has(doc.user_id.toString())) {
      addIssue(issues, 'thong_bao', toId(doc._id), 'user_id', 'orphan_user_reference', 'can_review_thu_cong')
    }
  }
}

async function main() {
  console.log('DATABASE_AUDIT_START')

  if (!process.env.MONGODB_URI) {
    throw new Error('Missing MONGODB_URI')
  }

  const uri = new URL(process.env.MONGODB_URI)
  const host = uri.host
  const dbName = uri.pathname.replace(/^\//, '')
  const nodeEnv = process.env.NODE_ENV || 'undefined'

  console.log(`HOST=${host}`)
  console.log(`DATABASE=${dbName}`)
  console.log(`NODE_ENV=${nodeEnv}`)
  console.log(`AUDIT_TIME=${new Date().toISOString()}`)

  await mongoose.connect(process.env.MONGODB_URI)

  try {
    const db = mongoose.connection.db
    const collectionRows = await listCollectionsWithMeta(db)
    console.log(`COLLECTION_COUNT=${collectionRows.length}`)
    for (const row of collectionRows) {
      console.log(`COLLECTION ${row.collection} COUNT=${row.count}`)
    }

    const issues = []
    const { unresolvedSpecialty } = await checkAppointments(db, issues)
    await checkDoctors(db, issues)
    await checkInvoices(db, issues)
    await checkPayments(db, issues)
    await checkInvoicesStatus(db, issues)
    await checkPrescriptions(db, issues)
    await checkClinicConfig(db, issues)
    await checkNotifications(db, issues)
    await checkOrphans(db, issues)

    console.log(`UNRESOLVED_SPECIALTY_COUNT=${unresolvedSpecialty.length}`)

    if (issues.length > 0) {
      console.log('DATA_AUDIT_FAIL')
      for (const issue of issues) {
        console.log(
          [
            'ISSUE',
            `collection=${issue.collection}`,
            `document_id=${issue.documentId}`,
            `field=${issue.field}`,
            `reason=${issue.reason}`,
            `action=${issue.action}`,
          ].join(' | ')
        )
      }
    } else {
      console.log('DATA_AUDIT_PASS')
    }

    console.log('DATABASE_AUDIT_DONE')
  } finally {
    await mongoose.disconnect()
  }
}

await main()
