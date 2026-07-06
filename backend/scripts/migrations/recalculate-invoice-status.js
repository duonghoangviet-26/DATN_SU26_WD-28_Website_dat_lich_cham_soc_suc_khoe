import { runMigration } from './_migrationRunner.js'
import { tinhTrangThaiHoaDon } from '../../src/services/hoaDon.service.js'

const result = await runMigration({
  name: 'recalculate-invoice-status',
  rollbackable: true,
  async up({ connection }) {
    const invoices = await connection.collection('hoa_don')
      .find({}, { projection: { _id: 1 } })
      .toArray()

    let affectedDocuments = 0

    for (const invoice of invoices) {
      await tinhTrangThaiHoaDon(invoice._id)
      affectedDocuments += 1
    }

    return affectedDocuments
  },
})

console.log(JSON.stringify(result))
