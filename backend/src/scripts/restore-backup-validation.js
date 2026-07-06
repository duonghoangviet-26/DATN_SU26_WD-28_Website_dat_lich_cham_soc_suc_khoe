import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { MongoClient } from 'mongodb'
import { EJSON } from 'bson'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendRoot = path.resolve(__dirname, '../..')

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

function withDatabaseName(uri, dbName) {
  const parsed = new URL(uri)
  parsed.pathname = `/${dbName}`
  return parsed.toString()
}

const args = parseArgs(process.argv.slice(2))
if (!args.backupDir) {
  throw new Error('Usage: node src/scripts/restore-backup-validation.js --backupDir <dir> [--tempDb <name>]')
}

const sourceUri = args.uri || await readMongoUri()
const backupDir = path.resolve(backendRoot, '..', args.backupDir)
const metadata = JSON.parse(await fs.readFile(path.join(backupDir, 'metadata.json'), 'utf8'))
const tempDbName = args.tempDb || `vf_bakchk_${Date.now()}`
const tempUri = withDatabaseName(sourceUri, tempDbName)

const client = new MongoClient(tempUri)

try {
  await client.connect()
  const db = client.db(tempDbName)
  await db.dropDatabase()

  for (const collectionInfo of metadata.collections) {
    const filePath = path.join(backupDir, `${collectionInfo.name}.json`)
    const fileText = await fs.readFile(filePath, 'utf8')
    const documents = EJSON.parse(fileText)
    const collection = db.collection(collectionInfo.name)

    if (documents.length > 0) {
      await collection.insertMany(documents, { ordered: true })
    } else {
      await db.createCollection(collectionInfo.name)
    }

    const indexes = collectionInfo.indexes.filter((index) => index.name !== '_id_')
    if (indexes.length > 0) {
      await collection.createIndexes(
        indexes.map((index) => {
          const indexSpec = {
            key: index.key,
            name: index.name,
          }

          if (typeof index.unique === 'boolean') indexSpec.unique = index.unique
          if (typeof index.sparse === 'boolean') indexSpec.sparse = index.sparse
          if (typeof index.expireAfterSeconds === 'number') {
            indexSpec.expireAfterSeconds = index.expireAfterSeconds
          }
          if (typeof index.background === 'boolean') indexSpec.background = index.background

          return indexSpec
        })
      )
    }
  }

  const checkNames = ['lich_hen', 'nguoi_dung', 'bac_si', 'thanh_toan']
  const validation = []

  for (const name of checkNames) {
    const sourceMeta = metadata.collections.find((collection) => collection.name === name)
    const restoredCount = await db.collection(name).countDocuments()
    validation.push({
      name,
      sourceCount: sourceMeta ? sourceMeta.count : null,
      restoredCount,
    })
  }

  console.log(`TEMP_DB ${tempDbName}`)
  for (const item of validation) {
    console.log(`COUNT ${item.name} ${item.sourceCount} ${item.restoredCount}`)
  }
} finally {
  await client.close()
}
