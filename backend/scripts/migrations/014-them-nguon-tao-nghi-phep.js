import { runMigration } from './_migrationRunner.js'

// ============================================================
// 014 — Backfill `nguoi_tao_id` + `nguon_tao` cho đơn nghỉ phép, và unique index chống trùng
// Thiết kế: docs/superpowers/specs/2026-08-03-luong-bac-si-nghi-design.md muc 4.2
// ============================================================
// Truoc day khong luu AI TAO don, chi luu ai DUYET. Suy tu `trang_thai` chi dung luc moi tao:
// khi le tan duyet don cua bac si thi ca hai loai deu thanh `da_duyet` voi nguoi_duyet_id =
// le tan -> mat dau vet. UI moi can phan biet "Bac si xin nghi" vs "Le tan ghi nhan".
//
// Suy nguon_tao tu du lieu da co, KHONG doan bua:
//   `reportDoctorUnavailable` (le tan) tao don voi trang_thai='da_duyet' + thoi_diem_duyet
//   ngay tai thoi diem tao => trang_thai='da_duyet' VA thoi_diem_duyet ~ ngay_tao.
//   `createLeaveRequest` (bac si) tao voi trang_thai='cho_duyet', thoi_diem_duyet=null.
//
// BAT BUOC co dieu kien trang_thai='da_duyet': tren DB that co 2 don `tu_choi` cua seed script
// cung co thoi_diem_duyet == ngay_tao. Chung la don BAC SI gui roi bi tu choi — neu chi xet
// khoang cach thoi gian se gan nham thanh 'le_tan_ghi_nhan'. Le tan khong bao gio tao ra don
// `tu_choi` (luong bao nghi dot xuat duyet thang).
//
// Nguong 5 giay: du rong de bao ham do tre cua transaction, du hep de khong nham voi don
// bac si gui roi duoc duyet sau.
//
// Kiem chung tren DB that 2026-08-03: 0 don `da_duyet` nao co thoi_diem_duyet cach xa
// ngay_tao — tuc CHUA TUNG co don bac si nao duoc duyet, dung nhu lo hong G2 mo ta.

const NGUONG_CHENH_MS = 5000

const result = await runMigration({
  name: '014-them-nguon-tao-nghi-phep',
  rollbackable: true,
  async up({ connection }) {
    const col = connection.collection('nghi_phep_bac_si')
    const bacSiCol = connection.collection('bac_si')
    let affectedDocuments = 0

    const donCu = await col.find({ nguon_tao: { $exists: false } }).toArray()
    console.log(`[014] Tim thay ${donCu.length} don chua co nguon_tao`)

    // user_id cua tung bac si — de gan nguoi_tao_id cho don do chinh bac si gui.
    const bacSiList = await bacSiCol.find({}, { projection: { _id: 1, user_id: 1 } }).toArray()
    const userIdCuaBacSi = new Map(bacSiList.map((b) => [String(b._id), b.user_id ?? null]))

    let demLeTan = 0
    let demBacSi = 0

    for (const don of donCu) {
      const leTanGhiNhan = don.trang_thai === 'da_duyet'
        && don.thoi_diem_duyet && don.ngay_tao
        && Math.abs(new Date(don.thoi_diem_duyet) - new Date(don.ngay_tao)) <= NGUONG_CHENH_MS

      const nguonTao = leTanGhiNhan ? 'le_tan_ghi_nhan' : 'bac_si_tu_gui'
      const nguoiTaoId = leTanGhiNhan
        ? (don.nguoi_duyet_id ?? null)
        : (userIdCuaBacSi.get(String(don.bac_si_id)) ?? null)

      await col.updateOne(
        { _id: don._id },
        { $set: { nguon_tao: nguonTao, nguoi_tao_id: nguoiTaoId } },
      )
      affectedDocuments += 1
      if (nguonTao === 'le_tan_ghi_nhan') demLeTan += 1
      else demBacSi += 1
    }

    console.log(`[014] nguon_tao='le_tan_ghi_nhan': ${demLeTan} don`)
    console.log(`[014] nguon_tao='bac_si_tu_gui':  ${demBacSi} don`)

    // ── Unique partial index chong 2 le tan tao trung don ───────────────────
    // Phai DEDUPE truoc, khong thi build index that bai — cung cach da lam voi
    // uniq_lich_hen_theo_slot.
    const trung = await col.aggregate([
      { $match: { trang_thai: { $in: ['cho_duyet', 'da_duyet'] } } },
      {
        $group: {
          _id: {
            bac_si_id: '$bac_si_id',
            tu_ngay: '$tu_ngay',
            den_ngay: '$den_ngay',
            gio_bat_dau: '$gio_bat_dau',
          },
          ids: { $push: '$_id' },
          n: { $sum: 1 },
        },
      },
      { $match: { n: { $gt: 1 } } },
    ]).toArray()

    if (trung.length > 0) {
      console.log(`[014] ⚠️  Phat hien ${trung.length} nhom don TRUNG — huy don thua (giu don cu nhat)`)
      for (const nhom of trung) {
        // Giu ban ghi dau tien (ObjectId tang dan = tao truoc), huy phan con lai.
        const [giuLai, ...thua] = nhom.ids
        console.log(`[014]   giu ${giuLai}, huy ${thua.length} don thua`)
        const res = await col.updateMany(
          { _id: { $in: thua } },
          {
            $set: {
              trang_thai: 'da_huy',
              ghi_chu: 'Tu dong huy boi migration 014 — don trung lap (cung bac si, cung ngay, cung khung gio)',
            },
          },
        )
        affectedDocuments += res.modifiedCount
      }
    } else {
      console.log('[014] Khong co don trung — index build duoc ngay')
    }

    await col.createIndex(
      { bac_si_id: 1, tu_ngay: 1, den_ngay: 1, gio_bat_dau: 1 },
      {
        unique: true,
        name: 'uniq_don_nghi_dang_hieu_luc',
        partialFilterExpression: { trang_thai: { $in: ['cho_duyet', 'da_duyet'] } },
      },
    )
    console.log('[014] ✅ Da tao index uniq_don_nghi_dang_hieu_luc')

    return affectedDocuments
  },
})

console.log(JSON.stringify(result))
