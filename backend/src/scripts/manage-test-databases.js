import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { MongoClient } from 'mongodb'
import {
  buildDatabaseRows,
  formatTextReport,
  maskMongoUri,
  summarizeRows,
} from './lib/mongoTestDbCleanup.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendRoot = path.resolve(__dirname, '../..')

function parseArgs(argv) {
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

async function readMongoUri() {
  const envPath = path.join(backendRoot, '.env')
  const envText = await fs.readFile(envPath, 'utf8')
  const line = envText.split(/\r?\n/).find((entry) => entry.startsWith('MONGODB_URI='))

  if (!line) {
    throw new Error('Missing MONGODB_URI in backend/.env')
  }

  return line.slice('MONGODB_URI='.length)
}

function ensureDeleteConfirmation(args) {
  if (!args.deleteSafe) {
    return
  }

  if (args.confirm !== 'DELETE_TEST_DATABASES') {
    throw new Error(
      'Refusing to delete databases without --confirm DELETE_TEST_DATABASES'
    )
  }
}

function resolveOutputPath(outArg) {
  if (!outArg) {
    return null
  }

  return path.isAbsolute(outArg)
    ? outArg
    : path.resolve(backendRoot, '..', outArg)
}

async function writeReport(outputPath, content) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, content, 'utf8')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  ensureDeleteConfirmation(args)

  const mongoUri = args.uri || await readMongoUri()
  const parsedUri = new URL(mongoUri)
  const productionDbName = parsedUri.pathname.replace(/^\//, '')
  const host = parsedUri.host
  const outputFormat = args.format === 'json' ? 'json' : 'text'
  const outputPath = resolveOutputPath(args.out)

  const client = new MongoClient(mongoUri)

  try {
    await client.connect()
    const admin = client.db().admin()
    const databaseList = await admin.listDatabases()
    const rows = buildDatabaseRows(databaseList.databases, { productionDbName })
    const summary = summarizeRows(rows)

    if (args.deleteSafe) {
      for (const row of rows.filter((entry) => entry.category === 'safe_delete')) {
        await client.db(row.name).dropDatabase()
      }
    }

    const payload = {
      host,
      productionDbName,
      mode: args.deleteSafe ? 'delete_safe' : 'list_only',
      connection: maskMongoUri(mongoUri),
      summary,
      rows,
    }

    const output = outputFormat === 'json'
      ? JSON.stringify(payload, null, 2) + '\n'
      : formatTextReport(rows, { host, productionDbName })

    if (outputPath) {
      await writeReport(outputPath, output)
      console.log(`REPORT_WRITTEN ${outputPath}`)
    }

    if (args.deleteSafe) {
      console.log(`DELETED_SAFE_DATABASES=${summary.safe_delete}`)
    }

    process.stdout.write(output)
  } finally {
    await client.close()
  }
}

await main()
