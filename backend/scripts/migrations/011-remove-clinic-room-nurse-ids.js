import { runMigration } from './_migrationRunner.js'

const result = await runMigration({
  name: '011-remove-clinic-room-nurse-ids',
  rollbackable: false,
  async up({ connection }) {
    const result = await connection.collection('phong_kham').updateMany(
      { nurse_ids: { $exists: true } },
      { $unset: { nurse_ids: '' } }
    )

    return result.modifiedCount
  },
})

console.log(JSON.stringify(result))
