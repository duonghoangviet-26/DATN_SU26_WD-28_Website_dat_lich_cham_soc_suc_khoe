import fs from 'fs/promises'
import path from 'path'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { MongoClient } from 'mongodb'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const backendRoot = path.resolve(__dirname, '../..')
export const repoRoot = path.resolve(backendRoot, '..')
export const docsDir = path.join(repoRoot, 'docs', 'demo-seed')
export const reportsDir = path.join(backendRoot, 'reports', 'demo-seed')
export const EXPECTED_DB_NAME = 'DATN_VITAFAMILY'

dotenv.config({ path: path.join(backendRoot, '.env') })

export const resetCollectionPlans = [
  { name: 'nguoi_dung', reason: 'Tai khoan demo va staff demo' },
  { name: 'gia_dinh', reason: 'Nhom gia dinh cua benh nhan demo' },
  { name: 'thanh_vien', reason: 'Thanh vien/benh nhan demo' },
  { name: 'bac_si', reason: 'Ho so bac si demo' },
  { name: 'lich_lam_viec', reason: 'Lich va slot demo' },
  { name: 'lich_hen', reason: 'Lich hen demo' },
  { name: 'hoa_don', reason: 'Hoa don demo' },
  { name: 'thanh_toan', reason: 'Thanh toan demo' },
  { name: 'hoan_tien', reason: 'Hoan tien demo' },
  { name: 'thong_bao', reason: 'Thong bao demo' },
  { name: 'ket_qua_kham', reason: 'Ket qua kham demo' },
  { name: 'ket_qua_kham_tai', reason: 'Ket qua kham tai demo' },
  { name: 'ket_qua_kham_mui', reason: 'Ket qua kham mui demo' },
  { name: 'ket_qua_kham_hong', reason: 'Ket qua kham hong demo' },
  { name: 'don_thuoc', reason: 'Don thuoc demo' },
  { name: 'sinh_hieu_kham', reason: 'Sinh hieu kham demo' },
  { name: 'cau_hinh_phong_kham', reason: 'Singleton cau hinh demo' },
  { name: 'khach_vang_lai', reason: 'Khach vang lai demo' },
  { name: 'nghi_phep_bac_si', reason: 'Don nghi phep bac si demo' },
  { name: 'lich_su_lich_hen', reason: 'Log thay doi lich hen demo' },
  { name: 'counters', reason: 'Counter ma demo' },
  { name: 'thong_tin_phong_kham', reason: 'Collection chi nhanh thuc te cua repo' },
  { name: 'chuyen_khoa', reason: 'Chuyen khoa demo' },
  { name: 'ho_so_y_te', reason: 'Ho so y te demo' },
  { name: 'dich_vu', reason: 'Dich vu demo' },
  { name: 'cai_dat_thanh_toan', reason: 'Cai dat thanh toan demo' },
]

export function parseArgs(argv) {
  const args = {}

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (!arg.startsWith('--')) continue

    const nextArg = argv[index + 1]
    if (!nextArg || nextArg.startsWith('--')) {
      args[arg.slice(2)] = true
      continue
    }

    args[arg.slice(2)] = nextArg
    index += 1
  }

  return args
}

export function timestampForName(date = new Date()) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}${mm}${dd}-${hh}${min}`
}

export function maskMongoUri(uri) {
  return uri.replace(/:([^:@]+)@/, ':***@')
}

export function getMongoUri() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Missing MONGODB_URI')
  }

  return process.env.MONGODB_URI
}

export function getConnectionMeta(mongoUri) {
  const parsed = new URL(mongoUri)
  return {
    host: parsed.host,
    databaseName: parsed.pathname.replace(/^\//, ''),
    nodeEnv: process.env.NODE_ENV || 'undefined',
    runAt: new Date().toISOString(),
    maskedUri: maskMongoUri(mongoUri),
  }
}

export function ensureExpectedDatabaseName(databaseName) {
  if (databaseName !== EXPECTED_DB_NAME) {
    throw new Error(`Refuse to continue because database is ${databaseName}, expected ${EXPECTED_DB_NAME}`)
  }
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

export async function writeTextFile(filePath, content) {
  await ensureDir(path.dirname(filePath))
  await fs.writeFile(filePath, content, 'utf8')
}

export async function writeJsonFile(filePath, value) {
  await writeTextFile(filePath, JSON.stringify(value, null, 2) + '\n')
}

export async function readJsonFileIfExists(filePath, fallback = null) {
  try {
    const text = await fs.readFile(filePath, 'utf8')
    return JSON.parse(text)
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return fallback
    }
    throw error
  }
}

export function fixedObjectId(sequence) {
  return new mongoose.Types.ObjectId(sequence.toString(16).padStart(24, '0'))
}

export function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function formatDateParts(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return {
    yyyymmdd: `${year}${month}${day}`,
    yymmdd: `${String(year).slice(-2)}${month}${day}`,
    isoDate: `${year}-${month}-${day}`,
  }
}

export function buildMarkdownTable(headers, rows) {
  const head = `| ${headers.join(' | ')} |`
  const sep = `| ${headers.map(() => '---').join(' | ')} |`
  const body = rows.map((row) => `| ${row.join(' | ')} |`)
  return [head, sep, ...body].join('\n') + '\n'
}

export function printConnectionMeta(meta) {
  console.log(`Database dang ket noi: ${EXPECTED_DB_NAME}`)
  console.log(`Host: ${meta.host}`)
  console.log(`Database name: ${meta.databaseName}`)
  console.log(`NODE_ENV: ${meta.nodeEnv}`)
  console.log(`Thoi diem chay: ${meta.runAt}`)
}

export async function connectMongooseForExpectedDb() {
  const mongoUri = getMongoUri()
  const meta = getConnectionMeta(mongoUri)
  ensureExpectedDatabaseName(meta.databaseName)
  await mongoose.connect(mongoUri)
  return meta
}

export async function withMongoClientForExpectedDb(fn) {
  const mongoUri = getMongoUri()
  const meta = getConnectionMeta(mongoUri)
  ensureExpectedDatabaseName(meta.databaseName)
  const client = new MongoClient(mongoUri)
  await client.connect()

  try {
    return await fn({
      client,
      db: client.db(meta.databaseName),
      meta,
    })
  } finally {
    await client.close()
  }
}

export function stateFilePath(name) {
  return path.join(reportsDir, name)
}

export function docFilePath(name) {
  return path.join(docsDir, name)
}
