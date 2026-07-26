import fs from 'fs'
import mongoose from 'mongoose'

import ChuyenKhoa from '../../src/models/ChuyenKhoa.js'

function readMongoUri() {
  const envText = fs.readFileSync(new URL('../../.env', import.meta.url), 'utf8')
  const mongoLine = envText.split(/\r?\n/).find((line) => line.startsWith('MONGODB_URI='))
  if (!mongoLine) {
    throw new Error('Missing MONGODB_URI in backend/.env')
  }
  return mongoLine.slice('MONGODB_URI='.length)
}

async function main() {
  await mongoose.connect(readMongoUri())

  const rootEnt = await ChuyenKhoa.findOne({ slug: 'tai-mui-hong', status: 'active' })
  if (!rootEnt) {
    throw new Error('Khong tim thay chuyen khoa Tai Mui Hong active')
  }

  console.log(JSON.stringify({
    skipped: true,
    reason: 'He thong hien chi giu chuyen khoa Tai Mui Hong; khong seed chuyen khoa khac.',
    rootSpecialty: { _id: String(rootEnt._id), ten: rootEnt.ten, slug: rootEnt.slug },
  }, null, 2))

  await mongoose.disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
