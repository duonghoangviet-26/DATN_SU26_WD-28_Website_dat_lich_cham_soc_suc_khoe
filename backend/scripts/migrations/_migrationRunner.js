import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { fileURLToPath } from 'url'

const currentFile = fileURLToPath(import.meta.url)
const currentDir = path.dirname(currentFile)
const defaultLogPath = path.join(currentDir, 'migration-log.json')
const envPath = path.resolve(currentDir, '../../.env')

dotenv.config({ path: envPath })

function resolveMongoUri() {
  const mongoUri = process.env.MONGODB_URI

  if (!mongoUri) {
    throw new Error('Missing MONGODB_URI for migration command')
  }

  return mongoUri
}

function resolveLogPath() {
  return process.env.MIGRATION_LOG_PATH || defaultLogPath
}

function readMigrationLog(logPath) {
  if (!fs.existsSync(logPath)) {
    return []
  }

  const content = fs.readFileSync(logPath, 'utf8').trim()
  return content ? JSON.parse(content) : []
}

function writeMigrationLog(logPath, entries) {
  fs.writeFileSync(logPath, JSON.stringify(entries, null, 2))
}

export async function runMigration({ name, rollbackable = false, up }) {
  if (!name) {
    throw new Error('Migration name is required')
  }

  if (typeof up !== 'function') {
    throw new Error('Migration up handler is required')
  }

  const startedAt = new Date()
  const mongoUri = resolveMongoUri()
  const logPath = resolveLogPath()

  fs.mkdirSync(path.dirname(logPath), { recursive: true })

  let affectedDocuments = 0
  let status = 'success'
  let errorMessage = null

  try {
    await mongoose.connect(mongoUri)
    const result = await up({ mongoose, connection: mongoose.connection })
    affectedDocuments = Number.isFinite(result) ? result : 0
  } catch (error) {
    status = 'fail'
    errorMessage = error instanceof Error ? error.message : String(error)
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect()
    }

    const entries = readMigrationLog(logPath)
    entries.push({
      name,
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      affected_documents: affectedDocuments,
      status,
      rollbackable,
      error_message: errorMessage,
    })
    writeMigrationLog(logPath, entries)
  }

  if (status === 'fail') {
    throw new Error(`Migration ${name} failed: ${errorMessage}`)
  }

  return {
    name,
    affectedDocuments,
    rollbackable,
    status,
  }
}
