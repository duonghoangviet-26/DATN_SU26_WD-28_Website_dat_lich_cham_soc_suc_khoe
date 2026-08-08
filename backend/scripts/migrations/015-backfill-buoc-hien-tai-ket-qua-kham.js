import { runMigration } from './_migrationRunner.js'

// ============================================================
// 015 — Backfill `buoc_hien_tai` cho ket_qua_kham cu
// WS-1 — Luong kham 4 buoc
// ============================================================

const result = await runMigration({
  name: '015-backfill-buoc-hien-tai-ket-qua-kham',
  rollbackable: true,
  async up({ connection }) {
    const db = connection

    // Hồ sơ cũ đều được nhập bằng luồng một-form-phẳng và đã xác nhận xong, nên đúng nghĩa là
    // đã ở bước cuối. Để default 'tiep_nhan' sẽ khiến trang khám hiểu nhầm là "đang dở dang"
    // và mở lại bước 1 cho một hồ sơ đã chốt.
    const ketQua = await db.collection('ket_qua_kham').updateMany(
      { buoc_hien_tai: { $exists: false } },
      { $set: { buoc_hien_tai: 'hoan_tat' } },
    )
    console.log(`  Da gan buoc_hien_tai='hoan_tat' cho ${ketQua.modifiedCount} ho so cu`)

    return ketQua.modifiedCount
  },
})

console.log(JSON.stringify(result))
