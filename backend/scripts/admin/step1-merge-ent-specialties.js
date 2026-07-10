import fs from 'fs'
import mongoose from 'mongoose'

import BacSi from '../../src/models/BacSi.js'
import ChuyenKhoa from '../../src/models/ChuyenKhoa.js'
import DichVu from '../../src/models/DichVu.js'
import HoaDon from '../../src/models/HoaDon.js'
import LichHen from '../../src/models/LichHen.js'
import LichLamViec from '../../src/models/LichLamViec.js'

function readMongoUri() {
  const envText = fs.readFileSync(new URL('../../.env', import.meta.url), 'utf8')
  const mongoLine = envText.split(/\r?\n/).find((line) => line.startsWith('MONGODB_URI='))
  if (!mongoLine) {
    throw new Error('Missing MONGODB_URI in backend/.env')
  }
  return mongoLine.slice('MONGODB_URI='.length)
}

function byExactName(name) {
  return new RegExp(`^${name}$`, 'i')
}

async function main() {
  await mongoose.connect(readMongoUri())

  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const tai = await ChuyenKhoa.findOne({ ten: byExactName('Tai') }).session(session)
    const mui = await ChuyenKhoa.findOne({ ten: byExactName('Mui') }).session(session)
    const hong = await ChuyenKhoa.findOne({ ten: byExactName('Hong') }).session(session)

    if (!tai || !mui || !hong) {
      throw new Error('Khong tim du 3 chuyen khoa Tai/Mui/Hong de gop')
    }

    const duplicateEntDocs = await ChuyenKhoa.find({
      _id: { $nin: [tai._id, mui._id, hong._id] },
      $or: [
        { ten: /tai mui hong/i },
        { slug: /^tai-mui-hong/i },
      ],
    }).session(session)

    const root = tai
    const mergedDocs = [mui, hong, ...duplicateEntDocs]
    const mergedIds = mergedDocs.map((item) => item._id)

    root.ten = 'Tai Mũi Họng'
    root.slug = 'tai-mui-hong'
    root.status = 'active'
    await root.save({ session })

    await Promise.all([
      LichHen.updateMany(
        { specialty_id: { $in: mergedIds } },
        { $set: { specialty_id: root._id } },
        { session }
      ),
      DichVu.updateMany(
        { specialty_id: { $in: mergedIds } },
        { $set: { specialty_id: root._id } },
        { session }
      ),
      HoaDon.updateMany(
        { specialty_id: { $in: mergedIds } },
        { $set: { specialty_id: root._id } },
        { session }
      ),
      BacSi.updateMany(
        { specialties: { $in: mergedIds } },
        [
          {
            $set: {
              specialties: {
                $setUnion: [
                  {
                    $map: {
                      input: '$specialties',
                      as: 'specialtyId',
                      in: {
                        $cond: [
                          { $in: ['$$specialtyId', mergedIds] },
                          root._id,
                          '$$specialtyId',
                        ],
                      },
                    },
                  },
                  [],
                ],
              },
            },
          },
        ],
        { session }
      ),
      LichLamViec.updateMany(
        { 'slots.specialty_id': { $in: mergedIds } },
        [
          {
            $set: {
              slots: {
                $map: {
                  input: '$slots',
                  as: 'slot',
                  in: {
                    $mergeObjects: [
                      '$$slot',
                      {
                        specialty_id: {
                          $cond: [
                            { $in: ['$$slot.specialty_id', mergedIds] },
                            root._id,
                            '$$slot.specialty_id',
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        ],
        { session }
      ),
    ])

    if (mergedDocs.length > 0) {
      await ChuyenKhoa.updateMany(
        { _id: { $in: mergedIds } },
        { $set: { status: 'hidden' } },
        { session }
      )
    }

    await session.commitTransaction()
    console.log(JSON.stringify({
      rootId: String(root._id),
      hiddenIds: mergedIds.map((id) => String(id)),
      hiddenCount: mergedIds.length,
    }, null, 2))
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
    await mongoose.disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
