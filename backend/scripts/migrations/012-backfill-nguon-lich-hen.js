import { runMigration } from './_migrationRunner.js'

// ============================================================
// 012 — Backfill `nguon` + hạn mức dời cho lịch hẹn cũ
// Rule: .claude/rules/lich-lam-viec-bac-si.md muc 10.D
// ============================================================
// `nguon` (online | tai_cho) la BAN CHAT nghiep vu cua luot kham, khac `hinh_thuc_dat_lich`
// (kenh tao: patient/receptionist/admin). Muc 4 va 6 deu phan xu theo `nguon`, nen de null
// tren 100% lich hen cu la de he thong doan mo ho.
//
// Suy nguon tu du lieu da co, KHONG doan bua:
//   hinh_thuc_dat_lich='patient'      -> online   (khach tu dat qua app)
//   hinh_thuc_dat_lich='receptionist' -> tai_cho  (le tan tiep nhan tai quay)
//   con lai: co user_id  -> online    (phai dang nhap moi dat duoc)
//            khong user_id -> tai_cho (khach vang lai)

const result = await runMigration({
  name: '012-backfill-nguon-lich-hen',
  rollbackable: true,
  async up({ connection }) {
    const col = connection.collection('lich_hen')
    let affectedDocuments = 0

    const quyTac = [
      { filter: { nguon: { $in: [null, undefined] }, hinh_thuc_dat_lich: 'patient' }, nguon: 'online' },
      { filter: { nguon: { $in: [null, undefined] }, hinh_thuc_dat_lich: 'receptionist' }, nguon: 'tai_cho' },
      { filter: { nguon: { $in: [null, undefined] }, user_id: { $type: 'objectId' } }, nguon: 'online' },
      { filter: { nguon: { $in: [null, undefined] } }, nguon: 'tai_cho' },
    ]

    for (const { filter, nguon } of quyTac) {
      const res = await col.updateMany(filter, { $set: { nguon } })
      affectedDocuments += res.modifiedCount
      if (res.modifiedCount > 0) console.log(`[012] nguon='${nguon}': ${res.modifiedCount} lich hen`)
    }

    // Hạn mức dời của khách: chưa từng đếm nên khởi tạo 0 cho toàn bộ dữ liệu cũ.
    const resDoi = await col.updateMany(
      { so_lan_doi_khach_yeu_cau: { $exists: false } },
      { $set: { so_lan_doi_khach_yeu_cau: 0 } },
    )
    affectedDocuments += resDoi.modifiedCount
    console.log(`[012] so_lan_doi_khach_yeu_cau=0: ${resDoi.modifiedCount} lich hen`)

    return affectedDocuments
  },
})

console.log(JSON.stringify(result))
