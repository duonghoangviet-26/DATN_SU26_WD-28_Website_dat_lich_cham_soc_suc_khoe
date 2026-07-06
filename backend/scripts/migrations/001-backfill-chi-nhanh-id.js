import mongoose from 'mongoose'
import { runMigration } from './_migrationRunner.js'

const missingBranchFilter = {
  $or: [{ chi_nhanh_id: { $exists: false } }, { chi_nhanh_id: null }],
}

function resolveDefaultBranchId() {
  const value = process.env.DEFAULT_BRANCH_ID

  if (!value) {
    return null
  }

  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error('DEFAULT_BRANCH_ID is not a valid ObjectId')
  }

  return new mongoose.Types.ObjectId(value)
}

function asBranchKey(value) {
  return value ? value.toString() : null
}

async function buildDoctorBranchMap(connection) {
  const doctors = await connection.collection('bac_si')
    .find(
      { chi_nhanh_id: { $exists: true, $ne: null } },
      { projection: { _id: 1, chi_nhanh_id: 1 } }
    )
    .toArray()

  return new Map(
    doctors.map((doctor) => [doctor._id.toString(), asBranchKey(doctor.chi_nhanh_id)])
  )
}

async function backfillDoctorBranches(connection, defaultBranchId) {
  const missingCount = await connection.collection('bac_si').countDocuments(missingBranchFilter)

  if (missingCount > 0 && !defaultBranchId) {
    throw new Error('Missing DEFAULT_BRANCH_ID for bac_si backfill')
  }

  if (missingCount === 0) {
    return 0
  }

  const result = await connection.collection('bac_si').updateMany(
    missingBranchFilter,
    { $set: { chi_nhanh_id: defaultBranchId } }
  )

  return result.modifiedCount
}

async function backfillCollectionFromDoctor({ connection, collectionName, defaultBranchId }) {
  const doctorBranchMap = await buildDoctorBranchMap(connection)
  const documents = await connection.collection(collectionName).find(missingBranchFilter).toArray()

  let modifiedCount = 0

  for (const document of documents) {
    const doctorBranchId = document.doctor_id
      ? doctorBranchMap.get(document.doctor_id.toString())
      : null

    const resolvedBranchId = doctorBranchId || asBranchKey(defaultBranchId)

    if (!resolvedBranchId) {
      throw new Error(`Missing DEFAULT_BRANCH_ID for ${collectionName} document ${document._id}`)
    }

    const result = await connection.collection(collectionName).updateOne(
      { _id: document._id },
      { $set: { chi_nhanh_id: new mongoose.Types.ObjectId(resolvedBranchId) } }
    )

    modifiedCount += result.modifiedCount
  }

  return modifiedCount
}

const result = await runMigration({
  name: '001-backfill-chi-nhanh-id',
  rollbackable: true,
  async up({ connection }) {
    const defaultBranchId = resolveDefaultBranchId()

    let affectedDocuments = 0

    affectedDocuments += await backfillDoctorBranches(connection, defaultBranchId)
    affectedDocuments += await backfillCollectionFromDoctor({
      connection,
      collectionName: 'lich_lam_viec',
      defaultBranchId,
    })
    affectedDocuments += await backfillCollectionFromDoctor({
      connection,
      collectionName: 'lich_hen',
      defaultBranchId,
    })

    return affectedDocuments
  },
})

console.log(JSON.stringify(result))
