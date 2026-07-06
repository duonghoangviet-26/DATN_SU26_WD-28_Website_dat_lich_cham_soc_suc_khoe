import { MongoClient } from 'mongodb'

import {
  connectMongooseForExpectedDb,
  docFilePath,
  getMongoUri,
  getConnectionMeta,
  printConnectionMeta,
  resetCollectionPlans,
  stateFilePath,
  writeJsonFile,
  writeTextFile,
  EXPECTED_DB_NAME,
  parseArgs,
} from './_shared.js'

function buildCollectionsResetMarkdown(rows) {
  const lines = [
    '# Collections To Reset',
    '',
    '| Collection | So document truoc khi xoa | Co xoa khong | Ly do |',
    '| --- | --- | --- | --- |',
  ]

  for (const row of rows) {
    lines.push(`| ${row.name} | ${row.beforeCount} | ${row.willReset ? 'YES' : 'NO'} | ${row.reason} |`)
  }

  lines.push('')
  return lines.join('\n')
}

async function collectCollectionRows(db) {
  const rows = []

  for (const plan of resetCollectionPlans) {
    const exists = await db.listCollections({ name: plan.name }, { nameOnly: true }).hasNext()
    const beforeCount = exists ? await db.collection(plan.name).countDocuments() : 0
    rows.push({
      name: plan.name,
      reason: plan.reason,
      exists,
      beforeCount,
      willReset: true,
    })
  }

  return rows
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const isDryRun = Boolean(args['dry-run'])
  const isApply = Boolean(args.apply)

  if (!isDryRun && !isApply) {
    throw new Error('Usage: node scripts/demo-seed/02-reset-demo-db.js --dry-run | --apply')
  }

  if (isApply && process.env.CONFIRM_RESET_DATN_VITAFAMILY !== 'YES') {
    console.log('Missing CONFIRM_RESET_DATN_VITAFAMILY=YES. Refuse to reset real database.')
    return
  }

  const mongoUri = getMongoUri()
  const meta = getConnectionMeta(mongoUri)
  printConnectionMeta(meta)

  const client = new MongoClient(mongoUri)
  await client.connect()

  try {
    const db = client.db(meta.databaseName)
    if (db.databaseName !== EXPECTED_DB_NAME) {
      throw new Error(`Refuse to reset database ${db.databaseName}`)
    }

    const rows = await collectCollectionRows(db)
    await writeTextFile(docFilePath('collections-to-reset.md'), buildCollectionsResetMarkdown(rows))

    console.log(`WARNING: day la database that ${EXPECTED_DB_NAME}`)
    for (const row of rows) {
      console.log(`RESET_PLAN | collection=${row.name} | before=${row.beforeCount}`)
    }

    if (isDryRun) {
      console.log('DEMO_DB_RESET_DRY_RUN_DONE')
      return
    }

    const afterRows = []
    for (const row of rows) {
      const result = await db.collection(row.name).deleteMany({})
      const remaining = await db.collection(row.name).countDocuments()
      afterRows.push({
        ...row,
        deletedCount: result.deletedCount,
        afterCount: remaining,
      })
      console.log(`RESET_APPLY | collection=${row.name} | deleted=${result.deletedCount} | remaining=${remaining}`)
    }

    await writeJsonFile(stateFilePath('reset-state.json'), {
      resetAt: new Date().toISOString(),
      databaseName: meta.databaseName,
      host: meta.host,
      nodeEnv: meta.nodeEnv,
      countsBeforeReset: Object.fromEntries(afterRows.map((row) => [row.name, row.beforeCount])),
      countsAfterReset: Object.fromEntries(afterRows.map((row) => [row.name, row.afterCount])),
    })

    console.log('DEMO_DB_RESET_APPLIED')
  } finally {
    await client.close()
  }
}

await main()
