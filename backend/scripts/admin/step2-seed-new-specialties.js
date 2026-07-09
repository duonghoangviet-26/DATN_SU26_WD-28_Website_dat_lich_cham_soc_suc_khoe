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

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function main() {
  await mongoose.connect(readMongoUri())

  const rootEnt = await ChuyenKhoa.findOne({ slug: 'tai-mui-hong', status: 'active' })
  if (!rootEnt) {
    throw new Error('Khong tim thay chuyen khoa Tai Mui Hong active de lay clinic goc')
  }

  const seeds = [
    { ten: 'Nhi khoa', mo_ta: 'Khám và theo dõi sức khỏe trẻ em', thu_tu: 2 },
    { ten: 'Da liễu', mo_ta: 'Khám và theo dõi da liễu cơ bản', thu_tu: 3 },
  ]

  const created = []

  for (const seed of seeds) {
    const existing = await ChuyenKhoa.findOne({ slug: slugify(seed.ten), phong_kham_id: rootEnt.phong_kham_id })
    if (existing) {
      existing.ten = seed.ten
      existing.mo_ta = seed.mo_ta
      existing.thu_tu = seed.thu_tu
      existing.status = 'active'
      await existing.save()
      created.push({ _id: String(existing._id), ten: existing.ten, reused: true })
      continue
    }

    const specialty = await ChuyenKhoa.create({
      phong_kham_id: rootEnt.phong_kham_id,
      ten: seed.ten,
      mo_ta: seed.mo_ta,
      slug: slugify(seed.ten),
      thu_tu: seed.thu_tu,
      status: 'active',
    })
    created.push({ _id: String(specialty._id), ten: specialty.ten, reused: false })
  }

  console.log(JSON.stringify(created, null, 2))
  await mongoose.disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
