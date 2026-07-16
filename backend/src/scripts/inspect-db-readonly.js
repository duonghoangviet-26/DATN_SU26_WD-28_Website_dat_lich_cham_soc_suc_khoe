import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

// ============================================================
// INSPECT DB (READ-ONLY) — chỉ dùng listCollections/countDocuments/find().limit(3)
// Không insert/update/delete/drop bất kỳ dữ liệu nào.
// Không in MONGODB_URI (kể cả dạng che một phần) hay bất kỳ secret nào ra console.
// ============================================================

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendRoot = path.resolve(__dirname, '../..')

dotenv.config({ path: path.join(backendRoot, '.env') })

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('Thieu MONGODB_URI trong backend/.env')
  process.exit(1)
}

const SENSITIVE_KEY_PATTERN = /pass|mat_khau|token|secret|otp|refresh|gateway_response/i
const EMAIL_KEY_PATTERN = /^email/i
const PHONE_KEY_PATTERN = /so_dien_thoai|phone|sdt/i

function maskEmail(value) {
  if (typeof value !== 'string' || !value.includes('@')) return value
  const [local, domain] = value.split('@')
  const visible = local.slice(0, 2)
  return `${visible}${'*'.repeat(Math.max(local.length - visible.length, 1))}@${domain}`
}

function maskPhone(value) {
  if (typeof value !== 'string') return value
  if (value.length <= 4) return '*'.repeat(value.length)
  return `${value.slice(0, 3)}${'*'.repeat(Math.max(value.length - 5, 1))}${value.slice(-2)}`
}

function redact(value) {
  if (Array.isArray(value)) return value.map((item) => redact(item))
  if (value && typeof value === 'object') {
    if (typeof value.toHexString === 'function') return value.toString() // ObjectId
    if (value instanceof Date) return value.toISOString()
    const out = {}
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        out[key] = '[REDACTED]'
      } else if (EMAIL_KEY_PATTERN.test(key) && typeof val === 'string') {
        out[key] = maskEmail(val)
      } else if (PHONE_KEY_PATTERN.test(key) && typeof val === 'string') {
        out[key] = maskPhone(val)
      } else {
        out[key] = redact(val)
      }
    }
    return out
  }
  return value
}

const client = new MongoClient(uri)

try {
  await client.connect()
  const db = client.db()
  const dbName = db.databaseName
  const collectionInfos = (await db.listCollections().toArray()).sort((a, b) => a.name.localeCompare(b.name))

  const report = {
    generatedAt: new Date().toISOString(),
    databaseName: dbName,
    collectionCount: collectionInfos.length,
    collections: [],
  }

  for (const info of collectionInfos) {
    const coll = db.collection(info.name)
    const count = await coll.countDocuments()
    const samples = await coll.find({}).limit(3).toArray()

    report.collections.push({
      name: info.name,
      count,
      samples: samples.map((doc) => redact(doc)),
    })

    console.log(`${info.name}: ${count} documents`)
  }

  const outDir = path.join(backendRoot, 'reports')
  await fs.mkdir(outDir, { recursive: true })
  const outPath = path.join(outDir, 'inspect-db-readonly-report.json')
  await fs.writeFile(outPath, JSON.stringify(report, null, 2), 'utf8')

  console.log(`\nDATABASE_NAME ${dbName}`)
  console.log(`COLLECTION_COUNT ${collectionInfos.length}`)
  console.log(`REPORT_WRITTEN ${outPath}`)
} finally {
  await client.close()
}
