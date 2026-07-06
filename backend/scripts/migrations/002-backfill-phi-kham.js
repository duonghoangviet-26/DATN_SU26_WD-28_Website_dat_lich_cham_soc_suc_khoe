import { runMigration } from './_migrationRunner.js'

const missingPhiKhamFilter = {
  $or: [{ phi_kham: { $exists: false } }, { phi_kham: null }],
}

function resolveDefaultPhiKham(configDocument) {
  if (!configDocument) {
    return null
  }

  const candidates = [
    configDocument.phi_kham_mac_dinh,
    configDocument.gia_kham_mac_dinh,
    configDocument.default_phi_kham,
    configDocument.default_gia_kham,
  ]

  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      return value
    }
  }

  return null
}

const result = await runMigration({
  name: '002-backfill-phi-kham',
  rollbackable: true,
  async up({ connection }) {
    const configDocument = await connection.collection('cau_hinh_phong_kham').findOne({})
    const defaultPhiKham = resolveDefaultPhiKham(configDocument)
    const doctors = await connection.collection('bac_si').find(missingPhiKhamFilter).toArray()

    let affectedDocuments = 0

    for (const doctor of doctors) {
      let resolvedPhiKham = null

      if (typeof doctor.gia_kham === 'number' && Number.isFinite(doctor.gia_kham) && doctor.gia_kham >= 0) {
        resolvedPhiKham = doctor.gia_kham
      } else if (defaultPhiKham !== null) {
        resolvedPhiKham = defaultPhiKham
      } else {
        throw new Error(`Missing default phi_kham for bac_si document ${doctor._id}`)
      }

      const updateResult = await connection.collection('bac_si').updateOne(
        { _id: doctor._id },
        { $set: { phi_kham: resolvedPhiKham } }
      )

      affectedDocuments += updateResult.modifiedCount
    }

    return affectedDocuments
  },
})

console.log(JSON.stringify(result))
