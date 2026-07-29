import { ObjectId } from 'mongodb'
import { runMigration } from './_migrationRunner.js'

const DRY_RUN = process.env.MIGRATION_DRY_RUN === 'true'

function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.startsWith('84') && digits.length >= 10) return `0${digits.slice(2)}`
  return digits
}

function normalizeName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function personKey(fields) {
  const birth = fields?.ngay_sinh ? new Date(fields.ngay_sinh).toISOString().slice(0, 10) : ''
  return `${normalizePhone(fields?.so_dien_thoai)}|${normalizeName(fields?.ho_ten)}|${birth}|${fields?.gioi_tinh ?? ''}`
}

function idKey(value) {
  return value ? String(value) : null
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== ''
}

function dateFromAppointment(appointment) {
  if (!appointment?.ngay_kham || !appointment?.gio_kham) return null
  const date = new Date(appointment.ngay_kham)
  const [hours, minutes] = String(appointment.gio_kham).split(':').map(Number)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  date.setUTCHours(hours, minutes, 0, 0)
  return date
}

function profileName(value) {
  return String(value ?? '').trim() || 'Chua xac dinh'
}

const result = await runMigration({
  name: '013-backfill-ho-so-benh-nhan-offline',
  rollbackable: false,
  async up({ connection }) {
    const db = connection.db
    const profiles = db.collection('ho_so_benh_nhan')
    const users = await db.collection('nguoi_dung').find({}, {
      projection: { _id: 1, ho_ten: 1, so_dien_thoai: 1 },
    }).toArray()
    const families = await db.collection('gia_dinh').find({}, {
      projection: { _id: 1, user_id: 1 },
    }).toArray()
    const members = await db.collection('thanh_vien').find({}, {
        projection: { _id: 1, family_id: 1, tai_khoan_id: 1, ho_ten: 1, ngay_sinh: 1, gioi_tinh: 1, di_ung: 1, benh_nen: 1, ho_so_benh_nhan_id: 1 },
    }).toArray()
    const guests = await db.collection('khach_vang_lai').find({}, {
      projection: { _id: 1, ho_ten: 1, so_dien_thoai: 1, ngay_sinh: 1, gioi_tinh: 1, dia_chi: 1, ghi_chu: 1, created_by: 1, ho_so_benh_nhan_id: 1 },
    }).toArray()
    const appointments = await db.collection('lich_hen').find({}, {
      projection: {
        _id: 1, user_id: 1, member_id: 1, khach_vang_lai_id: 1,
        ho_so_benh_nhan_id: 1, ten_khach: 1, so_dien_thoai_khach: 1,
        gioi_tinh_khach: 1, nam_sinh_khach: 1, ngay_kham: 1, gio_kham: 1,
        schedule_id: 1, slot_id: 1,
      },
    }).toArray()
    const queues = await db.collection('hang_doi').find({}, {
      projection: {
        _id: 1, appointment_id: 1, member_id: 1, khach_vang_lai_id: 1,
        ho_so_benh_nhan_id: 1, ten_benh_nhan: 1, so_dien_thoai: 1,
        ngay_tao: 1, schedule_id: 1, slot_id: 1, khung_index: 1, gio_hen_goc: 1,
        specialty_id: 1, doctor_id: 1, phong_kham: 1,
      },
    }).toArray()
    const results = await db.collection('ket_qua_kham').find({}, {
      projection: { _id: 1, appointment_id: 1, hang_doi_id: 1, ho_so_benh_nhan_id: 1 },
    }).toArray()
    const medicalRecords = await db.collection('ho_so_y_te').find({}, {
      projection: { _id: 1, member_id: 1, appointment_id: 1, ho_so_benh_nhan_id: 1 },
    }).toArray()
    const vitals = await db.collection('sinh_hieu_kham').find({}, {
      projection: { _id: 1, appointment_id: 1, hang_doi_id: 1, ho_so_benh_nhan_id: 1 },
    }).toArray()
    const invoices = await db.collection('hoa_don').find({}, {
      projection: { _id: 1, appointment_id: 1, hang_doi_id: 1, ho_so_benh_nhan_id: 1 },
    }).toArray()
    const payments = await db.collection('thanh_toan').find({}, {
      projection: { _id: 1, appointment_id: 1, hoa_don_id: 1, hang_doi_id: 1, ho_so_benh_nhan_id: 1 },
    }).toArray()
    const schedules = await db.collection('lich_lam_viec').find({}, {
      projection: { _id: 1, slots: 1 },
    }).toArray()
    const existingProfiles = await profiles.find({}).toArray()

    const userMap = new Map(users.map((item) => [idKey(item._id), item]))
    const familyMap = new Map(families.map((item) => [idKey(item._id), item]))
    const memberMap = new Map(members.map((item) => [idKey(item._id), item]))
    const guestMap = new Map(guests.map((item) => [idKey(item._id), item]))
    const appointmentMap = new Map(appointments.map((item) => [idKey(item._id), item]))
    const queueMap = new Map(queues.map((item) => [idKey(item._id), item]))
    const invoiceMap = new Map(invoices.map((item) => [idKey(item._id), item]))
    const scheduleMap = new Map(schedules.map((item) => [idKey(item._id), item]))
    const profileByKey = new Map()
    const profileByPersonKey = new Map()
    const profilesToInsert = []
    let createdProfileCount = 0
    const updates = new Map()

    if (!DRY_RUN) {
      const profileIndexes = await profiles.indexes()
      for (const index of profileIndexes) {
        const keys = Object.keys(index.key ?? {})
        const isLegacyUniqueLink = index.unique
          && keys.length === 1
          && ['member_id', 'khach_vang_lai_id'].includes(keys[0])
        if (isLegacyUniqueLink) await profiles.dropIndex(index.name)
      }
    }

    for (const profile of existingProfiles) {
      if (profile.member_id) profileByKey.set(`member:${idKey(profile.member_id)}`, profile)
      if (profile.khach_vang_lai_id) profileByKey.set(`guest:${idKey(profile.khach_vang_lai_id)}`, profile)
      if (profile.tai_khoan_id && !profile.member_id && !profile.khach_vang_lai_id) {
        profileByKey.set(`user:${idKey(profile.tai_khoan_id)}`, profile)
      }
      const profilePersonKey = personKey(profile)
      if (!profile.member_id && !profile.khach_vang_lai_id && !profile.tai_khoan_id
        && normalizeName(profile.ho_ten)) {
        profileByPersonKey.set(profilePersonKey, profile)
      }
    }

    async function ensureProfile(key, fields, personKey = null) {
      const allowPersonFallback = key.startsWith('appointment:') || key.startsWith('queue:')
      const existing = profileByKey.get(key) || (allowPersonFallback && personKey ? profileByPersonKey.get(personKey) : null)
      if (existing) {
        profileByKey.set(key, existing)
        return existing
      }

      const _id = new ObjectId()
      const now = new Date()
      const profile = {
        _id,
        ho_ten: profileName(fields.ho_ten),
        so_dien_thoai: fields.so_dien_thoai ?? null,
        so_dien_thoai_tim_kiem: normalizePhone(fields.so_dien_thoai) || null,
        ngay_sinh: fields.ngay_sinh ?? null,
        gioi_tinh: fields.gioi_tinh ?? null,
        dia_chi: fields.dia_chi ?? null,
        ghi_chu: fields.ghi_chu ?? null,
        tai_khoan_id: fields.tai_khoan_id ?? null,
        nguoi_giam_ho_id: fields.nguoi_giam_ho_id ?? null,
        member_id: fields.member_id ?? null,
        khach_vang_lai_id: fields.khach_vang_lai_id ?? null,
        nguon_tao: fields.nguon_tao ?? 'backfill',
        trang_thai: 'active',
        ngay_tao: now,
        ngay_cap_nhat: now,
      }
      profileByKey.set(key, profile)
      if (personKey && !fields.member_id && !fields.khach_vang_lai_id && !fields.tai_khoan_id) {
        profileByPersonKey.set(personKey, profile)
      }
      createdProfileCount += 1
      if (!DRY_RUN) await profiles.insertOne(profile)
      else profilesToInsert.push(profile)
      return profile
    }

    function scheduleSlot(appointment) {
      const schedule = appointment?.schedule_id ? scheduleMap.get(idKey(appointment.schedule_id)) : null
      const slot = schedule?.slots?.find((item) => idKey(item._id) === idKey(appointment.slot_id))
      return { schedule, slot }
    }

    function addUpdate(collectionName, document, setFields) {
      const changes = {}
      for (const [field, value] of Object.entries(setFields)) {
        if (hasValue(value) && !hasValue(document[field])) changes[field] = value
      }
      if (Object.keys(changes).length === 0) return
      const key = `${collectionName}:${idKey(document._id)}`
      const current = updates.get(key)
      if (current) Object.assign(current.$set, changes)
      else updates.set(key, { collectionName, documentId: document._id, $set: changes })
    }

    function addLinkUpdate(collectionName, document, field, value) {
      if (!hasValue(value) || idKey(document[field]) === idKey(value)) return
      addUpdate(collectionName, { ...document, [field]: null }, { [field]: value })
    }

    for (const member of members) {
      const family = familyMap.get(idKey(member.family_id))
      const memberAccount = member.tai_khoan_id ? userMap.get(idKey(member.tai_khoan_id)) : null
      const guardian = family?.user_id ? userMap.get(idKey(family.user_id)) : null
      const contact = memberAccount ?? guardian
      const profile = await ensureProfile(`member:${idKey(member._id)}`, {
        ho_ten: member.ho_ten,
        so_dien_thoai: contact?.so_dien_thoai ?? null,
        ngay_sinh: member.ngay_sinh,
        gioi_tinh: member.gioi_tinh,
        ghi_chu: [member.di_ung, member.benh_nen].filter(Boolean).join('; ') || null,
        tai_khoan_id: member.tai_khoan_id ?? null,
        nguoi_giam_ho_id: member.tai_khoan_id ? null : (family?.user_id ?? null),
        member_id: member._id,
        nguon_tao: 'online',
      })
      addLinkUpdate('thanh_vien', member, 'ho_so_benh_nhan_id', profile._id)
    }

    for (const guest of guests) {
      const profile = await ensureProfile(`guest:${idKey(guest._id)}`, {
        ho_ten: guest.ho_ten,
        so_dien_thoai: guest.so_dien_thoai,
        ngay_sinh: guest.ngay_sinh,
        gioi_tinh: guest.gioi_tinh,
        dia_chi: guest.dia_chi,
        ghi_chu: guest.ghi_chu,
        nguoi_giam_ho_id: guest.created_by,
        khach_vang_lai_id: guest._id,
        nguon_tao: 'backfill',
      }, personKey(guest))
      addLinkUpdate('khach_vang_lai', guest, 'ho_so_benh_nhan_id', profile._id)
    }

    const appointmentProfiles = new Map()
    for (const appointment of appointments) {
      let profile = null
      if (appointment.member_id) {
        profile = profileByKey.get(`member:${idKey(appointment.member_id)}`)
      } else if (appointment.khach_vang_lai_id) {
        profile = profileByKey.get(`guest:${idKey(appointment.khach_vang_lai_id)}`)
      } else if (appointment.user_id) {
        const user = userMap.get(idKey(appointment.user_id))
        profile = await ensureProfile(`user:${idKey(appointment.user_id)}`, {
          ho_ten: appointment.ten_khach || user?.ho_ten,
          so_dien_thoai: appointment.so_dien_thoai_khach || user?.so_dien_thoai,
          gioi_tinh: appointment.gioi_tinh_khach === 'male' ? 'nam' : appointment.gioi_tinh_khach === 'female' ? 'nu' : null,
          tai_khoan_id: appointment.user_id,
          nguon_tao: 'online',
        }, `${normalizePhone(appointment.so_dien_thoai_khach || user?.so_dien_thoai)}|${normalizeName(appointment.ten_khach || user?.ho_ten)}`)
      } else {
        const appointmentPersonKey = personKey({
          so_dien_thoai: appointment.so_dien_thoai_khach,
          ho_ten: appointment.ten_khach,
          ngay_sinh: appointment.nam_sinh_khach ? new Date(`${appointment.nam_sinh_khach}-01-01T00:00:00.000Z`) : null,
          gioi_tinh: appointment.gioi_tinh_khach === 'male' ? 'nam' : appointment.gioi_tinh_khach === 'female' ? 'nu' : null,
        })
        profile = await ensureProfile(`appointment:${idKey(appointment._id)}`, {
          ho_ten: appointment.ten_khach,
          so_dien_thoai: appointment.so_dien_thoai_khach,
          gioi_tinh: appointment.gioi_tinh_khach === 'male' ? 'nam' : appointment.gioi_tinh_khach === 'female' ? 'nu' : null,
          ngay_sinh: appointment.nam_sinh_khach ? new Date(`${appointment.nam_sinh_khach}-01-01T00:00:00.000Z`) : null,
          nguon_tao: 'tai_quay',
        }, appointmentPersonKey)
      }
      if (!profile) continue
      appointmentProfiles.set(idKey(appointment._id), profile)
      addLinkUpdate('lich_hen', appointment, 'ho_so_benh_nhan_id', profile._id)
    }

    for (const queue of queues) {
      let profile = queue.appointment_id ? appointmentProfiles.get(idKey(queue.appointment_id)) : null
      if (!profile && queue.member_id) profile = profileByKey.get(`member:${idKey(queue.member_id)}`)
      if (!profile && queue.khach_vang_lai_id) profile = profileByKey.get(`guest:${idKey(queue.khach_vang_lai_id)}`)
      if (!profile) {
        profile = await ensureProfile(`queue:${idKey(queue._id)}`, {
          ho_ten: queue.ten_benh_nhan,
          so_dien_thoai: queue.so_dien_thoai,
          nguon_tao: 'tai_quay',
        }, personKey({ so_dien_thoai: queue.so_dien_thoai, ho_ten: queue.ten_benh_nhan }))
      }
      if (profile) addLinkUpdate('hang_doi', queue, 'ho_so_benh_nhan_id', profile._id)

      const appointment = queue.appointment_id ? appointmentMap.get(idKey(queue.appointment_id)) : null
      if (appointment) {
        const { schedule, slot } = scheduleSlot(appointment)
        addUpdate('hang_doi', queue, {
          schedule_id: appointment.schedule_id,
          slot_id: appointment.slot_id,
          khung_index: slot?.khung_index,
          gio_hen_goc: dateFromAppointment(appointment),
          specialty_id: appointment.specialty_id,
          doctor_id: appointment.doctor_id,
          phong_kham: slot?.phong_kham,
        })
        if (!schedule) console.warn(`[013] Missing schedule for queue ${queue._id}`)
      }
    }

    const profileByQueueId = new Map()
    for (const queue of queues) {
      const update = updates.get(`hang_doi:${idKey(queue._id)}`)
      const profileId = update?.$set?.ho_so_benh_nhan_id || queue.ho_so_benh_nhan_id
      if (profileId) profileByQueueId.set(idKey(queue._id), profileId)
    }

    for (const item of results) {
      const profile = item.appointment_id
        ? appointmentProfiles.get(idKey(item.appointment_id))
        : profileByQueueId.get(idKey(item.hang_doi_id))
      if (profile) addLinkUpdate('ket_qua_kham', item, 'ho_so_benh_nhan_id', profile._id ?? profile)
    }

    for (const item of medicalRecords) {
      const profile = item.appointment_id
        ? appointmentProfiles.get(idKey(item.appointment_id))
        : item.member_id ? profileByKey.get(`member:${idKey(item.member_id)}`) : null
      if (profile) addLinkUpdate('ho_so_y_te', item, 'ho_so_benh_nhan_id', profile._id ?? profile)
    }

    for (const item of vitals) {
      const profile = item.appointment_id
        ? appointmentProfiles.get(idKey(item.appointment_id))
        : profileByQueueId.get(idKey(item.hang_doi_id))
      if (profile) addLinkUpdate('sinh_hieu_kham', item, 'ho_so_benh_nhan_id', profile._id ?? profile)
    }

    const profileByInvoiceId = new Map()
    for (const invoice of invoices) {
      const profile = invoice.appointment_id
        ? appointmentProfiles.get(idKey(invoice.appointment_id))
        : invoice.hang_doi_id ? profileByQueueId.get(idKey(invoice.hang_doi_id)) : null
      if (profile) {
        const profileId = profile._id ?? profile
        profileByInvoiceId.set(idKey(invoice._id), profileId)
        addLinkUpdate('hoa_don', invoice, 'ho_so_benh_nhan_id', profileId)
      }
    }

    for (const payment of payments) {
      const profile = payment.hoa_don_id
        ? profileByInvoiceId.get(idKey(payment.hoa_don_id))
        : payment.appointment_id ? appointmentProfiles.get(idKey(payment.appointment_id)) : null
      if (profile) addLinkUpdate('thanh_toan', payment, 'ho_so_benh_nhan_id', profile._id ?? profile)
    }

    const groupedUpdates = new Map()
    for (const update of updates.values()) {
      if (!groupedUpdates.has(update.collectionName)) groupedUpdates.set(update.collectionName, [])
      groupedUpdates.get(update.collectionName).push({
        updateOne: { filter: { _id: update.documentId }, update: { $set: update.$set } },
      })
    }

    if (DRY_RUN) {
      console.log(JSON.stringify({
        dry_run: true,
        profiles_to_insert: createdProfileCount,
        documents_to_update: updates.size,
        updates_by_collection: Object.fromEntries([...groupedUpdates].map(([name, ops]) => [name, ops.length])),
      }, null, 2))
      return 0
    }

    async function replaceSingleFieldIndex(collection, field, name, options = {}) {
      const indexes = await collection.indexes()
      for (const index of indexes) {
        const keys = Object.keys(index.key ?? {})
        if (keys.length === 1 && keys[0] === field) {
          await collection.dropIndex(index.name)
        }
      }
      await collection.createIndex({ [field]: 1 }, { name, ...options })
    }

    await replaceSingleFieldIndex(profiles, 'so_dien_thoai_tim_kiem', 'idx_ho_so_benh_nhan_phone')
    await replaceSingleFieldIndex(profiles, 'member_id', 'uniq_ho_so_benh_nhan_member', {
      unique: true,
      partialFilterExpression: { member_id: { $type: 'objectId' } },
    })
    await replaceSingleFieldIndex(profiles, 'khach_vang_lai_id', 'uniq_ho_so_benh_nhan_guest', {
      unique: true,
      partialFilterExpression: { khach_vang_lai_id: { $type: 'objectId' } },
    })

    for (const [collectionName, operations] of groupedUpdates) {
      if (operations.length > 0) await db.collection(collectionName).bulkWrite(operations, { ordered: false })
    }

    await replaceSingleFieldIndex(db.collection('hoa_don'), 'appointment_id', 'uniq_hoa_don_theo_appointment', {
      unique: true,
      partialFilterExpression: { appointment_id: { $type: 'objectId' } },
    })
    await replaceSingleFieldIndex(db.collection('hoa_don'), 'hang_doi_id', 'uniq_hoa_don_theo_hang_doi', {
      unique: true,
      partialFilterExpression: { hang_doi_id: { $type: 'objectId' } },
    })
    await replaceSingleFieldIndex(db.collection('hoa_don'), 'ho_so_benh_nhan_id', 'idx_hoa_don_ho_so_benh_nhan')
    await replaceSingleFieldIndex(db.collection('lich_hen'), 'ho_so_benh_nhan_id', 'idx_lich_hen_ho_so_benh_nhan')
    await db.collection('hang_doi').createIndex({ ho_so_benh_nhan_id: 1, trang_thai: 1 }, { name: 'idx_hang_doi_ho_so_trang_thai' })
    await db.collection('hang_doi').createIndex({ schedule_id: 1, slot_id: 1 }, { name: 'idx_hang_doi_schedule_slot' })
    await db.collection('thanh_toan').createIndex({ ho_so_benh_nhan_id: 1 }, { name: 'idx_thanh_toan_ho_so_benh_nhan' })
    await replaceSingleFieldIndex(db.collection('sinh_hieu_kham'), 'ho_so_benh_nhan_id', 'idx_sinh_hieu_ho_so_benh_nhan')

    const affectedDocuments = updates.size + createdProfileCount
    console.log(JSON.stringify({
      dry_run: false,
      profiles_created: createdProfileCount,
      documents_updated: updates.size,
      affected_documents: affectedDocuments,
    }, null, 2))
    return affectedDocuments
  },
})

console.log(JSON.stringify(result))
