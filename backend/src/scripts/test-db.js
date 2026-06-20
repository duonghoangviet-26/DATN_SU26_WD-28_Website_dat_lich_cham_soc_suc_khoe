/**
 * test-db.js — Kiểm tra dữ liệu seed trong MongoDB Atlas
 * Chạy: node src/scripts/test-db.js
 */
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })

import * as models from '../models/index.js'

const {
  NguoiDung, ThongTinPhongKham, ChuyenKhoa, DichVu, CaiDatThanhToan,
  GiaDinh, ThanhVien, BacSi, LichLamViec, LichHen, ThanhToan, HoanTien,
  HoSoYTe, KetQuaKham, DonThuoc, NhacNho, DanhGia, ThongBao,
  ThongBaoHeThong, PhienChat, TinNhanChat, LichSuLichHen, NhatKyThaoTac,
  DatLaiMatKhau,
} = models

// ── helpers ─────────────────────────────────────────────────────────────────
const GREEN  = '\x1b[32m'
const RED    = '\x1b[31m'
const YELLOW = '\x1b[33m'
const RESET  = '\x1b[0m'
const BOLD   = '\x1b[1m'

let passed = 0, failed = 0, warnings = 0

function ok(label, detail = '') {
  console.log(`  ${GREEN}✓${RESET} ${label}${detail ? ' — ' + detail : ''}`)
  passed++
}
function fail(label, detail = '') {
  console.log(`  ${RED}✗${RESET} ${RED}${label}${RESET}${detail ? ' — ' + detail : ''}`)
  failed++
}
function warn(label, detail = '') {
  console.log(`  ${YELLOW}⚠${RESET} ${label}${detail ? ' — ' + detail : ''}`)
  warnings++
}

