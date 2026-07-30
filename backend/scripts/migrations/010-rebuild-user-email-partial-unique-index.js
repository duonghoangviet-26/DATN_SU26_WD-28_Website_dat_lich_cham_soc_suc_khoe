import { runMigration } from './_migrationRunner.js'

function isEmailIndex(index) {
  return index?.key && Object.keys(index.key).length === 1 && index.key.email === 1
}

const result = await runMigration({
  name: '010-rebuild-user-email-partial-unique-index',
  rollbackable: false,
  async up({ connection }) {
    const users = connection.collection('nguoi_dung')

    const duplicates = await users.aggregate([
      { $match: { ngay_xoa: null } },
      { $group: { _id: '$email', count: { $sum: 1 } } },
      { $match: { _id: { $ne: null }, count: { $gt: 1 } } },
      { $limit: 1 },
    ]).toArray()

    if (duplicates.length > 0) {
      throw new Error(`Cannot create unique email index because active email is duplicated: ${duplicates[0]._id}`)
    }

    const indexes = await users.indexes()
    for (const index of indexes) {
      if (isEmailIndex(index)) {
        await users.dropIndex(index.name)
      }
    }

    await users.createIndex(
      { email: 1 },
      {
        name: 'email_active_unique',
        unique: true,
        partialFilterExpression: { ngay_xoa: null },
      }
    )

    return 1
  },
})

console.log(JSON.stringify(result))
