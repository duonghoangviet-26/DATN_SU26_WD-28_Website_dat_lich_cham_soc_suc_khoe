import 'dotenv/config'
import mongoose from 'mongoose'
import HoaDon from '../models/HoaDon.js'

const LEGACY_INDEX_NAME = 'appointment_id_1'

function isLegacyAppointmentIndex(index) {
  return index.name === LEGACY_INDEX_NAME
    && index.unique === true
    && index.key?.appointment_id === 1
    && !index.partialFilterExpression
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Missing MONGODB_URI in backend/.env')
  }

  await mongoose.connect(process.env.MONGODB_URI)

  try {
    const collection = mongoose.connection.db.collection(HoaDon.collection.name)
    const before = await collection.indexes()
    const legacyIndex = before.find(isLegacyAppointmentIndex)

    if (legacyIndex) {
      await collection.dropIndex(legacyIndex.name)
    }

    // Create only indexes declared by the model; preserve unrelated indexes.
    await HoaDon.createIndexes()

    const after = await collection.indexes()
    console.log(JSON.stringify({
      collection: collection.collectionName,
      dropped: legacyIndex?.name ?? null,
      indexes: after.map(({ name, key, unique, partialFilterExpression }) => ({
        name,
        key,
        ...(unique ? { unique } : {}),
        ...(partialFilterExpression ? { partialFilterExpression } : {}),
      })),
    }, null, 2))
  } finally {
    await mongoose.disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
