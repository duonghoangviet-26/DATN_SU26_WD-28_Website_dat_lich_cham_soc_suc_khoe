import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { MongoClient } from 'mongodb'
import { EJSON } from 'bson'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendRoot = path.resolve(__dirname, '../..')

function formatTimestamp(date = new Date()) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}${mm}${dd}-${hh}${min}`
}

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (!arg.startsWith('--')) continue
    args[arg.slice(2)] = argv[index + 1]
    index += 1
  }
  return args
}

async function readMongoUri() {
  const envPath = path.join(backendRoot, '.env')
  const envText = await fs.readFile(envPath, 'utf8')
  const line = envText.split(/\r?\n/).find((entry) => entry.startsWith('MONGODB_URI='))
  if (!line) {
    throw new Error('Missing MONGODB_URI in backend/.env')
  }
  return line.slice('MONGODB_URI='.length)
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

const args = parseArgs(process.argv.slice(2))
const mongoUri = args.uri || await readMongoUri()
const timestamp = args.timestamp || formatTimestamp()
const outputDir = path.resolve(
  backendRoot,
  '..',
  'backup',
  args.out || `vitafamily-${timestamp}`
)

const client = new MongoClient(mongoUri)

try {
  await ensureDir(outputDir)
  await client.connect()

  const db = client.db()
  const dbName = db.databaseName
  const collections = await db.listCollections().toArray()
  const metadata = {
    createdAt: new Date().toISOString(),
    databaseName: dbName,
    collectionCount: collections.length,
    collections: [],
  }

  for (const collectionInfo of collections) {
    const collection = db.collection(collectionInfo.name)
    const documents = await collection.find({}).toArray()
    const indexes = await collection.indexes()

    metadata.collections.push({
      name: collectionInfo.name,
      count: documents.length,
      indexes,
    })

    const collectionPath = path.join(outputDir, `${collectionInfo.name}.json`)
    await fs.writeFile(collectionPath, EJSON.stringify(documents, null, 2), 'utf8')
  }

  const metadataPath = path.join(outputDir, 'metadata.json')
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8')

  console.log(`BACKUP_CREATED ${outputDir}`)
  console.log(`DATABASE ${dbName}`)
  console.log(`COLLECTIONS ${collections.length}`)
} finally {
  await client.close()
}
