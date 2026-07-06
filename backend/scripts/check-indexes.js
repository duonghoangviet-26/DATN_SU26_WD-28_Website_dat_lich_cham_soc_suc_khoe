import 'dotenv/config'
import mongoose from 'mongoose'

import ThanhToan from '../src/models/ThanhToan.js'
import HoaDon from '../src/models/HoaDon.js'
import LichHen from '../src/models/LichHen.js'
import LichLamViec from '../src/models/LichLamViec.js'
import CauHinhPhongKham from '../src/models/CauHinhPhongKham.js'
import SinhHieuKham from '../src/models/SinhHieuKham.js'
import KetQuaKham from '../src/models/KetQuaKham.js'
import KetQuaKhamTai from '../src/models/KetQuaKhamTai.js'
import KetQuaKhamMui from '../src/models/KetQuaKhamMui.js'
import KetQuaKhamHong from '../src/models/KetQuaKhamHong.js'

function keysEqual(indexKeys, expectedKeys) {
  const actualEntries = Object.entries(indexKeys)
  const expectedEntries = Object.entries(expectedKeys)

  if (actualEntries.length !== expectedEntries.length) {
    return false
  }

  return expectedEntries.every(([key, value], idx) => {
    const [actualKey, actualValue] = actualEntries[idx] ?? []
    return actualKey === key && actualValue === value
  })
}

function findIndex(indexes, expectedKeys) {
  return indexes.find((index) => keysEqual(index.key, expectedKeys))
}

function describeKeys(keys) {
  return JSON.stringify(keys)
}

function validateIndex(indexes, expectedKeys, options = {}) {
  const index = findIndex(indexes, expectedKeys)
  if (!index) {
    return `Missing index ${describeKeys(expectedKeys)}`
  }

  if (Object.prototype.hasOwnProperty.call(options, 'unique')) {
    const actualUnique = Boolean(index.unique)
    if (actualUnique !== options.unique) {
      return `Index ${describeKeys(expectedKeys)} unique expected ${options.unique} but got ${actualUnique}`
    }
  }

  if (Object.prototype.hasOwnProperty.call(options, 'sparse')) {
    const actualSparse = Boolean(index.sparse)
    if (actualSparse !== options.sparse) {
      return `Index ${describeKeys(expectedKeys)} sparse expected ${options.sparse} but got ${actualSparse}`
    }
  }

  return null
}

async function ensureIndexesBuilt() {
  await Promise.all([
    ThanhToan.init(),
    HoaDon.init(),
    LichHen.init(),
    LichLamViec.init(),
    CauHinhPhongKham.init(),
    SinhHieuKham.init(),
    KetQuaKham.init(),
    KetQuaKhamTai.init(),
    KetQuaKhamMui.init(),
    KetQuaKhamHong.init(),
  ])
}

async function collectIndexErrors() {
  const checks = [
    {
      collection: ThanhToan.collection.collectionName,
      indexes: await ThanhToan.collection.indexes(),
      validations: [
        { keys: { appointment_id: 1 }, options: { unique: true, sparse: true } },
      ],
    },
    {
      collection: HoaDon.collection.collectionName,
      indexes: await HoaDon.collection.indexes(),
      validations: [
        { keys: { appointment_id: 1 }, options: { unique: true } },
        { keys: { so_hoa_don: 1 }, options: { unique: true } },
      ],
    },
    {
      collection: LichHen.collection.collectionName,
      indexes: await LichHen.collection.indexes(),
      validations: [
        { keys: { ma_lich_hen: 1 }, options: { unique: true, sparse: true } },
      ],
    },
    {
      collection: LichLamViec.collection.collectionName,
      indexes: await LichLamViec.collection.indexes(),
      validations: [
        { keys: { 'slots._id': 1, 'slots.status': 1 } },
      ],
    },
    {
      collection: CauHinhPhongKham.collection.collectionName,
      indexes: await CauHinhPhongKham.collection.indexes(),
      validations: [
        { keys: { singleton_key: 1 }, options: { unique: true } },
      ],
    },
    {
      collection: SinhHieuKham.collection.collectionName,
      indexes: await SinhHieuKham.collection.indexes(),
      validations: [
        { keys: { appointment_id: 1 }, options: { unique: true } },
      ],
    },
    {
      collection: KetQuaKham.collection.collectionName,
      indexes: await KetQuaKham.collection.indexes(),
      validations: [
        { keys: { appointment_id: 1 }, options: { unique: true } },
      ],
    },
    {
      collection: KetQuaKhamTai.collection.collectionName,
      indexes: await KetQuaKhamTai.collection.indexes(),
      validations: [
        { keys: { appointment_id: 1 }, options: { unique: false } },
      ],
    },
    {
      collection: KetQuaKhamMui.collection.collectionName,
      indexes: await KetQuaKhamMui.collection.indexes(),
      validations: [
        { keys: { appointment_id: 1 }, options: { unique: false } },
      ],
    },
    {
      collection: KetQuaKhamHong.collection.collectionName,
      indexes: await KetQuaKhamHong.collection.indexes(),
      validations: [
        { keys: { appointment_id: 1 }, options: { unique: false } },
      ],
    },
  ]

  const errors = []

  for (const check of checks) {
    for (const validation of check.validations) {
      const error = validateIndex(check.indexes, validation.keys, validation.options)
      if (error) {
        errors.push({
          collection: check.collection,
          error,
        })
      }
    }
  }

  return errors
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Missing MONGODB_URI')
  }

  await mongoose.connect(process.env.MONGODB_URI)

  try {
    await ensureIndexesBuilt()
    const errors = await collectIndexErrors()

    if (errors.length > 0) {
      for (const item of errors) {
        console.error(`${item.collection}: ${item.error}`)
      }
      process.exitCode = 1
      return
    }

    console.log('ALL_INDEXES_VALID')
  } finally {
    await mongoose.disconnect()
  }
}

await main()
