import { runMigration } from './_migrationRunner.js'

// ============================================================
// 010 — Khoi phuc cau hinh nang luc kham cho chuyen_khoa
// Rule: .claude/rules/lich-lam-viec-bac-si.md muc 2, 9 (P0), 10.A, 10.D
// ============================================================
// Ba field cau hinh tung duoc them 2026-07-23 roi MAT khi merge `main` (commit ca685dc).
// Hau qua: scheduleGenerator .select() ra undefined -> he thong am tham chay 1 slot/khung,
// 100% online. Nghiep vu 70/30 va nhieu-slot-moi-khung KHONG chay tren du lieu that.
//
// Migration nay CHI dien vao ban ghi con THIEU field ($exists: false) — khong bao gio
// de len gia tri admin da cau hinh.

const MAC_DINH = {
  thoi_gian_kham_trung_binh_phut: 15, // TMH: kham 10-15' -> floor(30/15) = 2 slot/khung
  so_slot_moi_khung: null, // null = tu tinh tu thoi gian kham
  ty_le_online_phan_tram: 70, // quota giu cho online, con lai danh cho khach toi quay
}

// Gia kham: rule muc 12 chot MOT gia duy nhat theo CHUYEN KHOA. Du lieu cu chi co gia o
// tung bac si -> suy ra gia PHO BIEN NHAT trong so bac si thuoc chuyen khoa do (tie-break
// lay gia THAP hon, khong bao gio tu dong nang gia len cho benh nhan). Khong co bac si
// nao co gia -> de 0 va bao cao de admin tu dat.
async function suyRaGiaKham(connection, specialtyId) {
  const doctors = await connection
    .collection('bac_si')
    .find({ specialties: specialtyId })
    .project({ gia_kham: 1, phi_kham: 1 })
    .toArray()

  const dem = new Map()
  for (const doctor of doctors) {
    const gia = Number(doctor.phi_kham ?? doctor.gia_kham)
    if (!Number.isFinite(gia) || gia <= 0) continue
    dem.set(gia, (dem.get(gia) ?? 0) + 1)
  }
  if (dem.size === 0) return { gia: 0, canhBao: true }

  const [giaChot] = [...dem.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]
  return { gia: giaChot, canhBao: false }
}

const result = await runMigration({
  name: '010-backfill-chuyen-khoa-slot-config',
  rollbackable: true,
  async up({ connection }) {
    const collection = connection.collection('chuyen_khoa')
    let affectedDocuments = 0

    for (const [truong, giaTri] of Object.entries(MAC_DINH)) {
      const res = await collection.updateMany(
        { [truong]: { $exists: false } },
        { $set: { [truong]: giaTri } }
      )
      affectedDocuments += res.modifiedCount
    }

    const thieuGia = await collection
      .find({ $or: [{ gia_kham: { $exists: false } }, { gia_kham: 0 }, { gia_kham: null }] })
      .project({ _id: 1, ten: 1 })
      .toArray()

    const cauCanhBao = []
    for (const specialty of thieuGia) {
      const { gia, canhBao } = await suyRaGiaKham(connection, specialty._id)
      const res = await collection.updateOne({ _id: specialty._id }, { $set: { gia_kham: gia } })
      affectedDocuments += res.modifiedCount
      if (canhBao) {
        cauCanhBao.push(`  ⚠ "${specialty.ten}": khong suy ra duoc gia kham -> dat 0, admin phai tu cau hinh`)
      } else {
        cauCanhBao.push(`  ✓ "${specialty.ten}": gia_kham = ${gia.toLocaleString('vi-VN')}d (suy tu bac si)`)
      }
    }

    if (cauCanhBao.length > 0) {
      console.log('[010] Gia kham theo chuyen khoa:')
      console.log(cauCanhBao.join('\n'))
    }

    return affectedDocuments
  },
})

console.log(JSON.stringify(result))
