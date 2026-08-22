import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { HoaDon, LichHen, HangDoi, KetQuaKham, ThanhToan } from '../models/index.js'

// ============================================================
// SCRIPT CHỈ ĐỌC (READ-ONLY) — Debug: hóa đơn "đã thanh toán đủ" nhưng
// lễ tân CHƯA xác nhận thu ngân (da_xac_nhan_thu_ngan=false).
// Chạy: node src/scripts/inspect-cashier-confirmation-gap.js
// KHÔNG update/delete/create. KHÔNG in MONGODB_URI/mat_khau/token.
// ============================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })

const uri = process.env.MONGODB_URI
if (!uri) { console.error('Thieu MONGODB_URI'); process.exit(1) }

function line(t) { console.log('\n' + '='.repeat(78) + '\n' + t + '\n' + '='.repeat(78)) }

async function main() {
  await mongoose.connect(uri)
  console.log(`DB: ${mongoose.connection.db.databaseName}`)

  line('1. Hoa don da_thanh_toan_du nhung CHUA xac nhan thu ngan')
  const stuck = await HoaDon.find({
    trang_thai_hoa_don: 'da_thanh_toan_du',
    da_xac_nhan_thu_ngan: { $ne: true },
  }).sort({ ngay_cap_nhat: -1 }).limit(30).lean()
  console.log(`Tong so: ${await HoaDon.countDocuments({ trang_thai_hoa_don: 'da_thanh_toan_du', da_xac_nhan_thu_ngan: { $ne: true } })}`)

  for (const inv of stuck) {
    const source = inv.appointment_id ? 'online' : inv.hang_doi_id ? 'offline' : 'khong-ro'
    console.log(`\n--- HoaDon ${inv._id} (${inv.so_hoa_don}) nguon=${source} tong=${inv.tong_thanh_toan} ---`)
    console.log(`  ngay_tao=${inv.ngay_tao ?? inv.createdAt} ngay_cap_nhat=${inv.ngay_cap_nhat ?? inv.updatedAt}`)

    const payments = await ThanhToan.find({ hoa_don_id: inv._id }).select('status so_tien loai_thanh_toan phuong_thuc ngay_thanh_toan').lean()
    console.log(`  ThanhToan (${payments.length}):`, payments.map(p => `${p.status}/${p.loai_thanh_toan}/${p.so_tien}d`).join(', ') || '(khong co)')

    if (inv.appointment_id) {
      const appt = await LichHen.findById(inv.appointment_id).select('status payment_status gia_kham ngay_kham ten_khach').lean()
      console.log(`  LichHen: status=${appt?.status} payment_status=${appt?.payment_status} gia_kham=${appt?.gia_kham} ngay_kham=${appt?.ngay_kham?.toISOString?.().slice(0,10)}`)
      const hoSo = await KetQuaKham.findOne({ appointment_id: inv.appointment_id }).select('status dich_vu_phat_sinh').lean()
      console.log(`  KetQuaKham: status=${hoSo?.status ?? '(chua co)'} so_dich_vu_phat_sinh=${hoSo?.dich_vu_phat_sinh?.length ?? 0}`)
    }
    if (inv.hang_doi_id) {
      const hd = await HangDoi.findById(inv.hang_doi_id).select('trang_thai ten_benh_nhan checkin_time thoi_diem_ket_thuc').lean()
      console.log(`  HangDoi: trang_thai=${hd?.trang_thai} ten=${hd?.ten_benh_nhan} checkin=${hd?.checkin_time?.toISOString?.()} ket_thuc=${hd?.thoi_diem_ket_thuc?.toISOString?.()}`)
    }
  }

  line('2. Hoa don ONLINE co ThanhToan phi_dat_lich paid nhung invoice van chua_thanh_toan')
  const onlineUnpaidInvoices = await HoaDon.find({
    appointment_id: { $ne: null },
    trang_thai_hoa_don: { $ne: 'da_thanh_toan_du' },
  }).limit(500).select('_id appointment_id trang_thai_hoa_don tong_thanh_toan').lean()
  let mismatchCount = 0
  for (const inv of onlineUnpaidInvoices) {
    const prepay = await ThanhToan.findOne({ hoa_don_id: inv._id, loai_thanh_toan: 'phi_dat_lich', status: 'paid' }).lean()
    if (prepay) {
      mismatchCount += 1
      if (mismatchCount <= 15) {
        console.log(`  ⚠️ HoaDon ${inv._id} co phi_dat_lich paid (${prepay.so_tien}d) nhung trang_thai_hoa_don=${inv.trang_thai_hoa_don} (tong=${inv.tong_thanh_toan})`)
      }
    }
  }
  console.log(`Tong so lech: ${mismatchCount} / ${onlineUnpaidInvoices.length} hoa don online chua 'da_thanh_toan_du' da kiem tra`)

  line('3. Doi chieu ThanhToan paid nhung hoa_don_id = null (chua gan hoa don)')
  const orphanPaid = await ThanhToan.find({ status: 'paid', hoa_don_id: null }).select('appointment_id hang_doi_id so_tien loai_thanh_toan ngay_thanh_toan').limit(30).lean()
  console.log(`Tong so: ${await ThanhToan.countDocuments({ status: 'paid', hoa_don_id: null })}`)
  for (const p of orphanPaid) {
    console.log(`  ThanhToan ${p._id} appt=${p.appointment_id ?? '-'} hang_doi=${p.hang_doi_id ?? '-'} ${p.loai_thanh_toan} ${p.so_tien}d`)
  }

  line('4. Ca kham da_xac_nhan (bac si hoan tat) nhung KHONG co HoaDon nao lien ket')
  const confirmedRecords = await KetQuaKham.find({ status: 'da_xac_nhan' }).select('appointment_id hang_doi_id thoi_diem_xac_nhan').sort({ thoi_diem_xac_nhan: -1 }).limit(50).lean()
  let noInvoiceCount = 0
  for (const r of confirmedRecords) {
    const filter = r.appointment_id ? { appointment_id: r.appointment_id } : { hang_doi_id: r.hang_doi_id }
    const inv = await HoaDon.findOne(filter).select('_id').lean()
    if (!inv && !r.appointment_id) {
      // offline: invoice chi duoc tao khi le tan bam lap hoa don — binh thuong neu chua thao tac
      noInvoiceCount += 1
    } else if (!inv && r.appointment_id) {
      // online: invoice PHAI ton tai tu luc dat lich — neu khong co la bat thuong
      console.log(`  ❌ KetQuaKham (appointment_id=${r.appointment_id}) da_xac_nhan nhung KHONG TIM THAY HoaDon nao (bat thuong, invoice online phai tao tu luc dat lich)`)
    }
  }
  console.log(`Offline chua lap hoa don (binh thuong, cho le tan thao tac): ${noInvoiceCount}`)

  await mongoose.disconnect()
  console.log('\nHoan tat - khong co thay doi nao duoc ghi vao database.')
}

main().catch((err) => { console.error('Loi:', err.message); process.exit(1) })
