import { runMigration } from './_migrationRunner.js'

// ============================================================
// 011 — Seed mau dang ky ca cho bac si dang hoat dong
// Rule: .claude/rules/lich-lam-viec-bac-si.md muc 3 + 10.B
// ============================================================
// Tu 2026-07-26 `scheduleGenerator` KHONG con auto full-day: no doc `mau_lich_lam_viec`
// de biet bac si truc ca nao. Neu khong seed truoc, moi bac si hien co se thanh "chua
// dang ky ca nao" -> he thong ngung sinh lich moi.
//
// Migration nay seed dung HANH VI CU (ca 7 thu, ca sang + ca chieu, phong mac dinh cua
// bac si) de khong ai bi mat lich. Admin trim lai sau tren giao dien.
//
// AN TOAN:
//   - Bo qua bac si da co mau (khong ghi de cau hinh admin da dat).
//   - Bo qua bac si khong map duoc `phong_kham_mac_dinh` sang `phong_kham._id`
//     va BAO CAO — mau bat buoc co phong.
//   - Chan xung dot "1 phong = 1 bac si / ca" ngay trong lan seed.

const CAC_THU = [0, 1, 2, 3, 4, 5, 6]
const CAC_CA = ['sang', 'chieu']

function tenPhongDayDu(room) {
  return `${room.ten}, Tầng ${room.tang}, Tòa ${room.toa}`
}

const result = await runMigration({
  name: '011-seed-mau-lich-lam-viec',
  rollbackable: true,
  async up({ connection }) {
    const mauCol = connection.collection('mau_lich_lam_viec')
    const rooms = await connection.collection('phong_kham').find({}).toArray()
    const phongTheoTen = new Map(rooms.map((r) => [tenPhongDayDu(r), r._id]))

    const doctors = await connection.collection('bac_si').find({
      trang_thai_duyet: 'approved',
      trang_thai: 'active',
      la_hien: true,
    }).toArray()

    const hieuLucTu = new Date()
    hieuLucTu.setUTCHours(0, 0, 0, 0)

    // Theo doi (thu, ca) -> phong da bi chiem, de khong seed ra du lieu vi pham ngay.
    const phongDaChiem = new Map()
    for (const m of await mauCol.find({ trang_thai: 'active' }).toArray()) {
      phongDaChiem.set(`${m.thu_trong_tuan}|${m.ca}|${m.phong_id}`, m.bac_si_id)
    }

    const canhBao = []
    const banGhi = []
    let boQuaDaCoMau = 0

    for (const doctor of doctors) {
      const daCo = await mauCol.countDocuments({ bac_si_id: doctor._id })
      if (daCo > 0) { boQuaDaCoMau += 1; continue }

      const phongId = phongTheoTen.get(doctor.phong_kham_mac_dinh)
      if (!phongId) {
        canhBao.push(`  ⚠ bac si ${doctor._id}: phong_kham_mac_dinh="${doctor.phong_kham_mac_dinh}" khong map duoc -> BO QUA, admin phai xep phong`)
        continue
      }

      let xungDot = false
      for (const thu of CAC_THU) {
        for (const ca of CAC_CA) {
          const khoa = `${thu}|${ca}|${phongId}`
          if (phongDaChiem.has(khoa)) {
            canhBao.push(`  ⚠ bac si ${doctor._id}: phong da bi bac si ${phongDaChiem.get(khoa)} chiem o thu ${thu} ca ${ca} -> BO QUA ca bac si nay`)
            xungDot = true
            break
          }
        }
        if (xungDot) break
      }
      if (xungDot) continue

      for (const thu of CAC_THU) {
        for (const ca of CAC_CA) {
          phongDaChiem.set(`${thu}|${ca}|${phongId}`, doctor._id)
          banGhi.push({
            bac_si_id: doctor._id,
            thu_trong_tuan: thu,
            ca,
            phong_id: phongId,
            chuyen_khoa_id: doctor.specialties?.[0] ?? null,
            trang_thai: 'active',
            hieu_luc_tu: hieuLucTu,
            hieu_luc_den: null,
            ghi_chu: 'Seed tu hanh vi cu (auto full-day) — admin trim lai theo lich truc that',
            ngay_tao: new Date(),
            ngay_cap_nhat: new Date(),
          })
        }
      }
    }

    if (banGhi.length > 0) await mauCol.insertMany(banGhi)

    console.log(`[011] Bac si dang hoat dong : ${doctors.length}`)
    console.log(`[011] Da co mau (bo qua)    : ${boQuaDaCoMau}`)
    console.log(`[011] Mau da tao            : ${banGhi.length} (${banGhi.length / 14} bac si x 7 thu x 2 ca)`)
    if (canhBao.length > 0) {
      console.log('[011] Canh bao:')
      console.log(canhBao.join('\n'))
    }

    return banGhi.length
  },
})

console.log(JSON.stringify(result))