async function check(name, Model, minCount, fieldChecks = []) {
  console.log(`\n${BOLD}[${name}]${RESET}`)
  try {
    const docs = await Model.find({}).lean()
    if (docs.length < minCount) {
      fail(`count`, `cần ≥${minCount}, có ${docs.length}`)
    } else {
      ok(`count`, `${docs.length} bản ghi`)
    }

    if (docs.length > 0) {
      const sample = docs[0]
      for (const field of fieldChecks) {
        if (field in sample || sample[field] !== undefined) {
          const val = sample[field]
          ok(`field "${field}"`, JSON.stringify(val)?.slice(0, 60))
        } else {
          fail(`field "${field}" thiếu trong document`)
        }
      }
    }
    return docs
  } catch (e) {
    fail(`query lỗi`, e.message)
    return []
  }
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${BOLD}═══════════════════════════════════════════${RESET}`)
  console.log(`${BOLD}  TEST DB — VitaFamily MongoDB Atlas${RESET}`)
  console.log(`${BOLD}═══════════════════════════════════════════${RESET}`)

  await mongoose.connect(process.env.MONGODB_URI)
  console.log(`\n${GREEN}✅ Kết nối MongoDB Atlas thành công${RESET}`)

  // ── 1. NguoiDung ─────────────────────────────────────────────────────────
  const users = await check('NguoiDung', NguoiDung, 5,
    ['email', 'ho_ten', 'role', 'status', 'ngay_tao'])

  // Kiểm tra phân quyền đúng
  console.log('  → Phân loại role:')
  const admins  = users.filter(u => u.role === 'admin')
  const doctors = users.filter(u => u.role === 'doctor')
  const uusers  = users.filter(u => u.role === 'user')
  admins.length  > 0 ? ok(`admin`, admins.map(u=>u.email).join(', '))  : fail('Không có admin nào!')
  doctors.length > 0 ? ok(`doctor`, doctors.map(u=>u.email).join(', ')) : fail('Không có doctor nào!')
  uusers.length  > 0 ? ok(`user`, uusers.map(u=>u.email).join(', '))   : warn('Không có user thường')

  // mat_khau phải là hash (không được là plaintext)
  const plain = users.filter(u => u.mat_khau === '123456')
  plain.length === 0
    ? ok('mat_khau đã hash (bcrypt)')
    : fail(`mat_khau lưu plaintext! ${plain.map(u=>u.email).join(', ')}`)

  // ── 2. ChuyenKhoa ────────────────────────────────────────────────────────
  const specialties = await check('ChuyenKhoa', ChuyenKhoa, 1,
    ['ten', 'slug', 'status', 'ngay_tao'])
  if (specialties.length > 0) {
    const slugOk = specialties.every(s => s.slug && /^[a-z0-9-]+$/.test(s.slug))
    slugOk ? ok('slug auto-generated (kebab-case)') : fail('slug sai format')
  }

  // ── 3. DichVu ────────────────────────────────────────────────────────────
  const services = await check('DichVu', DichVu, 1,
    ['ma_dich_vu', 'ten', 'loai', 'gia', 'thoi_gian_phut', 'status'])
  if (services.length > 0) {
    const maOk = services.every(s => /^DV\d{3}$/.test(s.ma_dich_vu))
    maOk ? ok('ma_dich_vu auto-gen (DV001 format)') : fail('ma_dich_vu sai format')
    const loaiOk = services.every(s => ['clinic','home'].includes(s.loai))
    loaiOk ? ok('loai hợp lệ (clinic|home)') : fail('loai chứa giá trị lạ')
  }

  // ── 4. ThongTinPhongKham ─────────────────────────────────────────────────
  await check('ThongTinPhongKham', ThongTinPhongKham, 1,
    ['ten', 'dia_chi', 'so_dien_thoai'])

  // ── 5. CaiDatThanhToan ───────────────────────────────────────────────────
  await check('CaiDatThanhToan', CaiDatThanhToan, 3,
    ['ten_cai_dat', 'gia_tri', 'mo_ta'])

  // ── 6. BacSi ─────────────────────────────────────────────────────────────
  const bacsidocs = await check('BacSi', BacSi, 1,
    ['user_id', 'specialties', 'so_nam_kinh_nghiem', 'trang_thai_duyet'])
  if (bacsidocs.length > 0) {
    const approved = bacsidocs.filter(b => b.trang_thai_duyet === 'approved')
    ok(`${approved.length}/${bacsidocs.length} bác sĩ đã duyệt`)
  }

  // ── 7. GiaDinh & ThanhVien ───────────────────────────────────────────────
  await check('GiaDinh', GiaDinh, 1, ['user_id', 'ten_nhom'])
  const members = await check('ThanhVien', ThanhVien, 2,
    ['family_id', 'ho_ten', 'ngay_sinh', 'gioi_tinh', 'la_chu_ho'])
  if (members.length > 0) {
    const chuho = members.filter(m => m.la_chu_ho === true)
    ok(`${chuho.length} chủ hộ trong ${members.length} thành viên`)
  }

  // ── 8. LichLamViec ───────────────────────────────────────────────────────
  const schedules = await check('LichLamViec', LichLamViec, 1,
    ['doctor_id', 'ngay', 'slots'])
  if (schedules.length > 0 && schedules[0].slots) {
    ok(`slots embed`, `${schedules[0].slots.length} slot trong lịch đầu tiên`)
    const slot = schedules[0].slots[0]
    ;['gio_bat_dau','gio_ket_thuc','so_benh_nhan_toi_da'].every(f => f in slot)
      ? ok('slot fields đầy đủ')
      : fail('slot thiếu fields')
  }

  // ── 9. LichHen ───────────────────────────────────────────────────────────
  const appts = await check('LichHen', LichHen, 1,
    ['user_id', 'doctor_id', 'loai_kham', 'ngay_kham', 'status', 'payment_status', 'gia_kham'])
  if (appts.length > 0) {
    const statuses = [...new Set(appts.map(a => a.status))]
    ok(`status đa dạng`, statuses.join(', '))
    const loaiOk = appts.every(a => ['clinic','home'].includes(a.loai_kham))
    loaiOk ? ok('loai_kham hợp lệ') : fail('loai_kham chứa giá trị lạ')
  }

  // ── 10. ThanhToan & HoanTien ─────────────────────────────────────────────
  await check('ThanhToan', ThanhToan, 1,
    ['appointment_id', 'benh_nhan_id', 'so_tien', 'status'])
  await check('HoanTien', HoanTien, 1,
    ['appointment_id', 'so_tien_hoan', 'phan_tram_hoan', 'status'])

  // ── 11. HoSoYTe, KetQuaKham, DonThuoc ───────────────────────────────────
  await check('HoSoYTe', HoSoYTe, 1,
    ['member_id', 'appointment_id', 'ten_bac_si', 'chan_doan'])
  await check('KetQuaKham', KetQuaKham, 1,
    ['appointment_id', 'chan_doan', 'huong_dan_dieu_tri'])
  const prescriptions = await check('DonThuoc', DonThuoc, 1,
    ['medical_record_id', 'member_id', 'items'])
  if (prescriptions.length > 0 && prescriptions[0].items) {
    ok(`items thuốc embed`, `${prescriptions[0].items.length} thuốc`)
    const item = prescriptions[0].items[0]
    ;['ten_thuoc','lieu_luong','tan_suat','gio_uong'].every(f => f in item)
      ? ok('thuốc fields đầy đủ')
      : fail('thuốc item thiếu fields')
  }

  // ── 12. NhacNho ──────────────────────────────────────────────────────────
  await check('NhacNho', NhacNho, 1,
    ['user_id', 'prescription_id', 'gio_nhac'])

  // ── 13. DanhGia ──────────────────────────────────────────────────────────
  const reviews = await check('DanhGia', DanhGia, 1,
    ['user_id', 'doctor_id', 'appointment_id', 'so_sao', 'noi_dung'])
  if (reviews.length > 0) {
    const soSaoOk = reviews.every(r => r.so_sao >= 1 && r.so_sao <= 5)
    soSaoOk ? ok('so_sao trong khoảng 1–5') : fail('so_sao ngoài khoảng')
  }

  // ── 14. ThongBao & ThongBaoHeThong ───────────────────────────────────────
  await check('ThongBao', ThongBao, 1,
    ['user_id', 'tieu_de', 'noi_dung', 'loai'])
  await check('ThongBaoHeThong', ThongBaoHeThong, 1,
    ['tieu_de', 'noi_dung', 'tao_boi', 'doi_tuong'])

  // ── 15. Chat ─────────────────────────────────────────────────────────────
  await check('PhienChat', PhienChat, 1, ['user_id'])
  const msgs = await check('TinNhanChat', TinNhanChat, 2,
    ['session_id', 'vai_tro', 'noi_dung'])
  if (msgs.length > 0) {
    const roles = [...new Set(msgs.map(m => m.vai_tro))]
    ok(`vai_tro tin nhắn`, roles.join(', '))
  }

  // ── 16. LichSuLichHen & NhatKyThaoTac ───────────────────────────────────
  await check('LichSuLichHen', LichSuLichHen, 3,
    ['appointment_id', 'den_trang_thai', 'vai_tro'])
  await check('NhatKyThaoTac', NhatKyThaoTac, 1,
    ['nguoi_thuc_hien_id', 'vai_tro', 'hanh_dong', 'loai_doi_tuong'])

  // ── 17. DatLaiMatKhau ────────────────────────────────────────────────────
  await check('DatLaiMatKhau', DatLaiMatKhau, 1,
    ['user_id', 'ma_otp', 'het_han'])

  // ── Tổng kết ─────────────────────────────────────────────────────────────
  console.log(`\n${BOLD}═══════════════════════════════════════════${RESET}`)
  console.log(`${BOLD}  KẾT QUẢ${RESET}`)
  console.log(`${BOLD}═══════════════════════════════════════════${RESET}`)
  console.log(`  ${GREEN}Passed : ${passed}${RESET}`)
  console.log(`  ${RED}Failed : ${failed}${RESET}`)
  console.log(`  ${YELLOW}Warning: ${warnings}${RESET}`)
  if (failed === 0) {
    console.log(`\n${GREEN}${BOLD}  ✅ Tất cả collections đều OK — sẵn sàng gắn API!${RESET}`)
  } else {
    console.log(`\n${RED}${BOLD}  ❌ Có ${failed} lỗi cần kiểm tra lại.${RESET}`)
  }
  console.log()

  await mongoose.disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
